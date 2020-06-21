const { BitmexWS, BinanceWS } = require('../../websockets')
const { BINANCE_EXCHANGE, BITMEX_EXCHANGE } = require('../../constants')

const GetWSClass = (exchangeId, pair, options) => {
    switch (exchangeId) {
        case BITMEX_EXCHANGE:
            return new BitmexWS(options)
        case BINANCE_EXCHANGE:
            return new BinanceWS(options)
        default:
            return new BitmexWS(options)
    }
}

module.exports = GetWSClass
