let sio = require('socket.io')

class SocketIO {
    constructor(server) {
        this.io = sio(server)
        this.sockets = {}
    }

    saveSocketConnection(socket) {
        this.sockets[socket.id] = socket
    }

    deleteSocketConnection(socketId) {
        delete this.sockets[socketId]
    }

    get() {
        return this.io
    }

    getSockets() {
        return this.sockets
    }
}

module.exports = SocketIO
