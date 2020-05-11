const Joi = require('joi')
const { ALLOWED_EXCHANGES } = require('../../../../constants')

module.exports = Joi.object().keys({
    exchange: Joi.string()
        .valid([...ALLOWED_EXCHANGES])
        .required(),
    symbol: Joi.string().required(),
    startTime: Joi.date().required(),
    endTime: Joi.date().required(),
    timeFrame: Joi.string().valid([]).required()
})
