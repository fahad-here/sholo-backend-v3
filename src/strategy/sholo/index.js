const Strategy = require('../base')

class Sholo extends Strategy {
    constructor(
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal
    ) {
        super(onBuySignal, onSellSignal, onLiquidatedSignal)
        this.onPriceRReachedSignal = onPriceRReachedSignal
    }

    async run(realtime, currentCandlePrice, timestamp) {}
}

module.exports = Sholo
