const createError = require('http-errors')
const express = require('express')
const bodyParser = require("body-parser")
const http = require("http")
const cors = require("cors")
const logger = require('morgan')

const indexRouter = require('./routes/index')

const app = express()

const PORT = 3001

// view engine setup
app.set('view engine', 'ejs')

app.use(logger('dev'))
app.use(express.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(cors({
    origin: (origin, callback) => {
        if (['http://localhost:3000'].indexOf(origin) !== -1) {
            callback(null, true)
        } else {
            callback(new Error("Not allowed by CORS"))
        }
    }
}))

app.use('/api/v3', indexRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404))
})

// error handler
app.use(function(err, req, res) {
    // set locals, only providing error in development
    res.locals.message = err.message
    res.locals.error = req.app.get('env') === 'development' ? err : {}

    // render the error page
    res.status(err.status || 500)
    res.render('error')
})


app.set("port", PORT)
let server = http.createServer(app)

server.listen(PORT)
server.on('error', onError)
server.on("listening", onListening)

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error
    }

    const bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges')
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(bind + ' is already in use')
            process.exit(1)
            break
        default:
            throw error
    }
}

function onListening() {
    let addr = server.address()
    let bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port
    console.info("Listening on " + bind)
}

module.exports = app
