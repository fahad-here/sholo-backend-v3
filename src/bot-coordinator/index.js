const { DBSchemas } = require('../api/db')
const { BotSchema } = DBSchemas
const { fork } = require('child_process')
const { Logger } = require('../utils')
const parentBotLogDir = require('path').resolve(
    __dirname,
    '../../.logs/bot_logs/'
)
const parentBotsDir = require('path').resolve(__dirname, '../../src/bot')
const fs = require('fs')
const SocketIOConnection = require('../../src/socketio')

const HEART_BEAT = 15000 //milliseconds

let botCoordinator = null

class BotCoordinator {
    _exitGracefully() {
        const connection = SocketIOConnection.connection()
        for (let key of Object.keys(this.bots)) {
            for (let id of Object.keys(connection.sockets))
                connection.sockets[id].emit(
                    `${key}`,
                    JSON.stringify({
                        type: 'update',
                        bot: { active: false, _id: key }
                    })
                )
            this.stopBot(key)
        }
    }

    _processHandlers() {
        const events = [
            `exit`,
            `SIGINT`,
            `SIGUSR1`,
            `SIGUSR2`,
            `uncaughtException`,
            `SIGTERM`
        ]
        events.forEach((eventType) => {
            process.on(eventType, (eventType, exitCode) => {
                Logger.info(
                    `Event type happened ${eventType} with code ${exitCode}`
                )
                this._exitGracefully()
            })
        })
    }

    startBot(bot) {
        Logger.info(`start bot  ${bot.order}, botID : ${bot._id}`)
        const connection = SocketIOConnection.connection()

        const out = fs.openSync(`${parentBotLogDir}\\out_${bot._id}.log`, 'a')
        const err = fs.openSync(`${parentBotLogDir}\\err_${bot._id}.log`, 'a')
        this.bots[bot._id] = fork(
            parentBotsDir,
            [parentBotsDir, JSON.stringify(bot)],
            {
                detached: true,
                stdio: ['ignore', out, err, 'ipc']
            }
        )
        this.bots[bot._id].on('message', ({ command, args }) => {
            const { channel, message } = args
            if (command === 'socket') {
                for (let id of Object.keys(connection.sockets))
                    connection.sockets[id].emit(
                        channel,
                        JSON.stringify(message)
                    )
            }
        })
    }

    stopBot(botId) {
        this.bots[botId].send({ command: 'stop', args: { botId } })
    }

    async killSwitch() {
        for (let key of Object.keys(this.bots)) {
            await this.bots[key].send({ command: 'stop', args: { botId: key } })
            delete this.bots[key]
        }
    }

    restartBot(botId) {
        this.bots[botId].send({ command: 'stop', args: { botId } })
        delete this.bots[botId]
    }

    initializeBots() {
        this._processHandlers()
        setInterval(() => {
            Logger.info('Checking for bot state changes ')
            BotSchema.find({})
                .then((bots) => {
                    let enabledAndInactiveBots = bots.filter(
                        (bot) => bot.enabled && !bot.active
                    )
                    let disabledAndActiveBots = bots.filter(
                        (bot) => !bot.enabled && bot.active
                    )
                    Logger.info(
                        `Enabled and inactive bots: ${enabledAndInactiveBots.length}`
                    )
                    Logger.info(
                        `Disabled and active bots: ${disabledAndActiveBots.length}`
                    )
                    if (enabledAndInactiveBots.length > 0)
                        enabledAndInactiveBots.map((bot) => {
                            this.startBot(bot)
                        })
                    if (
                        disabledAndActiveBots.length > 0 &&
                        Object.keys(this.bots).length !== 0
                    )
                        disabledAndActiveBots.map((bot) => {
                            this.stopBot(bot._id)
                        })
                })
                .catch((err) => {
                    Logger.error('Error ', err)
                    throw new Error('Error starting/stopping up active bots')
                })
        }, HEART_BEAT)
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
