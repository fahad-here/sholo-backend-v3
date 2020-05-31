const SocketIO = require('../../socketio')
class Publish {
    constructor(exchange, pair) {
        this.exchange = exchange
        this.pair = pair
    }
}

module.exports = Publish
