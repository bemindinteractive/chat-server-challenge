const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const avatar = require('./avatar')

const app = express()

const port = process.env.PORT || 8080

const user = {
  id: '0948628179',
  name: 'Chuck',
  surname: 'Norris',
  username: "chuck_ny88",
  email: "chuck_ny88@fake.com",
  password: "supersecret",
  avatar: avatar,

  contacts: [
    {
      id: '5398264910',
      name: 'Mariza',
      surname: 'Kavlana',
      username: 'kikkykavla',
      email: 'kikkykavla@fake.com',
      avatar: avatar,
      receivedMessages: {
        messages: [
          {
            message: 'Ciao mondo',
            timestamp: ''
          }
        ],
        count: 1
      },
    },
    {
      id: '7201738462',
      name: 'Moreno',
      surname: 'Suarez',
      username: 'morenosua',
      email: 'morenosua@fake.com',
      avatar: ''
    }
  ]
}

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(morgan('dev'))
app.use(cookieParser())

app.get('/', (req, res) => {
  res.json({status: 200, user})
})

app.post('/login', (req, res) => {
  if(!req.body || !req.body.username || !req.body.password) {
    res.json({status: 500, message: 'Invalid Request'})
  } else if(req.body.username === user.username && req.body.password === user.password) {
    const token = crypto.randomBytes(64).toString('hex')
    res.cookie('sessionId', token, { session: true, httpOnly: true })
    res.json({
      status: 200,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        username: user.username,
        email: user.email,
        avatar: avatar
      }
    })
    next()
  } else {
    res.json({status: 500, message: 'Invalid Request'})
  }
})

app.post('/logout', (req, res) => {
  if(req.body && req.body.token === token) {
    res.clearCookie('sessionId')
    res.json({status: 200, message: 'You are now logged out'})
    next()
  } else {
    res.json({status: 500, message: 'Invalid Request'})
  }
})

app.get('/user/:id/contacts', (req, res) => {

})

app.get('/user/:id/contacts/:contactId/messages', (req, res) => {

})

app.listen(port, () => {
  console.log(`Chat server listening on port ${port}!`)
})
