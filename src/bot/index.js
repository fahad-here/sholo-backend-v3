import { Factory } from '../strategy'

const { DBConnect, DBSchemas } = require('../../src/api/db')
const { BotSchema } = DBSchemas
const { GetPriceTickerKey, Logger } = require('../../src/utils')

const redis = require('redis')
const { MAP_WS_PAIR_TO_SYMBOL, SHOLO_STRATEGY } = require('../../src/constants')
const sub = redis.createClient()
const botClient = redis.createClient()
const pubClient = redis.createClient()

class Bot {
    _subscribeToEvents(bot) {
        const exchange = bot.exchange
        const pair = MAP_WS_PAIR_TO_SYMBOL[bot.symbol]
        sub.subscribe(GetPriceTickerKey(exchange, pair), (err, count) => {
            Logger.info(
                `Child process ${
                    bot._id
                } Subscribed to ${count} channel. Listening for updates on the ${GetPriceTickerKey(
                    exchange,
                    pair
                )} channel. pid: ${process.pid}`
            )
        })
        sub.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            //check for changes here
            Logger.info(
                `Data on child process ${bot._id}  bot order: ${bot.order}:  ${message}`
            )
            //set trader here, create the buy and sell signals here as well
            //Factory(SHOLO_STRATEGY)
        })

        botClient.subscribe(bot._id, (err, count) => {
            Logger.info(
                `Child processs ${bot._id} Subscribed to ${bot._id} 
                channel. Listening for updates on the ${bot._id} channel.`
            )
        })

        botClient.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info('Data received on bot channel ' + this._bot._id, parsed)
            if (parsed.disable) {
                this.stopBot()
            }
        })
    }

    publishStopBot() {
        const data = JSON.stringify({ disable: true })
        pubClient.publish(this._botId, data)
    }

    stopBot() {
        BotSchema.findOneAndUpdate(
            {
                _id: this._botId,
                _userId: this._userId
            },
            { $set: { active: false } },
            { new: true }
        )
            .then((bot) => {
                this._bot = bot
                //process.send({command: 'socket', args: {channel: `${bot._id}__update`, message: {bot}}})
                sub.quit()
                botClient.quit()
                pubClient.quit()
                process.exit()
            })
            .catch((err) => {
                Logger.info('Error quitting bot : ' + bot._id)
                Logger.info('Error quitting bot : ', err)
            })
    }

    constructor(bot) {
        bot = JSON.parse(bot)
        this._bot = bot
        this._botId = bot._id
        this._userId = bot._userId
    }

    async connectDB() {
        await DBConnect()
    }

    init() {
        const bot = this._bot
        BotSchema.findOneAndUpdate(
            { _id: bot._id, _userId: bot._userId },
            { $set: { active: true } },
            { new: true }
        )
            .then((data) => {
                this._bot = bot
                this._subscribeToEvents(bot)
                process.send({
                    command: 'socket',
                    args: {
                        channel: `${data._id}__update`,
                        message: { bot: data }
                    }
                })
            })
            .catch((err) => {
                Logger.info('Error starting bot : ' + bot._id)
                Logger.info('Error starting bot : ' + err)
                this.stopBot()
            })
    }
}

async function main() {
    Logger.info(`pid ${process.pid}`)
    Logger.info(`bot order ${JSON.parse(process.argv[3]).order}`)
    const bot = new Bot(process.argv[3])
    await bot.connectDB()
    bot.init()
    process.on('message', ({ command, args }) => {
        switch (command) {
            case 'stop':
                Logger.info(
                    'Received data from parent process on child process ',
                    { command, args }
                )
                bot.publishStopBot()
                break
        }
    })

    process.on('exit', () => {
        Logger.info('exit child')
    })
}

main()
