const env = process.env
const Logger = require('../logger')
const ResponseMessage = require('../getResponseMessage')
const RouteErrorHandler = (err, req, res, next) => {
    // set locals, only providing error in development
    if (env.NODE_ENV === 'production') {
    } else {
        Logger.info('Error')
        Logger.info(err.message)
        Logger.info(err)
        res.status(err.status || 500)
        Logger.info(res.statusCode)
    }
    if (res.statusCode === 500)
        res.status(500).json(
            ResponseMessage(true, err.message || err.error_description)
        )
    else if (res.statusCode === 404)
        res.status(404).json(ResponseMessage(true, 'Page does not exist'))
    else res.json(ResponseMessage(true, err.message || err.error_description))
}

module.exports = RouteErrorHandler
