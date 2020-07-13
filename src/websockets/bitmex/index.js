const BitMEXClient = require('bitmex-realtime-api')
const BaseWS = require('../base')
const { BITMEX_EXCHANGE } = require('../../constants')
const BigNumber = require('bignumber.js')
class BitmexWS extends BaseWS {
    constructor(pair, options) {
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
                    priceChangeData.timestamp,
                    this.options.testnet
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

    addOrderTicker() {
        this.ws.addStream(this.pair, 'order', (data, pair, tableName) => {
            const orderData = data[0]
            if (orderData)
                if (this.onEmitOrderChangeListener)
                    this.onEmitOrderChangeListener(
                        this.id,
                        this.pair,
                        orderData.orderID,
                        orderData.ordStatus,
                        orderData.orderQty,
                        orderData.cumQty,
                        orderData.leavesQty
                    )
        })
    }

    addPositionTicker() {
        this.ws.addStream(this.pair, 'position', (data, pair, tableName) => {
            const positionData = data[0]
            if (positionData)
                if (this.onEmitPositionChangeListener)
                    this.onEmitPositionChangeListener(
                        this.id,
                        this.pair,
                        positionData.isOpen,
                        new BigNumber(positionData.maintMargin)
                            .dividedBy(100000000)
                            .toFixed(8),
                        new BigNumber(positionData.markValue)
                            .dividedBy(100000000)
                            .toFixed(8),
                        positionData.liquidationPrice,
                        positionData.bankruptPrice,
                        new BigNumber(positionData.realisedPnl)
                            .dividedBy(100000000)
                            .toFixed(8),
                        new BigNumber(positionData.unrealisedPnl)
                            .dividedBy(100000000)
                            .toFixed(8),
                        positionData.unrealisedPnlPcnt
                    )
        })
    }
}

module.exports = BitmexWS
