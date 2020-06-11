const { DBSchemas } = require('../api/db')
const { BotSchema } = DBSchemas
const { spawn } = require('child_process')
const RedisClient = require('../data/redis')
const { promisify } = require('util')
let botCoordinator = null
let BotCoordinatorKey = 'BotCoordinator'

class BotCoordinator {
    startBot(bot) {
        this.bots[bot._id] = spawn(
            'node',
            ['bot.js' /*params to pass to bot.js*/],
            {
                detached: true,
                stdio: ['inherit', out, err, 'ipc']
            }
        )
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
        this.bots[key].send({ command: 'stop', args: { botId: key } })
        delete this.bots[key]
        RedisClient.set(BotCoordinatorKey, JSON.stringify(this.bots))
    }

    async initializeBots() {
        const getAsync = promisify(RedisClient.get).bind(RedisClient)
        const cachedBotCoordinator = await getAsync(BotCoordinatorKey)
        this.bots = JSON.parse(cachedBotCoordinator)
        await this.killSwitch()
        BotSchema.find({ active: true })
            .then((activeBots) => {
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
