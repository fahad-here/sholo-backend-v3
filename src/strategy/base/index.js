class Strategy {
    constructor(onBuySignal, onSellSignal) {
        this.onBuySignal = onBuySignal
        this.onSellSignal = onSellSignal
    }

    async run(realtime, currentCandle, candlesticks) {}
}

module.exports = Strategy
