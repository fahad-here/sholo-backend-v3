const express = require('express')
const usersController = express.Router()
const { AuthMiddleware } = require('../../middleware')

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

usersController.get('/', AuthMiddleware.requireJWT, AuthMiddleware.getUser)

module.exports = usersController
