const Sholo = require('./sholo')
const { SHOLO_STRATEGY } = require('../constants')

const Factory = (
    type,
    {
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal,
        botId
    }
) => {
    switch (type) {
        case SHOLO_STRATEGY:
            return new Sholo(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal,
                botId
            )
        default:
            return new Sholo(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal,
                botId
            )
    }
}

module.exports = {
    Factory,
    Sholo
}
