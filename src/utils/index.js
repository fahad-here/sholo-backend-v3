const moment = require('moment')

const Logger = require('./logger')
const ResponseMessage = require('./getResponseMessage')
const RouteErrorHandler = require('./errorHandler')
const Validation = require('./validation')
const GetCandleKey = (exchangeName, symbol, timeFrame) =>
    `${exchangeName}__${symbol}__${timeFrame}`
const RoundDate = (date, duration, method) =>
    moment(Math[method](+date / +duration) * +duration)
module.exports = {
    Logger,
    ResponseMessage,
    RouteErrorHandler,
    Validation,
    GetCandleKey,
    RoundDate
}
