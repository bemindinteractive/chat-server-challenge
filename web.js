import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import crypto from 'crypto'
import express from 'express'
import http from 'http'
import morgan from 'morgan'
import sha256 from 'sha256'
import { Server } from 'socket.io'
import { v4 as uuid } from 'uuid'

import {
  cleanUser,
  createSession,
  getContactById,
  getDb,
  getSessionUser,
  getUserById,
  isAuthenticated,
} from './lib/index.js'

async function main() {
  const app = express()
  const db = await getDb()
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

  // const whitelist = [
  //   'http://localhost:1337',
  //   'http://0.0.0.0:1337',
  //   'http://localhost:3000',
  //   'http://0.0.0.0:3000',
  // ]

  const corsOptions = {
    origin: function (origin, callback) {
      // if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
      // } else {
      //   callback(new Error('Not allowed by CORS'))
      // }
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

  app.post('/login', async (req, res) => {
    await db.read()

    await new Promise((resolve) =>
      setTimeout(() => {
        resolve({ data: 'your return data' })
      }, 3000)
    )

    if (!req.body || !req.body.username || !req.body.password) {
      res.status(400).json({ message: 'Invalid username or password supplied' })
    } else if (
      !!db.data.users[req.body.username] &&
      sha256(req.body.password) === db.data.users[req.body.username].password
    ) {
      const sessionId = crypto.randomBytes(64).toString('hex')

      db.data.sessions[sessionId] = createSession(db.data.users[req.body.username])
      await db.write()
      res.cookie('sessionId', sessionId, {
        session: true,
        httpOnly: true,
        secure: false,
        sameSite: 'none',
      })
      res.json(cleanUser(db.data.users[req.body.username]))
    } else {
      res.status(400).json({ message: 'Bad request' })
    }
  })

  app.post('/logout', async (req, res) => {
    await db.read()
    if (!!req.cookies.sessionId && db.data.sessions[req.cookies.sessionId]) {
      delete db.data.sessions[req.cookies.sessionId]
      await db.write()
      res.clearCookie('sessionId')
      res.json({ message: 'You are now logged out' })
    } else {
      res.status(400).json({ message: 'Bad request' })
    }
  })

  app.get('/profile', async (req, res) => {
    await db.read()
    if (isAuthenticated(req, db.data.sessions)) {
      res.json(cleanUser(db.data.users[db.data.sessions[req.cookies.sessionId].username]))
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  })

  app.get('/contacts', async (req, res) => {
    await db.read()
    if (isAuthenticated(req, db.data.sessions)) {
      const user = getUserById(db.data.sessions[req.cookies.sessionId].id, db.data.users)

      let contacts = user.contacts.map((c) => ({
        ...cleanUser(getContactById(user, c.id, db.data.users)),
        history: {
          unreadCount: db.data.histories[c.historyId].messages.reduce((acc, m) => {
            if (!m.readDate && m.contactId !== user.id) {
              acc++
            }
            return acc
          }, 0),
        },
        contacts: undefined,
        historyId: undefined,
      }))

      if (!!req.query.q) {
        const queryRegex = new RegExp(req.query.q, 'i')
        contacts = contacts.filter(
          (c) =>
            queryRegex.test(c.name) || queryRegex.test(c.surname) || queryRegex.test(c.username)
        )
      }

      res.json(contacts)
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  })

  app.get('/contacts/:contactId', async (req, res) => {
    await db.read()
    if (isAuthenticated(req, db.data.sessions)) {
      const user = getSessionUser(req, db.data.sessions, db.data.users)
      const contact = getContactById(user, req.params.contactId, db.data.users)

      if (!!contact) {
        res.json(cleanUser(contact))
      } else {
        res.status(404).json({ message: 'Contact not found' })
      }
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  })

  app.get('/contacts/:contactId/history', async (req, res) => {
    await db.read()
    if (isAuthenticated(req, db.data.sessions)) {
      const user = getSessionUser(req, db.data.sessions, db.data.users)
      const contact = getContactById(user, req.params.contactId, db.data.users)

      if (!!contact) {
        const history = db.data.histories[contact.historyId]

        history.messages.forEach((m) => {
          if (!m.readDate && m.contactId === contact.id) {
            m.readDate = new Date().toISOString()
          }
        })

        await db.write()

        contact.history = {
          ...history,
          unreadCount: history.messages.reduce((acc, m) => {
            if (!m.readDate && m.contactId === contact.id) {
              acc++
            }
            return acc
          }, 0),
        }

        contact.historyId = undefined

        res.json(contact.history)
      } else {
        res.status(404).json({ message: 'Contact not found' })
      }
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  })

  app.post('/contacts/:contactId/send', async (req, res) => {
    await db.read()
    if (isAuthenticated(req, db.data.sessions)) {
      if (!!req.body.readDate) {
        return res.status(400).json({ message: "Bad Request: readDate mustn't be provided" })
      }

      const user = getSessionUser(req, db.data.sessions, db.data.users)
      const contact = getContactById(user, req.params.contactId, db.data.users)

      if (!!contact) {
        const message = Object.assign({}, req.body, {
          id: uuid(),
          contactId: user.id,
          sentDate: new Date().toISOString(),
        })

        const history = db.data.histories[contact.historyId]

        history.messages.push(message)

        await db.write()

        res.json(message)
        io.emit('chat message', {
          senderId: user.id,
          recipientId: contact.id,
        }) // This will emit the event to all connected sockets
      } else {
        res.status(404).json({ message: 'Contact not found' })
      }
    } else {
      res.status(401).json({ message: 'Unauthorized' })
    }
  })

  server.listen(port, host, async () => {
    console.log(`Chat server listening on http://${host}:${port}!`)
    console.log(`Swagger-ui is available on http://${host}:${port}/`)
    // await db.write()
  })
}

main()
