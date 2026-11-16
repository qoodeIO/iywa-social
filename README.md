# Space

Social network "Space": home con vetro liquido, storie, reel, profilo e **messaggi in tempo reale**
con chat 1:1, gruppi, chiamate e videochiamate.

## Avvio in locale

Servono due terminali:

```
npm install
npm run calls   # hub realtime (Cloudflare Worker + Durable Object) su 127.0.0.1:8787
npm run dev     # app su http://127.0.0.1:4173 (inoltra /calls all'hub)
```

Account demo: `forno.neri` / `forno`. Per provare chat e chiamate dal vivo serve un secondo
account: registralo da un'altra finestra in incognito o da un altro browser.

## Messaggi, gruppi e chiamate

La logica è portata da Spinchat (VideoApp) e adattata a un Durable Object:

- **Hub** (`calls/src/worker.js`): un Durable Object con SQLite per utenti, conversazioni,
  membri e messaggi. Gestisce presenza e ultimo accesso, "sta scrivendo", conferme di lettura
  (visibili solo se entrambi le hanno attive), messaggi idempotenti per `clientId`, cronologia a
  pagine, gruppi fino a 20 persone con amministratore (rinomina, aggiungi, rimuovi, esci).
- **Chiamate** in mesh P2P fino a 6 persone: l'hub fa squillare, inoltra offer/answer/ICE e
  registra l'esito nella chat (durata, persa, rifiutata, occupato). Squillo di 45 s, rifiuto,
  annullamento, "occupato", risposta su un altro dispositivo.
- **Client** (`src/live/`): `hub.js` (WebSocket con riconnessione e ping), `LiveStore.jsx`
  (stato e invio ottimistico con riprova), `calls.js` + `peer.js` (WebRTC: chi entra offre,
  candidati ICE in coda, riavvio ICE, fotocamera attivabile durante una chiamata vocale senza
  rinegoziare, cambio fotocamera), `sounds.js` (suonerie sintetizzate).
- I contatti demo restano locali: le chiamate verso di loro squillano e finiscono in "nessuna
  risposta".

### TURN (consigliato in produzione)

Senza TURN le chiamate usano solo STUN e possono non connettersi su reti aziendali o NAT rigidi.
Copia `calls/.dev.vars.example` in `calls/.dev.vars` e imposta `TURN_KEY_ID` e
`TURN_KEY_API_TOKEN` (Cloudflare Realtime TURN). In produzione: `wrangler secret put ...`.

### Produzione

`npx wrangler deploy --config calls/wrangler.jsonc`, poi build del sito con
`VITE_HUB_URL=wss://<worker>/calls/hub npm run build` se il sito non è sullo stesso dominio.

Limiti noti: l'identità è l'@nome dichiarato dal client (manca un login lato server), foto e
vocali sono salvati come data URL nel Durable Object (meglio R2 per volumi reali), niente
notifiche push con l'app chiusa.

## Acquisti diretti con Stripe Connect

Ogni bottega collega **il proprio** account Stripe (Express) da *Impostazioni → Pagamenti*.
Chi compra paga con Stripe Checkout: i soldi vanno direttamente sull'account del venditore e
Space trattiene una commissione (`PLATFORM_FEE_PERCENT`, predefinita 5%).

1. In `calls/.dev.vars` aggiungi le chiavi **di test**:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   PLATFORM_FEE_PERCENT=5
   ```
2. Riavvia il server del Direct (`npm run calls`).
3. Webhook in locale: `stripe listen --forward-to localhost:8787/calls/api/stripe/webhook`
   (il segreto `whsec_...` che stampa va in `STRIPE_WEBHOOK_SECRET`). Anche senza webhook,
   al ritorno dal pagamento l'app conferma l'ordine interrogando Stripe.
4. In produzione: `wrangler secret put STRIPE_SECRET_KEY` (e gli altri) e un endpoint webhook
   su `https://<worker>/calls/api/stripe/webhook` con gli eventi `checkout.session.completed`
   e `account.updated`.

Flusso: account *Azienda / Bottega* → *Pagamenti → Collega Stripe* (onboarding Stripe) →
i prodotti dello shop vengono pubblicati sul server → nella sezione **Shop** (icona borsa in
Home) gli altri utenti vedono "Acquista ora" → Stripe Checkout → ordine in *Ordini*, notifica
in tempo reale al venditore, "Segna spedito".

I prezzi usati nel pagamento sono sempre quelli salvati sul server, mai quelli inviati
dal browser. **Limite importante:** il server si fida del nome utente dichiarato dall'app
(non c'è ancora un vero login). Finché non c'è, usa solo chiavi Stripe di test.
