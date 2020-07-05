const mongoose = require('mongoose')
const {
    ALLOWED_EXCHANGES,
    POSITION_SHORT,
    POSITION_LONG
} = require('../../../../constants')
const AutoIncrement = require('mongoose-sequence')(mongoose)

const PositionSchema = new mongoose.Schema({
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
    _botId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot'
    },
    _botSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'bot-config-session'
    },
    _botIdSimple: {
        type: Number
    },
    _botConfigIdSimple: {
        type: Number
    },
    _botSessionIdSimple: {
        type: Number
    },
    _accountIdSimple: {
        type: Number
    },
    _buyOrderIdSimple: {
        type: Number
    },
    _sellOrderIdSimple: {
        type: Number
    },
    _buyOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    _sellOrderId: {
        type: mongoose.Schema.Types.ObjectId
    },
    side: {
        type: String,
        enum: [POSITION_LONG, POSITION_SHORT]
    },
    isOpen: {
        type: Boolean,
        default: false
    },
    entryPrice: { type: Number, default: 0 },
    exitPrice: { type: Number, default: 0 },
    symbol: { type: String },
    pair: { type: String },
    exchange: { type: String, required: true, enum: [...ALLOWED_EXCHANGES] },
    margin: { type: Number, default: 0 },
    positionSize: { type: Number, default: 0 },
    liquidationPrice: { type: Number, default: 0 },
    bankruptPrice: { type: Number, default: 0 },
    realisedPnl: { type: Number, default: 0 },
    unrealisedPnl: { type: Number, default: 0 },
    leverage: { type: Number, default: 1, max: 100, min: 1 },
    liquidationStats: { type: Object },
    liquidated: { type: Boolean, default: false },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
PositionSchema.plugin(AutoIncrement, {
    id: 'positionCounter',
    inc_field: 'id'
})
const Position = mongoose.model('position', PositionSchema)
module.exports = Position
