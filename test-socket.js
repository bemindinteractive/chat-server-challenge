const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')

const app = express()

const port = process.env.PORT || 1337
const host = process.env.HOST || '0.0.0.0'

app.use(express.static(__dirname + '/test-socket/'))
app.use('/scripts', express.static(__dirname + '/node_modules/socket.io/client-dist/'))

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(morgan('dev'))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message })

  next(err)
})

app.listen(port, host, () => {
  console.log(`Chat client listening on http://${host}:${port}!`)
})
