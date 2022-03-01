import { promises as fs } from 'fs'
import {
  JSONFile,
  Low,
} from 'lowdb'
import {
  dirname,
  join,
} from 'path'
import sha256 from 'sha256'
import { fileURLToPath } from 'url'
import { v4 as uuid } from 'uuid'

import avatars from './avatars.js'

export async function getDb() {
  const __dirname = dirname(fileURLToPath(import.meta.url))

  const storeDir = '../.tmp'

  const storeFile = 'store.json'

  // Use JSON file for storage
  const dir = join(__dirname, `${storeDir}`)
  const file = join(__dirname, `${storeDir}/${storeFile}`)
  try {
    await fs.stat(file)
  } catch (err) {
    await fs.mkdir(dir)
    await fs.writeFile(file, JSON.stringify(createInitData()), 'utf-8')
  }

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
    id: res.users.caio.id,
    historyId: Object.keys(res.histories)[0],
  })
  res.users.tizio.contacts.push({
    id: res.users.sempronio.id,
    historyId: Object.keys(res.histories)[1],
  })

  res.users.caio.contacts.push({
    id: res.users.tizio.id,
    historyId: Object.keys(res.histories)[0],
  })
  res.users.caio.contacts.push({
    id: res.users.sempronio.id,
    historyId: Object.keys(res.histories)[2],
  })

  res.users.sempronio.contacts.push({
    id: res.users.tizio.id,
    historyId: Object.keys(res.histories)[1],
  })
  res.users.sempronio.contacts.push({
    id: res.users.caio.id,
    historyId: Object.keys(res.histories)[2],
  })

  res.initDate = new Date()

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
  const contact = user.contacts.find((c) => c.id === id)
  if (contact) {
    const contactUser = getUserById(contact.id, users)

    if (contact && contactUser) {
      return { ...contactUser, ...contact }
    }
  } else {
    return null
  }
}
