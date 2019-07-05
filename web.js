const express = require('express')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const uuid = require('uuid/v4')
const sha256 = require('sha256')
const jetpack = require('fs-jetpack')
const { createDb } = require('./utils')

const app = express()

const port = process.env.PORT || 8080

app.use(express.static('swagger-ui'))
app.use(express.static('api'))

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin)
  res.header('Access-Control-Allow-Credentials', 'true')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(morgan('dev'))
app.use(cookieParser())

const dbDir = '.tmp/db.json'
const minuteOffset = 3600000

let db

const getDb = () => jetpack.read(dbDir, 'json')
const commitDb = () => jetpack.write(dbDir, db)

const initDb = () => {

  jetpack.append(dbDir, '')

  try {
    db = getDb()
  } catch (ex) {
    console.log('initializing empty db')

    db = createDb()

    Object.keys(db.users).forEach(uu => {
      if (!db.users[uu].contacts) {
        db.users[uu].contacts = Object.keys(db.users).filter(u => db.users[u].id !== db.users[uu].id)
          .map(u => Object.assign({}, db.users[u], {
            history: {
              messages: [{
                id: uuid(),
                contactId: db.users[u].id,
                message: `Ciao ${db.users[uu].name}`,
                sentDate: new Date(db.initDate.getTime() - (minuteOffset * 2)).toISOString(),
                readDate: null
              }, {
                id: uuid(),
                contactId: db.users[uu].id,
                message: `Ciao ${db.users[u].name}`,
                sentDate: new Date(db.initDate.getTime() - minuteOffset).toISOString(),
                readDate: new Date(db.initDate.getTime() - minuteOffset).toISOString()
              }]
            }
          }))
      }
    })

    commitDb()

  }


}

const isAuthenticated = (req) => !!db.sessions[req.cookies.sessionId]

const cleanUser = (user) => {
  const cleanedUser = Object.assign({}, user)
  delete cleanedUser.contacts
  delete cleanedUser.password

  if (!!cleanedUser.history) {
    delete cleanedUser.history
  }

  return cleanedUser
}

const getContacts = (sessionId) => db.users[db.sessions[sessionId].username].contacts

const getContact = (sessionId, contactId) => getContacts(sessionId).find(c => c.id === contactId)

const updateUnreadCount = (contact) => {
  contact.unreadCount = contact.history.messages.reduce((res, m) => !!m.readDate && contact.id !== m.contactId ? (res +1) : res , 0)

  return contact
}

// app.get('/', (req, res) => {
//   return res.redirect(301, '/docs')
// })

app.post('/login', (req, res) => {
  if (!req.body || !req.body.username || !req.body.password) {
    res.status(400).json({ message: 'Invalid username or password supplied' })
  } else if (!!db.users[req.body.username] && sha256(req.body.password) === db.users[req.body.username].password) {

    const sessionId = crypto.randomBytes(64).toString('hex')

    db.sessions[sessionId] = db.users[req.body.username]
    commitDb()
    res.cookie('sessionId', sessionId, { session: true, httpOnly: true })
    res.json(cleanUser(db.users[req.body.username]))
  } else {
    res.status(400).json({ message: 'Bad request' })
  }
})

app.post('/logout', (req, res) => {
  if (!!req.cookies.sessionId && db.sessions[req.cookies.sessionId]) {
    delete db.sessions[req.cookies.sessionId]
    commitDb()
    res.clearCookie('sessionId')
    res.json({ message: 'You are now logged out' })
  } else {
    res.status(400).json({ message: 'Bad request' })
  }
})

app.get('/profile', (req, res) => {
  if (isAuthenticated(req)) {
    res.json(cleanUser(db.users[db.sessions[req.cookies.sessionId].username]))
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts', (req, res) => {
  if (isAuthenticated(req)) {

    let contacts = getContacts(req.cookies.sessionId)

    if (!!req.query.name) {
      contacts = contacts.filter(c => c.name.toLowerCase().indexOf(req.query.name) > -1 || c.surname.toLowerCase().indexOf(req.query.name) > -1 || c.username.toLowerCase().indexOf(req.query.name) > -1)
    }

    contacts = contacts.map(c => updateUnreadCount(c))

    res.json(contacts.map(c => cleanUser(c)))
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts/:contactId', (req, res) => {
  if (isAuthenticated(req)) {
    let contact = getContact(req.cookies.sessionId, req.params.contactId)

    if (!!contact) {
      contact = updateUnreadCount(contact)
      commitDb()
      res.json(cleanUser(contact))
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.get('/contacts/:contactId/history', (req, res) => {
  if (isAuthenticated(req)) {
    const contact = getContact(req.cookies.sessionId, req.params.contactId)

    if (!!contact) {

      contact.history.messages.forEach(m => {
        if (!m.readDate) {
          m.readDate = (new Date()).toISOString()
        }
      })

      commitDb()

      res.json(contact.history)
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.post('/contacts/:contactId/send', (req, res) => {
  if (isAuthenticated(req)) {

    if (!!req.body.readDate
      ) {
      return res.status(400).json({ message: 'Bad Request: readDate mustn\'t be provided'  })
    }

    const contact = getContact(req.cookies.sessionId, req.params.contactId)

    if (!!contact) {

      const message = Object.assign({}, req.body, { id: uuid(), sentDate: (new Date()).toISOString(), readDate: (new Date()).toISOString() })

      contact.history.messages.push(message)
      commitDb()
      res.json(message)
    } else {
      res.status(404).json({ message: 'Contact not found' })
    }
  } else {
    res.status(401).json({ message: 'Unauthorized' })
  }
})

app.listen(port, '0.0.0.0', () => {
  console.log(`Chat server listening on http://localhost:${port}!`)
  console.log(`Swagger-ui is available on http://localhost:${port}`)
  initDb()
})
