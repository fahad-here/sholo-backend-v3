const app = require(`./src/api`)
const {PublishData} = require('./src/data')
const BotCoordinator = require('./src/bot-coordinator')
PublishData()
BotCoordinator.initialize()
module.exports = app