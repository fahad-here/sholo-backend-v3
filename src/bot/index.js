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
const { Bitmex } = require('../exchange')
const redis = require('redis')
const { POSITION_LONG, POSITION_SHORT, SELL, BUY } = require('../constants')
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
        this._inProgress = false
        //uses the strategy passed in by the bot if exists
        this._strategy = Factory(bot.strategy ? bot.strategy : SHOLO_STRATEGY, {
            onBuySignal: (price, timeStamp) => {
                this.onBuySignal(price, timeStamp)
            },
            onSellSignal: (price, timeStamp) => {
                this.onSellSignal(price, timeStamp)
            },
            onLiquidatedSignal: (price, timeStamp) => {
                this.onLiquidatedSignal(price, timeStamp)
            },
            onPriceRReachedSignal: (price, timeStamp) => {
                this.onPriceRReachedSignal(price, timeStamp)
            }
        })
    }

    async _calculateFees(preOrderBalance) {
        console.log('calculating fees')
        const postOrderBalance = await this._trader.getBalance()
        console.log('post order balance ', postOrderBalance)
        const difference = this._bot.positionOpen
            ? postOrderBalance.free[BTC] - preOrderBalance.free[BTC]
            : preOrderBalance.free[BTC] - postOrderBalance.free[BTC]
        console.log('fees difference', difference)
        const feePercent = FEES[this._bot.feeType]
        console.log('fees type', feePercent)
        const leverage = this._bot.leverage
        let fees
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
            amount = new BigNumber(previousOrder.amount)
                .integerValue(BigNumber.ROUND_DOWN)
                .toFixed(0)
            console.log(currentUsdPrice)
            console.log(amount)
            console.log(margin)
            return { amount, margin }
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
                .toFixed(0)
            console.log(currentUsdPrice)
            console.log(amount)
            console.log(margin)
            return { amount, margin }
        }
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
        this._inProgress = true
        console.log('in progress', this._inProgress)
        try {
            const liquidityCheck = true
            if (liquidityCheck) {
                const {
                    _userId,
                    _botConfigId,
                    _botSessionId,
                    _accountIdSimple,
                    _botConfigIdSimple,
                    _botSessionIdSimple,
                    exchange,
                    feeType,
                    symbol,
                    leverage,
                    order: botOrder,
                    id: _botIdSimple,
                    positionOpen
                } = this._bot
                const { _id, accountType } = this._account
                const side =
                    accountType === POSITION_SHORT
                        ? positionOpen
                            ? BUY
                            : SELL
                        : positionOpen
                        ? SELL
                        : BUY
                //calculate fees before placing order
                const preOrderBalance = await this._trader.getBalance()
                console.log('pro order balance ', preOrderBalance)
                const { amount, margin } = await this._calculateAmount(
                    price,
                    isBuy
                )
                console.log(this._bot._id, side)
                console.log('amount', amount)
                console.log('margin', margin)
                const { liquidation } = Bitmex._calculateLiquidation(
                    amount,
                    price,
                    leverage,
                    botOrder.includes('l') ? POSITION_LONG : POSITION_SHORT
                )
                const orderDetails = await this._trader.createMarketOrder(
                    side,
                    amount
                )
                console.log('post order')
                const fees = await this._calculateFees(preOrderBalance)
                console.log('fees ', fees)
                const botSession = await BotConfigSessionSchema.findById({
                    _id: _botSessionId
                })
                const order = await new OrderSchema({
                    _userId,
                    _botId: this._botId,
                    _botConfigId,
                    _botSessionId,
                    _accountId: _id,
                    _botIdSimple,
                    _accountIdSimple,
                    _botConfigIdSimple,
                    _botSessionIdSimple,
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
                console.log('post local order save')
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
                            positionOpen: isBuy,
                            _previousOrderId: order._id
                        }
                    },
                    { new: true }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: this._bot
                })
                console.log('post updated bot')
                const newBal = await this._trader.getBalance()
                this._account = await AccountSchema.findByIdAndUpdate(
                    { _id: this._account._id },
                    { $set: { balance: newBal } },
                    { new: true }
                )
                console.log('post updated account balance')
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'account',
                    account: this._account
                })
                if (isBuy) {
                    console.log('is buy, setting position')
                    const positionData = {
                        _userId,
                        _botId: this._botId,
                        _botConfigId,
                        _botSessionId,
                        _accountId: _id,
                        _botIdSimple,
                        _accountIdSimple,
                        _botConfigIdSimple,
                        _botSessionIdSimple,
                        _buyOrderId: order._id,
                        _buyOrderIdSimple: order.id,
                        isOpen: true,
                        side: botOrder.includes('l')
                            ? POSITION_LONG
                            : POSITION_SHORT,
                        entryPrice: price,
                        symbol,
                        pair: MAP_WS_PAIR_TO_SYMBOL[symbol],
                        exchange,
                        leverage,
                        startedAt: timestamp
                    }
                    this._position = await new PositionSchema(
                        positionData
                    ).save()
                    this._positionId = this._position._id
                    console.log('setting position', this._position)
                    this._sendSignalToParent('socket', `${this._bot._id}`, {
                        type: 'position',
                        position: this._position
                    })
                    console.log('post buy position bot')
                } else {
                    console.log('is sell, setting position details')
                    const changedSet = {
                        exitPrice: price,
                        endedAt: timestamp,
                        _sellOrderId: order._id,
                        _sellOrderIdSimple: order.id
                    }
                    if (!this._position) {
                        const pos = await PositionSchema.findByIdAndUpdate(
                            { _id: this._positionId },
                            { $set: changedSet },
                            { new: true }
                        )
                        console.log('post sell changing position')
                        this._sendSignalToParent('socket', `${this._bot._id}`, {
                            type: 'position',
                            position: pos
                        })
                        this._positionId = null
                        console.log('post sell position bot')
                    } else {
                        this._position = await PositionSchema.findByIdAndUpdate(
                            { _id: this._position._id },
                            { $set: changedSet },
                            { new: true }
                        )
                        console.log('post sell changing position')
                        this._sendSignalToParent('socket', `${this._bot._id}`, {
                            type: 'position',
                            position: this._position
                        })
                        console.log('post sell position bot')
                    }
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
                console.log('post updated session position bot')
            } else {
                console.log('market is not liquid enough')
            }
            this._inProgress = false
            console.log('post everything progress', this._inProgress)
        } catch (e) {
            Logger.error('error in buy sell signal', e)
            console.log(e)
            this._inProgress = false
            console.log('post error progress', this._inProgress)
        }
    }

    async onBuySignal(price, timestamp) {
        if (!this._position && !this._inProgress) {
            console.log('on buy signal')
            await this.onBuySellSignal(price, timestamp, true)
            // save this order in db
            // create a position
            // subscribe to ws updates on the position
            // update db on ws updates
            // update bot with new price p value
            // update liquidation price
            // send the updates via sockets to frontend
        }
    }

    async onSellSignal(price, timestamp) {
        if (!this._position) Logger.error(`No current position`)
        if (this._position.isOpen && !this._inProgress)
            Logger.error('Current position is not open')
        if (this._position && !this._inProgress) {
            console.log('on sell signal')
            await this.onBuySellSignal(price, timestamp, false)
        }
    }

    async onLiquidatedSignal(price, timestamp) {
        try {
            if (this._position && !this._inProgress) {
                console.log('liquidated signal ')
                const changedSet = {
                    exitPrice: price,
                    isOpen: false,
                    endedAt: timestamp,
                    liquidated: true
                }
                this._position = await PositionSchema.findByIdAndUpdate(
                    { _id: this._position._id },
                    { $set: changedSet },
                    { new: true }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'position',
                    position: pos
                })
                this._position = null
                await this.stopBot()
            }
        } catch (e) {
            Logger.error(`Error on liquidated signal `, e)
        }
    }

    async onPriceRReachedSignal(price, timestamp) {
        console.log('onPriceRReachedSignal')
        if (!this._position && !this._inProgress) {
            await this.onBuySellSignal(price, timestamp, true)
            //send email notification
        }
    }

    async onTickerPriceReceived(price, timestamp) {
        try {
            console.log('looking for active positions')
            const hasPositions = await PositionSchema.findOne({
                _botId: this._bot._id,
                _botConfigId: this._bot._botConfigId,
                _botSessionId: this._bot._botSessionId
            })
            await this._strategy.run(
                true,
                price,
                timestamp,
                this._bot,
                hasPositions
            )
        } catch (e) {
            Logger.error(`Error running bot strategy `, e)
        }
    }

    async _onOrderChangeEmitter(
        exchange,
        pair,
        _orderId,
        status,
        totalOrderQuantity,
        filledQuantity,
        remainQuantity
    ) {
        try {
            const order = await OrderSchema.findOneAndUpdate(
                { _orderId, pair },
                {
                    $set: {
                        status,
                        totalOrderQuantity,
                        filledQuantity,
                        remainQuantity
                    }
                }
            )
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'order',
                order
            })
        } catch (e) {
            Logger.error('Error saving order on change', e)
        }
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
        console.log('positon change current progress', this._inProgress)
        console.log('positon change received data', isOpen)
        if (isOpen) {
            if (this._position && !this._inProgress) {
                console.log(
                    'position exists and is open and not in progress',
                    this._position
                )
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
                console.log(
                    'position does not exist and is open',
                    this._position
                )
            }
        } else {
            if (this._position) {
                console.log('position exists and is not open', this._position)
                console.log('position ', {
                    isOpen,
                    margin,
                    positionSize,
                    liquidationPrice,
                    bankruptPrice,
                    realisedPnl,
                    unrealisedPnl
                })
                changedSet = {
                    ...changedSet,
                    isOpen,
                    realisedPnl: this._position.unrealisedPnl,
                    unrealisedPnl
                }
                changed = true
                this._bot = await BotSchema.findByIdAndUpdate(
                    { _id: this._bot._id },
                    {
                        $set: {
                            realisedPnl: new BigNumber(this._bot.realisedPnl)
                                .plus(this._position.unrealisedPnl)
                                .toFixed(8),
                            unrealisedPnl
                        }
                    }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    position: this._bot
                })
            } else {
                console.log(
                    'position does not exist and is not open',
                    this._position
                )
            }
        }

        if (changed && this._position) {
            console.log('position values changed and position exists')
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
            console.log('setting position null')
            this._position = null
        }
    }

    async _subscribeToEvents(bot) {
        const exchange = bot.exchange
        const pair = MAP_WS_PAIR_TO_SYMBOL[bot.symbol]
        //this works only for bitmex right now
        this._ws = GetWSClass(exchange, pair, {
            apiKeyID: this._account.apiKey,
            apiKeySecret: this._account.apiSecret,
            testnet: this._account.testNet
        })
        this._ws.setOrderListener(
            (
                exchange,
                pair,
                _orderId,
                status,
                totalOrderQuantity,
                filledQuantity,
                remainQuantity
            ) =>
                this._onOrderChangeEmitter(
                    exchange,
                    pair,
                    _orderId,
                    status,
                    totalOrderQuantity,
                    filledQuantity,
                    remainQuantity
                )
        )
        this._ws.setPositionListener(
            (
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
            ) =>
                this._onPositionChangeEmitter(
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
                )
        )
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
            /*Logger.info(
                `Data on child process ${bot._id}  bot order: ${bot.order}:  ${message}`
            )*/
            await this.onTickerPriceReceived(
                parsedData.price,
                parsedData.timestamp
            )
            //set trader here, create the buy and sell signals here as well
        })

        botClient.subscribe(bot._id, (err, count) => {
            Logger.info(
                `Child processs ${count} Subscribed to ${bot._id} 
                channel. Listening for updates on the ${bot._id} channel.`
            )
        })

        botClient.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info('Data received on bot channel ' + this._bot._id, parsed)
            if (parsed.disable) {
                await this.stopBot()
            }
        })

        pubClient.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info(
                'Data received on pub bot channel ' + this._bot._id,
                parsed
            )
            if (parsed.disable) {
                await this.stopBot()
            }
        })
    }

    publishStopBot() {
        const data = JSON.stringify({ disable: true })
        console.log(this._botId)
        pubClient.publish(this._botId, data)
    }

    async stopBot() {
        try {
            console.log('stopping bot')
            this._bot = await BotSchema.findOneAndUpdate(
                {
                    _id: this._botId,
                    _userId: this._userId
                },
                { $set: { active: false } },
                { new: true }
            )
            this._ws.setOrderListener(null)
            this._ws.setPositionListener(null)
            this._ws.exit()
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'update',
                bot: this._bot
            })
            priceSubscriptionClient.quit()
            botClient.quit()
            pubClient.quit()
            process.exit()
        } catch (e) {
            Logger.info('Error quitting bot : ' + this._bot._id)
            Logger.info('Error quitting bot : ', err)
        }
    }

    async connectDB() {
        await DBConnect()
    }

    async _setUpTrader() {
        try {
            this._account = await AccountSchema.findById({
                _id: this._bot._accountId
            })
            this._trader = new Trade(
                this._account.exchange,
                {
                    apiKey: this._account.apiKey,
                    secret: this._account.apiSecret
                },
                this._account.testNet
            )
            this._trader.setPair(this._bot.symbol)
            await this._trader.setLeverage(this._bot.leverage)
        } catch (e) {
            Logger.error(`Error setting up trader, `, err)
        }
    }

    async _findActivePosition(bot) {
        //need to figure out a way to check if the position is still active on the exchange
        try {
            this._position = await PositionSchema.findOne({
                isOpen: true,
                liquidated: false,
                exchange: bot.exchange,
                symbol: bot.symbol,
                _botId: bot._id,
                _botSessionId: bot.currentSession
            })
        } catch (e) {
            console.log(e)
            Logger.error(`Error when looking for active position`, e)
        }
    }

    async init() {
        try {
            let bot = this._bot
            console.log('setting bot')
            this._bot = await BotSchema.findOneAndUpdate(
                { _id: bot._id, _userId: bot._userId },
                { $set: { active: true } },
                { new: true }
            )
            console.log('finding active position')
            await this._findActivePosition(this._bot)
            console.log('subscribing to events')
            await this._subscribeToEvents(this._bot)
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'update',
                bot: this._bot
            })
        } catch (e) {
            console.log(e)
            Logger.info('Error initializing bot : ' + bot._id)
            Logger.error('Error initializing bot', e)
            await this.stopBot()
        }
    }
}

async function main() {
    Logger.info(`pid ${process.pid}`)
    Logger.info(`bot order ${JSON.parse(process.argv[3]).order}`)
    const bot = new Bot(process.argv[3])
    await bot.connectDB()
    await bot._setUpTrader()
    await bot.init()
    process.on('message', async ({ command, args }) => {
        switch (command) {
            case 'stop':
                Logger.info(
                    'Received data from parent process on child process ',
                    { command, args }
                )
                await bot.stopBot()
                break
        }
    })

    process.on('exit', () => {
        Logger.info('exit child')
    })
}

main()
