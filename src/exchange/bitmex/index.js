const BaseExchange = require('../base')

class Bitmex extends BaseExchange {
    constructor(options) {
        const id = 'bitmex'
        super(id, options)
    }
}

module.exports = Bitmex
