const { DBConnect, DBDisconnect } = require('./connection')
const DBSchemas = require('./models')

module.exports = {
    DBConnect,
    DBDisconnect,
    DBSchemas
}
