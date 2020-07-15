const BaseExchange = require('../base')
const { CREATE_MARKET_ORDER, CREATE_LIMIT_ORDER } = require('../../constants')
const BigNumber = require('bignumber.js')

class Binance extends BaseExchange {
    constructor(options) {
        const id = 'binance'
        super(id, options)
    }

    async setLeverage(leverage, symbol) {
        const exchange = this.exchange
        this.leverage = leverage
        await exchange.fapiPrivatePostLeverage({
            symbol,
            leverage
        })
        try {
            //change to isolated if in cross mode
            await exchange.fapiPrivatePostMarginType({
                symbol,
                marginType: 'ISOLATED'
            })
        } catch (e) {
            const error = JSON.parse(e.message.split(this.id + ' ')[1])
            //so it does not throw an error is the margin mode is already isolated
            if (error.code !== -4046) throw e
        }
    }

    async createMarketOrder(symbol, side, amount, price, params = {}) {
        if (!this.exchange.has[CREATE_MARKET_ORDER])
            throw new Error('This exchange does not support market orders')
        return await this.exchange.fapiPrivatePostOrder({
            symbol,
            side: side.toUpperCase(),
            quantity: amount,
            type: 'MARKET',
            ...params
        })
    }

    async createLimitOrder(symbol, side, amount, price, params) {
        if (!this.exchange.has[CREATE_LIMIT_ORDER])
            throw new Error('This exchange does not support limit orders')
        return await this.exchange.fapiPrivatePostOrder({
            symbol,
            side: side.toUpperCase(),
            quantity: amount,
            type: 'LIMIT',
            timeInForce: 'GTC',
            price,
            ...params
        })
    }

    async getOrder(orderId, symbol) {
        if (!this.exchange.has['fetchOrder'])
            throw new Error('This exchange does not support fetching an order')
        return await this.exchange.fapiPrivateGetOpenOrder({
            symbol,
            orderId
        })
    }

    async getAllSymbolOrders(symbol) {
        if (!this.exchange.has['fetchOrders'])
            throw new Error('This exchange does not support fetching orders')
        return await this.exchange.fapiPrivateGetAllOrders({
            symbol
        })
    }

    async closeOpenPositions(symbol) {
        const allCurrentPositions = await this.exchange.fapiPrivateGetPositionRisk(
            {
                symbol
            }
        )
        //get current symbol position
        const relevantPosition = allCurrentPositions.filter(
            (positions) => positions.symbol === symbol
        )[0]
        //checks if there is an open position
        if (!new BigNumber(relevantPosition.positionAmt).isEqualTo(0)) {
            const isLong = new BigNumber(
                relevantPosition.positionAmt
            ).isGreaterThan(0)
            // if the current position is a short makes a buy order, sell order otherwise
            // if the current position is a short multiplies by -1 to keep the binance format
            return await this.createMarketOrder(
                symbol,
                isLong ? 'SELL' : 'BUY',
                isLong
                    ? relevantPosition.positionAmt
                    : new BigNumber(relevantPosition.positionAmt)
                          .multipliedBy(-1)
                          .toFixed(8)
            )
        }
        return {
            message: `All positions on ${this.symbol} are closed already`
        }
    }

    async cancelOpenOrder(orderId, symbol) {
        if (!this.exchange.has['cancelOpenOrder'])
            throw new Error(
                'This exchange does not support cancelling an order'
            )
        return await this.exchange.fapiPrivateDeleteOrder({
            symbol,
            orderId
        })
    }

    //limited to last 3 months of trades
    async getTrades(symbol, startTime, limit, params = {}) {
        if (!this.exchange.hasFetchMyTrades)
            throw new Error('This exchange does not support getting trades')
        return this.exchange.fapiPrivateGetUserTrades({
            symbol,
            limit,
            startTime,
            ...params
        })
    }
}

module.exports = Binance
