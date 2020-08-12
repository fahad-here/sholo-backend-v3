require('dotenv').config()
const { DBConnect } = require('../src/api/db')
const {DBSchemas} = require('../src/api/db')
const {
    BotSchema,
} = DBSchemas

const _pauseBot = async (bot) => {
    try {
        let { active } = bot
        if (!active)
            return false
        bot = await BotSchema.findOneAndUpdate(
            {
                _id: bot._id,
            },
            {
                $set: {
                    active: false
                }
            },
            { new: true }
        )
        return true
    } catch (e) {
        console.log(e)
        return false
    }
}

const _pauseAllRunningBots = async () => {
    const allBots = await BotSchema.find({active: true})
    console.log('Active Bots', allBots.length)
    let results = {}
    await allBots.map(async bot => {
        const res = await _pauseBot(bot)
        results[bot._id.toString()] = res
    })
    const checkConfigs = await BotSchema.find({active: true})
    console.log('Check Bots', checkConfigs.length)
    console.log('Results', results)
}

const pauseAllBots = async () =>{
    await DBConnect()
    await _pauseAllRunningBots()
    process.exit()
}

pauseAllBots()