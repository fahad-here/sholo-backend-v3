const BigNumber = require('bignumber.js')

const { Logger } = require('../utils')
const { Binance, Bitmex } = require('../exchange')
const { FetchOHLCV } = require('../data')
const {
    CANDLE_POSITIONS,
    ALLOWED_EXCHANGES,
    FEES,
    BINANCE_EXCHANGE,
    BITMEX_EXCHANGE,
    POSITION_LONG,
    POSITION_SHORT
} = require('../constants')
const { TIME_FRAME, OPEN, HIGH, LOW, CLOSE } = CANDLE_POSITIONS

const BOT_SHORT_1 = 's1'
const BOT_LONG_1 = 'l1'

const bots = {
    [BOT_SHORT_1]: {},
    [BOT_LONG_1]: {}
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
    initialCandlePrice: null,
    finalCandlePrice: null,
    positionCounter: 0
}

const _getBotInstance = (balance, direction, priceP) => {
    return {
        balance, // Balance in btc
        positions: [], // Position history
        direction, // Bot direction
        waitForExit: false, // Wait to exit position after price goes back to entry
        priceP
    }
}

class Simulator {
    ranSetBotParams = false

    constructor(
        exchangeName,
        exchangeParams,
        symbol,
        timeFrame,
        fromDateTime,
        toDateTime
    ) {
        if (ALLOWED_EXCHANGES.indexOf(exchangeName) === -1)
            throw new Error(`${exchangeName} is not yet supported`)
        switch (exchangeName) {
            case BITMEX_EXCHANGE:
                this.exchange = new Bitmex(exchangeParams)
                break
            case BINANCE_EXCHANGE:
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
        startingBalances = { [BOT_SHORT_1]: 1, [BOT_LONG_1]: 1 },
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
        if (entryPrice < 0) throw new Error('Entry price must be positive')
        if (priceA < 0) throw new Error('Entry price must be positive')
        if (priceB < 0) throw new Error('Entry price must be positive')
        if (priceR < 0) throw new Error('Entry price must be positive')
        if (leverage > 100 || leverage < 1)
            throw new Error('Leverage must be between 1-100x')
        if (typeof startingBalances !== 'object')
            throw new Error(
                'Starting balances must be an object containing BTC values of each account'
            )
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
        this.stats = stats
    }

    _getTotalBtcBalances() {
        let totalBtcBalance = 0
        for (let _bot of Object.keys(this.bots))
            totalBtcBalance = new BigNumber(totalBtcBalance)
                .plus(this.bots[_bot].balance)
                .toFixed(8)
        return totalBtcBalance
    }

    _initializeAccounts() {
        this.bots = { ...bots }
        Logger.info('Initializing accounts..')
        for (let _bot of Object.keys(this.bots)) {
            this.bots[_bot] = _getBotInstance(
                new BigNumber(this.startingBalances[_bot])
                    .multipliedBy(this.leverage)
                    .toFixed(8),
                _bot === BOT_SHORT_1 ? POSITION_SHORT : POSITION_LONG,
                this.priceP
            )
        }
        this.stats.totalInitialBtcBalance = this._getTotalBtcBalances()
        Logger.info('Accounts:', this.bots)
    }

    async _fetchCandles() {
        const fetchOHLCV = new FetchOHLCV(this.exchange)
        this.candles = await fetchOHLCV.getCandles(
            this.symbol,
            this.timeFrame,
            this.fromDateTime,
            this.toDateTime,
            this.exchangeParams
        )
    }

    async simulate() {
        if (!this.ranSetBotParams)
            throw new Error('Please call setBotParams() before simulating')
        this._initializeAccounts()

        await this._fetchCandles()

        if (this.isMargin) return this._simulateWithMargin()
        else return this._simulateWithoutMargin()
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
        const value = new BigNumber(e1)
            .minus(e2)
            .multipliedBy(totalEntry)
            .multipliedBy(directionalMultiplier)
            .toFixed(8)
        return new BigNumber(amount).plus(value).toFixed(8)
    }

    _addBotPosition(bot, price, candle, time) {
        const feePercent = FEES[this.feeType]
        // Balance available for trades
        if (parseFloat(this.bots[bot].balance) > 0) {
            const txFees = new BigNumber(this.bots[bot].balance)
                .multipliedBy(feePercent)
                .dividedBy(100)
                .toFixed(8)
            const txFeesUsd = new BigNumber(txFees)
                .multipliedBy(candle[OPEN])
                .toFixed(8)
            const amount = new BigNumber(this.bots[bot].balance)
                .minus(txFees)
                .toFixed(8)
            this.bots[bot].positions.push(
                this._getBotPosition(
                    price,
                    amount,
                    this.bots[bot].direction,
                    false,
                    time,
                    candle,
                    txFees,
                    txFeesUsd
                )
            )
            this.bots[bot].balance = 0
        } else if (
            this.bots[bot].balance === 0 &&
            !this.bots[bot].positions[this.bots[bot].positions.length - 1]
                .isExit
        ) {
            //exit position
            const currentPosition = this.bots[bot].positions[
                this.bots[bot].positions.length - 1
            ]
            let amount = this._calcBotPositionBtcValue(
                this.bots[bot].direction,
                currentPosition.entry,
                currentPosition.amount,
                price
            )
            const txFees = new BigNumber(amount)
                .multipliedBy(feePercent)
                .dividedBy(100)
                .toFixed(8)
            const txFeesUsd = new BigNumber(txFees)
                .multipliedBy(candle[OPEN])
                .toFixed(8)
            amount = new BigNumber(amount).minus(txFees).toFixed(8)
            this.bots[bot].positions.push(
                this._getBotPosition(
                    price,
                    amount,
                    this.bots[bot].direction,
                    true,
                    time,
                    candle,
                    txFees,
                    txFeesUsd
                )
            )
            this.bots[bot].balance = amount
        }
    }

    _enterPositionIfNeeded(bot, candle, time) {
        const isLongBot = bot.indexOf('l') !== -1
        const currentPosition =
            this.bots[bot].positions.length > 0
                ? this.bots[bot].positions[this.bots[bot].positions.length - 1]
                : null
        const priceP = this.bots[bot].priceP
        const isActivePosition = currentPosition && !currentPosition.isExit
        if (!this.notify)
            if (isActivePosition) {
                //needs to exit
                if (
                    isLongBot &&
                    new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                        priceP + this.priceA
                    ) &&
                    new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                        priceP + this.priceA
                    )
                ) {
                    this._addBotPosition(
                        bot,
                        priceP + this.priceA,
                        candle,
                        time
                    )
                    this.bots[bot].priceP += this.priceA
                } else if (
                    !isLongBot &&
                    new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                        priceP - this.priceA
                    ) &&
                    new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                        priceP - this.priceA
                    )
                ) {
                    this._addBotPosition(
                        bot,
                        priceP - this.priceA,
                        candle,
                        time
                    )
                    this.bots[bot].priceP -= this.priceA
                }
            } else {
                if (currentPosition) {
                    if (isLongBot) {
                        if (
                            new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                                priceP - this.priceB
                            ) &&
                            new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                                priceP - this.priceB
                            )
                        ) {
                            this._addBotPosition(
                                bot,
                                priceP - this.priceB,
                                candle,
                                time
                            )
                            this.bots[bot].priceP -= this.priceB
                            this.stats.positionCounter++
                        } else if (
                            new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                                priceP + this.priceR
                            ) &&
                            new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                                priceP + this.priceR
                            )
                        ) {
                            this._addBotPosition(
                                bot,
                                priceP + this.priceR,
                                candle,
                                time
                            )
                            this.notify = {
                                candle,
                                bot,
                                time,
                                priceP: priceP,
                                price: priceP + this.priceR
                            }
                            this.stats.positionCounter++
                        }
                    } else {
                        if (
                            new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                                priceP + this.priceB
                            ) &&
                            new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                                priceP + this.priceB
                            )
                        ) {
                            this._addBotPosition(
                                bot,
                                priceP + this.priceB,
                                candle,
                                time
                            )
                            this.bots[bot].priceP += this.priceB
                            this.stats.positionCounter++
                        } else if (
                            new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                                priceP - this.priceR
                            ) &&
                            new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                                priceP - this.priceR
                            )
                        ) {
                            this._addBotPosition(
                                bot,
                                priceP - this.priceR,
                                candle,
                                time
                            )
                            this.notify = {
                                candle,
                                bot,
                                time,
                                price: priceP - this.priceR
                            }
                            this.stats.positionCounter++
                        }
                    }
                } else if (
                    new BigNumber(candle[LOW]).isLessThanOrEqualTo(
                        this.entryPrice
                    ) &&
                    new BigNumber(candle[HIGH]).isGreaterThanOrEqualTo(
                        this.entryPrice
                    )
                ) {
                    this._addBotPosition(bot, this.entryPrice, candle, time)
                    this.stats.positionCounter++
                }
            }
    }

    _calculateStats(lastCandle) {
        let totalEndingBtcBalance = 0
        let totalFeesBtcPaid = 0
        let totalFeesUsdPaid = 0
        for (let bot of Object.keys(this.bots)) {
            const btcBalance =
                this.bots[bot].balance !== 0
                    ? this.bots[bot].balance
                    : this._calcBotPositionBtcValue(
                          this.bots[bot].direction,
                          this.bots[bot].positions[
                              this.bots[bot].positions.length - 1
                          ].entry,
                          this.bots[bot].positions[
                              this.bots[bot].positions.length - 1
                          ].amount,
                          lastCandle[CLOSE]
                      )
            this.bots[bot].positions.map((position) => {
                totalFeesBtcPaid = new BigNumber(totalFeesBtcPaid)
                    .plus(position.txFees)
                    .toFixed(8)
                totalFeesUsdPaid = new BigNumber(totalFeesUsdPaid)
                    .plus(position.txFeesUsd)
                    .toFixed(8)
            })
            totalEndingBtcBalance = new BigNumber(totalEndingBtcBalance)
                .plus(btcBalance)
                .toFixed(8)
        }
        this.stats.totalEndingBtcBalance = totalEndingBtcBalance
        this.stats.totalEndingUsdBalance = new BigNumber(totalEndingBtcBalance)
            .multipliedBy(lastCandle[CLOSE])
            .toFixed(4)
        this.stats.totalBtcPnl = new BigNumber(this.stats.totalEndingBtcBalance)
            .minus(this.stats.totalInitialBtcBalance)
            .toFixed(4)
        this.stats.totalUsdPnl = new BigNumber(this.stats.totalEndingUsdBalance)
            .minus(this.stats.totalInitialUsdBalance)
            .toFixed(4)
        this.stats.totalBtcPnlPercent = new BigNumber(this.stats.totalBtcPnl)
            .dividedBy(this.stats.totalInitialBtcBalance)
            .multipliedBy(100)
            .toFixed(4)
        this.stats.totalUsdPnlPercent = new BigNumber(this.stats.totalUsdPnl)
            .dividedBy(this.stats.totalInitialUsdBalance)
            .multipliedBy(100)
            .toFixed(4)
        this.stats.totalFeesBtcPaid = totalFeesBtcPaid
        this.stats.totalFeesUsdPaid = totalFeesUsdPaid
    }

    _simulateWithoutMargin() {
        const { candles, bots } = this
        let iterator = 0
        for (let candle of candles) {
            if (iterator === 0) {
                for (let bot of Object.keys(bots)) {
                    this.stats.totalInitialUsdBalance = new BigNumber(
                        this.stats.totalInitialBtcBalance
                    )
                        .multipliedBy(candle[OPEN])
                        .toFixed(4)
                }
                this.stats.initialCandlePrice = candle[OPEN]
            }
            iterator++
            const time = new Date(candle[TIME_FRAME]).toUTCString()
            for (let bot of Object.keys(bots)) {
                this._enterPositionIfNeeded(bot, candle, time)
            }
            if (iterator === candles.length) {
                this._calculateStats(candle)
                this.stats.finalCandlePrice = candle[CLOSE]
            }
        }
        return {
            stats: this.stats,
            bots: this.bots,
            notify: this.notify
        }
    }

    _simulateWithMargin(values) {
        // TODO: Add margin logic
        return this._simulateWithoutMargin(values)
    }
}

module.exports = Simulator
