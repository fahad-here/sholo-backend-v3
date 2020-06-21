const Strategy = require('../base')

class Sholo extends Strategy {
    constructor(
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal,
        lowThreshold = 0,
        highThreshold = 0
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
        const hasPositions = true

        if (positionOpen) {
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) ||
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            )
                this.onLiquidatedSignal(this.price, this.timestamp)
            else if (
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(priceP + priceA).plus(this.highThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(priceP + priceA).minus(this.lowThreshold)
                )
            )
                this.onSellSignal(this.price, this.timestamp)
        } else {
            if (hasPositions) {
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
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(entryPrice).plus(this.highThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.lowThreshold)
                    )
                this.onBuySignal(this.price, this.timestamp)
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
        const hasPositions = true
        if (positionOpen) {
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) ||
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            )
                this.onLiquidatedSignal(this.price, this.timestamp)
            else if (
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(priceP - priceA).plus(this.highThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(priceP - priceA).minus(this.lowThreshold)
                )
            )
                this.onSellSignal(this.price, this.timestamp)
        } else {
            if (hasPositions) {
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
                //enter positions
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(entryPrice).plus(this.highThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.lowThreshold)
                    )
                this.onBuySignal(this.price, this.timestamp)
            }
        }
    }

    async run(realtime, currentCandlePrice, timestamp, botDetails) {
        this._bot = botDetails
        this.price = currentCandlePrice
        this.timestamp = timestamp
        const { order } = botDetails
        const isLongBot = order.indexOf('l') !== -1
        if (isLongBot) await this.longStrategy()
        else await this.shortStrategy()
    }
}

module.exports = Sholo
