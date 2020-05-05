const Joi = require('joi')

module.exports = (schema, options) => {
    return async (req, res, next) => {
        try {
            if (!options)
                options = {
                    allowUnknown: false
                }
            const result = await Joi.validate(req.body, schema, options)
            if (!req.value) {
                req.value = {}
            }
            req.value['body'] = result.value
            next()
        } catch (e) {
            if (e.name === 'ValidationError')
                return res.status(400).json({
                    error: true,
                    message: 'The request body is incorrect.'
                })
            next(e)
        }
    }
}
