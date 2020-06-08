const UserSchema = require('./user')
const TokenSchema = require('./token')
const BackTestConfigSchema = require('./backtest')
const SimulationResultSchema = require('./simulation-result')
const AccountSchema = require('./account')
const BotConfigSchema = require('./bot-config')
const BotConfigSessionSchema = require('./bot-config-session')
const BotSchema = require('./bot')
const DBSchemas = {
    UserSchema,
    TokenSchema,
    BackTestConfigSchema,
    SimulationResultSchema,
    AccountSchema,
    BotConfigSchema,
    BotConfigSessionSchema,
    BotSchema
}

module.exports = DBSchemas
