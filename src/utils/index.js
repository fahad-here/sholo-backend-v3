const Logger = require('./logger')
const ResponseMessage = require('./getResponseMessage')
const RouteErrorHandler = require('./errorHandler')
const Validation = require('./validation')
const GetCandleKey = (exchangeName, symbol, timeFrame) =>
    `${exchangeName}__${symbol}__${timeFrame}`
module.exports = {
    Logger,
    ResponseMessage,
    RouteErrorHandler,
    Validation,
    GetCandleKey
}
