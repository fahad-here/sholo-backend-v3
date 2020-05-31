const moment = require('moment')

const Logger = require('./logger')
const ResponseMessage = require('./getResponseMessage')
const RouteErrorHandler = require('./errorHandler')
const Validation = require('./validation')
const GetCandleKey = (exchangeName, symbol, timeFrame) =>
    `${exchangeName}__${symbol}__${timeFrame}`
const RoundDate = (date, duration, method) =>
    moment(Math[method](+date / +duration) * +duration)
const GetPriceTickerKey = (exchangeName, pair) =>
    `${exchangeName}__price__${pair}`
const GetOrderBook10TickerKey = (exchangeName, pair) =>
    `${exchangeName}__order10__${pair}`
module.exports = {
    Logger,
    ResponseMessage,
    RouteErrorHandler,
    Validation,
    GetCandleKey,
    RoundDate,
    GetPriceTickerKey,
    GetOrderBook10TickerKey
}
