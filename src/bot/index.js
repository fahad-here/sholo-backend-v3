const BigNumber = require('bignumber.js')

const { Factory } = require('../strategy')

const { DBConnect, DBSchemas } = require('../../src/api/db')
const {
    AccountSchema,
    BotSchema,
    OrderSchema,
    BotConfigSessionSchema,
    PositionSchema,
    BotConfigSchema
} = DBSchemas
const {
    GetPriceTickerKey,
    GetTestNetPriceTickerKey,
    GetWSClass,
    ChildLogger
} = require('../../src/utils')
const Trade = require('../trade')
const { Bitmex } = require('../exchange')
const redis = require('redis')
const {
    POSITION_LONG,
    POSITION_SHORT,
    SELL,
    BUY,
    ORDER_TYPE_MARKET,
    ORDER_TYPE_LIMIT
} = require('../constants')
const {
    FEES,
    BITMEX_FEE_CUTOFF,
    MAP_WS_PAIR_TO_SYMBOL,
    SHOLO_STRATEGY,
    BTC,
    LIMIT_FEES,
    MARKET_FEES,
    FEE_TYPE_MAKER,
    FEE_TYPE_TAKER,
    BIDS,
    ASKS
} = require('../../src/constants')
const priceSubscriptionClient = redis.createClient()
const botClient = redis.createClient()
const pubClient = redis.createClient()
let Logger

class Bot {
    constructor(bot) {
        bot = JSON.parse(bot)
        this._bot = bot
        this._botId = bot._id
        this._userId = bot._userId
        this._inProgress = false

        //uses the strategy passed in by the bot if exists
        Logger.info('inside constructor')
        this._strategy = Factory(bot.strategy ? bot.strategy : SHOLO_STRATEGY, {
            onBuySignal: (price, timeStamp, isMarket) => {
                this.onBuySignal(price, timeStamp, isMarket)
            },
            onSellSignal: (price, timeStamp, isMarket) => {
                this.onSellSignal(price, timeStamp, isMarket)
            },
            onLiquidatedSignal: (price, timeStamp) => {
                this.onLiquidatedSignal(price, timeStamp)
            },
            onPriceRReachedSignal: (price, timeStamp) => {
                this.onPriceRReachedSignal(price, timeStamp)
            },
            botId: bot._id
        })
    }

    async _checkLiquidity(amount, price) {
        const { symbol, marketThreshold, positionOpen, order } = this._bot
        const l1OrderBook = await this._trader.getOrderbook(symbol, 200)
        const isLong = order.includes('l')
        let side = isLong
            ? positionOpen
                ? BIDS
                : ASKS
            : positionOpen
            ? ASKS
            : BIDS
        let thresholdAmount = 0
        Logger.info(`Side : ${side}`)
        if (amount > l1OrderBook[side][0][1]) {
            for (let i = 0; i < l1OrderBook[side].length; i++) {
                switch (side) {
                    case 'bids':
                        if (
                            price - marketThreshold <=
                            l1OrderBook[side][i][0]
                        ) {
                            thresholdAmount =
                                thresholdAmount + l1OrderBook[side][i][1]
                        } else break
                        break
                    case 'asks':
                        if (
                            price + marketThreshold >=
                            l1OrderBook[side][i][0]
                        ) {
                            thresholdAmount =
                                thresholdAmount + l1OrderBook[side][i][1]
                        } else break
                        break
                }
            }
            Logger.info(`Amount : ${amount}`)
            Logger.info(`Threshold Amount : ${thresholdAmount}`)
            return amount >= thresholdAmount
        } else return true
    }

    async _calculateFees(preOrderBalance, isMarket) {
        Logger.info('calculating fees')
        const postOrderBalance = await this._trader.getBalance()
        const difference = this._bot.positionOpen
            ? postOrderBalance.free[BTC] - preOrderBalance.free[BTC]
            : preOrderBalance.free[BTC] - postOrderBalance.free[BTC]
        Logger.info(`fees difference: ${difference}`)
        const feePercent = isMarket
            ? FEES[FEE_TYPE_TAKER]
            : FEES[FEE_TYPE_MAKER]
        Logger.info(`is Market: ${isMarket}`)
        Logger.info(`fees type: ${feePercent}`)
        const leverage = this._bot.leverage
        let fees
        switch (feePercent) {
            case FEE_TYPE_MAKER:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(LIMIT_FEES)
                    .toFixed(8)
                break
            case FEE_TYPE_TAKER:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(MARKET_FEES)
                    .toFixed(8)
                break
            default:
                fees = new BigNumber(difference)
                    .multipliedBy(leverage)
                    .multipliedBy(MARKET_FEES)
                    .toFixed(8)
                break
        }
        return { fees, difference }
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
            Logger.info(
                `(Currently Open) current usd price: ${currentUsdPrice}`
            )
            Logger.info(`(Currently Open)amount to buy: ${amount}`)
            Logger.info(`(Currently Open)margin amount ${margin}`)
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
            Logger.info(
                `(Currently Closed) current usd price: ${currentUsdPrice}`
            )
            Logger.info(`(Currently Closed) amount to buy: ${amount}`)
            Logger.info(`(Currently Closed) margin amount ${margin}`)
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

    async onBuySellSignal(price, timestamp, isBuy, isMarket) {
        this._inProgress = true
        Logger.info(`in progress: ${this._inProgress}`)
        try {
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
                positionOpen,
                priceP,
                orderOpen
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
            Logger.info(`pre order balance`, preOrderBalance)
            const { amount, margin } = await this._calculateAmount(price, isBuy)
            Logger.info(`${this._bot._id} ${side}`)
            Logger.info(`amount : ${amount}`)
            Logger.info(`margin ${margin}`)
            Logger.info(`pre order bot balance: ${this._bot.balance}`)
            const liquidityCheck = isMarket
                ? await this._checkLiquidity(amount, price)
                : true
            if (liquidityCheck) {
                const { liquidation } = Bitmex._calculateLiquidation(
                    amount,
                    price,
                    leverage,
                    botOrder.includes('l') ? POSITION_LONG : POSITION_SHORT
                )
                const orderDetails = isMarket
                    ? await this._trader.createMarketOrder(side, amount)
                    : await this._trader.createLimitOrder(side, amount, price)
                Logger.info(`post order`)
                const { fees, difference } = await this._calculateFees(
                    preOrderBalance,
                    isMarket
                )
                Logger.info(`fees ${fees}`)
                Logger.info(`difference ${difference}`)
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
                    price: orderDetails.average,
                    amount,
                    cost: new BigNumber(orderDetails.cost)
                        .dividedBy(100000000)
                        .toFixed(8),
                    status: orderDetails.info.ordStatus,
                    fees,
                    botOrder,
                    totalOrderQuantity: amount,
                    type: isMarket ? ORDER_TYPE_MARKET : ORDER_TYPE_LIMIT,
                    filledQuantity: orderDetails.filled,
                    remainQuantity: orderDetails.remaining,
                    exchange: exchange,
                    type: isMarket ? FEE_TYPE_TAKER : FEE_TYPE_MAKER,
                    symbol: symbol,
                    pair: MAP_WS_PAIR_TO_SYMBOL[symbol],
                    isExit: positionOpen,
                    leverage: leverage,
                    orderSequence: botSession.orderSequence,
                    orderOpen: orderDetails.remaining !== 0
                }).save()
                Logger.info(`post local order save`)
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
                                      .minus(difference)
                                      .toFixed(8)
                                : new BigNumber(this._bot.balance)
                                      .plus(difference)
                                      .toFixed(8),
                            previousPriceP: isMarket
                                ? orderDetails.average
                                : priceP,
                            priceP: isMarket
                                ? orderDetails.average
                                : orderDetails.price,
                            liquidationPrice: liquidation,
                            positionOpen: true,
                            _previousOrderId: order._id,
                            orderOpen: orderDetails.remaining !== 0
                        }
                    },
                    { new: true }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: this._bot
                })
                Logger.info(`post updated bot`)
                Logger.info(`post order bot balance ${this._bot.balance}`)
                const newBal = await this._trader.getBalance()
                this._account = await AccountSchema.findByIdAndUpdate(
                    { _id: this._account._id },
                    { $set: { balance: newBal } },
                    { new: true }
                )
                Logger.info(`post updated account balance`)
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'account',
                    account: this._account
                })
                if (isBuy) {
                    Logger.info(`is buy, setting position`)
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
                        isOpen: isMarket,
                        side: botOrder.includes('l')
                            ? POSITION_LONG
                            : POSITION_SHORT,
                        entryPrice: orderDetails.average,
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
                    Logger.info(`setting position`, this._position._doc)
                    this._sendSignalToParent('socket', `${this._bot._id}`, {
                        type: 'position',
                        position: this._position
                    })
                    Logger.info(`post buy position bot`)
                } else {
                    Logger.info(`is sell, setting position details`)
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
                        Logger.info(`post sell changing position`)
                        this._sendSignalToParent('socket', `${this._bot._id}`, {
                            type: 'position',
                            position: pos
                        })
                        this._positionId = null
                        Logger.info(`post sell position bot`)
                    } else {
                        this._position = await PositionSchema.findByIdAndUpdate(
                            { _id: this._position._id },
                            { $set: changedSet },
                            { new: true }
                        )
                        Logger.info(`post sell changing position`)
                        this._sendSignalToParent('socket', `${this._bot._id}`, {
                            type: 'position',
                            position: this._position
                        })
                        Logger.info(`post sell position bot`)
                    }
                }
                const updateSequence = isBuy
                    ? { orderSequence: 1, positionSequence: 1 }
                    : { orderSequence: 1 }
                const updateValue = isBuy
                    ? botSession.positionSequence === 1
                        ? {
                              [`actualEntryPrice.${this._bot.order}`]: orderDetails.average
                          }
                        : {}
                    : { [`exitPrice.${this._bot.order}`]: orderDetails.average }
                const session = await BotConfigSessionSchema.findByIdAndUpdate(
                    { _id: _botSessionId },
                    { $inc: updateSequence, $set: updateValue },
                    { new: true }
                )
                Logger.info(`Session order sequence ${session.orderSequence}`)
                Logger.info(
                    `Session position sequence ${session.positionSequence}`
                )

                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'session',
                    session
                })
                Logger.info(`post updated session position bot`)
            } else {
                Logger.info(`market is not liquid enough`)
            }
            this._inProgress = false
            Logger.info(`post everything progress: ${this._inProgress}`)
        } catch (e) {
            Logger.error('error in buy sell signal', e)
            this._inProgress = false
            Logger.error('post error progress ' + this._inProgress)
        }
    }

    async onBuySignal(price, timestamp, isMarket) {
        Logger.info(
            `inside buy signal ${
                this._position ? this._position.isOpen : null
            } ${this._inProgress}`
        )
        if (!this._inProgress) {
            Logger.info(`on buy signal`)
            await this.onBuySellSignal(price, timestamp, true, isMarket)
            // save this order in db
            // create a position
            // subscribe to ws updates on the position
            // update db on ws updates
            // update bot with new price p value
            // update liquidation price
            // send the updates via sockets to frontend
        }
    }

    async onSellSignal(price, timestamp, isMarket) {
        Logger.info(
            `inside sell signal ${
                this._position ? this._position.isOpen : null
            } ${this._inProgress}`
        )
        if (!this._inProgress) {
            Logger.info(`on sell signal`)
            await this.onBuySellSignal(price, timestamp, false, isMarket)
        }
    }

    async onLiquidatedSignal(price, timestamp) {
        try {
            if (this._position && !this._inProgress) {
                Logger.info(`liquidated signal `)
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
                    position: this._position
                })
                this._sendSignalToParent('email', `${this._bot._id}`, {
                    account: this._account,
                    bot: this._bot,
                    price,
                    liquidated: true,
                    whatPrice: 'liquidation price'
                })
                this._position = null
                await this.stopBot()
            }
        } catch (e) {
            Logger.error(`Error on liquidated signal `, e)
        }
    }

    async onPriceRReachedSignal(price, timestamp) {
        Logger.info(`onPriceRReachedSignal`)
        if (!this._position && !this._inProgress) {
            //send email notification
            this._sendSignalToParent('email', `${this._bot._id}`, {
                account: this._account,
                bot: this._bot,
                price,
                liquidated: false,
                whatPrice: 'Price R'
            })
            await this.stopBot()
        }
    }

    async onTickerPriceReceived(price, timestamp) {
        try {
            Logger.info(`looking for active positions`)
            const hasPositions = await PositionSchema.findOne({
                _botId: this._bot._id,
                _botConfigId: this._bot._botConfigId,
                _botSessionId: this._bot._botSessionId
            })
            const session = await BotConfigSessionSchema.findById({
                _id: this._bot._botSessionId
            })
            await this._strategy.run(
                true,
                price,
                timestamp,
                this._bot,
                session,
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
        remainQuantity,
        average
    ) {
        try {
            Logger.info('order change here')
            Logger.info('order', {
                exchange,
                pair,
                _orderId,
                status,
                totalOrderQuantity,
                filledQuantity,
                remainQuantity,
                average
            })
            let order = await OrderSchema.findOne({ _orderId, pair })
            let updatedOrder
            if (order) {
                let cost = new BigNumber(totalOrderQuantity)
                    .dividedBy(average)
                    .multipliedBy(this._bot.leverage)
                    .toFixed(8)
                let fees = new BigNumber(cost)
                    .multipliedBy(
                        order
                            ? order.feeType === FEE_TYPE_MAKER
                                ? LIMIT_FEES
                                : MARKET_FEES
                            : LIMIT_FEES
                    )
                    .toFixed(8)
                updatedOrder = await OrderSchema.findByIdAndUpdate(
                    { _id: order._id },
                    {
                        $set: {
                            status,
                            totalOrderQuantity,
                            filledQuantity,
                            remainQuantity,
                            price: average,
                            cost,
                            fees,
                            orderOpen: remainQuantity !== 0
                        }
                    },
                    { new: true }
                )
                Logger.info('post save order ' + this._bot._id)
                Logger.info('post save order', updatedOrder._doc)
            }
            if (
                (status === 'Filled' || remainQuantity === 0) &&
                order.orderOpen
            ) {
                let cost = new BigNumber(totalOrderQuantity)
                    .dividedBy(average)
                    .dividedBy(order.leverage)
                    .toFixed(8)
                this._bot = await BotSchema.findByIdAndUpdate(
                    { _id: this._bot._id },
                    {
                        $set: {
                            orderOpen: false,
                            priceP: average,
                            balance: order.isExit
                                ? new BigNumber(this._bot.balance)
                                      .plus(cost)
                                      .toFixed(8)
                                : this._bot.balance
                        }
                    },
                    { new: true }
                )
                Logger.info(`bot post order update ` + this._bot.orderOpen)
                Logger.info(`bot balance order update ` + this._bot.balance)
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: this._bot
                })
            }
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'order',
                order: updatedOrder
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
        // Logger.info(`positon change current progress: ${this._inProgress}`)
        // Logger.info(`positon change received data isOpen: ${isOpen}`)
        if (isOpen) {
            if (this._position && !this._inProgress) {
                // Logger.info(
                //     `position exists and is open and not in progress: `,
                //     {
                //         id,
                //         pair,
                //         isOpen,
                //         margin,
                //         positionSize,
                //         liquidationPrice,
                //         bankruptPrice,
                //         realisedPnl,
                //         unrealisedPnl
                //     }
                // )
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
                    bot: this._bot
                })
            } else {
                Logger.info(
                    `position does not exist and is open `
                    // ,{
                    //     id,
                    //     pair,
                    //     isOpen,
                    //     margin,
                    //     positionSize,
                    //     liquidationPrice,
                    //     bankruptPrice,
                    //     realisedPnl,
                    //     unrealisedPnl
                    // }
                )
            }
        } else {
            if (this._position) {
                Logger.info(
                    `position exists and is not open {}`
                    // , {
                    //     id,
                    //     pair,
                    //     isOpen,
                    //     margin,
                    //     positionSize,
                    //     liquidationPrice,
                    //     bankruptPrice,
                    //     realisedPnl,
                    //     unrealisedPnl
                    // }
                )
                changedSet = {
                    ...changedSet,
                    isOpen,
                    realisedPnl: this._position.unrealisedPnl,
                    unrealisedPnl
                }
                changed = true
                const botRealisedPnl = new BigNumber(this._bot.realisedPnl)
                    .plus(this._position.unrealisedPnl)
                    .toFixed(8)
                this._bot = await BotSchema.findByIdAndUpdate(
                    { _id: this._bot._id },
                    {
                        $set: {
                            positionOpen: isOpen,
                            realisedPnl: botRealisedPnl,
                            balance: new BigNumber(this._bot.balance)
                                .plus(botRealisedPnl)
                                .toFixed(8),
                            unrealisedPnl
                        }
                    }
                )
                this._sendSignalToParent('socket', `${this._bot._id}`, {
                    type: 'update',
                    bot: this._bot
                })
            } else {
                Logger.info(
                    `position does not exist and is not open`
                    // , {
                    //     id,
                    //     pair,
                    //     isOpen,
                    //     margin,
                    //     positionSize,
                    //     liquidationPrice,
                    //     bankruptPrice,
                    //     realisedPnl,
                    //     unrealisedPnl
                    // }
                )
            }
        }

        if (changed && this._position) {
            Logger.info(`position values changed and position exists`)
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
            Logger.info(`setting position null`)
            this._position = null
        }
    }

    async _subscribeToEvents(bot) {
        const exchange = bot.exchange
        Logger.info(`exchange ${bot.exchange}`)
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
                remainQuantity,
                average
            ) =>
                this._onOrderChangeEmitter(
                    exchange,
                    pair,
                    _orderId,
                    status,
                    totalOrderQuantity,
                    filledQuantity,
                    remainQuantity,
                    average
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
            bot.testNet
                ? GetTestNetPriceTickerKey(exchange, pair)
                : GetPriceTickerKey(exchange, pair),
            (err, count) => {
                Logger.info(
                    `Child process ${
                        bot._id
                    } Subscribed to ${count} channel. Listening for updates on the ${
                        bot.testNet
                            ? GetTestNetPriceTickerKey(exchange, pair)
                            : GetPriceTickerKey(exchange, pair)
                    } channel. pid: ${process.pid}`
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
        Logger.info(this._botId)
        pubClient.publish(this._botId, data)
    }

    async stopBot() {
        try {
            Logger.info(`stopping bot`)
            this._bot = await BotSchema.findOneAndUpdate(
                {
                    _id: this._botId,
                    _userId: this._userId
                },
                { $set: { active: false } },
                { new: true }
            )
            const botConfig = await BotConfigSchema.findById({
                _id: this._bot._botConfigId
            })
            if (!botConfig.paused) {
                this._inProgress = true
                Logger.info('current session' + botConfig.currentSession)
                Logger.info('Bot is paused' + botConfig.paused)

                if (this._bot.positionOpen) {
                    if (this._bot.orderOpen) {
                        Logger.info('Order open ' + this._bot.positionOpen)
                        Logger.info(`trader info ${this._trader.symbol}`)
                        Logger.info(`trader info ${this._trader.pair}`)
                        const orderDetails = await OrderSchema.findById({
                            _id: this._bot._previousOrderId
                        })
                        if (orderDetails.remainQuantity !== 0)
                            await this._trader.cancelOpenOrder(
                                orderDetails._orderId
                            )
                    }
                    Logger.info('Position open ' + this._bot.positionOpen)
                    Logger.info(`trader info ${this._trader.symbol}`)
                    Logger.info(`trader info ${this._trader.pair}`)
                    const currentPrice = await this._trader
                        .getExchange()
                        .getTickerPrice(this._trader.symbol).lastPrice
                    await PositionSchema.findByIdAndUpdate(
                        { _id: this._position._id },
                        {
                            $set: {
                                [`exitPrice`]: currentPrice,
                                isOpen: false
                            }
                        }
                    )
                    await BotSchema.findByIdAndUpdate(
                        { _id: this._bot._id },
                        {
                            $set: {
                                positionOpen: false,
                                orderOpen: false
                            }
                        }
                    )
                    await this._trader.closeOpenPositions()
                } else {
                    // if orders are open close them here
                    Logger.info('Position closed ' + this._bot.positionOpen)
                    if (this._bot.orderOpen) {
                        Logger.info('Order open ' + this._bot.positionOpen)
                        Logger.info(`trader info ${this._trader.symbol}`)
                        Logger.info(`trader info ${this._trader.pair}`)
                        const orderDetails = await OrderSchema.findById({
                            _id: this._bot._previousOrderId
                        })
                        if (orderDetails.remainQuantity !== 0)
                            await this._trader.cancelOpenOrder(
                                orderDetails._orderId
                            )
                    }
                }
            } else {
                Logger.info(
                    'Paused, current session' + botConfig.currentSession
                )
            }
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
            Logger.error('Error quitting bot : ' + this._bot._id)
            Logger.error('Error quitting bot : ', e)
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
                _botSessionId: bot._botSessionId
            })
        } catch (e) {
            Logger.error(`Error when looking for active position`, e)
        }
    }

    async init() {
        try {
            let bot = this._bot
            Logger.info(`setting bot`)
            this._bot = await BotSchema.findOneAndUpdate(
                { _id: bot._id, _userId: bot._userId },
                { $set: { active: true } },
                { new: true }
            )
            Logger.info(`finding active position`)
            await this._findActivePosition(this._bot)
            Logger.info(`subscribing to events`)
            await this._subscribeToEvents(this._bot)
            this._sendSignalToParent('socket', `${this._bot._id}`, {
                type: 'update',
                bot: this._bot
            })
        } catch (e) {
            Logger.info('Error initializing bot : ' + bot._id)
            Logger.error('Error initializing bot', e)
            await this.stopBot()
        }
    }
}

async function main() {
    console.log(JSON.parse(process.argv[3]))
    Logger = ChildLogger('bots', `${JSON.parse(process.argv[3])._id}__`)
    Logger.info('logger from child')
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
                    {
                        command,
                        args
                    }
                )
                await bot.stopBot()
                break
        }
    })

    process.on('exit', () => {
        Logger.info('exit child')
    })
}

try {
    main()
} catch (err) {
    Logger.info('error', err)
}
