const BaseExchange = require('../base')
const { POSITION_LONG, POSITION_SHORT } = require('../../constants')
const BigNumber = require('bignumber.js')

class Bitmex extends BaseExchange {
    constructor(options) {
        const id = 'bitmex'
        super(id, options)
    }

    async setLeverage(leverage, symbol) {
        return await this.exchange.privatePostPositionLeverage({
            symbol,
            leverage
        })
    }

    async closeOpenPositions(symbol) {
        return await this.exchange.privatePostOrderClosePosition({
            symbol
        })
    }

    static _calculateLiquidation(
        amount,
        currentUsdPrice,
        leverage,
        positionType
    ) {
        const contractVal = new BigNumber(1)
            .dividedBy(currentUsdPrice)
            .toFixed(8)
        const positionVal = new BigNumber(amount)
            .multipliedBy(contractVal)
            .toFixed(8)
        const takerFee = new BigNumber(0.00075)
            .multipliedBy(positionVal)
            .toFixed(8)
        const initialMargin = new BigNumber(1)
            .dividedBy(leverage)
            .plus(new BigNumber(takerFee).multipliedBy(2))
            .toFixed(8)
        const maintenanceMargin2 = new BigNumber(0.5)
            .dividedBy(leverage)
            .plus(takerFee)
            .plus(0.000373)
            .toFixed(8)
        const maintenanceMargin = new BigNumber(0.005)
            .multipliedBy(takerFee)
            .toFixed(8)
        let bankrupt
        let liquidation
        switch (positionType) {
            case POSITION_LONG:
                bankrupt = new BigNumber(currentUsdPrice)
                    .dividedBy(new BigNumber(1).plus(initialMargin))
                    .toFixed(8)
                liquidation = new BigNumber(bankrupt)
                    .plus(
                        new BigNumber(currentUsdPrice).multipliedBy(
                            new BigNumber(maintenanceMargin).plus(0.000373)
                        )
                    )
                    .toFixed(8)
                return { liquidation, bankrupt }
            case POSITION_SHORT:
                bankrupt = new BigNumber(currentUsdPrice)
                    .dividedBy(new BigNumber(1).minus(initialMargin))
                    .toFixed(8)
                liquidation = new BigNumber(bankrupt)
                    .minus(
                        new BigNumber(currentUsdPrice).multipliedBy(
                            new BigNumber(maintenanceMargin).minus(0.000373)
                        )
                    )
                    .toFixed(8)
                return { liquidation, bankrupt }
        }
    }
}

module.exports = Bitmex
