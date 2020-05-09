const express = require('express')
const backTestController = express.Router()
const { AuthMiddleware, BackTestMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation
const { AddBackTestConfig } = Schemas

backTestController.get(
    '/',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getAllBackTestConfigs
)

backTestController.post(
    '/',
    AuthMiddleware.requireJWT,
    ValidateBody(AddBackTestConfig),
    BackTestMiddleware.addNewBackTest
)

backTestController.put(
    '/:id',
    AuthMiddleware.requireJWT,
    ValidateBody(AddBackTestConfig),
    BackTestMiddleware.editBackTest
)

backTestController.delete(
    '/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.deleteBackTestConfig
)

backTestController.post(
    '/:id/run',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.runBackTestConfig
)

backTestController.get(
    '/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getBackTestConfig
)

backTestController.get(
    '/results',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getBackTestResult
)

backTestController.get(
    '/results/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getAllBackTestResults
)

module.exports = backTestController
