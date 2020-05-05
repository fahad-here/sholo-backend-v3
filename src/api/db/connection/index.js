const mongoose = require('mongoose')
const {
    NODE_ENV,
    MONGO_DEV_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING
} = require('../../../config')

mongoose.Promise = Promise

const dbURL =
    NODE_ENV !== "production"
        ? MONGO_DEV_CONNECTION_STRING
        : MONGO_PRODUCTION_CONNECTION_STRING

const DBConnect = () => {
    mongoose.connect(dbURL, {auto_reconnect: true})
}

const DBConnection = mongoose.connection

DBConnection.on('connecting', () => {
    console.info()
})

DBConnection.on('connected', () => {
    console.info()
})

DBConnection.on('open', () => {
    console.info()
})

DBConnection.on('reconnected', () => {
    console.info()
})

DBConnection.on('disconnected', () => {
    console.info()
})

DBConnection.on('error', () => {
    console.info()
})

module.exports = DBConnect