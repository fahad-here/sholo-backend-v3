const ccxt = require('ccxt')
const { CREATE_MARKET_ORDER, CREATE_LIMIT_ORDER } = require('../../constants')
const BigNumber = require('bignumber.js')

class BaseExchange {
    constructor(id, options = { enableRateLimit: true }) {
        if (!ccxt.exchanges.includes(id))
            throw new Error('Exchange does not exist')
        this.id = id
        //TODO: Change this when moving to production
        options = {
            ...options,
            verbose: true
        }
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

    setTestNet() {
        this.exchange.urls['api'] = this.exchange.urls['test']
    }

    setLeverage(leverage, symbol) {
        throw new Error('Need to implement this method')
    }

    async createMarketOrder(symbol, side, amount, params = {}) {
        if (!this.exchange.has[CREATE_MARKET_ORDER])
            throw new Error('This exchange does not support market orders')
        return await this.exchange.createMarketOrder(
            symbol,
            side,
            amount,
            params
        )
    }

    async createLimitOrder(symbol, side, amount, price, params) {
        if (!this.exchange.has[CREATE_LIMIT_ORDER])
            throw new Error('This exchange does not support limit orders')
        return await this.exchange.createLimitOrder(
            symbol,
            side,
            amount,
            price,
            params
        )
    }

    async getOrder(orderId, symbol) {
        if (!this.exchange.has['fetchOrder'])
            throw new Error('This exchange does not support fetching an order')
        return await this.exchange.fetchOrder(orderId, symbol)
    }

    async getAllSymbolOrders(symbol) {
        if (!this.exchange.has['fetchOrders'])
            throw new Error('This exchange does not support fetching orders')
        return await this.exchange.fetchOrders(symbol)
    }

    async closeOpenPositions(symbol) {
        throw new Error('Need to implement this method')
    }

    async cancelOpenOrder(orderId, symbol) {
        if (!this.exchange.has['cancelOpenOrder'])
            throw new Error(
                'This exchange does not support cancelling an order'
            )
        return await this.exchange.cancelOrder(orderId, symbol)
    }

    async getTrades(symbol, since, limit, params) {
        if (!this.exchange.hasFetchMyTrades)
            throw new Error('This exchange does not support getting trades')
        return await this.exchange.fetchMyTrades(symbol, since, limit, params)
    }
}

module.exports = BaseExchange
