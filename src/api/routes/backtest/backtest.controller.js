const express = require('express')
const backTestController = express.Router()
const { AuthMiddleware } = require('../../middleware')
const { Validation } = require('../../../utils')
const { ValidateBody, Schemas } = Validation

backTestController.get('/', AuthMiddleware.requireJWT)
backTestController.post('/', AuthMiddleware.requireJWT)
backTestController.put('/:id', AuthMiddleware.requireJWT)
backTestController.delete('/:id', AuthMiddleware.requireJWT)
backTestController.post('/:id/run', AuthMiddleware.requireJWT)
backTestController.get('/:id', AuthMiddleware.requireJWT)
backTestController.get('/results', AuthMiddleware.requireJWT)
backTestController.get('/results/:id', AuthMiddleware.requireJWT)

module.exports = backTestController
