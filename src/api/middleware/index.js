const AuthMiddleware = require('./auth')
const ProfileMiddleware = require('./profile')
const BackTestMiddleware = require('./backtest')
const BotMiddleware = require('./bot')
const AccountMiddleware = require('./account')

module.exports = {
    AuthMiddleware,
    ProfileMiddleware,
    BackTestMiddleware,
    BotMiddleware,
    AccountMiddleware
}
