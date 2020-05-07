const redis = require('redis')
const { REDIS_PORT, REDIS_PASSWORD, REDIS_HOST } = require('../../config')

const config = {
    host: REDIS_HOST,
    port: REDIS_PORT
}
if (REDIS_PASSWORD) config.password = REDIS_PASSWORD

module.exports = redis.createClient(config)
