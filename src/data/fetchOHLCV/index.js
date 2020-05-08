const moment = require('moment')
const { GetCandleKey, RoundDate } = require('../../utils')
const RedisClient = require('../redis')
const { promisify } = require('util')

class FetchOHLCV {
    constructor(exchange, test = false) {
        this.exchange = exchange
        this.test = test
        this.candles = []
        this.cachedCandles = []
        this.cachedCandleTimeFrames = []
    }

    async getCandles(
        symbol,
        timeFrame,
        fromDateTime,
        toDateTime,
        exchangeParams
    ) {
        let unit = timeFrame[timeFrame.length - 1]
        let time = parseInt(timeFrame.slice(0, timeFrame.indexOf(unit)))
        let fromMS = RoundDate(
            fromDateTime,
            moment.duration(time, unit),
            'floor'
        ).valueOf()
        let toMS = RoundDate(
            toDateTime,
            moment.duration(time, unit),
            'floor'
        ).valueOf()
        if (fromMS >= toMS)
            throw new Error('Last candle cannot be before the 1st candle')
        await this.exchange.getMarkets()
        if (this.exchange.getSymbols().indexOf(symbol) === -1)
            throw new Error('Exchange does not have this symbol, ' + symbol)
        return await this._checkCacheOrFetchCandles(
            symbol,
            timeFrame,
            fromMS,
            toMS,
            exchangeParams
        )
    }

    _checkCandleExistsAndAdd(candleToAdd) {
        if (this.cachedCandleTimeFrames.indexOf(candleToAdd[0]) === -1) {
            this.cachedCandles.push(candleToAdd)
            this.cachedCandleTimeFrames.push(candleToAdd[0])
        }
    }

    async _fetchAndCacheCandles(
        candleKey,
        symbol,
        timeFrame,
        fromMS,
        toMS,
        exchangeParams
    ) {
        let fetchedTimeStamps = []
        let unit = timeFrame[timeFrame.length - 1]
        let time = parseInt(timeFrame.slice(0, timeFrame.indexOf(unit)))
        toMS = toMS + moment.duration(time, unit).asMilliseconds()
        let firstCandleTime = fromMS
        let totalNumberOfCandles =
            (toMS - fromMS) / moment.duration(time, unit).asMilliseconds()
        let maxCandles =
            totalNumberOfCandles >= 1000 ? 1000 : totalNumberOfCandles
        let candlesLeftToFetch = totalNumberOfCandles

        while (candlesLeftToFetch > 0) {
            let fetchedCandles = await this.exchange.getOhlc(
                symbol,
                timeFrame,
                firstCandleTime,
                maxCandles,
                exchangeParams
            )
            fetchedCandles.map((currentCandle) => {
                fetchedTimeStamps = [...fetchedTimeStamps, currentCandle[0]]
                this._checkCandleExistsAndAdd(currentCandle)
            })
            firstCandleTime =
                fetchedCandles[maxCandles - 1][0] +
                moment.duration(time, unit).asMilliseconds()
            candlesLeftToFetch -= maxCandles
            maxCandles =
                candlesLeftToFetch <= 1000 ? candlesLeftToFetch : maxCandles
        }
        this.cachedCandles = this.cachedCandles.sort((a, b) => a[0] - b[0])
        this.cachedCandleTimeFrames = this.cachedCandleTimeFrames.sort(
            (a, b) => a - b
        )
        let stringifiedCandles = JSON.stringify(this.cachedCandles)
        RedisClient.set(candleKey, stringifiedCandles)
    }

    _setRequiredTimestamps(timeFrame, fromMS, toMS) {
        let requiredTimeStamps = []
        let unit = timeFrame[timeFrame.length - 1]
        let time = parseInt(timeFrame.slice(0, timeFrame.indexOf(unit)))
        requiredTimeStamps.push(fromMS)
        while (fromMS !== toMS) {
            fromMS += moment.duration(time, unit).asMilliseconds()
            requiredTimeStamps.push(fromMS)
        }
        return requiredTimeStamps
    }

    async _checkCacheOrFetchCandles(
        symbol,
        timeFrame,
        fromMS,
        toMS,
        exchangeParams
    ) {
        const requiredFromMS = fromMS
        const requiredToMS = toMS
        const getAsync = promisify(RedisClient.get).bind(RedisClient)
        const candleKey = this._getTestNotTestCandleKey(symbol, timeFrame)
        const cachedStringifiedCandles = await getAsync(candleKey)

        if (cachedStringifiedCandles) {
            this.cachedCandles = JSON.parse(cachedStringifiedCandles)
            this.cachedCandles.map((candle) =>
                this.cachedCandleTimeFrames.push(candle[0])
            )
            this.requiredTimeFrames = this._setRequiredTimestamps(
                timeFrame,
                fromMS,
                toMS
            )
            if (this.requiredTimeFrames.length > 0) {
                const toFetchCandleTimestamps = []
                this.requiredTimeFrames.map((requiredTimeFrame) => {
                    if (
                        this.cachedCandleTimeFrames.indexOf(
                            requiredTimeFrame
                        ) === -1
                    )
                        toFetchCandleTimestamps.push(requiredTimeFrame)
                })
                const notEqualIndex = []
                toFetchCandleTimestamps.map((currentTimeStamp, index) => {
                    if (index !== toFetchCandleTimestamps.length - 1) {
                        let unit = timeFrame[timeFrame.length - 1]
                        let time = parseInt(
                            timeFrame.slice(0, timeFrame.indexOf(unit))
                        )
                        if (
                            currentTimeStamp +
                                moment.duration(time, unit).asMilliseconds() !==
                            toFetchCandleTimestamps[index + 1]
                        )
                            notEqualIndex.push(index + 1)
                    }
                })
                let toFetchArray = []
                if (notEqualIndex.length > 0) {
                    toFetchArray.push(
                        toFetchCandleTimestamps.slice(0, notEqualIndex[0])
                    )
                    for (let i = 0; i < notEqualIndex.length; i++) {
                        if (i === notEqualIndex.length - 1)
                            toFetchArray.push(
                                toFetchCandleTimestamps.slice(
                                    notEqualIndex[i],
                                    toFetchCandleTimestamps.length
                                )
                            )
                        else
                            toFetchArray.push(
                                toFetchCandleTimestamps.slice(
                                    notEqualIndex[i],
                                    notEqualIndex[i + 1]
                                )
                            )
                    }
                } else toFetchArray.push(toFetchCandleTimestamps)

                for (let i = 0; i < toFetchArray.length; i++)
                    await this._fetchAndCacheCandles(
                        candleKey,
                        symbol,
                        timeFrame,
                        toFetchArray[i][0],
                        toFetchArray[i][toFetchArray[i].length - 1],
                        exchangeParams
                    )
            }
            return this.cachedCandles.slice(
                this.cachedCandleTimeFrames.indexOf(requiredFromMS),
                this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1
            )
        } else {
            await this._fetchAndCacheCandles(
                candleKey,
                symbol,
                timeFrame,
                fromMS,
                toMS,
                exchangeParams
            )
            return this.cachedCandles
        }
    }

    _getTestNotTestCandleKey(symbol, timeFrame) {
        return this.test
            ? 'test__' + GetCandleKey(this.exchange.id, symbol, timeFrame)
            : GetCandleKey(this.exchange.id, symbol, timeFrame)
    }

    _clearCache(symbol, timeFrame) {
        const candleKey = this._getTestNotTestCandleKey(symbol, timeFrame)
        RedisClient.del(candleKey)
    }
}

module.exports = FetchOHLCV
