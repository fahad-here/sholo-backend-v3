const Simulator = require('../../simulator')
const BOT_SHORT_1 = 's1'
const BOT_LONG_1 = 'l1'
const { CANDLE_POSITIONS } = require('../../constants')
const { HIGH, LOW, CLOSE } = CANDLE_POSITIONS
const tulind = require('tulind')
const BigNumber = require('bignumber.js')

class SholoPrediction extends Simulator {
    constructor(
        exchangeName,
        exchangeParams,
        symbol,
        timeFrame,
        fromDateTime,
        toDateTime,
        minDifference = 10,
        entryPrice = 10000,
        priceA = 200,
        priceB = 100,
        priceR = 300,
        leverage = 1,
        feeType = 'taker'
    ) {
        super(
            exchangeName,
            exchangeParams,
            symbol,
            timeFrame,
            fromDateTime,
            toDateTime
        )
        this.minDifference = minDifference
        this.startingBalances = { [BOT_SHORT_1]: 1, [BOT_LONG_1]: 1 }
        //this.setBotParams(startingBalances, entryPrice, priceA, priceB, priceR, leverage, feeType)
        //const { bots, stats, notify } = await this.simulate()
    }

    async run() {
        try {
            console.log('inside run')
            await this._fetchCandles()
            let candles = this.candles
            console.log(candles.length)
            let close = candles.map((c) => c[CLOSE])
            let highs = candles.map((c) => c[HIGH])
            let lows = candles.map((c) => c[LOW])
            let high = Math.max(...highs)
            let low = Math.min(...lows)
            console.log('high', high)
            console.log('lows', low)
            console.log('close', close.length)
            let sma = await tulind.indicators.sma.indicator([close], [7])
            console.log(sma[0].length)
            candles.splice(0, 6)
            console.log(candles.length)
            console.log(candles)
            console.log(sma[0])
            let highThrehsold = new BigNumber(sma[0][0])
                .plus(this.minDifference)
                .toFixed(2)
            let lowThrehsold = new BigNumber(sma[0][0])
                .minus(this.minDifference)
                .toFixed(2)
            let highDifference = new BigNumber(high)
                .minus(highThrehsold)
                .toFixed(2)
            let lowDifference = new BigNumber(lowThrehsold)
                .minus(low)
                .toFixed(2)
            console.log(highDifference)
            console.log(lowDifference)
            if (
                new BigNumber(highDifference).isLessThanOrEqualTo(0) ||
                new BigNumber(lowDifference).isLessThanOrEqualTo(0)
            ) {
                throw new Error(
                    `Price difference is to low, need to be in the range ` +
                        `${lowThrehsold} < ${sma[0][0]} < ${highThrehsold}` +
                        `, but the highest value was ${high} ` +
                        `and the lowest value was ${low}`
                )
            }
        } catch (err) {
            throw err
        }
        // this._initializeAccounts()
    }
}

module.exports = SholoPrediction
