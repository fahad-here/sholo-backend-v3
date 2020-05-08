const moment = require('moment')
const { GetCandleKey, Logger } = require('../../utils')
const RedisClient = require('../redis')
const { promisify } = require('util')

class FetchOHLCV {
    constructor(exchange) {
        this.exchange = exchange
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
        let fromMS = this._roundDate(
            fromDateTime,
            moment.duration(time, unit),
            'floor'
        ).valueOf()
        let toMS = this._roundDate(
            toDateTime,
            moment.duration(time, unit),
            'floor'
        ).valueOf()
        if (fromMS >= toMS)
            throw new Error('Last candle cannot be before the 1st candle')
        await this.exchange.getMarkets()
        if (this.exchange.getSymbols().indexOf(symbol) === -1)
            throw new Error('Exchange does not have this symbol, ' + symbol)
        return await this._newMethod(
            symbol,
            timeFrame,
            fromMS,
            toMS,
            exchangeParams
        )
    }

    _sortCandlesByTimeFrame(candles) {
        return candles.sort((a, b) => a[0] - b[0])
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
            console.log('fetched', fetchedCandles)
            Object.keys(fetchedCandles).map((index) =>
                this._checkCandleExistsAndAdd(fetchedCandles[index])
            )
            firstCandleTime =
                fetchedCandles[maxCandles - 1][0] +
                moment.duration(time, unit).asMilliseconds()
            candlesLeftToFetch -= maxCandles
            maxCandles =
                candlesLeftToFetch <= 1000 ? candlesLeftToFetch : maxCandles
        }
        this.cachedCandles = this._sortCandlesByTimeFrame(this.cachedCandles)
        this.cachedCandleTimeFrames = this.cachedCandleTimeFrames.sort(
            (a, b) => a - b
        )
        console.log('cached', this.cachedCandles)
        let stringifiedCandles = JSON.stringify(this.cachedCandles)
        RedisClient.set(candleKey, stringifiedCandles)
    }

    _roundDate(date, duration, method) {
        return moment(Math[method](+date / +duration) * +duration)
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
        console.log('req', requiredTimeStamps)
        return requiredTimeStamps
    }

    async _newMethod(symbol, timeFrame, fromMS, toMS, exchangeParams) {
        const requiredFromMS = fromMS
        const requiredToMS = toMS
        const getAsync = promisify(RedisClient.get).bind(RedisClient)
        const candleKey = GetCandleKey(this.exchange.id, symbol, timeFrame)
        Logger.info('Candle Key: ' + candleKey)
        //await RedisClient.del(candleKey)
        const cachedStringifiedCandles = await getAsync(candleKey)
        Logger.info('Cached String: ' + cachedStringifiedCandles)

        if (cachedStringifiedCandles) {
            this.cachedCandles = JSON.parse(cachedStringifiedCandles)
            this.cachedCandles.map((candle) =>
                this.cachedCandleTimeFrames.push(candle[0])
            )
            Logger.info(
                'Pre Fetch, Cached Candles: ' + cachedStringifiedCandles
            )
            Logger.info(
                'Pre Fetch, Cached Candles TimeFrames: ' +
                    JSON.stringify(this.cachedCandleTimeFrames)
            )
            this.requiredTimeFrames = this._setRequiredTimestamps(
                timeFrame,
                fromMS,
                toMS
            )
            console.log(this.requiredTimeFrames)
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
                                toFetchCandleTimestamps.slice(i, i + 1)
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
            this.candles = this.cachedCandles.slice(
                this.cachedCandleTimeFrames.indexOf(requiredFromMS),
                this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1
            )
            const slicedTime = this.cachedCandleTimeFrames.slice(
                this.cachedCandleTimeFrames.indexOf(requiredFromMS),
                this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1
            )
            Logger.info(
                'Post Fetch, returned candles: ' + JSON.stringify(this.candles)
            )
            Logger.info(
                'Post Fetch, returned timeStamps: ' + JSON.stringify(slicedTime)
            )
            return this.candles
        } else {
            Logger.info('Case 6: no saved candles, fetch all candles')
            await this._fetchAndCacheCandles(
                candleKey,
                symbol,
                timeFrame,
                fromMS,
                toMS,
                exchangeParams
            )
            const slicedTime = this.cachedCandleTimeFrames.slice(
                this.cachedCandleTimeFrames.indexOf(requiredFromMS),
                this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1
            )
            Logger.info(
                'Post Fetch, returned candles: ' +
                    JSON.stringify(this.cachedCandles)
            )
            Logger.info(
                'Post Fetch, returned timeStamps: ' + JSON.stringify(slicedTime)
            )
            return this.cachedCandles
        }
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
        const candleKey = GetCandleKey(this.exchange.id, symbol, timeFrame)
        Logger.info('Candle Key: ' + candleKey)
        await RedisClient.del(candleKey)
        const cachedStringifiedCandles = await getAsync(candleKey)
        Logger.info('Cached String: ' + cachedStringifiedCandles)
        if (cachedStringifiedCandles) {
            this.cachedCandles = JSON.parse(cachedStringifiedCandles)
            this.cachedCandles.map((candle) =>
                this.cachedCandleTimeFrames.push(candle[0])
            )
            Logger.info(
                'Pre Fetch, Cached Candles: ' + cachedStringifiedCandles
            )
            Logger.info(
                'Pre Fetch, Cached Candles TimeFrames: ' +
                    JSON.stringify(this.cachedCandleTimeFrames)
            )
            const firstCandleTimeFrame = this.cachedCandleTimeFrames[0]
            const lastCandleTimeFrame = this.cachedCandleTimeFrames[
                this.cachedCandleTimeFrames.length - 1
            ]
            Logger.info('First Candle Time Frame: ' + firstCandleTimeFrame)
            Logger.info('FromMS: ' + fromMS)
            Logger.info('Last Candle Time Frame: ' + lastCandleTimeFrame)
            Logger.info('ToMS: ' + toMS)
            //figure which all candles to fetch
            // case 4
            // fromMS and toMS are both either lower than the 1st saved candle time frame or higher than the last saved candle time frame
            // in either cases we fetch the data without changing the MS
            //case 1
            //fromMS is lesser than 1st saved candle time frame and toMS is lesser than the last saved candle time frame
            //fromMS stays the same and toMS is equal to the 1st saved candle

            //case 2
            //fromMS is greater than 1st saved candle time frame and toMS is greater than the last saved candle time frame
            //fromMS becomes the last saved candle and toMS stay the same

            //case 3
            //fromMS is lesser than the 1st saved candle time frame and toMS is greater than the last saved candle time frame
            // in this case we need to fetch and save twice
            // 1st fromMS is the same and toMS is the 1st saved candle
            // 2nd fromMS is the last saved candle and toMS is the same

            // case 5
            // fromMS and toMS are between the 1st and last candle time frame
            // just slice the array and send
            if (
                (fromMS < firstCandleTimeFrame &&
                    toMS < firstCandleTimeFrame) ||
                (fromMS > lastCandleTimeFrame && toMS > lastCandleTimeFrame)
            ) {
                Logger.info(
                    'Case 4: fromMS < firstCandleTimeFrame && toMS < firstCandleTimeFrame) || (fromMS>lastCandleTimeFrame && toMS> lastCandleTimeFrame'
                )
                Logger.info(
                    'fetch candles either all before or all after the saved timeframe'
                )
                await this._fetchAndCacheCandles(
                    candleKey,
                    symbol,
                    timeFrame,
                    fromMS,
                    toMS,
                    exchangeParams
                )
            } else if (
                fromMS < firstCandleTimeFrame &&
                toMS < lastCandleTimeFrame
            ) {
                Logger.info(
                    'Case 1: fromMS < firstCandleTimeFrame && toMS < lastCandleTimeFrame'
                )
                Logger.info('fetch candles before the saved timeframe')
                toMS = firstCandleTimeFrame
                await this._fetchAndCacheCandles(
                    candleKey,
                    symbol,
                    timeFrame,
                    fromMS,
                    toMS,
                    exchangeParams
                )
            } else if (
                fromMS >= firstCandleTimeFrame &&
                toMS > lastCandleTimeFrame
            ) {
                Logger.info(
                    'Case 2: fromMS >= firstCandleTimeFrame && toMS > lastCandleTimeFrame'
                )
                Logger.info('fetch candles after the saved timeframe')
                fromMS = lastCandleTimeFrame
                await this._fetchAndCacheCandles(
                    candleKey,
                    symbol,
                    timeFrame,
                    fromMS,
                    toMS,
                    exchangeParams
                )
            } else if (
                fromMS < firstCandleTimeFrame &&
                toMS > lastCandleTimeFrame
            ) {
                Logger.info(
                    'Case 3: fromMS < firstCandleTimeFrame && toMS > lastCandleTimeFrame'
                )
                Logger.info(
                    'fetch candles before and after the saved timeframe'
                )
                let tempToMS = toMS
                toMS = firstCandleTimeFrame
                await this._fetchAndCacheCandles(
                    candleKey,
                    symbol,
                    timeFrame,
                    fromMS,
                    toMS,
                    exchangeParams
                )
                fromMS = lastCandleTimeFrame
                toMS = tempToMS
                await this._fetchAndCacheCandles(
                    candleKey,
                    symbol,
                    timeFrame,
                    fromMS,
                    toMS,
                    exchangeParams
                )
            }

            Logger.info(
                'Case 5: fromMS and toMS are between the 1st and last candle time frame'
            )
            Logger.info(
                'Post Fetch, Cached Candles: ' +
                    JSON.stringify(this.cachedCandles)
            )
            Logger.info(
                'Post Fetch, Cached Candles TimeFrames: ' +
                    JSON.stringify(this.cachedCandleTimeFrames)
            )
            Logger.info('Required From Time MS: ' + requiredFromMS)
            Logger.info('Required To Time MS: ' + requiredToMS)
            Logger.info(
                'Required From Time MS Index: ' +
                    this.cachedCandleTimeFrames.indexOf(requiredFromMS)
            )
            Logger.info(
                'Required To Time MS Index: ' +
                    (this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1)
            )
            this.candles = this.cachedCandles.slice(
                this.cachedCandleTimeFrames.indexOf(requiredFromMS),
                this.cachedCandleTimeFrames.indexOf(requiredToMS) + 1
            )
            Logger.info(
                'Post Fetch, returned candles: ' + JSON.stringify(this.candles)
            )
            return this.candles
        } else {
            Logger.info('Case 6: no saved candles, fetch all candles')
            await this._fetchAndCacheCandles(
                candleKey,
                symbol,
                timeFrame,
                fromMS,
                toMS,
                exchangeParams
            )
            Logger.info(
                'Post Fetch, returned candles: ' +
                    JSON.stringify(this.cachedCandles)
            )
            return this.cachedCandles
        }
    }
}

module.exports = FetchOHLCV
