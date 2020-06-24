const BigNumber = require('bignumber.js')

const { Factory } = require('../strategy')

const { DBConnect, DBSchemas } = require('../../src/api/db')
const {
    AccountSchema,
    BotSchema,
    OrderSchema,
    BotConfigSessionSchema,
    PositionSchema
} = DBSchemas
const { GetPriceTickerKey, Logger, GetWSClass } = require('../../src/utils')
const Trade = require('../trade')
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

    _sendSignalToParent(command, channel, message) {
        process.send({
            command,
            args: {
                channel,
                message
            }
        })
    }

    async onBuySellSignal(price, timestamp, isBuy) {
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
        const { amount, margin } = this._calculateAmount(price, isBuy)
        const {
            liquidation
        } = this._trader.exchange
            .getExchange()
            ._calculateLiquidation(amount, price)
        const orderDetails = await this._trader.createMarketOrder(side, amount)
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
        this._sendSignalToParent('socket', `${this._bot._id}`, {
            type: 'order',
            order
        })
        this._bot = await BotSchema.findByIdAndUpdate(
            { _id: this._botId },
            {
                $set: {
                    balance: isBuy
                        ? new BigNumber(this._bot.balance)
                              .minus(
                                  new BigNumber(orderDetails.amount)
                                      .dividedBy(orderDetails.average)
                                      .dividedBy(leverage)
                              )
                              .toFixed(8)
                        : new BigNumber(this._bot.balance)
                              .plus(
                                  new BigNumber(orderDetails.amount)
                                      .dividedBy(orderDetails.average)
                                      .dividedBy(leverage)
                              )
                              .toFixed(8),
                    priceP: price,
                    liquidationPrice: liquidation,
                    positionOpen: true,
                    _previousOrderId: order._id
                }
            },
            { new: true }
        )
        this._sendSignalToParent('socket', `${this._bot._id}`, {
            type: 'update',
            bot: this._bot
        })
        const newBal = await this._trader.getBalance()
        this._account = await AccountSchema.findByIdAndUpdate(
            { _id: this._account._id },
            { $set: { balance: newBal } },
            { new: true }
        )
        this._sendSignalToParent('socket', `${this._bot._id}`, {
            type: 'account',
            account: this._account
        })
        if (isBuy) {
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
            this._position = await new PositionSchema(positionData).save()
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'position',
                position: this._position
            })
        } else {
            const changedSet = {
                exitPrice: price,
                isOpen: false,
                endedAt: timestamp
            }
            this._account = await AccountSchema
            const pos = await PositionSchema.findByIdAndUpdate(
                { _id: this._position._id },
                { $set: changedSet },
                { new: true }
            )
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'position',
                position: pos
            })
        }
        const updateSequence = isBuy
            ? { orderSequence: 1, positionSequence: 1 }
            : { orderSequence: 1 }
        const updateValue = isBuy
            ? botSession.positionSequence === 1
                ? { [`actualEntryPrice.${this._bot.order}`]: price }
                : {}
            : { [`exitPrice.${this._bot.order}`]: price }
        const session = await BotConfigSessionSchema.findByIdAndUpdate(
            { _id: _botSessionId },
            { $inc: updateSequence, $set: updateValue },
            { new: true }
        )
        this._sendSignalToParent('socket', `${this._bot._id}`, {
            type: 'session',
            session
        })
    }

    async onBuySignal(price, timestamp) {
        try {
            if (!this._position) {
                await this.onBuySellSignal(price, timestamp, true)
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

    async onSellSignal(price, timestamp) {
        try {
            if (!this._position) Logger.error(`No current position`)
            if (!this._position.isOpen)
                Logger.error('Current position is not open')
            await this.onBuySellSignal(price, timestamp, false)
        } catch (e) {
            Logger.error(`Error on sell signal `, e)
        }
    }

    async onLiquidatedSignal(price, timestamp) {
        try {
            const changedSet = {
                exitPrice: price,
                isOpen: false,
                endedAt: timestamp,
                liquidated: true
            }
            const pos = await PositionSchema.findByIdAndUpdate(
                { _id: this._position._id },
                { $set: changedSet },
                { new: true }
            )
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'position',
                position: pos
            })
            this._position = null
            this.publishStopBot()
        } catch (e) {
            Logger.error(`Error on liquidated signal `, e)
        }
    }

    async onPriceRReachedSignal(price, timestamp) {
        try {
            if (!this._position) {
                await this.onBuySellSignal(price, timestamp, true)
                //send email notification
            }
        } catch (e) {
            Logger.error(`Error on price r reached signal `, e)
        }
    }

    async onTickerPriceReceived(price, timestamp) {
        try {
            await this._strategy.run(true, price, timestamp, this._bot)
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

    async _onPositionChangeEmitter(
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
        let changed = false
        let changedSet = {}
        if (isOpen) {
            if (this._position.margin !== margin) {
                this._position.margin = margin
                changedSet = {
                    ...changedSet,
                    margin
                }
                changed = true
            }
            if (this._position.positionSize !== positionSize) {
                this._position.positionSize = positionSize
                changedSet = {
                    ...changedSet,
                    positionSize
                }
                changed = true
            }
            if (this._position.liquidationPrice !== liquidationPrice) {
                this._position.liquidationPrice = liquidationPrice
                changedSet = {
                    ...changedSet,
                    liquidationPrice
                }
                changed = true
            }
            if (this._position.bankruptPrice !== bankruptPrice) {
                this._position.bankruptPrice = bankruptPrice
                changedSet = {
                    ...changedSet,
                    bankruptPrice
                }
                changed = true
            }
            if (this._position.realisedPnl !== realisedPnl) {
                this._position.realisedPnl = realisedPnl
                changedSet = {
                    ...changedSet,
                    realisedPnl
                }
                changed = true
            }
            if (this._position.unrealisedPnl !== unrealisedPnl) {
                this._position.unrealisedPnl = unrealisedPnl
                changedSet = {
                    ...changedSet,
                    unrealisedPnl
                }
                changed = true
            }
            this._bot = await BotSchema.findByIdAndUpdate(
                { _id: this._bot._id },
                { $set: changedSet },
                { new: true }
            )
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'update',
                position: this._bot
            })
        } else {
            if (this._position) {
                this._position.isOpen = isOpen
                changedSet = {
                    ...changedSet,
                    isOpen,
                    realisedPnl,
                    unrealisedPnl
                }
                changed = true
                this._bot = await BotSchema.findByIdAndUpdate(
                    { _id: this._bot._id },
                    {
                        $set: {
                            realisedPnl: new BigNumber(this._bot.realisedPnl)
                                .plus(realisedPnl)
                                .toFixed(8),
                            unrealisedPnl
                        }
                    }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    position: this._bot
                })
            }
        }

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
        if (changed && this._position) {
            this._position = await PositionSchema.findByIdAndUpdate(
                { _id: this._position._id },
                { $set: changedSet },
                { new: true }
            )
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'position',
                position: this._position
            })
        }
        if (!isOpen) {
            this._position = null
        }
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

        botClient.subscribe(bot._id, () => {
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
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: this._bot
                })
                priceSubscriptionClient.quit()
                botClient.quit()
                pubClient.quit()
                process.exit()
            })
            .catch((err) => {
                Logger.info('Error quitting bot : ' + this._bot._id)
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
                this._trader.setPair(this._bot.symbol)
                this._trader.setLeverage(this._bot.leverage)
            })
            .catch((err) => {
                Logger.error(`Error setting up trader, `, err)
            })
    }

    _findActivePosition(bot) {
        //need to figure out a way to check if the position is still active on the exchange
        PositionSchema.findOne({
            isOpen: true,
            liquidated: false,
            exchange: bot.exchange,
            symbol: bot.symbol,
            _botId: bot._id,
            _botSessionId: bot.currentSession
        })
            .then((position) => {
                this._position = position
            })
            .catch((err) => {
                Logger.error(`Error when looking for active position`, err)
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
                this._findActivePosition(bot)
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: data
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
