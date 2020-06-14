const { DBConnect, DBSchemas } = require('../../src/api/db')
const { BotSchema } = DBSchemas
const SocketIOConnection = require('../../src/socketio')
const { GetPriceTickerKey, Logger } = require('../../src/utils')

const redis = require('redis')
const { MAP_WS_PAIR_TO_SYMBOL } = require('../../src/constants')
const sub = redis.createClient()
const botClient = redis.createClient()
const pubClient = redis.createClient()

let connection = SocketIOConnection.connection()

class Bot {
    _subscribeToEvents() {
        const bot = this._bot
        const exchange = bot.exchange
        const pair = MAP_WS_PAIR_TO_SYMBOL[bot.symbol]
        sub.subscribe(GetPriceTickerKey(exchange, pair), (err, count) => {
            Logger.info(
                `Child process ${
                    bot._id
                } Subscribed to ${count} channel. Listening for updates on the ${GetPriceTickerKey(
                    exchange,
                    pair
                )} channel.`
            )
        })
        sub.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info(
                'data on child process ' + process.argv[2],
                JSON.stringify(parsed)
            )
            //check for changes here
        })

        botClient.subscribe(bot._id, (err, count) => {
            Logger.info(
                `Child process ${bot._id} Subscribed to ${bot._id} channel. Listening for updates on the ${bot._id} channel.`
            )
        })

        botClient.on('message', async (channel, message) => {
            const parsed = JSON.parse(message)
            Logger.info(
                'data on child process ' + this._bot._id,
                JSON.stringify(parsed)
            )
            if (parsed.disable) {
                this.stopBot()
            }
        })
    }

    publishStopBot() {
        console.log(this._botId)
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
                for (let id of Object.keys(connection.sockets))
                    connection.sockets[id].emit(this._botId, bot)
                sub.quit()
                botClient.quit()
                pubClient.quit()
                process.exit()
            })
            .catch((err) => {})
    }

    constructor(bot) {
        this._botId = bot._id
        this._userId = bot._userId
        DBConnect()
        BotSchema.findOneAndUpdate(
            { _id: bot._botId, _userId: bot._userId },
            { $set: { active: true } }
        )
            .then((bot) => {
                this._bot = bot
                this._subscribeToEvents()
            })
            .catch((err) => {
                Logger.info('Error starting bot : ' + this._botId)
            })
    }
}

/*sub.subscribe(GetPriceTickerKey('bitmex', 'XBTUSD'), (err, count) => {
    console.log(
        `Child process ${process.argv[2]} Subscribed to ${count} channel. Listening for updates on the ${GetPriceTickerKey('bitmex', 'XBTUSD')} channel.`
    )
})*/
/*
sub.on('message', async (channel, message) => {
    const parsed = JSON.parse(message)
    console.log('data on child process ' + process.argv[2], parsed)
})

botClient.subscribe(process.argv[2], (err, count) => {
    console.log(
        `Child process ${process.argv[2]} Subscribed to ${count} channel. Listening for updates on the ${process.argv[2]} channel.`
    )
})

botClient.on("message", async (channel, message) => {
    const parsed = JSON.parse(message)
    console.log('data on child process ' + process.argv[2], parsed)
    if (parsed.disable) {
        sub.quit()
        botClient.quit()
        process.exit()
    }
})

process.on('message', ({command, args}) => {
    switch (command) {
        case 'stop':
            console.log(args)
            const data = JSON.stringify({disable: true})
            pubClient.publish(args.botId, data)
            break
    }
})*/
const bot = new Bot(process.argv[2])

process.on('message', ({ command, args }) => {
    switch (command) {
        case 'stop':
            bot.publishStopBot()
            break
    }
})
