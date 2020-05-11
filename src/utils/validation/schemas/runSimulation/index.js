const Joi = require('joi')
const {
    ALLOWED_EXCHANGES,
    ALLOWED_TIME_FRAMES
} = require('../../../../constants')

module.exports = Joi.object().keys({
    exchange: Joi.string()
        .valid(...ALLOWED_EXCHANGES)
        .required(),
    symbol: Joi.string().required(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    timeFrame: Joi.string()
        .valid(...ALLOWED_TIME_FRAMES)
        .required()
})
