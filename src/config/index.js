require('dotenv').config()

const {
    MONGO_DEV_CONNECTION_STRING,
    MONGO_TEST_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_ALGORITHM,
    JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN,
    JWT_REFRESH_ALGORITHM,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    AWS_SES_ACCESS_KEY_ID,
    AWS_SES_SECRET_ACCESS_KEY,
    AWS_SES_REGION
} = process.env

const whitelist = ['http://localhost:3000']

const CORS_CONFIG = {
    origin: (origin, callback) => {
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(new Error('Not allowed by CORS'))
        }
    }
}

const SES_CONFIG = {
    apiVersion: '2010-12-01',
    accessKeyId: AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
    region: AWS_SES_REGION
}

module.exports = {
    CORS_CONFIG,
    MONGO_DEV_CONNECTION_STRING,
    MONGO_TEST_CONNECTION_STRING,
    MONGO_PRODUCTION_CONNECTION_STRING,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    JWT_ALGORITHM,
    JWT_REFRESH_SECRET,
    JWT_REFRESH_EXPIRES_IN,
    JWT_REFRESH_ALGORITHM,
    REDIS_HOST,
    REDIS_PASSWORD,
    REDIS_PORT,
    SES_CONFIG
}
