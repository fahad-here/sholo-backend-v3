const express = require('express')
const botsController = express.Router()
const { AuthMiddleware, BotMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

botsController.get(
    '/bot-config/:id',
    AuthMiddleware.requireJWT,
    BotMiddleware.getAllSessionDetails
)
botsController.get(
    '/bot-config/:botId/:sessionId',
    AuthMiddleware.requireJWT,
    BotMiddleware.getCurrentSessionDetails
)

botsController.get('/all/', AuthMiddleware.requireJWT, BotMiddleware.getAllBots)

botsController.get(
    '/sessions/',
    AuthMiddleware.requireJWT,
    BotMiddleware.getAllBotSessions
)

botsController.get(
    '/',
    AuthMiddleware.requireJWT,
    BotMiddleware.getAllBotConfigs
)

botsController.post(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.CreateBotConfig),
    BotMiddleware.createBotConfig
)

botsController.post(
    '/:id/:action',
    AuthMiddleware.requireJWT,
    BotMiddleware.runBotConfigAction
)

botsController.put(
    '/:id',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.CreateBotConfig),
    BotMiddleware.editBotConfig
)

botsController.delete(
    '/:id',
    AuthMiddleware.requireJWT,
    BotMiddleware.deleteBotConfig
)

botsController.get(
    '/orders',
    AuthMiddleware.requireJWT,
    BotMiddleware.getAllOrders
)

botsController.get(
    '/positions',
    AuthMiddleware.requireJWT,
    BotMiddleware.getAllPositions
)

module.exports = botsController
