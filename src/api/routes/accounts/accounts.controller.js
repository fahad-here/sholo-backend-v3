const express = require('express')
const accountsController = express.Router()
const { AuthMiddleware, AccountMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody } = Validation

accountsController.get('/', AuthMiddleware.requireJWT, AccountMiddleware)

accountsController.get('/:id', AuthMiddleware.requireJWT, AccountMiddleware)

accountsController.post(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(),
    AccountMiddleware
)

accountsController.put(
    '/:id',
    AuthMiddleware.requireJWT,
    ValidateBody(),
    AccountMiddleware
)

accountsController.delete('/:id', AuthMiddleware.requireJWT, AccountMiddleware)

module.exports = accountsController
