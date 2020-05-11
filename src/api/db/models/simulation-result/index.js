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
    bots: { type: Object, required: true },
    exchange: {
        type: String,
        required: true
    },
    timeFrame: { type: Date, required: true },
    symbol: { type: Date, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalInitialUsdBalance: { type: String, required: true },
    totalInitialBtcBalance: { type: String, required: true },
    totalEndingBtcBalance: { type: String, required: true },
    totalEndingUsdBalance: { type: String, required: true },
    totalUsdPnl: { type: String, required: true },
    totalBtcPnl: { type: String, required: true },
    totalUsdPnlPercent: { type: String, required: true },
    totalBtcPnlPercent: { type: String, required: true },
    totalFeesBtcPaid: { type: String, required: true },
    totalFeesUsdPaid: { type: String, required: true },
    intervenedCandle: { type: Object, default: null },
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
