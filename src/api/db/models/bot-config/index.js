const mongoose = require('mongoose')
const { ALLOWED_EXCHANGES } = require('../../../../constants')
const AutoIncrement = require('mongoose-sequence')(mongoose)

const BotConfigSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    selectedAccounts: {
        type: Object,
        required: true
    },
    startingBalances: {
        type: Object,
        required: true
    },
    exchange: { type: String, required: true, enum: [...ALLOWED_EXCHANGES] },
    symbol: { type: String, required: true },
    entryPrice: { type: Number, required: true },
    priceA: { type: Number, required: true },
    priceB: { type: Number, required: true },
    priceR: { type: Number, required: true },
    leverage: { type: Number, default: 1, max: 100, min: 1 },
    marketThreshold: {
        type: Number
    },
    currentSession: {
        type: mongoose.Schema.Types.ObjectId
    },
    feeType: { type: String, required: true, enum: ['maker', 'taker'] },
    active: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
BotConfigSchema.plugin(AutoIncrement, {
    id: 'botConfigCounter',
    inc_field: 'id'
})
const BotConfig = mongoose.model('BackTestConfig', BotConfigSchema)
module.exports = BotConfig
