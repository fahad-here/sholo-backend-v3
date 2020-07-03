const express = require('express')
const router = express.Router()
const users = require('./users/users.controller')
const backTest = require('./backtest/backtest.controller')
const bots = require('./bots/bots.controller')
const accounts = require('./accounts/accounts.controller')
const trades = require('./trades/trades.controller')

router.use('/users', users)
router.use('/backtest', backTest)
router.use('/bots', bots)
router.use('/accounts', accounts)
router.use('/trades', trades)
module.exports = router
