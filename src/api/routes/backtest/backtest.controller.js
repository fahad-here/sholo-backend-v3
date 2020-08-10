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

backTestController.put(
    '/archive/:id',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.archiveBackTestConfig
)

backTestController.post(
    '/:id/run',
    AuthMiddleware.requireJWT,
    ValidateBody(RunSimulation),
    BackTestMiddleware.runBackTestConfig
)

backTestController.put(
    '/results/archive',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.archiveMultipleResults
)

backTestController.patch(
    '/results/delete',
    AuthMiddleware.requireJWT,
    BackTestMiddleware.deleteMultipleResults
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
