const chai = require('chai')
const { Binance } = require('../src/exchange')
const { FetchOHLCV } = require('../src/data')
const moment = require('moment')

const expect = chai.expect

const SYMBOL = 'BTC/USDT'
const TIMEFRAME = '1m'

const unit = TIMEFRAME[TIMEFRAME.length - 1]
const time = parseInt(TIMEFRAME.slice(0, TIMEFRAME.indexOf(unit)))

const fetchCandles = async (exchange, fromDate, toDate) => {
    const fetch2 = new FetchOHLCV(exchange)
    return await fetch2.getCandles(SYMBOL, TIMEFRAME, fromDate, toDate, {})
}

const getRequiredCandlesLength = (fromDate, toDate) =>
    (moment(toDate).valueOf() -
        moment(fromDate).valueOf() +
        moment.duration(time, unit).asMilliseconds()) /
    moment.duration(time, unit).asMilliseconds()

describe('Fetching And Caching', async () => {
    const binance = new Binance()

    it('should clear the test cache', (done) => {
        try {
            const fetcher = new FetchOHLCV(binance, true)
            fetcher._clearCache(SYMBOL, TIMEFRAME)
            done()
        } catch (e) {
            done(e)
        }
    }).timeout(15000)

    it('should fetch split range timeframes (11:10 - 11:15 & 11:20 - 11:25)', (done) => {
        ;(async () => {
            try {
                let y = 15
                let totalCandles = []
                let requiredTimeStamps = 0
                for (let x = 10; x <= 50; x += 10) {
                    let fromDate = new Date(`October 30, 2019 11:${x}:00`)
                    let toDate = new Date(`October 30, 2019 11:${y}:00`)
                    requiredTimeStamps =
                        requiredTimeStamps +
                        getRequiredCandlesLength(fromDate, toDate)
                    let candles = await fetchCandles(binance, fromDate, toDate)
                    expect(moment(fromDate).valueOf())
                        .to.be.a('number')
                        .to.equal(candles[0][0])
                    expect(moment(toDate).valueOf())
                        .to.be.a('number')
                        .to.equal(candles[candles.length - 1][0])
                    y += 10
                    totalCandles = [...totalCandles, ...candles]
                }
                expect(totalCandles.length)
                    .to.be.a('number')
                    .to.equal(requiredTimeStamps)
                done()
            } catch (e) {
                done(e)
            }
        })()
    }).timeout(15000)

    it('should fetch timeframes that comes between previous ranges (11:22 - 11:42)', (done) => {
        ;(async () => {
            try {
                let requiredTimeStamps
                let fromDate2 = new Date(`October 30, 2019 11:22:00`)
                let toDate2 = new Date(`October 30, 2019 11:42:00`)
                requiredTimeStamps = getRequiredCandlesLength(
                    fromDate2,
                    toDate2
                )
                let candles2 = await fetchCandles(binance, fromDate2, toDate2)
                expect(candles2.length)
                    .to.be.a('number')
                    .to.equal(requiredTimeStamps)
                done()
            } catch (e) {
                done(e)
            }
        })()
    }).timeout(15000)

    it(
        'should fetch timeframes that comes before and ends in the middle ' +
            'of the previously fetched candles(11:05 - 11:32)',
        (done) => {
            ;(async () => {
                try {
                    let requiredTimeStamps
                    let fromDate3 = new Date(`October 30, 2019 11:05:00`)
                    let toDate3 = new Date(`October 30, 2019 11:32:00`)
                    requiredTimeStamps = getRequiredCandlesLength(
                        fromDate3,
                        toDate3
                    )
                    let candles2 = await fetchCandles(
                        binance,
                        fromDate3,
                        toDate3
                    )
                    expect(candles2.length)
                        .to.be.a('number')
                        .to.equal(requiredTimeStamps)
                    done()
                } catch (e) {
                    done(e)
                }
            })()
        }
    ).timeout(15000)

    it(
        'should fetch timeframes that start in the middle and ends after the ' +
            'last previously fetched candles(11:34 - 12:00)',
        (done) => {
            ;(async () => {
                try {
                    let requiredTimeStamps
                    let fromDate4 = new Date(`October 30, 2019 11:34:00`)
                    let toDate4 = new Date(`October 30, 2019 12:00:00`)
                    requiredTimeStamps = getRequiredCandlesLength(
                        fromDate4,
                        toDate4
                    )
                    let candles2 = await fetchCandles(
                        binance,
                        fromDate4,
                        toDate4
                    )
                    expect(candles2.length)
                        .to.be.a('number')
                        .to.equal(requiredTimeStamps)
                    done()
                } catch (e) {
                    done(e)
                }
            })()
        }
    ).timeout(15000)
})
