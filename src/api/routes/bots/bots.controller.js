const express = require('express')
const botsController = express.Router()
const { AuthMiddleware, BotMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

botsController.get('/', AuthMiddleware.requireJWT, BotMiddleware)

botsController.get('/:id', AuthMiddleware.requireJWT, BotMiddleware)

botsController.post(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.CreateBotConfig),
    BotMiddleware.createBotConfig
)

botsController.post(
    '/:id/:action',
    AuthMiddleware.requireJWT,
    ValidateBody(),
    BotMiddleware
)

botsController.put(
    '/:id',
    AuthMiddleware.requireJWT,
    ValidateBody(),
    BotMiddleware
)

botsController.delete('/:id', AuthMiddleware.requireJWT, BotMiddleware)

module.exports = botsController
