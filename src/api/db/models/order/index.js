const mongoose = require('mongoose')
const Schema = mongoose.Schema
const AutoIncrement = require('mongoose-sequence')(mongoose)

const OrderSchema = new Schema(
    {
        _userId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'User'
        },
        _botId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'bot'
        },
        _botConfigId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'bot-config'
        },
        _botSessionId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'bot-config-session'
        },
        _accountId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'account'
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
        _orderId: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            required: true
        },
        side: {
            type: String
        },
        status: {
            type: String
        },
        totalOrderQuantity: { type: Number },
        filledQuantity: { type: Number },
        remainQuantity: { type: Number },
        price: {
            type: Number
        },
        amount: {
            type: Number
        },
        cost: {
            type: Number
        },
        fees: {
            type: Number
        },
        botOrder: {
            type: String
        },
        exchange: {
            type: String
        },
        average: {
            type: Number
        },
        type: {
            type: String
        },
        symbol: {
            type: String
        },
        pair: {
            type: String
        },
        isExit: {
            type: Boolean
        },
        leverage: {
            type: String
        },
        orderOpen: {
            type: Boolean
        }
    },
    {
        timestamps: {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
        }
    }
)
OrderSchema.plugin(AutoIncrement, {
    id: 'orderCounter',
    inc_field: 'id'
})
let Order = mongoose.model('order', OrderSchema)

module.exports = Order
