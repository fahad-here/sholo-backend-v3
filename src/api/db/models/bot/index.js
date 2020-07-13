const mongoose = require('mongoose')
const {
    ALLOWED_EXCHANGES,
    ALLOWED_STRATEGIES
} = require('../../../../constants')
const AutoIncrement = require('mongoose-sequence')(mongoose)

const BotSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    _accountId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Account'
    },
    _botConfigId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot-config'
    },
    _botSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot-config-session'
    },
    _previousOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'order'
    },
    _accountIdSimple: {
        type: Number
    },
    _botConfigIdSimple: {
        type: Number
    },
    _botSessionIdSimple: {
        type: Number
    },
    _previousOrderIdSimple: {
        type: Number
    },
    side: {
        type: String,
        enum: ['long', 'short']
    },
    // s1 or l1
    order: {
        type: String
    },
    enabled: {
        type: Boolean,
        default: false
    },
    symbol: { type: String, required: true },
    initialBalance: { type: String },
    balance: { type: String },
    exchange: { type: String, required: true, enum: [...ALLOWED_EXCHANGES] },
    entryPrice: { type: Number, required: true },
    priceP: { type: Number, required: true },
    priceA: { type: Number, required: true },
    priceB: { type: Number, required: true },
    priceR: { type: Number, required: true },
    exitPrice: { type: Number },
    leverage: { type: Number, default: 1, max: 100, min: 1 },
    liquidationPrice: { type: Number, default: 0 },
    liquidationStats: { type: Object },
    liquidated: false,
    realisedPnl: { type: Number, default: 0 },
    unrealisedPnl: { type: Number, default: 0 },
    marketThreshold: {
        type: Number
    },
    positionOpen: {
        type: Boolean,
        default: false
    },
    strategy: {
        type: String,
        required: true,
        enum: [...ALLOWED_STRATEGIES]
    },
    feeType: { type: String, required: true, enum: ['maker', 'taker'] },
    active: {
        type: Boolean,
        default: false
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    testNet: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
BotSchema.plugin(AutoIncrement, {
    id: 'botCounter',
    inc_field: 'id'
})
const BotConfig = mongoose.model('bot', BotSchema)
module.exports = BotConfig
