const Joi = require('joi')
const {
    ALLOWED_EXCHANGES,
    ALLOWED_MARGIN_TYPES
} = require('../../../../constants')

module.exports = Joi.object().keys({
    selectedAccounts: Joi.object().keys({
        s1: Joi.string().required(),
        l1: Joi.string().required()
    }),
    startingBalances: Joi.object().keys({
        s1: Joi.number().required(),
        l1: Joi.number().required()
    }),
    exchange: Joi.string()
        .valid(...ALLOWED_EXCHANGES)
        .required(),
    symbol: Joi.string().required(),
    entryPrice: Joi.number().min(1).required(),
    priceA: Joi.number().min(1).required(),
    priceB: Joi.number().min(1).required(),
    priceR: Joi.number().min(1).required(),
    leverage: Joi.number().min(1).required(),
    feeType: Joi.string().valid('maker', 'taker').required(),
    marketThreshold: Joi.number().min(1),
    testNet: Joi.boolean().required(),
    name: Joi.string().required(),
    marginType: Joi.string()
        .valid(...ALLOWED_MARGIN_TYPES)
        .required()
})
