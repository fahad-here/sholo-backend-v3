const UserSchema = require('./user')
const TokenSchema = require('./token')
const BackTestConfigSchema = require('./backtest')

const DBSchemas = {
    UserSchema,
    TokenSchema,
    BackTestConfigSchema
}

module.exports = DBSchemas
