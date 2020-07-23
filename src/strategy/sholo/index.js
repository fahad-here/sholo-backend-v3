const Strategy = require('../base')
const BigNumber = require('bignumber.js')
const { Logger } = require('../../utils')
const { BotConfigSessionSchema } = require('../../api/db/models')

class Sholo extends Strategy {
    constructor(
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal,
        lowThreshold = 1,
        highThreshold = 1,
        marketThreshold = 10
    ) {
        super(onBuySignal, onSellSignal, onLiquidatedSignal)
        this.onPriceRReachedSignal = onPriceRReachedSignal
        this.lowThreshold = lowThreshold
        this.highThreshold = highThreshold
        this.marketThreshold = marketThreshold
    }

    async getAndCheckSession() {
        const session = await BotConfigSessionSchema.findById({
            _id: this._bot._botSessionId
        })
        return session.orderSequence === 3 && session.PositionSequence === 3
    }

    async longStrategy() {
        const {
            priceR,
            entryPrice,
            priceP,
            priceA,
            priceB,
            liquidationPrice,
            positionOpen,
            orderOpen,
            feeType
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
            ) {
                if (!orderOpen) {
                    this.onBuySignal(
                        new BigNumber(this.price).minus(priceB).toFixed(8),
                        this.timestamp
                    )
                }
            } else {
                const check = await this.getAndCheckSession()
                Logger.info('long: check for position ' + check)
                if (check)
                    if (!openOrder)
                        this.onSellSignal(
                            new BigNumber(this.priceP).plus(priceA).toFixed(8),
                            this.timestamp
                        )
            }
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
                ) {
                    if (!openOrder)
                        this.onSellSignal(
                            new BigNumber(this.price).plus(priceA).toFixed(8),
                            this.timestamp
                        )
                } else if (
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
                let shouldEnter =
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(entryPrice).plus(this.marketThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.marketThreshold)
                    )
                let shouldLimitBuy = new BigNumber(
                    this.price
                ).isGreaterThanOrEqualTo(entryPrice + this.highThreshold)
                if (shouldEnter) {
                    Logger.info('long: hit entry marketprice')
                    this.onBuySignal(this.price, this.timestamp, true)
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
            positionOpen,
            orderOpen
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
            ) {
                if (!orderOpen) {
                    this.onBuySignal(
                        new BigNumber(this.price).plus(priceB).toFixed(8),
                        this.timestamp
                    )
                    // this.onSellSignal(this.price, this.timestamp)
                }
            } else {
                const check = await this.getAndCheckSession()
                Logger.info('short: check for position ' + check)
                if (check)
                    if (!openOrder)
                        this.onSellSignal(
                            new BigNumber(this.priceP).plus(priceA).toFixed(8),
                            this.timestamp
                        )
            }
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
                ) {
                    if (!openOrder)
                        this.onSellSignal(
                            new BigNumber(this.price).minus(priceA).toFixed(8),
                            this.timestamp
                        )
                } else if (
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
                Logger.info('short: enter position')
                let shouldEnter =
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(entryPrice).plus(this.marketThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(entryPrice).minus(this.marketThreshold)
                    )

                let shouldLimitBuy = new BigNumber(
                    this.price
                ).isLessThanOrEqualTo(entryPrice - this.lowThreshold)
                if (shouldEnter) {
                    Logger.info('short: hit entry marketprice')
                    this.onBuySignal(this.price, this.timestamp, true)
                }
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
