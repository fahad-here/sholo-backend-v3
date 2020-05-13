const FEE_TYPE_MAKER = 'maker'
const FEE_TYPE_TAKER = 'taker'
const FEE_TYPE_FIFTY_FIFTY = 'fifty-fifty'

const FEE_MAKER = -0.025
const FEE_TAKER = 0.075
const FEE_FIFTY_FIFTY = 0.05

const FEES = {
    [FEE_TYPE_MAKER]: FEE_MAKER,
    [FEE_TYPE_TAKER]: FEE_TAKER,
    [FEE_TYPE_FIFTY_FIFTY]: FEE_FIFTY_FIFTY
}

const CANDLE_TIME_FRAME_POSITION = 0
const CANDLE_OPEN_POSITION = 1
const CANDLE_HIGH_POSITION = 2
const CANDLE_LOW_POSITION = 3
const CANDLE_CLOSE_POSITION = 4
const CANDLE_VOLUME_POSITION = 5

const CANDLE_POSITIONS = {
    TIME_FRAME: CANDLE_TIME_FRAME_POSITION,
    OPEN: CANDLE_OPEN_POSITION,
    HIGH: CANDLE_HIGH_POSITION,
    LOW: CANDLE_LOW_POSITION,
    CLOSE: CANDLE_CLOSE_POSITION,
    VOLUME: CANDLE_VOLUME_POSITION
}

const BINANCE_EXCHANGE = 'binance'
const BITMEX_EXCHANGE = 'bitmex'

const ALLOWED_EXCHANGES = [BITMEX_EXCHANGE, BINANCE_EXCHANGE]

const ALLOWED_TIME_FRAMES = [
    '1m',
    '5m',
    '15m',
    '30m',
    '1h',
    '4h',
    '6h',
    '12h',
    '1d',
    '1w',
    '1M'
]

const POSITION_LONG = 'long'
const POSITION_SHORT = 'short'

module.exports = {
    FEES,
    CANDLE_POSITIONS,
    ALLOWED_EXCHANGES,
    BITMEX_EXCHANGE,
    BINANCE_EXCHANGE,
    POSITION_LONG,
    POSITION_SHORT,
    ALLOWED_TIME_FRAMES
}
