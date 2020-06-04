const AWS = require('aws-sdk')
const { SES_CONFIG } = require('../../config')

module.exports = (sourceEmail, destinationEmails, subject, body) => {
    let params = {
        Source: sourceEmail,
        Destination: {
            ToAddresses: destinationEmails
        },
        ReplyToAddresses: [],
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: body
                }
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject
            }
        }
    }
    return new AWS.SES(SES_CONFIG).sendEmail(params).promise()
}
