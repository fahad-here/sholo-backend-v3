const express = require('express')
const router = express.Router()
const users = require('./users/users.controller')
const backTest = require('./backtest/backtest.controller')
router.use('/users', users)
router.use('/backtest', backTest)
module.exports = router
