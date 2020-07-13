const FetchOHLCV = require('./fetchOHLCV')
const Redis = require('./redis')
const Publish = require('./publish')
const { BITMEX_EXCHANGE, BINANCE_EXCHANGE } = require('../constants')

const PublishData = () => {
    const publishBitmex = new Publish(BITMEX_EXCHANGE, 'XBTUSD')
    publishBitmex.initialize()
    const publishBinance = new Publish(BINANCE_EXCHANGE, 'BTCUSDT')
    publishBinance.initialize()
    const publishTestNetBitmex = new Publish(BITMEX_EXCHANGE, 'XBTUSD', {
        testnet: true
    })
    publishTestNetBitmex.initialize()
    const publishTestNetBinance = new Publish(BINANCE_EXCHANGE, 'BTCUSDT', {
        testnet: true
    })
    publishTestNetBinance.initialize()
}

module.exports = {
    FetchOHLCV,
    Redis,
    Publish,
    PublishData
}
