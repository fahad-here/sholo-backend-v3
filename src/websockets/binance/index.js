const BinanceAPI = require('binance')
const BaseWS = require('../base')
const { BINANCE_EXCHANGE } = require('../../constants')
const moment = require('moment')

class BinanceWS extends BaseWS {
    constructor(pair, options) {
        super(BINANCE_EXCHANGE, options, new BinanceAPI.BinanceWS(true), pair)
    }

    addInstrumentPriceTicker() {
        this.ws.onTicker(this.pair, (data) => {
            if (this.onEmitPriceChangeListener)
                this.onEmitPriceChangeListener(
                    this.id,
                    this.pair,
                    data.currentClose,
                    moment(data.eventTime).toISOString(),
                    this.options.testnet
                )
        })
    }

    addOrderBook10Ticker() {
        this.ws.onDepthLevelUpdate(this.pair, 10, (data) => {
            if (this.onEmitOrderBookChangeListener)
                this.onEmitOrderBookChangeListener(
                    this.id,
                    this.pair,
                    data.bids,
                    data.asks,
                    data.eventTime
                )
        })
    }
}

module.exports = BinanceWS
