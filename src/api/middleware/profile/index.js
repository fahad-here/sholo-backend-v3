const { UserSchema } = require('../../db/models')

async function editUserDetails(req, res, next) {
    const { parameterName, parameterValue } = req.body
    const user = req.user
    try {
        let updateDetails = {
            [parameterName]: parameterValue
        }
        const _user = await UserSchema.findByIdAndUpdate(
            { _id: user._id },
            { $set: updateDetails },
            { new: true }
        )
        return res.json({
            error: false,
            message: `Edited ${parameterName} successfully`,
            user: _user
        })
    } catch (e) {
        next(e)
    }
}

module.exports = {
    editUserDetails
}
