# Chat server challenge

La documentazione delle API REST è accessibile dalla homepage del servizio.

L'endpoint socket non è documentato ma è disponibile sulla stessa porta del server http.

il socket emette un solo evento: `chat message`.

L'autenticazione restituirà nella risposta un cookie di sessione che andrà passato in tutte le richieste successive per identificare la sessione.

E' previsto l'accesso multi utente da client diversi per effettuare prove di comunicazione, di seguito le credenziali:

| Username  | Password         |
| --------- | ---------------- |
| tizio     | tizio.secret     |
| caio      | caio.secret      |
| sempronio | sempronio.secret |

## Comandi

`npm run dev` per lanciare il servizio

`npm run dev:fe` per lanciare il server che contiene la pagina per provare il socket
