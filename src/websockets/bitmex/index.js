const BitMEXClient = require('bitmex-realtime-api')
const BaseWS = require('../base')
const { BITMEX_EXCHANGE } = require('../../constants')

class BitmexWS extends BaseWS {
    constructor(pair, options = { testnet: true }) {
        super(BITMEX_EXCHANGE, options, new BitMEXClient(options), pair)
    }

    addInstrumentPriceTicker() {
        this.ws.addStream(this.pair, 'instrument', (data, pair, tableName) => {
            const priceChangeData = data[0]
            if (this.onEmitPriceChangeListener)
                this.onEmitPriceChangeListener(
                    this.id,
                    this.pair,
                    priceChangeData.lastPrice,
                    priceChangeData.timestamp
                )
        })
    }

    addOrderBook10Ticker() {
        this.ws.addStream(this.pair, 'orderBook10', (data, pair, tableName) => {
            const orderBookData = data[0]
            if (this.onEmitOrderBookChangeListener)
                this.onEmitOrderBookChangeListener(
                    this.id,
                    this.pair,
                    orderBookData.bids,
                    orderBookData.asks,
                    orderBookData.timestamp
                )
        })
    }
}

module.exports = BitmexWS
