const SocketIOConnection = require('../../socketio')
const redis = require('redis')
const { BINANCE_EXCHANGE, BITMEX_EXCHANGE } = require('../../constants')
const { GetOrderBook10TickerKey, GetPriceTickerKey } = require('../../utils')
const { BitmexWS, BinanceWS } = require('../../websockets')
const pub = redis.createClient()

const priceChangeListener = async (exchangeName, pair, price, timestamp) => {
    if (!price) return
    let connection = SocketIOConnection.connection()
    const value = { exchangeName, pair, price, timestamp }
    let stringifiedData = JSON.stringify(value)
    let priceKey = GetPriceTickerKey(exchangeName, pair)
    pub.publish(priceKey, stringifiedData)
    for (let id of Object.keys(connection.sockets))
        connection.sockets[id].emit(priceKey, value)
}

const orderBookListener = (exchangeName, pair, bids, asks, timestamp) => {
    if (!bids || !asks) return
    let connection = SocketIOConnection.connection()
    const value = { exchangeName, pair, bids, asks, timestamp }
    let stringifiedData = JSON.stringify(value)
    let orderBook10Key = GetOrderBook10TickerKey(exchangeName, pair)
    pub.publish(orderBook10Key, stringifiedData)
    for (let id of Object.keys(connection.sockets))
        connection.sockets[id].emit(orderBook10Key, value)
}

class Publish {
    constructor(
        exchange,
        pair,
        emitPriceChangeListener = priceChangeListener,
        emitOrderBook10ChangeListener = orderBookListener
    ) {
        this.exchange = exchange
        this.pair = pair
        this.emitPriceChangeListener = emitPriceChangeListener
        this.emitOrderBook10ChangeListener = emitOrderBook10ChangeListener
    }

    initialize() {
        this.ws = null
        switch (this.exchange) {
            case BITMEX_EXCHANGE:
                this.ws = new BitmexWS(this.pair)
                break
            case BINANCE_EXCHANGE:
                this.ws = new BinanceWS(this.pair)
                break
            default:
                this.ws = new BitmexWS(this.pair)
        }

        this.ws.setOrderBookListener(this.emitOrderBook10ChangeListener)
        this.ws.setInstrumentPriceTickerListener(this.emitPriceChangeListener)
        this.ws.addInstrumentPriceTicker()
        this.ws.addOrderBook10Ticker()
    }
}

module.exports = Publish
