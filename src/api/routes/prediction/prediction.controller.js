const express = require('express')
const predictionController = express.Router()
const { AuthMiddleware, PredictionMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

predictionController.get(
    '/results',
    AuthMiddleware.requireJWT,
    PredictionMiddleware.getAllPredictionResults
)
predictionController.get(
    '/results/:id',
    AuthMiddleware.requireJWT,
    PredictionMiddleware.getPredictionResult
)

predictionController.post(
    '/test',
    AuthMiddleware.requireJWT,
    PredictionMiddleware.runTestOnTimeFrame
)

module.exports = predictionController
