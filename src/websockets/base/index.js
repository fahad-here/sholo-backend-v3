const { ALLOWED_EXCHANGES } = require('../../constants')

class BaseWS {
    constructor(id, options, ws, pair) {
        if (!ALLOWED_EXCHANGES.includes(id))
            throw new Error('Exchange WS is not supported yet')
        this.id = id
        this.options = options
        this.ws = ws
        this.pair = pair
    }

    setInstrumentPriceTickerListener(onEmitPriceChangeListener) {
        this.onEmitPriceChangeListener = onEmitPriceChangeListener
    }

    setOrderBookListener(onEmitOrderBookChangeListener) {
        this.onEmitOrderBookChangeListener = onEmitOrderBookChangeListener
    }

    setOrderListener(onEmitOrderChangeListener) {
        this.onEmitOrderChangeListener = onEmitOrderChangeListener
    }

    setPositionListener(onEmitPositionChangeListener) {
        this.onEmitPositionChangeListener = onEmitPositionChangeListener
    }

    setTradeTickerListener(onEmitTradeChangeListener) {
        this.onEmitTradeChangeListener = onEmitTradeChangeListener
    }

    addInstrumentPriceTicker() {
        throw new Error('Need to implement this method')
    }

    addOrderBook10Ticker() {
        throw new Error('Need to implement this method')
    }

    addTradeTicker() {
        throw new Error('Need to implement this method')
    }

    addOrderTicker() {
        throw new Error('Need to implement this method')
    }

    addPositionTicker() {
        throw new Error('Need to implement this method')
    }
}

module.exports = BaseWS
