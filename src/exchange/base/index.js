const ccxt = require('ccxt')

export class BaseExchange {

    constructor(id, options = {enableRateLimit: true}) {
        if (!ccxt.exchanges.includes(id))
            throw new Error("Exchange does not exist")
        this.id = id
        this.exchange = new ccxt[id](options)
    }

    getMarkets() {
        return this.exchange.loadMarkets()
    }

    getOrderbook(symbol, limit = 25) {
        return this.exchange.fetchOrderBook(symbol, limit)
    }

    getOhlc(symbol, timeframe, since, limit = 100) {
        return this.exchange.fetchOHLCV(symbol, timeframe, since, limit)
    }

    getFetchBalance(){
        if(!this.exchange.has['fetchBalance'])
            throw new Error("Exchange does not support balances through ccxt")
        return this.exchange.fetchBalance()
    }

}