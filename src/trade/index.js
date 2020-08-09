const { GetExchangeClass } = require('../utils')
const { MAP_WS_PAIR_TO_SYMBOL } = require('../constants')

class Trade {
    constructor(exchangeId, exchangeParams, testNet = true) {
        this.exchangeId = exchangeId
        this.exchange = GetExchangeClass(exchangeId, exchangeParams)
        if (testNet) this.exchange.setTestNet()
    }

    async getOrderbook(symbol, limit) {
        return await this.exchange.getOrderbook(symbol, limit)
    }

    getBalance() {
        return this.exchange.getFetchBalance()
    }

    setPair(symbol) {
        this.symbol = symbol
        this.pair = MAP_WS_PAIR_TO_SYMBOL[symbol]
    }

    async setLeverage(leverage, marginType) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        this.leverage = leverage
        this.marginType = marginType
        return await this.exchange.setLeverage(leverage, this.pair, marginType)
    }

    //this only works on leverge for bitmex due to bitmex being a futures only exchange
    async createMarketOrder(side, amount, params = {}) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        if (!this.leverage) throw new Error('Please set your leverage first')
        return await this.exchange.createMarketOrder(
            this.symbol,
            side,
            amount,
            params
        )
    }

    async createLimitOrder(side, amount, price, params = {}) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        if (!this.leverage) throw new Error('Please set your leverage first')
        const symbol = this.symbol
        return await this.exchange.createLimitOrder(
            symbol,
            side,
            amount,
            price,
            params
        )
    }

    async getOrder(orderId) {
        const symbol = this.symbol
        if (!symbol) throw new Error('Please set your exchange pair first')
        return await this.exchange.getOrder(orderId, symbol)
    }

    async getAllSymbolOrders() {
        const symbol = this.symbol
        if (!symbol) throw new Error('Please set your exchange pair first')
        return await this.exchange.getAllSymbolOrders(symbol)
    }

    async cancelOpenOrder(orderId) {
        const symbol = this.symbol
        if (!symbol) throw new Error('Please set your exchange pair first')
        return this.exchange.cancelOpenOrder(orderId, symbol)
    }

    async closeOpenPositions() {
        const pair = this.pair
        if (!pair) throw new Error('Please set your exchange pair first')
        return this.exchange.closeOpenPositions(pair)
    }

    async getTrades(since, limit, params) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        return this.exchange.getTrades(this.symbol, since, limit, {
            ...params
        })
    }

    getExchange() {
        return this.exchange
    }

    getExchangeTime() {
        return this.exchange.milliseconds()
    }
}

module.exports = Trade
