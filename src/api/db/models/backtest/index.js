const mongoose = require('mongoose')
const AutoIncrement = require('mongoose-sequence')(mongoose)

const BackTestConfigSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    startingBalances: {
        type: Object,
        required: true
    },
    entryPrice: { type: Number, required: true },
    priceA: { type: Number, required: true },
    priceB: { type: Number, required: true },
    priceR: { type: Number, required: true },
    leverage: { type: Number, default: 1, max: 100, min: 1 },
    archived: { type: Boolean, default: false },
    feeType: { type: String, required: true, enum: ['maker', 'taker'] },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})
BackTestConfigSchema.plugin(AutoIncrement, {
    id: 'backtestConfigCounter',
    inc_field: 'id'
})
const BackTestConfig = mongoose.model('BackTestConfig', BackTestConfigSchema)
module.exports = BackTestConfig
