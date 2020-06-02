const mongoose = require('mongoose')
const { POSITION_LONG, POSITION_SHORT } = require('../../../../constants')
const Schema = mongoose.Schema

const accountSchema = new Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    accountName: {
        type: String
    },
    exchange: {
        type: String,
        required: true
    },
    accountType: {
        type: String,
        required: true,
        enum: [POSITION_SHORT, POSITION_LONG]
    },
    apiKey: {
        type: String,
        required: true
    },
    apiSecret: {
        type: String,
        required: true
    },
    testNet: {
        type: Boolean,
        required: true
    },
    balance: {
        type: Schema.Types.Mixed
    },
    inUse: {
        type: Boolean,
        default: false
    },
    inUseByConfig: Boolean,
    uid: String
})

const Accounts = mongoose.model('account', accountSchema)

module.exports = Accounts
