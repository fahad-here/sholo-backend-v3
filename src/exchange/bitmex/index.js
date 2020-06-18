const BaseExchange = require('../base')

class Bitmex extends BaseExchange {
    constructor(options) {
        const id = 'bitmex'
        super(id, options)
    }

    async setLeverage(leverage, symbol) {
        return await this.exchange.privatePostPositionLeverage({
            symbol,
            leverage
        })
    }

    async closeOpenPositions(symbol) {
        return await this.exchange.privatePostOrderClosePosition({
            symbol
        })
    }
}

module.exports = Bitmex
