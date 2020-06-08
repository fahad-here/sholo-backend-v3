const { Bitmex, Binance } = require('../../exchange')
const { BINANCE_EXCHANGE, BITMEX_EXCHANGE } = require('../../constants')

const GetExchangeClass = (exchangeId, options) => {
    switch (exchangeId) {
        case BITMEX_EXCHANGE:
            return new Bitmex(options)
        case BINANCE_EXCHANGE:
            options = {
                ...options,
                defaultType: 'future'
            }
            return new Binance(options)
        default:
            return new Bitmex(options)
    }
}

module.exports = GetExchangeClass
