const ResponseMessage = (error, message, payload) => {
    return {
        error,
        message,
        ...payload
    }
}

module.exports = ResponseMessage
