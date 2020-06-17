class Strategy {
    constructor(onBuySignal, onSellSignal, onLiquidatedSignal) {
        this.onBuySignal = onBuySignal
        this.onSellSignal = onSellSignal
        this.onLiquidatedSignal = onLiquidatedSignal
    }

    async run(realtime, currentCandle, candlesticks) {}
}

module.exports = Strategy
