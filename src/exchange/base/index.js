const ccxt = require('ccxt')

class BaseExchange {
    constructor(id, options = { enableRateLimit: true }) {
        if (!ccxt.exchanges.includes(id))
            throw new Error('Exchange does not exist')
        this.id = id
        this.exchange = new ccxt[id](options)
    }

    getMarkets() {
        return this.exchange.loadMarkets()
    }

    getSymbols() {
        if (this.exchange.symbols) return this.exchange.symbols
        else throw new Error('Please load markets before accessing symbols')
    }

    getOrderbook(symbol, limit = 25) {
        return this.exchange.fetchOrderBook(symbol, limit)
    }

    getOhlc(
        symbol,
        timeframe,
        since = undefined,
        limit = undefined,
        params = {}
    ) {
        if (!this.exchange.has['fetchOHLCV'])
            throw new Error('Exchange does not OHLCV through ccxt')
        if (!this.exchange.timeframes[timeframe])
            throw new Error('Exchange does not support this timeframe')
        return this.exchange.fetchOHLCV(symbol, timeframe, since, limit, params)
    }

    getFetchBalance() {
        if (!this.exchange.has['fetchBalance'])
            throw new Error('Exchange does not support balances through ccxt')
        return this.exchange.fetchBalance()
    }

    getAvailableTimeframes() {
        return this.exchange.timeframes
    }

    getExchange() {
        return this.exchange
    }
}

module.exports = BaseExchange
