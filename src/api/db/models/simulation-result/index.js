const mongoose = require('mongoose')

const SimulationResultSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    _backTestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BackTestConfig',
        required: true
    },
    _backTestSimpleId: {
        type: Number,
        required: true
    },
    bots: { type: Object, required: true },
    exchange: {
        type: String,
        required: true
    },
    timeFrame: { type: String, required: true },
    symbol: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalInitialUsdBalance: { type: String, required: true },
    totalInitialBtcBalance: { type: String, required: true },
    totalEndingBtcBalance: { type: String, required: true },
    totalEndingUsdBalance: { type: String, required: true },
    totalUsdPnl: { type: String, required: true },
    totalBtcPnl: { type: String, required: true },
    totalUnrealisedBtcPnl: { type: String, required: true },
    totalUnrealisedUsdPnl: { type: String, required: true },
    totalRealisedBtcPnl: { type: String, required: true },
    totalRealisedUsdPnl: { type: String, required: true },
    totalUsdPnlPercent: { type: String, required: true },
    totalBtcPnlPercent: { type: String, required: true },
    totalFeesBtcPaid: { type: String, required: true },
    totalFeesUsdPaid: { type: String, required: true },
    intervenedCandle: { type: Object, default: null },
    positionCounter: { type: Number, required: true },
    initialCandlePrice: { type: Number, required: true },
    finalCandlePrice: { type: Number, required: true },
    priceA: { type: Number, required: true },
    priceB: { type: Number, required: true },
    priceR: { type: Number, required: true },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
const SimulationResult = mongoose.model(
    'SimulationResult',
    SimulationResultSchema
)
module.exports = SimulationResult
