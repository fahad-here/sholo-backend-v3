const mongoose = require('mongoose')
const {
    NODE_ENV,
    MONGO_DEV_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING
} = require('../../../config')
const { Logger } = require('../../../utils')
mongoose.Promise = Promise

const dbURL =
    NODE_ENV !== 'production'
        ? MONGO_DEV_CONNECTION_STRING
        : MONGO_PRODUCTION_CONNECTION_STRING

const DBConnect = () => {
    mongoose.connect(dbURL, {
        auto_reconnect: true,
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
}

const DBDisconnect = () => {
    mongoose.disconnect()
}

const DBConnection = mongoose.connection

DBConnection.on('connecting', () => {
    Logger.info('Connecting to DB')
})

DBConnection.on('connected', () => {
    Logger.info('Connected to DB')
})

DBConnection.on('open', () => {
    Logger.info('Opened DB Connection')
})

DBConnection.on('reconnected', () => {
    Logger.info('Reconnected To DB')
})

DBConnection.on('disconnected', () => {
    Logger.info('Disconnected from DB')
})

DBConnection.on('error', (error) => {
    Logger.info('Error Connecting To DB', error)
})

module.exports = { DBConnect, DBDisconnect }
