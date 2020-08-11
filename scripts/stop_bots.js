const BigNumber = require('bignumber.js')
const { DBConnect } = require('../src/api/db')
const {DBSchemas} = require('../src/api/db')
const { GetExchangeClass } = require('../src/utils')
const {
    AccountSchema,
    BotConfigSchema,
    BotConfigSessionSchema,
    BotSchema,
    OrderSchema,
    PositionSchema
} = DBSchemas

const _changeAccountStatus = async (accountId, inUse) =>
    await AccountSchema.findByIdAndUpdate(
        { _id: accountId },
        { $set: { inUse } },
        { new: true }
    )

const _calculateStatsAndSetSession = async (
    botConfig,
    currentSession,
    bots,
    _userId
) => {
    let totalInitialUsdBalance = 0
    let totalInitialBtcBalance = 0
    let totalEndingUsdBalance = 0
    let totalEndingBtcBalance = 0
    let totalUsdPnl = 0
    let totalBtcPnl = 0
    let totalRealisedBtcPnl = 0
    let totalRealisedUsdPnl = 0
    let totalUnrealisedBtcPnl = 0
    let totalUnrealisedUsdPnl = 0
    let totalFeesBtcPaid = 0
    let totalFeesUsdPaid = 0
    currentSession = await BotConfigSessionSchema.findById({
        _id: currentSession
    })
    let exitChange = {}
    const exchange = await GetExchangeClass(botConfig.exchange)
    const currentTickerPrice = (await exchange.getTickerPrice(botConfig.symbol))
        .last
    if (currentSession.positionSequence > 1) {
        for (let key of Object.keys(botConfig.startingBalances)) {
            const exitPrice = currentSession.exitPrice
                ? currentSession.exitPrice[key]
                    ? currentSession.exitPrice[key]
                    : currentTickerPrice
                : currentTickerPrice
            exitChange = {
                ...exitChange,
                [`exitPrice.${key}`]: exitPrice
            }
            totalInitialBtcBalance = new BigNumber(totalInitialBtcBalance)
                .plus(botConfig.startingBalances[key])
                .toFixed(8)
            totalInitialUsdBalance = new BigNumber(totalInitialUsdBalance)
                .plus(
                    new BigNumber(botConfig.startingBalances[key]).multipliedBy(
                        currentSession.actualEntryPrice[key]
                            ? currentSession.actualEntryPrice[key]
                            : 0
                    )
                )
                .toFixed(8)
            let indexOfBot = bots.findIndex((bot) => bot.order === key)
            let position = await PositionSchema.findOne({
                isOpen: true,
                side: key.includes('l') ? 'long' : 'short',
                _botConfigId: bots[indexOfBot]._botConfigId,
                _botSessionId: currentSession._id
            })
            if (position) {
                totalEndingBtcBalance = bots[indexOfBot].positionOpen
                    ? new BigNumber(totalEndingBtcBalance)
                            .plus(bots[indexOfBot].balance)
                            .plus(position.margin)
                            .plus(bots[indexOfBot].unrealisedPnl)
                            .toFixed(8)
                    : new BigNumber(totalEndingBtcBalance)
                            .plus(bots[indexOfBot].balance)
                            .toFixed(8)
                totalEndingUsdBalance = bots[indexOfBot].positionOpen
                    ? new BigNumber(totalEndingUsdBalance)
                            .plus(
                                new BigNumber(bots[indexOfBot].balance)
                                    .plus(position.margin)
                                    .plus(bots[indexOfBot].unrealisedPnl)
                                    .multipliedBy(exitPrice)
                            )
                            .toFixed(8)
                    : new BigNumber(totalEndingUsdBalance)
                            .plus(
                                new BigNumber(
                                    bots[indexOfBot].balance
                                ).multipliedBy(exitPrice)
                            )
                            .toFixed(8)
            } else {
                let order = await OrderSchema.findOne({
                    orderOpen: true,
                    botOrder: key,
                    _botConfigId: bots[indexOfBot]._botConfigId,
                    _botSessionId: currentSession._id
                })
                if (order) {
                    totalEndingBtcBalance = bots[indexOfBot].orderOpen
                        ? new BigNumber(totalEndingBtcBalance)
                                .plus(bots[indexOfBot].balance)
                                .plus(
                                    new BigNumber(order.amount)
                                        .dividedBy(order.orderPrice)
                                        .toFixed(8)
                                )
                                .toFixed(8)
                        : new BigNumber(totalEndingBtcBalance)
                                .plus(bots[indexOfBot].balance)
                                .toFixed(8)
                    totalEndingUsdBalance = bots[indexOfBot].orderOpen
                        ? new BigNumber(totalEndingUsdBalance)
                                .plus(
                                    new BigNumber(bots[indexOfBot].balance)
                                        .plus(
                                            new BigNumber(order.amount)
                                                .dividedBy(order.orderPrice)
                                                .toFixed(8)
                                        )
                                        .multipliedBy(exitPrice)
                                )
                                .toFixed(8)
                        : new BigNumber(totalEndingUsdBalance)
                                .plus(
                                    new BigNumber(
                                        bots[indexOfBot].balance
                                    ).multipliedBy(exitPrice)
                                )
                                .toFixed(8)
                }
                totalRealisedBtcPnl = new BigNumber(totalRealisedBtcPnl)
                    .plus(bots[indexOfBot].realisedPnl)
                    .plus(bots[indexOfBot].unrealisedPnl)
                    .toFixed(8)
                totalRealisedUsdPnl = new BigNumber(totalRealisedBtcPnl)
                    .multipliedBy(exitPrice)
                    .toFixed(8)
                totalUnrealisedBtcPnl = 0
                totalUnrealisedUsdPnl = 0
            }
            totalBtcPnl = new BigNumber(totalEndingBtcBalance)
                .minus(totalInitialBtcBalance)
                .toFixed(8)
            totalUsdPnl = new BigNumber(totalEndingUsdBalance)
                .minus(totalInitialUsdBalance)
                .toFixed(8)
            //need to fetch current btc price here and calculate
            totalFeesUsdPaid = new BigNumber(totalFeesBtcPaid)
                .multipliedBy(currentTickerPrice)
                .toFixed(8)
        }
        return await BotConfigSessionSchema.findByIdAndUpdate(
            { _id: currentSession._id },
            {
                $set: {
                    stats: {
                        totalInitialBtcBalance,
                        totalInitialUsdBalance,
                        totalEndingUsdBalance,
                        totalEndingBtcBalance,
                        totalBtcPnl,
                        totalUsdPnl,
                        totalFeesBtcPaid,
                        totalFeesUsdPaid,
                        totalRealisedBtcPnl,
                        totalRealisedUsdPnl,
                        totalUnrealisedBtcPnl,
                        totalUnrealisedUsdPnl
                    },
                    active: false,
                    endedAt: Date.now(),
                    ...exitChange
                }
            }
        )
    }
}

const _stopBotConfig = async (botConfig) => {
    try {
        let { selectedAccounts, active, currentSession, paused, _userId } = botConfig
        if (!active || paused)
            return false
        let bots = []
        for (let key of Object.keys(selectedAccounts)) {
            // close open positions if any
            // change account status
            // update s1 and l1 bots
            // not sure if open positions need to be closed on stopping the bot
            // await _closeOpenBTCPositions(selectedAccounts[key], symbol)
            await _changeAccountStatus(selectedAccounts[key], false)
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
        //calculate session stats
        let botConfigSession = await _calculateStatsAndSetSession(
            botConfig,
            currentSession,
            bots,
            _userId
        )
        //update the bot config with the session = null
        const savedBotConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfig._id },
            {
                $set: {
                    active: false,
                    currentSession: null
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

const _stopAllRunningBots = async () => {
    const allConfigs = await BotConfigSchema.find({active: true})
    console.log('Active Configs', allConfigs.length)
    let results = {}
    allConfigs.map(async botConfig => {
        const res = await _stopBotConfig(botConfig)
        results[botConfig._id.toString()] = res
    })
    const checkConfigs = await BotConfigSchema.find({active: true})
    console.log('Check Configs', checkConfigs.length)
    console.log('Results', results)
}

const stopAllBots = async () =>{
    await DBConnect()
    await _stopAllRunningBots()
}

stopAllBots()