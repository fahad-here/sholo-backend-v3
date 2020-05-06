const BaseExchange = require('../base')

class Binance extends BaseExchange {
    constructor(options) {
        const id = 'binance'
        super(id, options)
    }
}

module.exports = Binance
