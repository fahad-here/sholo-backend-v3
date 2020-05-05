const express = require('express')
const router = express.Router()

router.get('/', function (req, res) {
    res.json({ error: false })
})

module.exports = router
