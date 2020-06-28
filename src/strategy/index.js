const Sholo = require('./sholo')
const { SHOLO_STRATEGY } = require('../constants')

const Factory = (
    type,
    { onBuySignal, onSellSignal, onLiquidatedSignal, onPriceRReachedSignal }
) => {
    switch (type) {
        case SHOLO_STRATEGY:
            return new Sholo(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal
            )
        default:
            return new Sholo(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal
            )
    }
}

module.exports = {
    Factory,
    Sholo
}
