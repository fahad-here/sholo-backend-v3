const { ResponseMessage, GetExchangeClass } = require('../../../utils')
const { DBSchemas } = require('../../db/index')
const { AccountSchema, BotConfigSchema } = DBSchemas

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

module.exports = {
    createBotConfig,
    editBotConfig,
    deleteBotConfig,
    getAllBotConfigs
}
