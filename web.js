const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http')
const { Server } = require('socket.io')
const morgan = require('morgan')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const { v4: uuid } = require('uuid')
const sha256 = require('sha256')

const {
  Store,
  Auth: { isAuthenticated, cleanSession },
  Contacts: { getContacts, getContact, updateUnreadCount, getUserById },
} = require('./lib')

const app = express()
const store = new Store()
const port = process.env.PORT || 8080
const host = process.env.HOST || '0.0.0.0'

app.use(express.static('swagger-ui'))

app.use(express.static('api'))

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(morgan('dev'))
app.use(cookieParser())

// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', req.headers.origin)
//   res.header('Access-Control-Allow-Credentials', 'true')
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
//   next()
// })

const whitelist = [
  'http://localhost:1337',
  'http://0.0.0.0:1337',
  'http://localhost:3000',
  'http://0.0.0.0:3000',
]

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
}

app.use(cors(corsOptions))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: err.message })

  next(err)
})

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    // origin: 'http://localhost:8080',
    methods: ['GET', 'POST'],
    // allowedHeaders: ['my-custom-header'],
    // credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('a user connected')
  socket.on('disconnect', () => {
    console.log('user disconnected')
  })

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg)
  })
})

// app.get('/', (req, res) => {
//   return res.redirect(301, '/docs')
// })

app.post('/login', (req, res) => {
  if (!req.body || !req.body.username || !req.body.password) {
    res.status(400).json({ message: 'Invalid username or password supplied' })
  } else if (
    !!store.getState().users[req.body.username] &&
    sha256(req.body.password) === store.getState().users[req.body.username].password
  ) {
    const sessionId = crypto.randomBytes(64).toString('hex')

    store.getState().sessions[sessionId] = store.getState().users[req.body.username]
    store.commitState()
    res.cookie('sessionId', sessionId, { session: true, httpOnly: true })
    res.json(cleanSession(store.getState().users[req.body.username]))
  } else {
    res.status(400).json({ message: 'Bad request' })
  }
})

app.post('/logout', (req, res) => {
  if (!!req.cookies.sessionId && store.getState().sessions[req.cookies.sessionId]) {
    delete store.getState().sessions[req.cookies.sessionId]
    store.commitState()
    res.clearCookie('sessionId')
    res.json({ message: 'You are now logged out' })
  } else {
    res.status(400).json({ message: 'Bad request' })
  }
})

app.get('/profile', (req, res) => {
  if (isAuthenticated(req, store.getState().sessions)) {
    res.json(
      cleanSession(
        store.getState().users[store.getState().sessions[req.cookies.sessionId].username]
      )
    )
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts', (req, res) => {
  if (isAuthenticated(req, store.getState().sessions)) {
    let contacts = getContacts(
      req.cookies.sessionId,
      store.getState().users,
      store.getState().sessions
    )

    if (!!req.query.name) {
      contacts = contacts.filter(
        (c) =>
          c.name.toLowerCase().indexOf(req.query.name) > -1 ||
          c.surname.toLowerCase().indexOf(req.query.name) > -1 ||
          c.username.toLowerCase().indexOf(req.query.name) > -1
      )
    }

    contacts = contacts.map((c) => updateUnreadCount(c))

    res.json(contacts.map((c) => cleanSession(c)))
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts/:contactId', (req, res) => {
  if (isAuthenticated(req, store.getState().sessions)) {
    let contact = getContact(
      req.cookies.sessionId,
      store.getState().users,
      store.getState().sessions,
      req.params.contactId
    )

    if (!!contact) {
      contact = updateUnreadCount(contact)
      store.commitState()
      res.json(cleanSession(contact))
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts/:contactId/history', (req, res) => {
  if (isAuthenticated(req, store.getState().sessions)) {
    const contact = getContact(
      req.cookies.sessionId,
      store.getState().users,
      store.getState().sessions,
      req.params.contactId
    )

    if (!!contact) {
      contact.history.messages.forEach((m) => {
        if (!m.readDate) {
          m.readDate = new Date().toISOString()
        }
      })

      store.commitState()

      res.json(contact.history)
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.post('/contacts/:contactId/send', (req, res) => {
  if (isAuthenticated(req, store.getState().sessions)) {
    if (!!req.body.readDate) {
      return res.status(400).json({ message: "Bad Request: readDate mustn't be provided" })
    }

    const contact = getContact(
      req.cookies.sessionId,
      store.getState().users,
      store.getState().sessions,
      req.params.contactId
    )

    const senderUser = getUserById(
      store.getState().sessions[req.cookies.sessionId].id,
      store.getState().users
    )

    const recipientUser = getUserById(req.params.contactId, store.getState().users)

    console.log(senderUser, recipientUser)

    if (!!contact) {
      const message = Object.assign({}, req.body, {
        id: uuid(),
        contactId: senderUser.id,
        sentDate: new Date().toISOString(),
        readDate: new Date().toISOString(),
      })

      contact.history.messages.push(message)
      store.commitState()
      res.json(message)
      io.emit('chat message', {
        senderId: senderUser.id,
        recipientId: req.params.contactId,
      }) // This will emit the event to all connected sockets
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

server.listen(port, host, () => {
  console.log(`Chat server listening on http://${host}:${port}!`)
  console.log(`Swagger-ui is available on http://${host}:${port}/`)
  store.commitState()
})
