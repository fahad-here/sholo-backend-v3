const BigNumber = require('bignumber.js')

const { Factory } = require('../strategy')

const { DBConnect, DBSchemas } = require('../../src/api/db')
const {
    BotSchema,
    OrderSchema,
    BotConfigSessionSchema,
    PositionSchema
} = DBSchemas
const { GetPriceTickerKey, Logger, GetWSClass } = require('../../src/utils')

const redis = require('redis')
const { POSITION_SHORT, SELL, BUY } = require('../constants')
const {
    FEES,
    BITMEX_FEE_CUTOFF,
    MAP_WS_PAIR_TO_SYMBOL,
    SHOLO_STRATEGY,
    BTC,
    LIMIT_FEES,
    MARKET_FEES,
    FEE_TYPE_MAKER,
    FEE_TYPE_TAKER
} = require('../../src/constants')
const priceSubscriptionClient = redis.createClient()
const botClient = redis.createClient()
const pubClient = redis.createClient()

class Bot {
    constructor(bot) {
        bot = JSON.parse(bot)
        this._bot = bot
        this._botId = bot._id
        this._userId = bot._userId
        //uses the strategy passed in by the bot if exists
        this._strategy = Factory(
            bot.strategy ? bot.strategy : SHOLO_STRATEGY,
            this.onBuySignal,
            this.onSellSignal,
            this.onLiquidatedSignal,
            this.onPriceRReachedSignal
        )
    }

    async _calculateFees(preOrderBalance) {
        const postOrderBalance = await this._trader.getBalance()
        const difference = this._bot.positionOpen
            ? postOrderBalance.free[BTC] - preOrderBalance.free[BTC]
            : preOrderBalance.free[BTC] - postOrderBalance.free[BTC]
        const feePercent = FEES[this._bot.feeType]
        const leverage = this._bot.leverage
        let fees = 0
        switch (feePercent) {
            case FEE_TYPE_MAKER:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(LIMIT_FEES)
                    .toFixed(8)
                return fees
            case FEE_TYPE_TAKER:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(MARKET_FEES)
                    .toFixed(8)
                return fees
            default:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(MARKET_FEES)
                    .toFixed(8)
                return fees
        }
    }

    async _calculateAmount(currentUsdPrice) {
        let amount = 0
        let margin = 0
        const balance = this._bot.balance
        const leverage = this._bot.leverage
        if (this._bot.positionOpen) {
            const previousOrder = await OrderSchema.findById({
                _id: this._bot._previousOrderId
            })
            amount = new BigNumber(previousOrder.amount).integerValue(
                BigNumber.ROUND_DOWN
            )
        } else {
            const tradeBalanceBtc = new BigNumber(balance)
                .multipliedBy(leverage)
                .toFixed(8)
            const tradeFees = new BigNumber(tradeBalanceBtc)
                .multipliedBy(BITMEX_FEE_CUTOFF)
                .toFixed(8)
            margin = new BigNumber(tradeBalanceBtc).minus(tradeFees).toFixed(8)
            amount = new BigNumber(margin)
                .multipliedBy(currentUsdPrice)
                .multipliedBy(0.96)
                .integerValue(BigNumber.ROUND_DOWN)
        }
        return { amount, margin }
    }

    async onBuySignal(price, timestamp) {
        try {
            if (!this._position) {
                const {
                    _userId,
                    _botConfigId,
                    _botSessionId,
                    exchange,
                    feeType,
                    symbol,
                    leverage,
                    order: botOrder
                } = this._bot
                const { _id, accountType } = this._account
                const side = accountType === POSITION_SHORT ? SELL : BUY
                //calculate fees before placing order
                const preOrderBalance = await this._trader.getBalance()
                const { amount, margin } = this._calculateAmount(price)
                const {
                    liquidation,
                    bankrupt
                } = this._trader.exchange
                    .getExchange()
                    ._calculateLiquidation(amount, price)
                const orderDetails = await this._trader.createMarketOrder(
                    side,
                    amount
                )
                const fees = await this._calculateFees(preOrderBalance)
                const botSession = await BotConfigSessionSchema.findById({
                    _id: _botSessionId
                })
                const order = await new OrderSchema({
                    _userId,
                    _botId: this._botId,
                    _botConfigId,
                    _botSessionId,
                    _accountId: _id,
                    _orderId: orderDetails.id,
                    timestamp: orderDetails.datetime,
                    side,
                    price,
                    amount,
                    cost: margin,
                    status: orderDetails.info.ordStatus,
                    fees,
                    botOrder,
                    totalOrderQuantity: amount,
                    filledQuantity: orderDetails.filled,
                    remainQuantity: orderDetails.remaining,
                    exchange: exchange,
                    type: feeType,
                    symbol: symbol,
                    pair: MAP_WS_PAIR_TO_SYMBOL[symbol],
                    isExit: false,
                    leverage: leverage,
                    orderSequence: botSession.orderSequence
                }).save()
                process.send({
                    command: 'socket',
                    args: {
                        channel: `${this._botId}`,
                        message: {
                            type: 'order',
                            order
                        }
                    }
                })
                this._bot = await BotSchema.findByIdAndUpdate(
                    { _id: this._botId },
                    {
                        $set: {
                            priceP: price,
                            liquidationPrice: liquidation,
                            positionOpen: true,
                            _previousOrderId: order._id
                        }
                    },
                    { new: true }
                )
                process.send({
                    command: 'socket',
                    args: {
                        channel: `${this._bot._id}`,
                        message: {
                            type: 'update',
                            bot: this._bot
                        }
                    }
                })
                const positionData = {
                    _userId,
                    _botId: this._botId,
                    _botConfigId,
                    _botSessionId,
                    _accountId: _id,
                    _buyOrderId: orderDetails.id,
                    isOpen: true,
                    side,
                    entryPrice: price,
                    symbol,
                    pair: MAP_WS_PAIR_TO_SYMBOL[symbol],
                    exchange,
                    leverage,
                    startedAt: timestamp
                }
                if (side === BUY) {
                    this._position = await new PositionSchema(
                        positionData
                    ).save()
                    process.send({
                        command: 'socket',
                        args: {
                            channel: `${this._bot._id}`,
                            message: {
                                type: 'position',
                                position: this._position
                            }
                        }
                    })
                } else {
                    this._position = null
                }
                const updateSequence =
                    side === BUY
                        ? { orderSequence: 1, positionSequence: 1 }
                        : { orderSequence: 1 }
                const session = await BotConfigSessionSchema.findByIdAndUpdate(
                    { _id: _botSessionId },
                    { $inc: updateSequence },
                    { new: true }
                )
                process.send({
                    command: 'socket',
                    args: {
                        channel: `${this._bot._id}`,
                        message: {
                            type: 'session',
                            session
                        }
                    }
                })
                // save this order in db
                // create a position
                // subscribe to ws updates on the position
                // update db on ws updates
                // update bot with new price p value
                // update liquidation price
                // send the updates via sockets to frontend
            }
        } catch (e) {
            Logger.error(`Error on buy signal `, e)
        }
    }

    onSellSignal(price, timestamp) {
        try {
            if (!this._position) Logger.error(`No current position`)
            if (!this._position.isOpen)
                Logger.error('Current position is not open')
            const {
                _userId,
                _botConfigId,
                _botSessionId,
                exchange,
                feeType,
                symbol,
                leverage,
                order: botOrder
            } = this._bot
            const { _id, accountType } = this._account
            const side = accountType === POSITION_SHORT ? SELL : BUY
            //calculate fees before placing order
        } catch (e) {
            Logger.error(`Error on sell signal `, e)
        }
    }

    onLiquidatedSignal() {}

    onPriceRReachedSignal() {}

    async onTickerPriceReceived(price, timestamp) {
        try {
            await this._strategy.run(true, price, timestamp)
        } catch (e) {
            Logger.error(`Error running bot strategy `, e)
        }
    }

    _onOrderChangeEmitter(
        id,
        pair,
        orderId,
        orderStatus,
        totalOrderQuantity,
        filledQuantity,
        remainQuantity
    ) {
        Logger.info('order ', {
            orderId,
            orderStatus,
            totalOrderQuantity,
            filledQuantity,
            remainQuantity
        })
    }

    _onPositionChangeEmitter(
        id,
        pair,
        isOpen,
        margin,
        positionSize,
        liquidationPrice,
        bankruptPrice,
        realisedPnl,
        unrealisedPnl,
        unrealisedPnlPercent
    ) {
        Logger.info('position ', {
            id,
            pair,
            isOpen,
            margin,
            positionSize,
            liquidationPrice,
            bankruptPrice,
            realisedPnl,
            unrealisedPnl,
            unrealisedPnlPercent
        })
    }

    _subscribeToEvents(bot) {
        const exchange = bot.exchange
        const pair = MAP_WS_PAIR_TO_SYMBOL[bot.symbol]
        //this works only for bitmex right now
        this._ws = GetWSClass(exchange, pair, {
            apiKeyID: this._account.apiKey,
            apiKeySecret: this._account.apiSecret,
            testnet: this._account.testNet
        })
        this._ws.setOrderListener(this._onOrderChangeEmitter)
        this._ws.setPositionListener(this._onPositionChangeEmitter)
        this._ws.addOrderTicker()
        this._ws.addPositionTicker()
        priceSubscriptionClient.subscribe(
            GetPriceTickerKey(exchange, pair),
            (err, count) => {
                Logger.info(
                    `Child process ${
                        bot._id
                    } Subscribed to ${count} channel. Listening for updates on the ${GetPriceTickerKey(
                        exchange,
                        pair
                    )} channel. pid: ${process.pid}`
                )
            }
        )
        priceSubscriptionClient.on('message', async (channel, message) => {
            const parsedData = JSON.parse(message)
            //check for changes here
            Logger.info(
                `Data on child process ${bot._id}  bot order: ${bot.order}:  ${message}`
            )
            this.onTickerPriceReceived(parsedData.price, parsedData.timestamp)
            //set trader here, create the buy and sell signals here as well
        })

        botClient.subscribe(bot._id, (err, count) => {
            Logger.info(
                `Child processs ${bot._id} Subscribed to ${bot._id} 
                channel. Listening for updates on the ${bot._id} channel.`
            )
        })

        botClient.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info('Data received on bot channel ' + this._bot._id, parsed)
            if (parsed.disable) {
                this.stopBot()
            }
        })
    }

    publishStopBot() {
        const data = JSON.stringify({ disable: true })
        pubClient.publish(this._botId, data)
    }

    stopBot() {
        BotSchema.findOneAndUpdate(
            {
                _id: this._botId,
                _userId: this._userId
            },
            { $set: { active: false } },
            { new: true }
        )
            .then((bot) => {
                this._bot = bot

                this._ws.setOrderListener(null)
                this._ws.setPositionListener(null)
                this._ws.addOrderTicker()
                this._ws.addPositionTicker()
                this._ws.exit()
                //process.send({command: 'socket', args: {channel: `${bot._id}__update`, message: {bot}}})
                sub.quit()
                botClient.quit()
                pubClient.quit()
                process.exit()
            })
            .catch((err) => {
                Logger.info('Error quitting bot : ' + bot._id)
                Logger.info('Error quitting bot : ', err)
            })
    }

    async connectDB() {
        await DBConnect()
    }

    async _setUpTrader() {
        AccountSchema.findById({ _id: this._bot._accountId })
            .then((account) => {
                this._account = account
                this._trader = new Trade(
                    account.exchange,
                    {
                        apiKey: account.apiKey,
                        secret: account.apiSecret
                    },
                    account.testNet
                )
                this._trader.setLeverage(account.leverage)
                this._trader.setPair(account.symbol)
            })
            .catch((err) => {
                Logger.error(`Error setting up trader, `, err)
            })
    }

    init() {
        const bot = this._bot
        BotSchema.findOneAndUpdate(
            { _id: bot._id, _userId: bot._userId },
            { $set: { active: true } },
            { new: true }
        )
            .then((data) => {
                this._bot = bot
                this._subscribeToEvents(bot)
                process.send({
                    command: 'socket',
                    args: {
                        channel: `${data._id}__update`,
                        message: { bot: data }
                    }
                })
            })
            .catch((err) => {
                Logger.info('Error starting bot : ' + bot._id)
                Logger.info('Error starting bot : ' + err)
                this.stopBot()
            })
    }
}

async function main() {
    Logger.info(`pid ${process.pid}`)
    Logger.info(`bot order ${JSON.parse(process.argv[3]).order}`)
    const bot = new Bot(process.argv[3])
    await bot.connectDB()
    await bot._setUpTrader()
    bot.init()
    process.on('message', ({ command, args }) => {
        switch (command) {
            case 'stop':
                Logger.info(
                    'Received data from parent process on child process ',
                    { command, args }
                )
                bot.publishStopBot()
                break
        }
    })

    process.on('exit', () => {
        Logger.info('exit child')
    })
}

main()
