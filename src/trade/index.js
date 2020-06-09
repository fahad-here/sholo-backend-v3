const { GetExchangeClass } = require('../utils')
const {
    BINANCE_EXCHANGE,
    BITMEX_EXCHANGE,
    CREATE_MARKET_ORDER,
    CREATE_LIMIT_ORDER,
    MAP_WS_PAIR_TO_SYMBOL
} = require('../constants')
const BigNumber = require('bignumber.js')

class Trade {
    constructor(exchangeId, exchangeParams, testNet = true) {
        this.exchangeId = exchangeId
        this.exchange = GetExchangeClass(exchangeId, exchangeParams)
        if (testNet) this.exchange.setTestNet()
    }

    setPair(pair) {
        this.pair = pair
        this.symbol = MAP_WS_PAIR_TO_SYMBOL[pair]
    }

    async setLeverage(leverage) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        this.leverage = leverage
        const exchange = this.exchange.getExchange()
        const symbol = this.symbol
        switch (this.exchangeId) {
            case BITMEX_EXCHANGE:
                await exchange.privatePostPositionLeverage({
                    symbol,
                    leverage
                })
                break
            case BINANCE_EXCHANGE:
                //timestamp not mandatory, opposite is stated in docs
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
                    const error = JSON.parse(
                        e.message.split(this.exchangeId + ' ')[1]
                    )
                    //so it does not throw an error is the margin mode is already isolated
                    if (error.code !== -4046) throw e
                }
                break
            default:
                throw new Error('Leverage does not exist for this exchange')
        }
    }

    //this only works on leverge for bitmex due to bitmex being a futures only exchange
    async createMarketOrder(side, amount, params = {}) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        if (!this.leverage) throw new Error('Please set your leverage first')
        const exchange = this.exchange.getExchange()
        const symbol = this.symbol
        if (!exchange.has[CREATE_MARKET_ORDER])
            throw new Error('This exchange does not support market orders')
        if (this.exchangeId === BINANCE_EXCHANGE)
            return await exchange.fapiPrivatePostOrder({
                symbol,
                side: side.toUpperCase(),
                quantity: amount,
                type: 'MARKET',
                ...params
            })
        return await exchange.createMarketOrder(symbol, side, amount, params)
    }

    async createLimitOrder(side, amount, price, params = {}) {
        if (!this.symbol) throw new Error('Please set your exchange pair first')
        if (!this.leverage) throw new Error('Please set your leverage first')
        const exchange = this.exchange.getExchange()
        const symbol = this.symbol
        if (!exchange.has[CREATE_LIMIT_ORDER])
            throw new Error('This exchange does not support market orders')
        if (this.exchangeId === BINANCE_EXCHANGE)
            return await exchange.fapiPrivatePostOrder({
                symbol,
                side: side.toUpperCase(),
                quantity: amount,
                type: 'LIMIT',
                timeInForce: 'GTC',
                price,
                ...params
            })
        return await exchange.createLimitOrder(
            symbol,
            side,
            amount,
            price,
            params
        )
    }

    async closeOpenPositions() {
        const exchange = this.exchange.getExchange()
        const symbol = this.symbol
        if (!symbol) throw new Error('Please set your exchange pair first')
        switch (this.exchangeId) {
            case BINANCE_EXCHANGE:
                const allCurrentPositions = await exchange.fapiPrivateGetPositionRisk(
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
            case BITMEX_EXCHANGE:
                return await exchange.privatePostOrderClosePosition({
                    symbol
                })
        }
    }
}

module.exports = Trade
