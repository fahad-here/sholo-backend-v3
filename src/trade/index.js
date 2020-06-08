const { GetExchangeClass } = require('../utils')
const { BINANCE_EXCHANGE, BITMEX_EXCHANGE } = require('../constants')

class Trade {
    constructor(exchangeId, exchangeParams, testNet = true) {
        this.exchangeId = exchangeId
        this.exchange = GetExchangeClass(exchangeId, exchangeParams)
        if (testNet) this.exchange.setTestNet()
    }

    setPair(symbol) {
        this.symbol = symbol
    }

    async setLeverage(leverage) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        this.leverage = leverage
        const exchange = this.exchange.getExchange()
        const symbol = this.symbol
        switch (this.exchangeId) {
            case BITMEX_EXCHANGE:
                await exchange.privatePostPositionLeverage({
                    symbol,
                    leverage
                })
                break
            case BINANCE_EXCHANGE:
                //timestamp not mandatory, opposite is stated in docs
                await exchange.fapiPrivatePostLeverage({
                    symbol,
                    leverage
                })
                break
            default:
                throw new Error('Leverage does not exist for this exchange')
        }
    }
}

module.exports = Trade
