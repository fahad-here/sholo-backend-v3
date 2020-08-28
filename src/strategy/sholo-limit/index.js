const Strategy = require('../base')
const BigNumber = require('bignumber.js')
const { ChildLogger } = require('../../utils')
const { BotConfigSessionSchema, BotSchema } = require('../../api/db/models')
let Logger

class SholoLimit extends Strategy {
    constructor(
        onBuySignal,
        onSellSignal,
        onLiquidatedSignal,
        onPriceRReachedSignal,
        botId,
        lowThreshold = 0,
        highThreshold = 0,
        marketThreshold = 10
    ) {
        super(onBuySignal, onSellSignal, onLiquidatedSignal)
        this.onPriceRReachedSignal = onPriceRReachedSignal
        this.lowThreshold = lowThreshold
        this.highThreshold = highThreshold
        this.marketThreshold = marketThreshold
        this._botId = botId
        Logger = ChildLogger('bots', `${botId}__`)
        Logger.info('inside strategy')
    }

    async getSessionOrderSequence() {
        return this._session.orderSequence
    }

    async longStrategy() {
        const {
            entryPrice,
            previousPriceP,
            priceP,
            priceA,
            priceB,
            priceR,
            liquidationPrice,
            positionOpen,
            orderOpen
        } = this._bot
        const orderSequence = await this.getSessionOrderSequence()
        if (orderSequence === 1 || orderSequence === 2) {
            Logger.info(
                `long: order sequence = 1 || 2, orderSequence = ${orderSequence}`
            )
            let shouldEnter =
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(entryPrice).plus(this.marketThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(entryPrice).minus(this.marketThreshold)
                )
            if (shouldEnter) {
                Logger.info(
                    `long: should enter ${shouldEnter}, create market buy order`
                )
                if (!positionOpen && !orderOpen)
                    this.onBuySignal(this.price, this.timestamp, true)
            }
        } else if (orderSequence === 3 || orderSequence === 4) {
            Logger.info(
                `long: order sequence = 3 || 4, orderSequence = ${orderSequence}`
            )
            if (positionOpen && !orderOpen) {
                Logger.info(
                    `long: position is open and no open orders, create limit sell order`
                )
                this.onSellSignal(
                    new BigNumber(priceP).plus(priceA).toFixed(8),
                    this.timestamp
                )
            }
        } else {
            Logger.info(`long: order sequence > 4, current price ${this.price}`)
            // if(!orderOpen){
            //     if(positionOpen){

            //     }else{

            //     }
            // }else{
            //     Logger.info(
            //         `long: open orders, cant create orders`
            //     )
            // }
            if (
                positionOpen &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    liquidationPrice
                )
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(
                        new BigNumber(previousPriceP).plus(priceA)
                    ).plus(this.marketThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).plus(priceA)
                        ).minus(this.marketThreshold)
                    )) ||
                (new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(previousPriceP).plus(priceA)
                ) &&
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(previousPriceP).plus(priceR)
                    ))
            ) {
                Logger.info(`long: previousPriceP: ${previousPriceP}`)
                Logger.info(
                    `long: previousPriceP + priceA hit, ${
                        previousPriceP + priceA
                    }`
                )
                if (!orderOpen) {
                    Logger.info(
                        `long: previousPriceP + priceA hit and no open orders, create limit buy order`
                    )
                    this.onBuySignal(
                        new BigNumber(previousPriceP)
                            .plus(priceA)
                            .minus(priceB)
                            .toFixed(8),
                        this.timestamp
                    )
                } else {
                    Logger.info(
                        `long: previousPriceP + priceA hit and open orders, cant create orders`
                    )
                }
            } else if (
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(
                        new BigNumber(previousPriceP).minus(priceB)
                    ).plus(this.marketThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).minus(priceB)
                        ).minus(this.marketThreshold)
                    )) ||
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(new BigNumber(previousPriceP).minus(priceB))
                ) &&
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).minus(priceR)
                        )
                    ))
            ) {
                Logger.info(`long: previousPriceP: ${previousPriceP}`)
                Logger.info(
                    `long: previousPriceP - priceB hit, ${
                        previousPriceP - priceB
                    }`
                )
                if (!orderOpen) {
                    Logger.info(
                        `long: previousPriceP - priceB hit and no open orders, create limit sell order`
                    )
                    this.onSellSignal(
                        new BigNumber(previousPriceP)
                            .minus(priceB)
                            .plus(priceA)
                            .toFixed(8),
                        this.timestamp
                    )
                } else {
                    Logger.info(
                        `long: previousPriceP - priceA hit and open orders, cant create orders`
                    )
                }
            } else if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(previousPriceP).plus(priceR)
                )
            )
                this.onPriceRReachedSignal(this.price, this.timestamp)
        }
    }

    async shortStrategy() {
        const {
            entryPrice,
            previousPriceP,
            priceP,
            priceA,
            priceB,
            priceR,
            liquidationPrice,
            positionOpen,
            orderOpen
        } = this._bot
        const orderSequence = await this.getSessionOrderSequence()
        if (orderSequence === 1 || orderSequence === 2) {
            Logger.info(
                `short: order sequence = 1 || 2, orderSequence = ${orderSequence}`
            )
            let shouldEnter =
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(entryPrice).plus(this.marketThreshold)
                ) &&
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(entryPrice).minus(this.marketThreshold)
                )
            if (shouldEnter) {
                Logger.info(
                    `short: should enter ${shouldEnter}, create market buy order`
                )
                this.onBuySignal(this.price, this.timestamp, true)
            }
        } else if (orderSequence === 3 || orderSequence === 4) {
            Logger.info(
                `short: order sequence = 3 || 4, orderSequence = ${orderSequence}`
            )
            if (positionOpen && !orderOpen) {
                Logger.info(
                    `short: position is open and no open orders, create limit sell order`
                )
                this.onSellSignal(
                    new BigNumber(priceP).minus(priceA).toFixed(8),
                    this.timestamp
                )
            }
        } else {
            Logger.info(
                `short: order sequence > 4, current price ${this.price}`
            )
            if (
                positionOpen &&
                new BigNumber(this.price).isLessThanOrEqualTo(liquidationPrice)
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(
                        new BigNumber(previousPriceP).minus(priceA)
                    ).plus(this.marketThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).minus(priceA)
                        ).minus(this.marketThreshold)
                    )) ||
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(new BigNumber(previousPriceP).minus(priceA))
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).minus(priceR)
                        )
                    ))
            ) {
                Logger.info(`short: previousPriceP: ${previousPriceP}`)
                Logger.info(
                    `short: previousPriceP - priceA hit, ${
                        previousPriceP - priceA
                    }`
                )

                if (!orderOpen) {
                    Logger.info(
                        `short: previousPriceP- priceA hit and no open orders, create limit buy order`
                    )
                    this.onBuySignal(
                        new BigNumber(previousPriceP)
                            .minus(priceA)
                            .plus(priceB)
                            .toFixed(8),
                        this.timestamp
                    )
                } else {
                    Logger.info(
                        `short: previousPriceP - priceA hit and open orders, cant create orders`
                    )
                }
            } else if (
                (new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(
                        new BigNumber(previousPriceP).plus(priceB)
                    ).plus(this.marketThreshold)
                ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).plus(priceB)
                        ).minus(this.marketThreshold)
                    )) ||
                (new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(new BigNumber(previousPriceP).plus(priceB))
                ) &&
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(
                            new BigNumber(previousPriceP).plus(priceR)
                        )
                    ))
            ) {
                Logger.info(`short: previousPriceP: ${previousPriceP}`)
                Logger.info(
                    `short: previousPriceP + priceB hit, ${
                        previousPriceP + priceB
                    }`
                )

                if (!orderOpen) {
                    Logger.info(
                        `short: previousPriceP + priceB hit and no open orders, create limit sell order`
                    )
                    this.onSellSignal(
                        new BigNumber(previousPriceP)
                            .plus(priceB)
                            .minus(priceA)
                            .toFixed(8),
                        this.timestamp
                    )
                } else {
                    Logger.info(
                        `short: previousPriceP + priceB hit and open orders, cant create orders`
                    )
                }
            } else if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(previousPriceP).plus(priceR)
                )
            )
                this.onPriceRReachedSignal(this.price, this.timestamp)
        }
    }

    async run(
        realtime,
        currentCandlePrice,
        timestamp,
        botDetails,
        sessionDetails,
        hasPositions
    ) {
        this._bot = botDetails
        this._session = sessionDetails
        this.price = currentCandlePrice
        this.timestamp = timestamp
        this.hasPositions = hasPositions
        const { order } = botDetails
        const isLongBot = order.indexOf('l') !== -1
        if (isLongBot) await this.longStrategy()
        else await this.shortStrategy()
    }
}

module.exports = SholoLimit
