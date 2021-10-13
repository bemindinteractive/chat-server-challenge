const { v4: uuid } = require('uuid')
const sha256 = require('sha256')
const jetpack = require('fs-jetpack')

const avatars = require('./avatars')
const storeDir = '.tmp/store.json'
const minuteOffset = 3600000

class Store {
  constructor() {
    jetpack.append(storeDir, '')

    try {
      this._store = this._fetch()
    } catch (ex) {
      console.log('initializing empty store')

      this._store = this._create()

      Object.keys(this._store.users).forEach((uu) => {
        if (!this._store.users[uu].contacts) {
          this._store.users[uu].contacts = Object.keys(this._store.users)
            .filter((u) => this._store.users[u].id !== this._store.users[uu].id)
            .map((u) =>
              Object.assign({}, this._store.users[u], {
                history: {
                  messages: [
                    {
                      id: uuid(),
                      contactId: this._store.users[u].id,
                      message: `Ciao ${this._store.users[uu].name}`,
                      sentDate: new Date(
                        this._store.initDate.getTime() - minuteOffset * 2
                      ).toISOString(),
                      readDate: null,
                    },
                    {
                      id: uuid(),
                      contactId: this._store.users[uu].id,
                      message: `Ciao ${this._store.users[u].name}`,
                      sentDate: new Date(
                        this._store.initDate.getTime() - minuteOffset
                      ).toISOString(),
                      readDate: new Date(
                        this._store.initDate.getTime() - minuteOffset
                      ).toISOString(),
                    },
                  ],
                },
              })
            )
        }
      })

      this.commitState()
    }
  }

  _create() {
    return {
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
        },
        caio: {
          id: uuid(),
          name: 'Gaio',
          surname: 'Gracco',
          username: 'caio',
          email: 'caio@bemind.me',
          password: sha256('caio.secret'),
          avatar: avatars.caio,
        },
        sempronio: {
          id: uuid(),
          name: 'Sempronio',
          surname: 'Gracco',
          username: 'sempronio',
          email: 'sempronio@bemind.me',
          password: sha256('sempronio.secret'),
          avatar: avatars.sempronio,
        },
      },
      initDate: new Date(),
    }
  }

  _fetch() {
    return jetpack.read(storeDir, 'json')
  }

  getState() {
    return this._store
  }

  commitState() {
    return jetpack.write(storeDir, this._store)
  }
}

class Auth {
  static isAuthenticated(req, sessions) {
    return !!sessions[req.cookies.sessionId]
  }

  static cleanSession(user) {
    const cleanedUser = Object.assign({}, user)
    delete cleanedUser.contacts
    delete cleanedUser.password

    if (!!cleanedUser.history) {
      delete cleanedUser.history
    }

    return cleanedUser
  }
}

class Contacts {
  static getUserById(id, users) {
    return Object.keys(users).find((k) => users[k].id === id)
  }

  static getContacts(sessionId, users, sessions) {
    return users[sessions[sessionId].username].contacts
  }

  static getContact(sessionId, users, sessions, contactId) {
    return Contacts.getContacts(sessionId, users, sessions).find((c) => c.id === contactId)
  }

  static updateUnreadCount(contact) {
    contact.unreadCount = contact.history.messages.reduce(
      (res, m) => (!!m.readDate && contact.id === m.contactId ? res + 1 : res),
      0
    )

    return contact
  }
}

module.exports = {
  Store,
  Auth,
  Contacts,
}
