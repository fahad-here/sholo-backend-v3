const Joi = require('joi')

module.exports = Joi.object().keys({
    startingBalances: Joi.string().valid('name', 'email').required(),
    entryPrice: Joi.number().min(1).required(),
    priceA: Joi.number().min(1).required(),
    priceB: Joi.number().min(1).required(),
    priceR: Joi.number().min(1).required(),
    leverage: Joi.number().min(1).required(),
    feeType: Joi.string().valid('maker', 'taker').required()
})
