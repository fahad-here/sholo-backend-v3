const Joi = require('joi')

module.exports = Joi.object().keys({
    parameterName: Joi.string().valid('name', 'email').required(),
    parameterValue: Joi.string().required()
})
