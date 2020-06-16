const Sholo = require('./sholo')
const { SHOLO_STRATEGY } = require('../constants')

const Factory = (type, onBuySignal, onSellSignal) => {
    switch (type) {
        case SHOLO_STRATEGY:
            return new Sholo(onBuySignal, onSellSignal)
        default:
            return new Sholo(onBuySignal, onSellSignal)
    }
}

module.exports = {
    Factory,
    Sholo
}
