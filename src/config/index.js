require("dotenv").config()

const {
    MONGO_DEV_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING,
} = process.env

const whitelist = ["http://localhost:3000"]

const CORS_CONFIG = {
    origin: (origin, callback) => {
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(new Error("Not allowed by CORS"))
        }
    }
}

module.exports = {
    CORS_CONFIG,
    MONGO_DEV_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING,
}