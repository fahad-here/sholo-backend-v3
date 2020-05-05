const express = require('express')
const usersController = express.Router()
const { AuthMiddleware, ProfileMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation
usersController.post(
    '/auth/register',
    AuthMiddleware.register,
    AuthMiddleware.signRefreshTokenForUser,
    AuthMiddleware.signJWTForUser
)

usersController.post(
    '/auth/login',
    AuthMiddleware.signIn,
    AuthMiddleware.signRefreshTokenForUser,
    AuthMiddleware.signJWTForUser
)

usersController.post(
    '/auth/refresh',
    AuthMiddleware.requireRefreshToken,
    AuthMiddleware.signJWTForUser
)

usersController.put(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(Schemas.EditUser),
    ProfileMiddleware.editUserDetails
)

usersController.get('/', AuthMiddleware.requireJWT, AuthMiddleware.getUser)

module.exports = usersController
