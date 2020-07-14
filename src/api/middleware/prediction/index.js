const {} = require('../../db/models')

async function getAllPredictionResults(req, res, next) {
    try {
        return res.json({
            message: `Test successfully`
        })
    } catch (e) {
        return next(e)
    }
}

async function getPredictionResult(req, res, next) {
    try {
        return res.json({
            message: `Test successfully`
        })
    } catch (e) {
        return next(e)
    }
}

async function runTestOnTimeFrame(req, res, next) {
    try {
        return res.json({
            message: `Test successfully`
        })
    } catch (e) {
        return next(e)
    }
}

module.exports = {
    getAllPredictionResults,
    getPredictionResult,
    runTestOnTimeFrame
}
