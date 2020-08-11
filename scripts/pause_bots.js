const { DBConnect } = require('../src/api/db')
const {DBSchemas} = require('../src/api/db')
const {
    BotConfigSchema,
    BotConfigSessionSchema,
    BotSchema,
} = DBSchemas

const _pauseBotConfig = async (botConfig) => {
    try {
        let { selectedAccounts, active, currentSession, paused, _userId } = botConfig
        if (!active || paused)
            return false
        let bots = []
        for (let key of Object.keys(selectedAccounts)) {
            const bot = await BotSchema.findOneAndUpdate(
                {
                    _accountId: selectedAccounts[key],
                    _botSessionId: currentSession,
                    _userId,
                    _botConfigId: botConfig._id
                },
                {
                    $set: {
                        enabled: false
                    }
                },
                { new: true }
            )
            bots.push(bot)
        }
        let botConfigSession = await BotConfigSessionSchema.findByIdAndUpdate(
            { _id: currentSession },
            {
                $set: {
                    active: false
                }
            },
            { new: true }
        )
        //update the bot config with the session = null
        const savedBotConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfig._id },
            {
                $set: {
                    active: false,
                    paused: true
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
    const allConfigs = await BotConfigSchema.find({active: true})
    console.log('Active Configs', allConfigs.length)
    let results = {}
    await allConfigs.map(async botConfig => {
        const res = await _pauseBotConfig(botConfig)
        results[botConfig._id.toString()] = res
    })
    const checkConfigs = await BotConfigSchema.find({active: true})
    console.log('Check Configs', checkConfigs.length)
    console.log('Results', results)
}

const pauseAllBots = async () =>{
    await DBConnect()
    await _pauseAllRunningBots()
    process.exit()
}

pauseAllBots()