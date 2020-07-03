const express = require('express')
const tradesController = express.Router()
const { AuthMiddleware, TradeMiddleware } = require('../../middleware')

tradesController.get(
    '/bot-config/order/:orderId',
    AuthMiddleware.requireJWT,
    TradeMiddleware.getTradesByOrder
)

tradesController.get(
    '/bot-config/session/:botConfigId/:botSessionId',
    AuthMiddleware.requireJWT,
    TradeMiddleware.getTradesBySessionId
)

module.exports = tradesController
