let sio = require('socket.io')
let connection = null

class SocketIO {
    constructor() {
        this.sockets = {}
    }

    connect(server, sessionMiddleware) {
        this.io = sio(server)
        this.io.origins('*:*')
        this.io.on('connection', (socket) => {
            this.saveSocketConnection(socket)
        })
        this.io.use(function (socket, next) {
            sessionMiddleware(socket.request, socket.request.res, next)
        })
    }

    saveSocketConnection(socket) {
        this.sockets[socket.id] = socket
        console.log('Client connected', socket.id)
        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id)
            this.deleteSocketConnection(socket.id)
        })
    }

    deleteSocketConnection(socketId) {
        delete this.sockets[socketId]
    }

    get() {
        return this.io
    }

    sendEvent(event, data, socketId) {
        this.sockets[socketId].emit(event, data)
    }

    registerEvent(event, handler, socketId) {
        this.sockets[socketId].on(event, handler)
    }

    static init(server, sessionMiddleware) {
        if (!connection) {
            connection = new SocketIO()
            connection.connect(server, sessionMiddleware)
        }
    }

    static getConnection() {
        if (!connection) {
            throw new Error('no active connection')
        }
        return connection
    }
}

module.exports = {
    connect: SocketIO.init,
    connection: SocketIO.getConnection
}
