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

module.exports = {
    createBotConfig
}
