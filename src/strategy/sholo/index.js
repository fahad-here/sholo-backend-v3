const Strategy = require('../base')
const BigNumber = require('bignumber.js')
const { Logger } = require('../../utils')

class Sholo extends Strategy {
    constructor(
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal,
        lowThreshold = 10,
        highThreshold = 10
    ) {
        super(onBuySignal, onSellSignal, onLiquidatedSignal)
        this.onPriceRReachedSignal = onPriceRReachedSignal
        this.lowThreshold = lowThreshold
        this.highThreshold = highThreshold
    }

    async longStrategy() {
        const {
            priceR,
            entryPrice,
            priceP,
            priceA,
            priceB,
            liquidationPrice,
            positionOpen
        } = this._bot
        if (positionOpen) {
            Logger.info('long: checking selling and liquidation strategy')
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) &&
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(priceP + priceA).plus(this.highThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(priceP + priceA).minus(this.lowThreshold)
                )
            )
                this.onSellSignal(this.price, this.timestamp)
        } else {
            if (this.hasPositions) {
                Logger.info('long: checking if buying strategy is met')
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP - priceB).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP - priceB).minus(this.lowThreshold)
                    )
                )
                    this.onBuySignal(this.price, this.timestamp)
                else if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP + priceR).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP + priceR).minus(this.lowThreshold)
                    )
                )
                    this.onPriceRReachedSignal(this.price, this.timestamp)
            } else {
                //enter positions
                Logger.info('long: enter position')
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(entryPrice).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.lowThreshold)
                    )
                ) {
                    Logger.info('long: hit entry price')
                    this.onBuySignal(this.price, this.timestamp)
                }
            }
        }
    }

    async shortStrategy() {
        const {
            priceR,
            entryPrice,
            priceP,
            priceA,
            priceB,
            liquidationPrice,
            positionOpen
        } = this._bot
        if (positionOpen) {
            Logger.info('short: checking selling and liquidation strategy')
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) &&
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(priceP - priceA).plus(this.highThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(priceP - priceA).minus(this.lowThreshold)
                )
            )
                this.onSellSignal(this.price, this.timestamp)
        } else {
            if (this.hasPositions) {
                Logger.info('short: checking if buying strategy is met')
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP + priceB).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP + priceB).minus(this.lowThreshold)
                    )
                )
                    this.onBuySignal(this.price, this.timestamp)
                else if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP - priceR).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP - priceR).minus(this.lowThreshold)
                    )
                )
                    this.onPriceRReachedSignal(this.price, this.timestamp)
            } else {
                Logger.info('short: entry price')
                //enter positions
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(entryPrice).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.lowThreshold)
                    )
                )
                    this.onBuySignal(this.price, this.timestamp)
            }
        }
    }

    async run(
        realtime,
        currentCandlePrice,
        timestamp,
        botDetails,
        hasPositions
    ) {
        Logger.info('running strategy')
        this._bot = botDetails
        this.price = currentCandlePrice
        this.timestamp = timestamp
        this.hasPositions = hasPositions
        const { order } = botDetails
        const isLongBot = order.indexOf('l') !== -1
        if (isLongBot) await this.longStrategy()
        else await this.shortStrategy()
    }
}

module.exports = Sholo
