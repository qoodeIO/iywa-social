# Space per iOS e Android

App nativa di Space in React Native (Expo SDK 58, Expo Router). Usa gli stessi dati demo dell'app web: `npm run seed` li rigenera da `../src/App.jsx`.

## Avviarla in locale

```bash
npm install
npm run ios        # build nativa e simulatore iPhone
npx expo start     # solo il server JavaScript, se l'app è già installata
```

Se CocoaPods dà errori di codifica: `export LANG=en_US.UTF-8`.

## TestFlight

Serve un account Apple Developer a pagamento e un account Expo.

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

EAS chiede l'accesso Apple, crea certificati e profili, registra l'app su App Store Connect e carica la build su TestFlight (10–15 minuti di elaborazione da parte di Apple).

Il bundle identifier è `com.qoode.space` in `app.json`: cambialo prima della prima build se vuoi un altro identificativo.

## Struttura

- `src/app/` — schermate (Expo Router): Home, Cerca, Reel, Messaggi, Profilo, Shop, bottega, prodotto, carrello, storie, chat.
- `src/ui/` — componenti condivisi (barra in basso, card dei prodotti, feed, profilo).
- `src/data/` — dati demo e logica del marketplace (recensioni, spedizioni, filtri).
- `src/lib/store.js` — stato salvato sul telefono (like, carrello, preferiti, messaggi).
