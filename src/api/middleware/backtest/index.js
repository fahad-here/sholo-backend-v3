const { DBSchemas } = require('../../db/index')
const { BackTestConfigSchema } = DBSchemas
const { ResponseMessage } = require('../../../utils')

async function addNewBackTest(req, res, next) {
    try {
        const {
            startingBalances,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            feeType
        } = req.body
        const backTestConfig = await new BackTestConfigSchema({
            startingBalances,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            feeType
        }).save()
        return res.json(
            ResponseMessage(
                false,
                'Successfully added back test configuration',
                { backTestConfig }
            )
        )
    } catch (e) {
        return next(e)
    }
}

async function editBackTest(req, res, next) {
    try {
        //send non edited values as well
        const id = req.params.id
        const user = req.user
        const {
            startingBalances,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            feeType
        } = req.body
        const findBackTest = await BackTestConfigSchema.findOne({
            _id: id,
            _userId: user._id
        })
        if (!findBackTest)
            return res
                .status(404)
                .json(ResponseMessage(true, 'BackTest Config not found'))
        const editBackTest = await BackTestConfigSchema.findByIdAndUpdate(
            { _id: id },
            {
                $set: {
                    startingBalances,
                    entryPrice,
                    priceA,
                    priceB,
                    priceR,
                    leverage,
                    feeType
                }
            },
            { new: true }
        )
        return res.json(
            ResponseMessage(false, 'Edited back test config successfully'),
            { backTestConfig: editBackTest }
        )
    } catch (e) {
        return next(e)
    }
}

async function getAllBackTestConfigs(req, res, next) {
    try {
        const user = req.user
        const backTestConfigs = await BackTestConfigSchema.find({
            _userId: user._id
        })
        if (!backTestConfigs)
            return res.json(
                ResponseMessage(false, 'No back test configs found')
            )
        return res.json(
            ResponseMessage(false, 'Back test configs found', {
                backTestConfigs
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function getBackTestConfig(req, res, next) {
    try {
        const id = req.params.id
        const user = req.user
        const backTestConfig = await BackTestConfigSchema.findOne({
            _id: id,
            _userId: user._id
        })
        if (!backTestConfig)
            return res.json(
                ResponseMessage(false, 'Back test config not found')
            )
        return res.json(
            ResponseMessage(false, 'Back test config found', { backTestConfig })
        )
    } catch (e) {
        return next(e)
    }
}

async function runBackTestConfig(req, res, next) {}

async function getAllBackTestResults(req, res, next) {}

async function getBackTestResult(req, res, next) {}

async function deleteBackTestConfig(req, res, next) {}

module.exports = {
    addNewBackTest,
    editBackTest,
    getAllBackTestConfigs,
    getBackTestConfig,
    deleteBackTestConfig,
    runBackTestConfig,
    getBackTestResult,
    getAllBackTestResults
}
