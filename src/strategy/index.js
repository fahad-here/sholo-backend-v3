const Sholo = require('./sholo')
const SholoLimit = require('./sholo-limit')
const { SHOLO_STRATEGY, SHOLO_STRATEGY_LIMIT } = require('../constants')

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
    console.log('inside strategy factory')
    switch (type) {
        case SHOLO_STRATEGY:
            return new Sholo(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal,
                botId
            )
        case SHOLO_STRATEGY_LIMIT:
            return new SholoLimit(
                onBuySignal,
                onSellSignal,
                onLiquidatedSignal,
                onPriceRReachedSignal,
                botId
            )
        default:
            return new SholoLimit(
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
    Sholo,
    SholoLimit
}
