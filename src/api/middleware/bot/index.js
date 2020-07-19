const { SHOLO_STRATEGY } = require('../../../constants')
const { ResponseMessage, GetExchangeClass } = require('../../../utils')
const { DBSchemas } = require('../../db/index')
const {
    AccountSchema,
    BotConfigSchema,
    BotConfigSessionSchema,
    BotSchema,
    OrderSchema,
    PositionSchema
} = DBSchemas
const Trade = require('../../../trade')
const BigNumber = require('bignumber.js')

const _checkUniqueAccounts = (accountIds) => {
    let accountIDArray = []
    for (let key of Object.keys(accountIds)) {
        accountIDArray.push(accountIds[key])
    }
    let beforeLength = accountIDArray.length
    let filterAccountIDs = accountIDArray.filter(
        (x, i, a) => a.indexOf(x) === i
    )
    return beforeLength === filterAccountIDs.length
}

const _checkAccountInUse = async (accountIds) => {
    let found = false
    for (let key of Object.keys(accountIds)) {
        const check = await AccountSchema.findById({ _id: accountIds[key] })
        if (check.inUse) {
            found = true
            break
        }
    }
    return found
}

const _fetchAccountBalance = async (accountID) => {
    const account = await AccountSchema.findById({ _id: accountID })
    if (!account) return -1
    const exchangeParams = {
        enableRateLimit: true,
        apiKey: account.apiKey,
        secret: account.apiSecret
    }

    let exchangeClass = await GetExchangeClass(account.exchange, exchangeParams)
    if (account.testNet) exchangeClass.setTestNet()
    const accountBalance = await exchangeClass.getFetchBalance()
    await AccountSchema.findByIdAndUpdate(
        { _id: account._id },
        {
            $set: {
                balance: accountBalance
            }
        }
    )
    return accountBalance.free
}

const _checkAccountBalances = async (accountIds, startingBalances) => {
    let accountBalances = {}
    for (let key of Object.keys(accountIds)) {
        accountBalances[key] = {}
        let bal = await _fetchAccountBalance(accountIds[key])
        accountBalances[key].balance = bal
        if (bal !== -1) {
            accountBalances[key].balanceCheck =
                bal['BTC'] >= startingBalances[key]
        }
    }
    return accountBalances
}

const _toggleAccountInUse = async (accountID, inUseByConfig) =>
    await AccountSchema.findByIdAndUpdate({ _id: accountID }, { inUseByConfig })

const _closeOpenBTCPositions = async (accountId, symbol) => {
    const accountDetails = await AccountSchema.findById({ _id: accountId })
    const trader = new Trade(
        accountDetails.exchange,
        {
            enableRateLimit: true,
            apiKey: accountDetails.apiKey,
            secret: accountDetails.apiSecret
        },
        accountDetails.testNet
    )
    trader.setPair(symbol)
    await trader.closeOpenPositions()
}

const _createBot = async (
    order,
    botConfig,
    botConfigSession,
    accountDetails,
    existingBot
) => {
    const {
        _id: _botConfigId,
        _userId,
        startingBalances,
        exchange,
        symbol,
        entryPrice,
        priceA,
        priceB,
        priceR,
        leverage,
        marketThreshold,
        feeType,
        strategy,
        id: _botConfigIdSimple,
        name
    } = botConfig
    const _accountId = accountDetails._id
    const _accountIdSimple = accountDetails.id
    const initialBalance = startingBalances[order]
    const direction = order.includes('l') ? 'long' : 'short'
    const { _id: _botSessionId, id: _botSessionIdSimple } = botConfigSession
    if (existingBot)
        return await BotSchema.findOneAndUpdate(
            { _botConfigId, order },
            {
                $set: {
                    _userId,
                    _accountId,
                    _botConfigId,
                    _botSessionId,
                    _accountIdSimple,
                    _botConfigIdSimple,
                    _botSessionIdSimple,
                    direction,
                    order,
                    exchange,
                    symbol,
                    initialBalance,
                    balance: initialBalance,
                    priceA,
                    priceB,
                    priceR,
                    priceP: entryPrice,
                    entryPrice,
                    positionOpen: false,
                    leverage,
                    liquidated: false,
                    marketThreshold,
                    feeType,
                    enabled: true,
                    testNet: accountDetails.testNet,
                    strategy,
                    realisedPnl: 0,
                    unrealisedPnl: 0,
                    name: `${name} ${order}`
                }
            },
            { upsert: true, new: true }
        )
    else
        return await new BotSchema({
            _userId,
            _accountId,
            _botConfigId,
            _botSessionId,
            _accountIdSimple,
            _botConfigIdSimple,
            _botSessionIdSimple,
            direction,
            order,
            exchange,
            symbol,
            initialBalance,
            balance: initialBalance,
            priceA,
            priceB,
            priceR,
            priceP: entryPrice,
            entryPrice,
            leverage,
            liquidated: false,
            marketThreshold,
            feeType,
            enabled: true,
            testNet: accountDetails.testNet,
            strategy,
            realisedPnl: 0,
            unrealisedPnl: 0,
            name: `${name} ${order}`
        }).save()
}

const _changeAccountStatus = async (accountId, inUse) =>
    await AccountSchema.findByIdAndUpdate(
        { _id: accountId },
        { $set: { inUse } },
        { new: true }
    )

const _startBot = async (req, res, next, botConfig, _userId) => {
    try {
        let accountCheck = await _checkUniqueAccounts(
            botConfig.selectedAccounts
        )
        if (!accountCheck)
            return res
                .status(403)
                .json(ResponseMessage(true, 'Please choose unique accounts'))
        let {
            selectedAccounts,
            startingBalances,
            exchange,
            symbol,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            marketThreshold,
            feeType,
            active,
            strategy,
            id: _botConfigIdSimple,
            currentSession,
            testNet,
            name
        } = botConfig
        if (active)
            return res
                .status(500)
                .json(
                    ResponseMessage(true, 'Bot configuration is already active')
                )
        let botConfigSession
        if (!currentSession)
            botConfigSession = await new BotConfigSessionSchema({
                selectedAccounts,
                startingBalances,
                exchange,
                symbol,
                entryPrice: { s1: entryPrice, l1: entryPrice },
                priceA,
                priceB,
                priceR,
                leverage,
                marketThreshold,
                feeType,
                _userId,
                _botConfigId: botConfig._id,
                _botConfigIdSimple,
                startedAt: new Date(),
                strategy,
                active: true,
                testNet
            }).save()
        else
            botConfigSession = await BotConfigSessionSchema.findById({
                _id: currentSession
            })
        let bots = []
        for (let key of Object.keys(selectedAccounts)) {
            // close open positions if any
            // change account status
            // create a bot for s1 and l1
            await _closeOpenBTCPositions(selectedAccounts[key], symbol)
            const accountDetails = await _changeAccountStatus(
                selectedAccounts[key],
                true
            )
            const checkBot = await BotSchema.findOne({
                order: key,
                _botConfigId: botConfig._id
            })
            const bot = await _createBot(
                key,
                botConfig,
                botConfigSession,
                accountDetails,
                checkBot
            )
            botConfigSession = await BotConfigSessionSchema.findByIdAndUpdate(
                { _id: botConfigSession._id },
                { $set: { [`_botIds.${bot.order}`]: bot.id } },
                { new: true }
            )
            bots.push(bot)
        }
        //update the bot config with the session
        //set bots to active so that coordinator picks it up
        const savedBotConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfig._id },
            {
                $set: {
                    active: true,
                    paused: false,
                    currentSession: botConfigSession._id
                }
            },
            { new: true }
        )
        return res.json(
            ResponseMessage(false, 'Bot configuration is now active', {
                botConfig: savedBotConfig,
                botConfigSession,
                bots
            })
        )
    } catch (e) {
        return next(e)
    }
}
//5ef8ecf0ad8e4e5b98fb969d
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
                          new BigNumber(bots[indexOfBot].balance).multipliedBy(
                              exitPrice
                          )
                      )
                      .toFixed(8)
            let currentBotOrders = await OrderSchema.find({
                _userId,
                _botId: bots[indexOfBot]._id,
                _botConfigId: botConfig._id,
                _botSessionId: currentSession._id
            })
            currentBotOrders.map((currentOrder) => {
                totalFeesBtcPaid = new BigNumber(totalFeesBtcPaid)
                    .plus(currentOrder.fees)
                    .toFixed(8)
            })
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

const _stopBot = async (req, res, next, botConfig, _userId) => {
    try {
        let { selectedAccounts, active, currentSession, paused } = botConfig
        if (!active || paused)
            return res
                .status(500)
                .json(
                    ResponseMessage(
                        true,
                        'Bot configuration is already paused/stopped'
                    )
                )
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
        return res.json(
            ResponseMessage(false, 'Bot configuration is now active', {
                botConfig: savedBotConfig,
                botConfigSession,
                bots
            })
        )
    } catch (e) {
        console.log(e)
        return next(e)
    }
}

const _pauseBot = async (req, res, next, botConfig, _userId) => {
    try {
        let { selectedAccounts, active, currentSession, paused } = botConfig
        if (!active || paused)
            return res
                .status(500)
                .json(
                    ResponseMessage(
                        true,
                        'Bot configuration is already paused/stopped'
                    )
                )
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
        return res.json(
            ResponseMessage(false, 'Bot configuration is now active', {
                botConfig: savedBotConfig,
                botConfigSession,
                bots
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function createBotConfig(req, res, next) {
    try {
        const {
            selectedAccounts,
            startingBalances,
            exchange,
            symbol,
            priceA,
            priceB,
            priceR,
            feeType,
            entryPrice,
            leverage,
            marketThreshold,
            testNet,
            name
        } = req.body
        const strategy = SHOLO_STRATEGY
        const _userId = req.user._id
        let check = _checkUniqueAccounts(selectedAccounts)
        if (!check)
            return res
                .status(403)
                .json(ResponseMessage(true, 'Please choose unique accounts'))
        const checkUse = await _checkAccountInUse(selectedAccounts)
        if (checkUse)
            return res
                .status(403)
                .json(
                    ResponseMessage(
                        true,
                        'One or more accounts are already in use by other configurations'
                    )
                )
        const accountBalances = await _checkAccountBalances(
            selectedAccounts,
            startingBalances
        )
        for (let key of Object.keys(accountBalances)) {
            if (
                accountBalances[key] === -1 ||
                !accountBalances[key].balanceCheck
            )
                return res
                    .status(403)
                    .json(
                        ResponseMessage(
                            true,
                            'One or more accounts have insufficient BTC balance',
                            accountBalances
                        )
                    )
        }

        let botConfig = await new BotConfigSchema({
            selectedAccounts,
            startingBalances,
            exchange,
            symbol,
            priceA,
            priceB,
            priceR,
            feeType,
            entryPrice,
            leverage,
            marketThreshold,
            _userId,
            strategy,
            testNet,
            name
        }).save()
        for (let key of Object.keys(botConfig.selectedAccounts))
            await _toggleAccountInUse(botConfig.selectedAccounts[key], true)
        if (botConfig)
            return res.json(
                ResponseMessage(false, 'Successful Request', { botConfig })
            )
        return res
            .status(500)
            .json(ResponseMessage(true, 'Error creating bot configuration'))
    } catch (e) {
        return next(e)
    }
}

async function editBotConfig(req, res, next) {
    try {
        const botConfigID = req.params.id
        const _userId = req.user._id
        const {
            selectedAccounts,
            startingBalances,
            exchange,
            symbol,
            priceA,
            priceB,
            priceR,
            feeType,
            entryPrice,
            leverage,
            marketThreshold,
            testNet,
            name
        } = req.body
        const findBotConfig = await BotConfigSchema.findById({
            _id: botConfigID,
            _userId
        })
        if (!findBotConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot config not found'))
        if (findBotConfig.active || findBotConfig.paused)
            return res
                .status(403)
                .json(
                    ResponseMessage(
                        true,
                        'This configuration is currently active/paused, ' +
                            'please stop it before trying to editing it'
                    )
                )
        let check = _checkUniqueAccounts(selectedAccounts)
        if (!check)
            return res
                .status(403)
                .json(ResponseMessage(true, 'Please choose unique accounts'))
        const accountBalances = await _checkAccountBalances(
            selectedAccounts,
            startingBalances
        )

        for (let key of Object.keys(accountBalances)) {
            if (
                accountBalances[key] === -1 ||
                !accountBalances[key].balanceCheck
            )
                return res
                    .status(403)
                    .json(
                        ResponseMessage(
                            true,
                            'One or more accounts have insufficient BTC balance',
                            accountBalances
                        )
                    )
        }
        const changeBotConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfigID },
            {
                $set: {
                    selectedAccounts,
                    startingBalances,
                    exchange,
                    symbol,
                    priceA,
                    priceB,
                    priceR,
                    feeType,
                    entryPrice,
                    leverage,
                    marketThreshold,
                    testNet,
                    name
                }
            },
            {
                new: true
            }
        )
        if (changeBotConfig)
            return res.json(
                ResponseMessage(false, 'Successful Request', {
                    botConfig: changeBotConfig
                })
            )
        return res
            .status(500)
            .json(ResponseMessage(true, 'Error editing bot configuration'))
    } catch (e) {
        return next(e)
    }
}

async function deleteBotConfig(req, res, next) {
    try {
        const botConfigID = req.params.id
        const _userId = req.user._id
        const findBotConfig = await BotConfigSchema.findById({
            _id: botConfigID,
            _userId
        })
        if (!findBotConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot config not found'))
        if (findBotConfig.active)
            return res
                .status(403)
                .json(
                    ResponseMessage(
                        true,
                        'This configuration is currently active, please disable it before deleting it'
                    )
                )
        //TODO: reset bots
        for (let key of Object.keys(findBotConfig.selectedAccounts)) {
            // TODO: close open btc positons
            // TODO: set the bot configuration to inactive
        }
        const deleteRes = await findBotConfig.remove()
        if (deleteRes)
            return res.json(ResponseMessage(false, 'Successful Request'))
        return res
            .status(500)
            .json(ResponseMessage(true, 'Error deleting bot configuration'))
    } catch (e) {
        return next(e)
    }
}

async function getAllBotConfigs(req, res, next) {
    try {
        const _userId = req.user._id
        const botConfigs = await BotConfigSchema.find({ _userId })
        if (!botConfigs || botConfigs.length === 0)
            return res
                .status(403)
                .json(ResponseMessage(true, 'Bot configs do not exist'))
        return res.json(
            ResponseMessage(false, 'Successful Request', {
                botConfigs
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function runBotConfigAction(req, res, next) {
    try {
        let { action, id } = req.params
        let _userId = req.user._id
        if (action !== 'start' && action !== 'stop' && action !== 'pause') {
            return res
                .status(403)
                .json(
                    ResponseMessage(
                        true,
                        'This is not an action we can perform on the bot.'
                    )
                )
        }
        const findBotConfig = await BotConfigSchema.findOne({
            _id: id,
            _userId
        })
        if (!findBotConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot configuration not found.'))
        if (findBotConfig.archived)
            return res
                .status(401)
                .json(ResponseMessage(true, 'Bot configuration is archied.'))
        switch (action) {
            case 'start':
                return await _startBot(req, res, next, findBotConfig, _userId)
            case 'stop':
                return await _stopBot(req, res, next, findBotConfig, _userId)
            case 'pause':
                return await _pauseBot(req, res, next, findBotConfig, _userId)
        }
    } catch (e) {
        return next(e)
    }
}

async function getAllBotSessions(req, res, next) {
    try {
        const _userId = req.user._id
        let botSessions = await BotConfigSessionSchema.find({ _userId })
        if (!botSessions || botSessions.length === 0)
            return res
                .status(404)
                .json(ResponseMessage(true, 'No bot sessions found.'))
        botSessions = botSessions.sort(
            (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        )
        return res
            .status(200)
            .json(ResponseMessage(false, 'Successful Request', { botSessions }))
    } catch (e) {
        return next(e)
    }
}

async function getAllBots(req, res, next) {
    try {
        const _userId = req.user._id
        let bots = await BotSchema.find({ _userId })
        if (!bots || bots.length === 0)
            return res.status(404).json(ResponseMessage(true, 'No bots found.'))
        bots = bots.sort((a, b) => b.id - a.id)
        return res
            .status(200)
            .json(ResponseMessage(false, 'Successful Request', { bots }))
    } catch (e) {
        return next(e)
    }
}

async function getAllOrders(req, res, next) {
    try {
        const _userId = req.user._id
        let orders = await OrderSchema.find({ _userId })
        if (!orders || orders.length === 0)
            return res
                .status(404)
                .json(ResponseMessage(true, 'No orders found.'))
        orders = orders.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
        return res
            .status(200)
            .json(ResponseMessage(false, 'Successful Request', { orders }))
    } catch (e) {
        return next(e)
    }
}

async function getAllPositions(req, res, next) {
    try {
        const _userId = req.user._id
        let positions = await PositionSchema.find({ _userId })
        if (!positions || positions.length === 0)
            return res
                .status(404)
                .json(ResponseMessage(true, 'No positions found.'))
        positions = positions.sort(
            (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        )
        return res.status(200).json(
            ResponseMessage(false, 'Successful Request', {
                positions
            })
        )
    } catch (e) {
        return next(e)
    }
}

const _getBotConfigSessionOrdersAndPositions = async (
    _botConfigId,
    _botSessionId,
    _userId
) => {
    let orders = await OrderSchema.find({
        _botConfigId,
        _botSessionId,
        _userId
    })
    let positions = await PositionSchema.find({
        _botConfigId,
        _botSessionId,
        _userId
    })
    return {
        orders,
        positions
    }
}

async function getAllSessionDetails(req, res, next) {
    try {
        const _id = req.params.id
        const _userId = req.user._id
        if (!_id)
            return res
                .status(400)
                .json(ResponseMessage(true, 'Please provide a bot config id'))
        const botConfig = await BotConfigSchema.findById({ _id })
        if (!botConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot config not found'))
        let botSessions = await BotConfigSessionSchema.find({
            _botConfigId: botConfig._id,
            _userId
        })
        botSessions = botSessions.sort(
            (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        )
        const bots = await BotSchema.find({
            _botConfigId: botConfig._id,
            _userId
        })
        let sessionOrders = []
        let sessionPositions = []
        let botConfigOrders = []
        let botConfigPositions = []
        for (let i = 0; i < botSessions.length; i++) {
            let {
                orders,
                positions
            } = await _getBotConfigSessionOrdersAndPositions(
                botConfig._id,
                botSessions[i]._id,
                _userId
            )
            if (orders) botConfigOrders = [...botConfigOrders, ...orders]
            if (positions)
                botConfigPositions = [...botConfigPositions, ...positions]
            sessionOrders.push({
                [`${botSessions[i]._id}`]: orders
            })
            sessionPositions.push({
                [`${botSessions[i]._id}`]: positions
            })
        }
        botConfigOrders = botConfigOrders.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
        botConfigPositions = botConfigPositions.sort(
            (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        )
        return res.json(
            ResponseMessage(false, 'Successful request', {
                sessionOrders,
                sessionPositions,
                botConfigOrders,
                botConfigPositions,
                botSessions,
                bots,
                botConfig
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function getCurrentSessionDetails(req, res, next) {
    try {
        const _botId = req.params.botId
        const _botSessionId = req.params.sessionId
        const _userId = req.user._id
        if (!_botSessionId)
            return res
                .status(400)
                .json(
                    ResponseMessage(
                        true,
                        'Please provide a bot config & a session id'
                    )
                )
        const botConfig = await BotConfigSchema.findById({ _id: _botId })
        if (!botConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot config not found'))
        const botSession = await BotConfigSessionSchema.findOne({
            _botConfigId: botConfig._id,
            _userId,
            _id: _botSessionId
        })
        const bots = await BotSchema.find({
            _botConfigId: botConfig._id,
            active: true,
            _userId,
            _botSessionId
        })

        let {
            orders,
            positions
        } = await _getBotConfigSessionOrdersAndPositions(
            botConfig._id,
            botSession._id,
            _userId
        )
        orders = orders.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
        positions = positions.sort(
            (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
        )
        return res.json(
            ResponseMessage(false, 'Successful request', {
                sessionOrders: orders,
                sessionPositions: positions,
                botSession,
                sessionBots: bots,
                botConfig
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function archiveBotConfig(req, res, next) {
    try {
        const _id = req.params.id
        let botConfig = await BotConfigSchema.findById({ _id })
        if (!botConfig)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Bot config not found'))
        if (botConfig.archived)
            return res
                .status(401)
                .json(ResponseMessage(true, 'Bot config is already archived.'))
        if (botConfig.paused)
            return res
                .status(401)
                .json(
                    ResponseMessage(
                        true,
                        'Bot config is currently paused, please stop it before archiving'
                    )
                )
        if (botConfig.active)
            return res
                .status(401)
                .json(
                    ResponseMessage(
                        true,
                        'Bot config is currently active, please stop it before archiving'
                    )
                )
        let bots = await BotSchema.find({
            _botConfigId: _id,
            _userId: req.user._id
        })
        let enabled = false
        let active = false
        let positionOpen = false
        if (bots) {
            bots.map((bot) => {
                if (bot.enabled) enabled = true
                if (bot.active) active = true
                if (bot.positionOpen) positionOpen = true
            })
        }
        if (enabled || active)
            return res
                .status(401)
                .json(
                    ResponseMessage(
                        true,
                        'One or more bots under this config is active/enabled, please stop it before archiving'
                    )
                )
        if (positionOpen)
            return res
                .status(401)
                .json(
                    ResponseMessage(
                        true,
                        'One or more bots has an open position, please close it before archiving'
                    )
                )
        botConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfig._id },
            { $set: { archived: true } },
            { new: true }
        )
        let updatedBots = []
        let accounts = []
        bots.map(async (bot) => {
            let update = await BotSchema.findByIdAndUpdate(
                { _id: bot._id },
                { $set: { archived: true } },
                { new: true }
            )
            updatedBots.push(update)

            let account = await _changeAccountStatus(bot._accountId, false)
            accounts.push(account)
        })
        return res.json(
            ResponseMessage(false, 'Successful Request', {
                botConfig,
                bots: updatedBots,
                accounts
            })
        )
    } catch (err) {
        return next(err)
    }
}

module.exports = {
    createBotConfig,
    editBotConfig,
    deleteBotConfig,
    getAllBotConfigs,
    runBotConfigAction,
    getAllBotSessions,
    getAllBots,
    getAllOrders,
    getAllPositions,
    getAllSessionDetails,
    getCurrentSessionDetails
}
