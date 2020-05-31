const FetchOHLCV = require('./fetchOHLCV')
const Redis = require('./redis')
const Publish = require('./publish')
const { BITMEX_EXCHANGE, BINANCE_EXCHANGE } = require('../constants')

const PublishData = () => {
    const publishBitmex = new Publish(BITMEX_EXCHANGE, 'XBTUSD')
    publishBitmex.initialize()
    const publishBinance = new Publish(BINANCE_EXCHANGE, 'BTCUSDT')
    publishBinance.initialize()
}

module.exports = {
    FetchOHLCV,
    Redis,
    Publish,
    PublishData
}
