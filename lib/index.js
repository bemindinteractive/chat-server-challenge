import { v4 as uuid } from 'uuid'
import sha256 from 'sha256'
import { join, dirname } from 'path'
import { Low, JSONFile } from 'lowdb'
import { fileURLToPath } from 'url'
import avatars from './avatars.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const storeDir = '../.tmp/store.json'

// Use JSON file for storage
const file = join(__dirname, storeDir)

export function getDb() {
  console.log(file)

  const adapter = new JSONFile(file)
  const db = new Low(adapter)
  // Read data from JSON file, this will set db.data content

  return db
}

export function createInitData() {
  const res = {
    sessions: {},
    users: {
      tizio: {
        id: uuid(),
        name: 'Tiberio',
        surname: 'Gracco',
        username: 'tizio',
        email: 'tizio@bemind.me',
        password: sha256('tizio.secret'),
        avatar: avatars.tizio,
        contacts: [],
      },
      caio: {
        id: uuid(),
        name: 'Gaio',
        surname: 'Gracco',
        username: 'caio',
        email: 'caio@bemind.me',
        password: sha256('caio.secret'),
        avatar: avatars.caio,
        contacts: [],
      },
      sempronio: {
        id: uuid(),
        name: 'Sempronio',
        surname: 'Gracco',
        username: 'sempronio',
        email: 'sempronio@bemind.me',
        password: sha256('sempronio.secret'),
        avatar: avatars.sempronio,
        contacts: [],
      },
    },
    initDate: new Date(),
  }

  res.histories = {
    [uuid()]: {
      messages: [
        {
          id: uuid(),
          contactId: res.users.tizio.id,
          message: 'Ciao Gaio',
          sentDate: new Date(),
          readDate: new Date(),
        },
        {
          id: uuid(),
          contactId: res.users.caio.id,
          message: 'Ciao Tiberio',
          sentDate: new Date(),
          readDate: new Date(),
        },
      ],
    },
    [uuid()]: {
      messages: [
        {
          id: uuid(),
          contactId: res.users.tizio.id,
          message: 'Ciao Sempronio',
          sentDate: new Date(),
          readDate: new Date(),
        },
        {
          id: uuid(),
          contactId: res.users.sempronio.id,
          message: 'Ciao Tiberio',
          sentDate: new Date(),
          readDate: new Date(),
        },
      ],
    },
    [uuid()]: {
      messages: [
        {
          id: uuid(),
          contactId: res.users.caio.id,
          message: 'Ciao Sempronio',
          sentDate: new Date(),
          readDate: new Date(),
        },
        {
          id: uuid(),
          contactId: res.users.sempronio.id,
          message: 'Ciao Gaio',
          sentDate: new Date(),
          readDate: new Date(),
        },
      ],
    },
  }

  res.users.tizio.contacts.push({
    contactId: res.users.caio.id,
    historyId: Object.keys(res.histories)[0],
  })
  res.users.tizio.contacts.push({
    contactId: res.users.sempronio.id,
    historyId: Object.keys(res.histories)[1],
  })

  res.users.caio.contacts.push({
    contactId: res.users.tizio.id,
    historyId: Object.keys(res.histories)[0],
  })
  res.users.caio.contacts.push({
    contactId: res.users.sempronio.id,
    historyId: Object.keys(res.histories)[2],
  })

  res.users.sempronio.contacts.push({
    contactId: res.users.tizio.id,
    historyId: Object.keys(res.histories)[1],
  })
  res.users.sempronio.contacts.push({
    contactId: res.users.caio.id,
    historyId: Object.keys(res.histories)[2],
  })

  return res
}

export function isAuthenticated(req, sessions) {
  return !!sessions[req.cookies.sessionId]
}

export function getSessionUser(req, sessions, users) {
  const session = sessions[req.cookies.sessionId]
  if (session) {
    return getUserById(session.id, users)
  }
}

export function cleanUser(user) {
  const cleanedUser = { ...user }
  delete cleanedUser.contacts
  delete cleanedUser.password

  if (!!cleanedUser.history) {
    delete cleanedUser.history
  }

  return cleanedUser
}

export function createSession({ id, username }) {
  return { id, username }
}

export function getUserById(id, users) {
  const lookupUsername = Object.keys(users).find((k) => users[k].id === id)

  return users[lookupUsername]
}

export function getContactById(user, id, users) {
  const contact = user.contacts.find((c) => c.contactId === id)
  const contactUser = getUserById(contact.contactId, users)

  if (contact && contactUser) {
    return { ...contactUser, ...contact }
  }
}

export function getContacts(sessionId, users, sessions) {
  return users[sessions[sessionId].username].contacts
}

export function getContact(sessionId, users, sessions, contactId) {
  return Contacts.getContacts(sessionId, users, sessions).find((c) => c.id === contactId)
}

export function updateUnreadCount(contact) {
  contact.unreadCount = contact.history.messages.reduce(
    (res, m) => (!!m.readDate && contact.id === m.contactId ? res + 1 : res),
    0
  )

  return contact
}
