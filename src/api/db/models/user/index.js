const mongoose = require('mongoose')
const Schema = mongoose.Schema
const passportLocalMongoose = require('passport-local-mongoose')
const findOrCreate = require('mongoose-findorcreate')

const UserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    }
})
UserSchema.plugin(findOrCreate)
UserSchema.plugin(passportLocalMongoose, {
    usernameField: 'email', // Use email, not the default 'username'
    usernameLowerCase: true, // Ensure that all emails are lowercase
    session: false // Disable sessions as we'll use JWTs
})
const User = mongoose.model('user', UserSchema)

module.exports = User
