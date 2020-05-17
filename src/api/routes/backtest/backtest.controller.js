const express = require('express')
const backTestController = express.Router()
const { AuthMiddleware, BackTestMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation
const { AddBackTestConfig, RunSimulation } = Schemas

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
    ValidateBody(RunSimulation),
    BackTestMiddleware.runBackTestConfig
)

backTestController.get(
    '/results',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getAllBackTestResults
)

backTestController.get(
    '/results/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getBackTestResult
)

backTestController.get(
    '/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.getBackTestConfig
)

module.exports = backTestController
