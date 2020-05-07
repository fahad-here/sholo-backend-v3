const moment = require('moment')

class FetchOHLCV {
    constructor(exchange) {
        this.exchange = exchange
        this.candles = []
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
        let toMS =
            this._roundDate(
                toDateTime,
                moment.duration(time, unit),
                'floor'
            ).valueOf() + moment.duration(time, unit).asMilliseconds()
        if (fromMS >= toMS)
            throw new Error('Last candle cannot be before the 1st candle')
        await this.exchange.getMarkets()
        if (this.exchange.getSymbols().indexOf(symbol) === -1)
            throw new Error('Exchange does not have this symbol, ' + symbol)
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
            Object.keys(fetchedCandles).map((index) =>
                this.candles.push(fetchedCandles[index])
            )
            firstCandleTime =
                fetchedCandles[maxCandles - 1][0] +
                moment.duration(time, unit).asMilliseconds()
            candlesLeftToFetch -= maxCandles
            maxCandles =
                candlesLeftToFetch <= 1000 ? candlesLeftToFetch : maxCandles
        }
        if (totalNumberOfCandles === this.candles.length) return this.candles
        else throw new Error('Candles fetched were inconsistent')
    }

    _roundDate(date, duration, method) {
        return moment(Math[method](+date / +duration) * +duration)
    }
}

module.exports = FetchOHLCV
