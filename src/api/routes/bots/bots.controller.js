const express = require('express')
const botsController = express.Router()
const { AuthMiddleware, BotMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

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

module.exports = botsController
