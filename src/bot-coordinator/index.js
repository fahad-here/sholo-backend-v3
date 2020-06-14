const { DBSchemas } = require('../api/db')
const { BotSchema } = DBSchemas
const { spawn } = require('child_process')
const RedisClient = require('../data/redis')
const { promisify } = require('util')
const parentDir = require('path').resolve(__dirname, '../../.logs/bot_logs/')
const fs = require('fs')
const out = fs.openSync(`${parentDir}\\out.log`, 'a')
const err = fs.openSync(`${parentDir}\\err.log`, 'a')
let botCoordinator = null
let BotCoordinatorKey = 'BotCoordinator'

class BotCoordinator {
    startBot(bot) {
        this.bots[bot._id] = spawn('node', ['bot.js', bot], {
            detached: true,
            stdio: ['inherit', out, err, 'ipc']
        })
    }

    stopBot(botId) {
        this.bots[botId].send({ command: 'stop', args: { botId } })
    }

    async killSwitch() {
        for (let key of Object.keys(this.bots)) {
            await this.bots[key].send({ command: 'stop', args: { botId: key } })
            delete this.bots[key]
            RedisClient.set(BotCoordinatorKey, JSON.stringify(this.bots))
        }
    }

    async restartBot(botId) {
        this.bots[botId].send({ command: 'stop', args: { botId } })
        delete this.bots[botId]
    }

    async initializeBots() {
        BotSchema.find({ active: true })
            .then((activeBots) => {
                console.log(activeBots)
                if (activeBots.length > 0)
                    activeBots.map((bot) => {
                        this.startBot(bot)
                    })
            })
            .catch((err) => {
                throw new Error('Error starting up active bots')
            })
    }

    constructor() {
        this.bots = {}
        this.initializeBots()
    }

    static init() {
        if (!botCoordinator) {
            botCoordinator = new BotCoordinator()
        }
    }

    static getCoordinator() {
        if (!botCoordinator) {
            throw new Error('no active coordinator')
        }
        return botCoordinator
    }
}

module.exports = {
    initialize: BotCoordinator.init,
    coordinator: BotCoordinator.getCoordinator
}
