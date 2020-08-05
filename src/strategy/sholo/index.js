const Strategy = require('../base')
const BigNumber = require('bignumber.js')
const { ChildLogger } = require('../../utils')
const { BotConfigSessionSchema } = require('../../api/db/models')
let Logger
class Sholo extends Strategy {
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
        Logger.info('inside straateggr')
    }

    async getAndCheckSession() {
        const session = await BotConfigSessionSchema.findById({
            _id: this._bot._botSessionId
        })
        return session.orderSequence === 3 && session.positionSequence === 3
    }
    // since the postion closes by the time this snippet is reached it does not limit buy again
    async longStrategy() {
        const {
            _botSessionId,
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

        const currentSession = this._session
        if (positionOpen) {
            const first =
                currentSession.orderSequence === 2 ||
                currentSession.orderSequence === 3 ||
                currentSession.orderSequence === 4
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) &&
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (first) {
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                )
                    Logger.info('first sell order check')
                if (!orderOpen) {
                    Logger.info(
                        'long: first position open and no orders open, creating buy sell limit order'
                    )
                    Logger.info(`price A ${priceA}`)
                    Logger.info(`price P ${priceP}`)
                    Logger.info(`price B ${priceB}`)
                    Logger.info(`price P+A ${priceP + priceA}`)

                    this.onSellSignal(
                        new BigNumber(this.price).plus(priceA).toFixed(8),
                        this.timestamp
                    )
                }
            } else if (!first) {
                Logger.info('not first and check for limit buy/sell')

                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                )
                    if (!orderOpen) {
                        Logger.info(
                            'long: !first position open and no orders open, hit sell price, creating buy limit order'
                        )
                        Logger.info(`price A ${priceA}`)
                        Logger.info(`price P ${priceP}`)
                        Logger.info(`price B ${priceB}`)
                        Logger.info(`price P+A ${priceP + priceA}`)

                        this.onSellSignal(
                            new BigNumber(this.price).plus(priceB).toFixed(8),
                            this.timestamp
                        )
                    }
                // else if(
                //     new BigNumber(this.price).isLessThanOrEqualTo(
                //         new BigNumber(priceP - priceB).plus(this.highThreshold)
                //     ) &&
                //     new BigNumber(this.price).isGreaterThanOrEqualTo(
                //         new BigNumber(priceP - priceB).minus(this.lowThreshold)
                //     )
                // ){
                //     if (!orderOpen) {
                //         Logger.info(
                //             'long: !first position open and no orders open, hit buy price, creating sell limit order'
                //         )
                //         Logger.info(`price A ${priceA}`)
                //         Logger.info(`price P ${priceP}`)
                //         Logger.info(`price B ${priceB}`)
                //         Logger.info(`price P-B ${priceP - priceB}`)

                //         this.onSellSignal(
                //             new BigNumber(this.price).plus(priceA).toFixed(8),
                //             this.timestamp
                //         )
                //     }
                // }
            } else {
                // const check = await this.getAndCheckSession()
                // Logger.info('long: check for position ' + check)
                // if (check)
                //     if (!orderOpen) {
                //         Logger.info(
                //             'long: position open and no orders open, creating sell limit order'
                //         )
                //         Logger.info(`price A ${priceA}`)
                //         Logger.info(`price P ${priceP}`)
                //         Logger.info(`price B ${priceB}`)
                //         Logger.info(`price P-A ${priceP - priceA}`)
                //         this.onSellSignal(
                //             new BigNumber(priceP).plus(priceA).toFixed(8),
                //             this.timestamp
                //         )
                //     }
            }
        } else {
            if (this.hasPositions) {
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                ) {
                    Logger.info(`has positions and hit price P, ${orderOpen}`)
                    if (!orderOpen) {
                        Logger.info(
                            'long: has already positions and no open orders, and hit buy price, create sell limit order'
                        )
                        Logger.info(`price A ${priceA}`)
                        Logger.info(`price P ${priceP}`)
                        Logger.info(`price B ${priceB}`)
                        Logger.info(`price P-B ${priceB - priceB}`)

                        this.onBuySignal(
                            new BigNumber(this.price).minus(priceB).toFixed(8),
                            this.timestamp
                        )
                    }
                } else if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP + priceA).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP + priceA).minus(this.lowThreshold)
                    )
                ) {
                    // if (!orderOpen) {
                    //     Logger.info(
                    //         'long: has already positions and no open orders, and hit sell price, create buy limit order'
                    //     )
                    //     Logger.info(`price A ${priceA}`)
                    //     Logger.info(`price P ${priceP}`)
                    //     Logger.info(`price B ${priceB}`)
                    //     Logger.info(`price P-B ${priceB - priceB}`)
                    //     this.onBuySignal(
                    //         new BigNumber(this.price).minus(priceB).toFixed(8),
                    //         this.timestamp
                    //     )
                    // }
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
                    Logger.info(`long price A ${priceA}`)
                    Logger.info(`long price P ${priceP}`)
                    Logger.info(`long price B ${priceB}`)
                    Logger.info(`long Entry Price ${entryPrice}`)

                    Logger.info('long: hit entry marketprice')
                    this.onBuySignal(this.price, this.timestamp, true)
                    setTimeout(() => {
                        this.onSellSignal(
                            new BigNumber(this.price).plus(priceA).toFixed(8),
                            this.timestamp
                        )
                    }, 5000)
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

        const currentSession = this._session
        if (positionOpen) {
            const first =
                currentSession.orderSequence === 2 ||
                currentSession.orderSequence === 3 ||
                currentSession.orderSequence === 4
            if (
                new BigNumber(this.price).isGreaterThanOrEqualTo(
                    new BigNumber(liquidationPrice).minus(this.lowThreshold)
                ) &&
                new BigNumber(this.price).isLessThanOrEqualTo(
                    new BigNumber(liquidationPrice).plus(this.highThreshold)
                )
            ) {
                this.onLiquidatedSignal(this.price, this.timestamp)
            } else if (first) {
                Logger.info('first true and limit sell order check')
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                )
                    if (!orderOpen) {
                        Logger.info(`price A ${priceA}`)
                        Logger.info(`price P ${priceP}`)
                        Logger.info(`price B ${priceB}`)
                        Logger.info(`price P-A ${priceP - priceA}`)

                        Logger.info(
                            'short: first position open and no orders open, creating buy limit order'
                        )
                        this.onSellSignal(
                            new BigNumber(this.price).minus(priceA).toFixed(8),
                            this.timestamp
                        )
                        // this.onSellSignal(this.price, this.timestamp)
                    }
            } else if (!first) {
                Logger.info('not first and  check for limit buy/sell')

                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                )
                    if (!orderOpen) {
                        Logger.info(
                            'short: !first position open and no orders open, hit buy price, creating sell limit order'
                        )

                        Logger.info(`price A ${priceA}`)
                        Logger.info(`price P ${priceP}`)
                        Logger.info(`price B ${priceB}`)
                        Logger.info(`price P+B ${priceP + priceB}`)
                        this.onSellSignal(
                            new BigNumber(this.price).minus(priceA).toFixed(8),
                            this.timestamp
                        )

                        // this.onSellSignal(this.price, this.timestamp)
                    } else if (
                        new BigNumber(this.price).isLessThanOrEqualTo(
                            new BigNumber(priceP - priceA).plus(
                                this.highThreshold
                            )
                        ) &&
                        new BigNumber(this.price).isGreaterThanOrEqualTo(
                            new BigNumber(priceP - priceA).minus(
                                this.lowThreshold
                            )
                        )
                    ) {
                        // if (!orderOpen) {
                        //     Logger.info(
                        //         'short: !first position open and no orders open, hit sell price, creating buy limit order'
                        //     )
                        //     Logger.info(`price A ${priceA}`)
                        //     Logger.info(`price P ${priceP}`)
                        //     Logger.info(`price B ${priceB}`)
                        //     Logger.info(`price P-A ${priceP + priceA}`)
                        //     this.onBuySignal(
                        //         new BigNumber(this.price).plus(priceB).toFixed(8),
                        //         this.timestamp
                        //     )
                        //     // this.onSellSignal(this.price, this.timestamp)
                        // }
                    }
            } else {
                // const check = await this.getAndCheckSession()
                // Logger.info('short: check for position ' + check)
                // if (check)
                //     if (!orderOpen) {
                //         Logger.info(`price A ${priceA}`)
                //         Logger.info(`price P ${priceP}`)
                //         Logger.info(`price B ${priceB}`)
                //         Logger.info(`price P-A ${priceP - priceA}`)
                //         Logger.info(
                //             'short: position open and no orders open, creating sell limit order'
                //         )
                //         this.onSellSignal(
                //             new BigNumber(priceP).minus(priceA).toFixed(8),
                //             this.timestamp
                //         )
                //     }
            }
        } else {
            if (this.hasPositions) {
                if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP).minus(this.lowThreshold)
                    )
                ) {
                    Logger.info(`has positions and hit price P, ${orderOpen}`)

                    if (!orderOpen) {
                        Logger.info(
                            'short: has already created positions and no open orders, and hit sell price, create buy limit order'
                        )
                        Logger.info(`price A ${priceA}`)
                        Logger.info(`price P ${priceP}`)
                        Logger.info(`price B ${priceB}`)
                        Logger.info(`price P+A ${priceP + priceB}`)

                        this.onBuySignal(
                            new BigNumber(this.price).plus(priceB).toFixed(8),
                            this.timestamp
                        )
                    }
                } else if (
                    new BigNumber(this.price).isLessThanOrEqualTo(
                        new BigNumber(priceP + priceB).plus(this.highThreshold)
                    ) &&
                    new BigNumber(this.price).isGreaterThanOrEqualTo(
                        new BigNumber(priceP + priceB).minus(this.lowThreshold)
                    )
                ) {
                    // if (!orderOpen) {
                    //     Logger.info(
                    //         'short: has already created positions and no open orders, and hit buy price, create sell limit order'
                    //     )
                    //     Logger.info(`price A ${priceA}`)
                    //     Logger.info(`price P ${priceP}`)
                    //     Logger.info(`price B ${priceB}`)
                    //     Logger.info(`price P+B ${priceP + priceB}`)
                    //     this.onSellSignal(
                    //         new BigNumber(this.price).minus(priceA).toFixed(8),
                    //         this.timestamp
                    //     )
                    // }
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
                    Logger.info(`short price A ${priceA}`)
                    Logger.info(`short price P ${priceP}`)
                    Logger.info(`short price B ${priceB}`)
                    Logger.info(` short Entry Price ${entryPrice}`)

                    Logger.info(
                        'short: hit entry marketprice, create market buy order'
                    )
                    this.onBuySignal(this.price, this.timestamp, true)
                    setTimeout(() => {
                        this.onSellSignal(
                            new BigNumber(this.price).minus(priceA).toFixed(8),
                            this.timestamp
                        )
                    }, 5000)
                }
            }
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

module.exports = Sholo
