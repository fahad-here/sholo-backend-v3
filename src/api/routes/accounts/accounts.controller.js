const express = require('express')
const accountsController = express.Router()
const { AuthMiddleware, AccountMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

accountsController.post(
    '/archive/:id',
    AuthMiddleware.requireJWT,
    AccountMiddleware.archiveAccount
)

accountsController.post(
    '/unarchive/:id',
    AuthMiddleware.requireJWT,
    AccountMiddleware.unarchiveAccount
)

accountsController.get(
    '/',
    AuthMiddleware.requireJWT,
    AccountMiddleware.getAllAccounts
)

accountsController.get(
    '/:id',
    AuthMiddleware.requireJWT,
    AccountMiddleware.getAccount
)

accountsController.post(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.CreateAccount),
    AccountMiddleware.createNewAccount
)

accountsController.put(
    '/:id',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.CreateAccount),
    AccountMiddleware.editAccountDetails
)

accountsController.delete(
    '/:id',
    AuthMiddleware.requireJWT,
    AccountMiddleware.deleteAccount
)

module.exports = accountsController
