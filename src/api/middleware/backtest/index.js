const { DBSchemas } = require('../../db/index')
const { BackTestConfigSchema, SimulationResultSchema } = DBSchemas
const { ResponseMessage } = require('../../../utils')
const Simulator = require('../../../simulator')

async function addNewBackTest(req, res, next) {
    try {
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
        const backTestConfig = await new BackTestConfigSchema({
            _userId: user._id,
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
            ResponseMessage(false, 'Edited back test config successfully', { backTestConfig: editBackTest })
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

async function runBackTestConfig(req, res, next) {
    try {
        const { exchange, symbol, startDate, endDate, timeFrame } = req.body
        const id = req.params.id
        const user = req.user
        if (!id)
            return res
                .status(400)
                .json(
                    ResponseMessage(
                        true,
                        'Need to pass back test configuration id'
                    )
                )
        const backTestConfig = await BackTestConfigSchema.findOne({
            _id: id,
            _userId: user._id
        })
        if (!backTestConfig)
            return res
                .status(400)
                .json(
                    ResponseMessage(true, 'Back test configuration not found')
                )
        const {
            startingBalances,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            feeType
        } = backTestConfig
        let simulator = new Simulator(
            exchange,
            {},
            symbol,
            timeFrame,
            startDate,
            endDate
        )
        simulator.setBotParams(
            startingBalances,
            entryPrice,
            priceA,
            priceB,
            priceR,
            leverage,
            feeType,
            false
        )
        const { bots, stats, notify } = await simulator.simulate()
        const simulationResult = await new SimulationResultSchema({
            _backTestConfigId: id,
            _userId: user._id,
            intervenedCandle: notify,
            bots,
            ...stats,
            exchange,
            timeFrame,
            symbol,
            startDate,
            endDate
        })
        res.json(
            ResponseMessage(false, 'Ran simulation successfully', {
                simulationResult
            })
        )
    } catch (e) {
        return next(e)
    }
}

async function getAllBackTestResults(req, res, next) {
    try {
        const user = req.user
        const simulationResults = await SimulationResultSchema.find({
            _userId: user._id
        })
        res.json(
            ResponseMessage(false, 'Successful request', { simulationResults })
        )
    } catch (e) {
        return next(e)
    }
}

async function getBackTestResult(req, res, next) {
    try {
        const _backTestId = req.params.id
        const user = req.user
        if (!_backTestId)
            return res
                .status(400)
                .json(
                    ResponseMessage(
                        true,
                        'Need to pass back test configuration id'
                    )
                )
        const simulationResults = await SimulationResultSchema.find({
            _userId: user._id,
            _backTestId
        })
        res.json(
            ResponseMessage(false, 'Successful request', { simulationResults })
        )
    } catch (e) {
        return next(e)
    }
}

async function deleteBackTestConfig(req, res, next) {
    try {
        const id = req.params.id
        const user = req.user
        if (!id)
            return res
                .status(400)
                .json(
                    ResponseMessage(
                        true,
                        'Need to pass back test configuration id'
                    )
                )
        const deleteResult = await BackTestConfigSchema.findOneAndRemove({
            _id: id,
            _userId: user._id
        })
        if (deleteResult)
            return res.json(
                ResponseMessage(
                    false,
                    'Successfully deleted back test configuration'
                )
            )
        return res
            .status(500)
            .json(ResponseMessage(true, 'Error deleting bot configuration'))
    } catch (e) {
        return next(e)
    }
}

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
