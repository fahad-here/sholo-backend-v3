const Joi = require('joi')
const {
    ALLOWED_EXCHANGES,
    ALLOWED_ACCOUNT_TYPES
} = require('../../../../constants')

module.exports = Joi.object().keys({
    exchange: Joi.string()
        .valid(...ALLOWED_EXCHANGES)
        .required(),
    accountName: Joi.string().required(),
    accountType: Joi.string()
        .valid(...ALLOWED_ACCOUNT_TYPES)
        .required(),
    apiKey: Joi.string().required(),
    apiSecret: Joi.string().required(),
    testNet: Joi.boolean().required()
})
