const moment = require('moment')
const Logger = require('./logger')
const ChildLogger = require('./childLogger')
const ResponseMessage = require('./getResponseMessage')
const RouteErrorHandler = require('./errorHandler')
const Validation = require('./validation')
const GetExchangeClass = require('./getExchangeClass')
const GetWSClass = require('./getWebSocketClass')
const GetCandleKey = (exchangeName, symbol, timeFrame) =>
    `${exchangeName}__${symbol}__${timeFrame}`
const RoundDate = (date, duration, method) =>
    moment(Math[method](+date / +duration) * +duration)
const GetPriceTickerKey = (exchangeName, pair) =>
    `${exchangeName}__price__${pair}`
const GetTestNetPriceTickerKey = (exchangeName, pair) =>
    `testnet__${exchangeName}__price__${pair}`
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
    GetTestNetPriceTickerKey,
    GetOrderBook10TickerKey,
    GetExchangeClass,
    GetWSClass,
    ChildLogger
}
