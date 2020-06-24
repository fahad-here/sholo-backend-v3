const { BitmexWS, BinanceWS } = require('../../websockets')
const { BINANCE_EXCHANGE, BITMEX_EXCHANGE } = require('../../constants')

const GetWSClass = (exchangeId, pair, options) => {
    switch (exchangeId) {
        case BITMEX_EXCHANGE:
            return new BitmexWS(pair, options)
        case BINANCE_EXCHANGE:
            return new BinanceWS(pair, options)
        default:
            return new BitmexWS(pair, options)
    }
}

module.exports = GetWSClass
