const { ResponseMessage, GetExchangeClass } = require('../../../utils')
const { DBSchemas } = require('../../db/index')
const {
    AccountSchema,
    BotConfigSchema,
    BotConfigSessionSchema,
    BotSchema
} = DBSchemas

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
    Logger.info('Account Details ', accountDetails._doc)
    const exchangeParams = {
        enableRateLimit: true,
        apiKey: accountDetails.apiKey,
        secret: accountDetails.apiSecret
    }
    let exchangeClass = await GetExchangeClass(
        accountDetails.exchange,
        exchangeParams
    )
    if (accountDetails.testNet) exchangeClass.setTestNet()
    //close positions when trade module is added
}

const _createBot = async (
    order,
    botConfig,
    botConfigSession,
    accountDetails
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
        feeType
    } = botConfig
    const _accountId = accountDetails._id
    const initialBalance = startingBalances[order]
    const direction = order.includes('l') ? 'long' : 'short'
    const { _id: _botSessionId } = botConfigSession
    return await BotSchema.findOneAndUpdate(
        { _botConfigId, order },
        {
            $set: {
                _userId,
                _accountId,
                _botConfigId,
                _botSessionId,
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
                testNet: accountDetails.testNet
            }
        },
        { upsert: true, new: true }
    )
}

const _changeAccountStatus = async (accountId, inUse) =>
    await AccountSchema.findByIdAndUpdate({ _id: accountId }, { inUse })

const _startBot = async (req, res, next, botConfig) => {
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
            active
        } = botConfig
        if (active)
            return res
                .status(500)
                .json(
                    ResponseMessage(true, 'Bot configuration is already active')
                )
        let botConfigSession = await new BotConfigSessionSchema({
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
            startedAt: new Date()
        }).save()
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

            const bot = await _createBot(
                key,
                botConfig,
                botConfigSession,
                accountDetails
            )
            bots.push(bot)
        }
        //update the bot config with the session
        //enable all the bots
        const savedBotConfig = await BotConfigSchema.findByIdAndUpdate(
            { _id: botConfig._id },
            {
                $set: {
                    active: true,
                    currentSession: botConfigSession._id
                }
            },
            { new: true }
        )
        for (let i = 0; i < bots.length; i++) {
            //await enableBot(bots[i])
        }
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

const _stopBot = (req, res, next, botConfig) => {
    try {
        return res.json(ResponseMessage(false, 'Place Holder'))
    } catch (e) {
        return next(e)
    }
}

const _killBot = (req, res, next, botConfig) => {
    try {
        return res.json(ResponseMessage(false, 'Place Holder'))
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
            marketThreshold
        } = req.body
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
            _userId
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
        const _userId = res.locals.user._id
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
            marketThreshold
        } = req.body
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
                        'This configuration is currently active, please disable it before editing it'
                    )
                )
        let check = _checkUniqueAccounts(null, selectedAccounts)
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
                    marketThreshold
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
        const _userId = res.locals.user._id
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
        const _userId = res.locals.user._id
        const botConfigs = await BotConfigSchema.find({ _userId })
        if (!botConfigs || botConfigs.length === 0)
            return res
                .status(403)
                .json(ResponseMessage(true, 'Bot configs do not exist'))
        return res.json(ResponseMessage(true, 'Successful Request'), {
            botConfigs
        })
    } catch (e) {
        return next(e)
    }
}

async function runBotConfigAction(req, res, next) {
    try {
        let { action, id } = req.params
        let _userId = req.user._id
        if (action !== 'start' || action !== 'stop' || action !== 'kill') {
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
        switch (action) {
            case 'start':
                return await _startBot(req, res, next, findBotConfig, _userId)
            case 'stop':
                return await _stopBot(req, res, next, findBotConfig, _userId)
            case 'kill':
                return await _killBot(req, res, next, findBotConfig, _userId)
        }
    } catch (e) {
        return next(e)
    }
}

module.exports = {
    createBotConfig,
    editBotConfig,
    deleteBotConfig,
    getAllBotConfigs,
    runBotConfigAction
}
