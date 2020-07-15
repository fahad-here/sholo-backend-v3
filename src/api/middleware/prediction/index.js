const { SholoPrediction } = require('../../../prediction')

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
        const {
            exchange,
            symbol,
            timeframe,
            fromDateTime,
            toDateTime
        } = req.body
        console.log(req.body)
        const sholoPrediction = new SholoPrediction(
            exchange,
            {},
            symbol,
            timeframe,
            new Date(fromDateTime),
            new Date(toDateTime)
        )
        await sholoPrediction.run()
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
