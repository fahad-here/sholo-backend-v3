const { createLogger, format, transports } = require('winston')
const { colorize, combine, timestamp, errors, printf, splat } = format
const fs = require('fs')
const path = require('path')

const env = process.env.NODE_ENV || 'development'
const logDir = '.logs'

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

const filename = path.join(logDir, 'output.log')

const printFFormatter = ({ timestamp, level, message, ...rest }) => {
    let restString = JSON.stringify(rest, undefined, 4)
    restString = restString === '{}' ? '' : restString
    return `[ ${timestamp} ] ${level}: ${message} ${restString}`
}
const devFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    splat(),
    errors(),
    printf(({ timestamp, level, message, ...rest }) => {
        let restString = JSON.stringify(rest, undefined, 4)
        restString = restString === '{}' ? '' : restString
        return `[ ${timestamp} ] ${level}: ${message} ${restString}`
    })
)

const Logger = createLogger({
    // change level if in dev environment versus production
    level: env === 'production' ? 'info' : 'debug',
    format: devFormat,
    transports: [
        new transports.Console({
            format: combine(colorize(), printf(printFFormatter))
        }),
        new transports.File({
            filename,
            format: combine(printf(printFFormatter))
        })
    ]
})

module.exports = Logger
