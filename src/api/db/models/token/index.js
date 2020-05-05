const mongoose = require('mongoose')

const TokenSchema = new mongoose.Schema({
    _userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    token: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    },
    expireAt: {
        type: Date,
        expires: 0
    },
    type: {
        type: String,
        required: true,
        enum: ['refresh']
    }
})
const Token = mongoose.model('Token', TokenSchema)
module.exports = Token
