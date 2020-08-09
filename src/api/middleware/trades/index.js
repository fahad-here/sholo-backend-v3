const { OrderSchema, AccountSchema } = require('../../db/models')
const { ResponseMessage } = require('../../../utils')
const Trade = require('../../../trade')

async function getAllTradesByOrderId(trader, symbol, orderID) {
    let params = orderID
        ? {
              filter: {
                  orderID
              }
          }
        : {}
    let since = trader.getExchangeTime() - 2592000000 // 30 days
    trader.setPair(symbol)
    let allTrades = []
    loop1: while (since < trader.getExchangeTime()) {
        const limit = 500 // change for your limit
        const trades = await trader.getTrades(since, limit, params)
        if (trades.length) {
            since = trades[0]['timestamp']
            for (let i = 0; i < trades.length; i++) {
                let exists = allTrades.filter((trade) => {
                    return trade.id === trades[i].id
                })
                if (exists.length > 0) {
                    break loop1
                } else {
                    allTrades = allTrades.concat(trades)
                }
            }
        } else {
            break
        }
    }
    return allTrades
}

async function getTradesByOrder(req, res, next) {
    try {
        const _id = req.params.orderId
        let orders = await OrderSchema.findById({ _id })
        if (!orders)
            return res
                .status(404)
                .json(ResponseMessage(true, 'Order not found'))
        const accountDetails = await AccountSchema.findById({
            _id: orders._accountId
        })
        let trader = new Trade(
            accountDetails.exchange,
            {
                enableRateLimit: true,
                apiKey: accountDetails.apiKey,
                secret: accountDetails.apiSecret
            },
            accountDetails.testNet
        )
        let trades = await getAllTradesByOrderId(
            trader,
            orders.symbol,
            orders._orderId
        )
        trades.map((trade, index) => {
            trades[index] = {
                ...trade,
                simpleOrderId: orders.id
            }
        })
        trades = trades.sort((a, b) => b - a)
        return res.json(
            ResponseMessage(false, 'Successful Request', { trades })
        )
    } catch (e) {
        return next(e)
    }
}

async function getTradesBySessionId(req, res, next) {
    try {
        const _botConfigId = req.params.botConfigId
        const _botSessionId = req.params.botSessionId
        let trades = []
        let allOrders = await OrderSchema.find({ _botConfigId, _botSessionId })
        if (allOrders) {
            for (let i = 0; i < allOrders.length; i++) {
                console.log('orders', allOrders[i]._orderId)
                const accountDetails = await AccountSchema.findById({
                    _id: allOrders[i]._accountId
                })
                let trader = new Trade(
                    accountDetails.exchange,
                    {
                        enableRateLimit: true,
                        apiKey: accountDetails.apiKey,
                        secret: accountDetails.apiSecret
                    },
                    accountDetails.testNet
                )
                let orderTrades = await getAllTradesByOrderId(
                    trader,
                    allOrders[i].symbol,
                    allOrders[i]._orderId
                )
                orderTrades.map((trade, index) => {
                    orderTrades[index] = {
                        ...trade,
                        simpleOrderId: allOrders[i].id
                    }
                })
                trades = trades.concat(orderTrades)
            }
            trades = trades.sort((a, b) => b - a)

            return res.json(
                ResponseMessage(false, 'Successful Request', { trades })
            )
        } else {
            return res
                .status(404)
                .json(ResponseMessage(true, 'No trades found'))
        }
    } catch (e) {
        return next(e)
    }
}

module.exports = {
    getTradesBySessionId,
    getTradesByOrder
}
