const BigNumber = require('bignumber.js')
const {Logger} = require('../utils')
const {Binance, Bitmex} = require('../exchange')
const {FetchOHLCV} = require('../data')
const BOT_SHORT_1 = 's1'
const BOT_LONG_1 = 'l1'

const CANDLE_TIME_FRAME_POSITION = 0
const CANDLE_OPEN_POSITION = 1
const CANDLE_HIGH_POSITION = 2
const CANDLE_LOW_POSITION = 3
const CANDLE_CLOSE_POSITION = 4
const CANDLE_VOLUME_POSITION = 5

const stats = {
    initialBtcBalance: null,
    initialUsdBalance: null,
    endingBtcBalance: null,
    endingUsdBalance: null,
    usdPnl: null,
    btcPnl: null,
    usdPnlPercent: null,
    btcPnlPercent: null,
}

const bots = {
    [BOT_SHORT_1]: {},
    [BOT_LONG_1]: {},
}

const FEE_TYPE_MAKER = 0
const FEE_TYPE_TAKER = 1
const FEE_TYPE_FIFTY_FIFTY = 2

const FEE_MAKER = -0.025
const FEE_TAKER = 0.075
const FEE_FIFTY_FIFTY = 0.05

const fees = {
    [FEE_TYPE_MAKER]: FEE_MAKER,
    [FEE_TYPE_TAKER]: FEE_TAKER,
    [FEE_TYPE_FIFTY_FIFTY]: FEE_FIFTY_FIFTY,
}
const _getBotInstance = (
    balance,
    direction
) => {
    return {
        balance, // Balance in btc
        positions: [], // Position history
        direction, // Bot direction
        waitForExit: false // Wait to exit position after price goes back to entry
    }
}

const stats = {
    totalInitialBtcBalance: null,
    totalInitialUsdBalance: null,
    totalEndingBtcBalance: null,
    totalEndingUsdBalance: null,
    totalUsdPnl: null,
    totalBtcPnl: null,
    totalUsdPnlPercent: null,
    totalBtcPnlPercent: null,
}

const POSITION_LONG = 'long'
const POSITION_SHORT = 'short'

let feeType

let allowedExchangeNames = ['bitmex', 'binance']

class Simulator {

    ranSetBotParams = false

    constructor(
        exchangeName,
        exchangeParams,
        symbol,
        timeFrame,
        fromDateTime,
        toDateTime,
    ) {
        if (allowedExchangeNames.indexOf(exchangeName) === -1)
            throw new Error(`${exchangeName} is not yet supported`)
        switch (exchangeName) {
            case allowedExchangeNames[0]:
                this.exchange = new Bitmex(exchangeParams)
                break
            case allowedExchangeNames[1]:
                this.exchange = new Binance(exchangeParams)
                break
        }
        this.exchangeParams = exchangeParams
        this.symbol = symbol
        this.timeFrame = timeFrame
        this.fromDateTime = fromDateTime
        this.toDateTime = toDateTime
    }

    setBotParams(
        startingBalances = {[BOT_SHORT_1]: 1, [BOT_LONG_1]: 1},
        entryPrice = 10000,
        priceA = 200,
        priceB = 100,
        priceR = 300,
        leverage = 1,
        feeType,
        isMargin = false
    ) {

        this.ranSetBotParams = true

        if (typeof isMargin !== 'boolean')
            throw new Error('Is Margin must either true or false')
        if (entryPrice < 0)
            throw new Error('Entry price must be positive')
        if (priceA < 0)
            throw new Error('Entry price must be positive')
        if (priceB < 0)
            throw new Error('Entry price must be positive')
        if (priceR < 0)
            throw new Error('Entry price must be positive')
        if (leverage > 100 || leverage < 1)
            throw new Error('Leverage must be between 1-100x')
        if (typeof startingBalances !== 'object')
            throw new Error('Starting balances must be an object containing BTC values of each account')
        for (let bot of Object.keys(bots)) {
            if (!startingBalances.hasOwnProperty(bot) || !startingBalances[bot])
                throw new Error(`Missing starting balance for bot ${bot}`)
        }
        this.startingBalances = startingBalances
        this.entryPrice = entryPrice
        this.priceP = entryPrice
        this.priceA = priceA
        this.priceB = priceB
        this.priceR = priceR
        this.leverage = leverage
        this.feeType = feeType
        this.isMargin = isMargin
        this.positions = {
            [BOT_LONG_1]: [],
            [BOT_SHORT_1]: []
        }
        this.stats = {
            [BOT_LONG_1]: stats,
            [BOT_SHORT_1]: stats
        }
    }

    setStrategies(
        strategies,
        strategySignalThreshold = {
            buy: 1,
            sell: 1
        }
    ) {
        if (!Array.isArray(strategies))
            throw new Error('Strategies must be passed as arrays')

        this.strategies = []
        for (let strategy of strategies)
            this.strategies.push(strategy.name)
        this.strategySignalThreshold = strategySignalThreshold
    }

    _initializeAccounts(startingBalances) {
        this.bots = [...bots]
        Logger.info('Initializing accounts..')
        for (let _bot of Object.keys(this.bots))
            this.bots[_bot] = _getBotInstance(
                parseFloat(startingBalances[_bot]).toFixed(8),
                _bot === BOT_SHORT_1 ? POSITION_SHORT : POSITION_LONG
            )
        Logger.info('Accounts:', this.bots)
    }

    async _fetchCandles() {
        const fetchOHLCV = new FetchOHLCV(this.exchange)
        this.candles = await fetchOHLCV.getCandles(this.symbol, this.timeFrame, this.fromDateTime, this.toDateTime, this.exchangeParams)
    }

    async simulate() {
        if (!this.ranSetBotParams)
            throw new Error('Please call setBotParams() before simulating')
        this._initializeAccounts(this.startingBalances)
        await this._fetchCandles()

        if (this.isMargin)
            return this._simulateWithMargin()
        else
            return this._simulateWithoutMargin()
    }

    _getFees(capital) {
        return capital * 0.075 * 0.01
    }

    _getFormattedDateFromTimestamp(timestamp) {
        return new Date(timestamp).toUTCString()
    }

    _getBotPosition(
        entry,
        amount,
        direction,
        isExit,
        time,
        candle,
        txFees,
        txFeesUsd
    ) {
        return {
            entry,
            amount,
            direction,
            isExit,
            time,
            candle,
            txFees,
            txFeesUsd
        }
    }

    _calcBotPositionBtcValue(
        direction, // Direction of bot
        entry, // Position entry price
        amount, // Position entry amount
        currentPrice // Current BTC price
    ) {
        const e1 = new BigNumber(1).dividedBy(entry).toFixed()
        const e2 = new BigNumber(1).dividedBy(currentPrice).toFixed()
        const totalEntry = new BigNumber(entry).multipliedBy(amount).toFixed()
        const directionalMultiplier = direction === POSITION_LONG ? 1 : -1
        const value = new BigNumber(
            e1
        ).minus(
            e2
        ).multipliedBy(
            totalEntry
        ).multipliedBy(
            directionalMultiplier
        ).toFixed(8)
        return new BigNumber(amount).plus(value).toFixed(8)
    }

    _addBotPosition(bot, price, candle, time) {
        const feePercent = fees[this.feeType]
        // Balance available for trades
        if (parseFloat(bots[bot].balance) > 0) {
            const txFees = new BigNumber(bots[bot].balance)
                .multipliedBy(feePercent)
                .dividedBy(100)
            const txFeesUsd = new BigNumber(txFees).multipliedBy(candle.open).toFixed(8)
            const amount = new BigNumber(bots[bot].balance)
                .minus(txFees)
                .toFixed(8)
            bots[bot].positions.push(
                this._getBotPosition(
                    price,
                    amount,
                    bots[bot].direction,
                    false,
                    time,
                    candle,
                    txFees,
                    txFeesUsd
                )
            )
        } else if (bots[bot].balance === 0 &&
            !bots[bot].positions[bots[bot].positions.length - 1].isExit) {
            //exit position
            const currentPosition = bots[bot].positions[bots[bot].positions.length - 1]
            let amount = this._calcBotPositionBtcValue(
                bots[bot].direction,
                currentPosition.entry,
                currentPosition.amount,
                price
            )
            const txFees = new BigNumber(amount).multipliedBy(feePercent).dividedBy(100)
            const txFeesUsd = new BigNumber(txFees).multipliedBy(candle.open).toFixed(8)
            amount = new BigNumber(amount).minus(txFees).toFixed(8)
            bots[bot].positions.push(
                this._getBotPosition(
                    price,
                    amount,
                    bots[bot].direction,
                    true,
                    time,
                    candle,
                    txFees,
                    txFeesUsd
                )
            )
            bots[bot].balance = amount
        }
    }

    _enterPositionIfNeeded(bot, candle, time) {
        const {bots} = this
        const isLongBot = bot.indexOf('l') !== -1
        const currentPosition = bots[bot].positions.length > 0 ?
            bots[bot].positions[bots[bot].positions.length - 1] :
            null
        const isActivePosition = currentPosition && !currentPosition.isExit
        if (isActivePosition) {
            //needs to exit
            if (isLongBot &&
                new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP + this.priceA)) &&
                new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP + this.priceA))) {
                this._addBotPosition(
                    bot,
                    this.priceP + this.priceA,
                    candle,
                    time
                )
                this.priceP += this.priceA
            } else if (
                new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP - this.priceA)) &&
                new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP - this.priceA))
            ) {
                this._addBotPosition(
                    bot,
                    this.priceP - this.priceA,
                    candle,
                    time
                )
                this.priceP -= this.priceA
            }
        } else {
            if (currentPosition) {
                if (isLongBot) {
                    if (
                        new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP - this.priceB)) &&
                        new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP - this.priceB))) {
                        this._addBotPosition(
                            bot,
                            this.priceP - this.priceB,
                            candle,
                            time
                        )
                        this.priceP -= this.priceB

                    } else if (new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP + this.priceR)) &&
                        new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP + this.priceR))) {
                        this._addBotPosition(
                            bot,
                            this.priceP - this.priceB,
                            candle,
                            time
                        )
                    }
                } else {
                    if (
                        new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP + this.priceB)) &&
                        new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP + this.priceB))
                    ) {
                        this._addBotPosition(
                            bot,
                            this.priceP + this.priceB,
                            candle,
                            time
                        )
                        this.priceP += this.priceB
                    } else if (
                        new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.priceP - this.priceR)) &&
                        new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.priceP - this.priceR))
                    ) {
                        this._addBotPosition(
                            bot,
                            this.priceP + this.priceB,
                            candle,
                            time
                        )
                    }
                }
            } else if (
                new BigNumber(candle[CANDLE_LOW_POSITION].isLessThanOrEqualTo(this.entryPrice)) &&
                new BigNumber(candle[CANDLE_HIGH_POSITION].isGreaterThanOrEqualTo(this.entryPrice))
            )
                this._addBotPosition(
                    bot,
                    this.entryPrice,
                    candle,
                    time
                )
        }
    }

    _simulateWithoutMargin() {
        const {candles, bots} = this
        for (let candle of candles) {
            const time = new Date(candle[CANDLE_TIME_FRAME_POSITION]).toUTCString()
            for (let bot of Object.keys(bots)) {
                this._enterPositionIfNeeded(
                    bot,
                    candle,
                    time
                )
            }
        }
    }

    _simulateWithMargin(values) {
        // TODO: Add margin logic
        return this._simulateWithoutMargin(values)
    }

}