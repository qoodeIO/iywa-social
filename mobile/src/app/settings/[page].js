import { useState } from "react";
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { INSET, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { CONTACTS, EXPLORE, POSTS, REELS, avatarFor } from "../../data";
import { Bookmark, Plus, Star, Store, User } from "../../ui/icons";
import { Avatar, Btn, Empty, Header, T, tap } from "../../ui/kit";
import { Card, ChoiceList, Divider, Kicker, Pick, Row, SettingIcon, ToggleRow, rowById } from "../../ui/settings";

const W = Dimensions.get("window").width;
const CELL = (W - 2) / 3;
const WEEK = [40, 62, 28, 74, 55, 36, 48];
const WEEK_DAYS = ["L", "M", "M", "G", "V", "S", "D"];

const AUDIENCE = [
  { id: "everyone", label: "Tutti" },
  { id: "following", label: "Persone che segui" },
  { id: "off", label: "Nessuno" },
];

const HEROES = {
  edit: "Come ti vedono gli altri",
  login: "Su questo telefono",
  saved: "Solo tu li vedi",
  archive: "Nascosti dal profilo",
  activity: "Su questo telefono",
  notifications: "Cosa può raggiungerti",
  time: "Un promemoria al giorno",
  privacy: "Chi vede i tuoi post",
  close: "Anello verde sulle storie",
  blocked: "Non possono trovarti",
  messages: "Risposte e attività",
  tags: "Prima che finisca su di te",
  comments: "Chi può rispondere",
  words: "Commenti e richieste",
  restricted: "I loro commenti restano da te",
  muted: "I loro post escono dal feed",
  content: "Cosa mostra il feed",
  theme: "Il colore di Space",
  language: "Lingua dell'app",
  accessibility: "Leggere l'app",
  data: "Con poca rete",
  "account-type": "Strumenti per il laboratorio",
  payments: "Vendere su Space",
  help: "Risposte brevi",
  "privacy-policy": "Space",
  terms: "Space",
  about: "Space",
};

const LEGAL = {
  "privacy-policy": [
    ["Cosa conserva Space", "Nome, handle, bio, i post che pubblichi in questa anteprima e le preferenze su questo telefono."],
    ["Chi ti vede", "Un account privato nasconde post, reel e storie a chi non hai approvato. Nome, foto e bio restano visibili."],
    ["Messaggi", "Stato attività e conferme di lettura seguono gli interruttori in Impostazioni. Se li spegni, si nascondono da entrambe le parti."],
    ["Le tue scelte", "Account silenziati, bloccati e parole nascoste restano sul telefono finché non li cancelli."],
  ],
  terms: [
    ["L'anteprima", "Space è una demo privata. Post, chat e account che aggiungi vivono su questo telefono."],
    ["I tuoi contenuti", "Le didascalie che scrivi restano tue. Non pubblicare ciò che non hai diritto di condividere."],
    ["Le altre persone", "Bloccare, limitare e silenziare cambia ciò che vedi in questa anteprima."],
    ["Modifiche", "Questi termini descrivono l'anteprima di oggi. L'app può cambiare mentre la demo cresce."],
  ],
};

const HELP = [
  ["Account privato", "Chi non hai approvato smette di vedere post, storie e reel. Il nome resta visibile."],
  ["Shop", "Con un account azienda il profilo mostra la scheda Shop. I clienti ti mandano una richiesta d'ordine in chat."],
  ["Aspetto", "Automatico segue il tema del telefono. Chiaro e Scuro lo fissano solo per Space."],
  ["I miei dati", "Like, carrello, messaggi e impostazioni restano su questo telefono. Azzera i dati li riporta all'inizio."],
];

const KINDS = ["Bottega artigiana", "Negozio", "Ristorante", "Laboratorio tessile", "Studio di design", "Scuola e corsi", "Azienda"];

export default function SettingPage() {
  const theme = useTheme();
  const { page } = useLocalSearchParams();
  const row = rowById(page);
  const title = row?.label || "Impostazioni";
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title} border />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {page === "saved" || page === "edit" ? null : <Hero id={page} title={title} meta={HEROES[page]} />}
          <Body page={page} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Hero({ id, title, meta }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", paddingTop: 22, paddingBottom: 6, gap: 6 }}>
      <SettingIcon id={id} size={56} />
      <T size={20} weight="700" style={{ marginTop: 4 }}>{title}</T>
      {meta ? <T size={13.5} color={theme.text2}>{meta}</T> : null}
    </View>
  );
}

function Body({ page }) {
  const store = useStore();
  const prefs = store.prefs;
  const set = (patch) => { tap(); store.setPrefs(patch); };
  switch (page) {
    case "edit": return <EditProfile />;
    case "login": return <Accounts />;
    case "saved": return <Saved />;
    case "archive": return <Empty icon={Bookmark} title="Niente qui" text="I post che archivi aspettano qui." />;
    case "activity": return <Activity />;
    case "notifications":
      return (
        <>
          <Kicker>Notifiche push</Kicker>
          <Card>
            {[["likes", "Like"], ["comments", "Commenti"], ["follows", "Nuovi follower"], ["messages", "Messaggi"], ["mentions", "Menzioni"]].map(([key, label], index) => (
              <ToggleRow key={key} first={index === 0} on={prefs.notes[key]} label={label} onPress={() => set({ notes: { [key]: !prefs.notes[key] } })} />
            ))}
          </Card>
        </>
      );
    case "time":
      return (
        <>
          <Week />
          <Kicker>Limite giornaliero</Kicker>
          <ChoiceList value={prefs.timeLimit} onPick={(timeLimit) => set({ timeLimit })} options={[
            { id: "off", label: "Spento" }, { id: "30", label: "30 minuti" }, { id: "45", label: "45 minuti" }, { id: "60", label: "1 ora" },
          ]} />
        </>
      );
    case "privacy":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.private} label="Account privato" meta="Solo chi approvi vede post, storie e reel." onPress={() => set({ private: !prefs.private })} />
        </Card>
      );
    case "close": return <People list={prefs.closeFriends} onChange={(closeFriends) => set({ closeFriends })} />;
    case "blocked": return <People list={prefs.blocked} onChange={(blocked) => set({ blocked })} />;
    case "muted": return <People list={prefs.muted} onChange={(muted) => set({ muted })} />;
    case "restricted": return <People list={prefs.restricted} onChange={(restricted) => set({ restricted })} />;
    case "messages":
      return (
        <>
          <Kicker>Richieste di messaggio</Kicker>
          <ChoiceList value={prefs.messages} options={AUDIENCE} onPick={(messages) => set({ messages })} />
          <Kicker>Risposte alle storie</Kicker>
          <ChoiceList value={prefs.storyReplies} options={AUDIENCE} onPick={(storyReplies) => set({ storyReplies })} />
          <Kicker>Attività</Kicker>
          <Card>
            <ToggleRow first on={prefs.activity} label="Stato attività" meta="Il pallino attivo, da entrambe le parti." onPress={() => set({ activity: !prefs.activity })} />
            <ToggleRow on={prefs.readReceipts} label="Conferme di lettura" meta="Visto, da entrambe le parti." onPress={() => set({ readReceipts: !prefs.readReceipts })} />
          </Card>
        </>
      );
    case "tags":
      return (
        <>
          <Kicker>Tag</Kicker>
          <ChoiceList value={prefs.tags} options={AUDIENCE} onPick={(tags) => set({ tags })} />
          <Kicker>Menzioni</Kicker>
          <ChoiceList value={prefs.mentions} options={AUDIENCE} onPick={(mentions) => set({ mentions })} />
        </>
      );
    case "comments":
      return (
        <>
          <Kicker>Chi può commentare</Kicker>
          <ChoiceList value={prefs.comments} options={AUDIENCE} onPick={(comments) => set({ comments })} />
        </>
      );
    case "words": return <Words />;
    case "content":
      return (
        <>
          <Kicker>Contenuti sensibili</Kicker>
          <ChoiceList value={prefs.sensitive} onPick={(sensitive) => set({ sensitive })} options={[
            { id: "less", label: "Meno" }, { id: "standard", label: "Standard" }, { id: "more", label: "Più" },
          ]} />
          <Kicker>Feed</Kicker>
          <Card>
            <ToggleRow first on={prefs.likeCounts} label="Conteggi di like e condivisioni" meta="I numeri su post e reel." onPress={() => set({ likeCounts: !prefs.likeCounts })} />
            <ToggleRow on={prefs.suggested} label="Contenuti suggeriti" meta="Nuove persone in Home." onPress={() => set({ suggested: !prefs.suggested })} />
          </Card>
        </>
      );
    case "theme":
      return (
        <>
          <Kicker>Aspetto</Kicker>
          <ChoiceList value={prefs.appearance} onPick={(appearance) => set({ appearance })} options={[
            { id: "auto", label: "Automatico", meta: "Segue il tema del telefono" }, { id: "light", label: "Chiaro" }, { id: "dark", label: "Scuro" },
          ]} />
        </>
      );
    case "language":
      return (
        <>
          <Kicker>Lingua</Kicker>
          <ChoiceList value="it" onPick={() => {}} options={[{ id: "it", label: "Italiano" }]} />
          <Note>Le altre lingue arrivano con i prossimi aggiornamenti.</Note>
        </>
      );
    case "accessibility":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.captions} label="Sottotitoli" meta="Mostrali sui reel." onPress={() => set({ captions: !prefs.captions })} />
          <ToggleRow on={prefs.altText} label="Testo alternativo" meta="Scrivilo quando pubblichi una foto." onPress={() => set({ altText: !prefs.altText })} />
        </Card>
      );
    case "data":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.dataSaver} label="Risparmio dati" meta="Carica foto più leggere." onPress={() => set({ dataSaver: !prefs.dataSaver })} />
        </Card>
      );
    case "account-type": return <Business />;
    case "payments": return <Payments />;
    case "help": return <Help />;
    case "privacy-policy":
    case "terms":
      return <Legal sections={LEGAL[page]} />;
    case "about":
      return <Legal sections={[["Space", "Un telefono per il laboratorio. Post, storie, reel, messaggi e shop."], ["Versione", `${Constants.expoConfig?.version || "1.0.0"} · iOS e Android`]]} />;
    default:
      return <Empty title="Pagina non trovata" text="Torna alle impostazioni." />;
  }
}

function Note({ children }) {
  const theme = useTheme();
  return <T size={13} color={theme.text2} style={{ paddingHorizontal: INSET + 4, paddingTop: 10, lineHeight: 18 }}>{children}</T>;
}

function Week() {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: 14, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 96, gap: 10 }}>
        {WEEK.map((height, index) => (
          <View key={index} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ width: "100%", height: height, borderRadius: 6, backgroundColor: index === 3 ? theme.blue : theme.text3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        {WEEK_DAYS.map((day, index) => <T key={index} size={11} color={theme.text2} style={{ flex: 1, textAlign: "center" }}>{day}</T>)}
      </View>
    </Card>
  );
}

function Activity() {
  const theme = useTheme();
  const store = useStore();
  const avg = Math.round(WEEK.reduce((sum, value) => sum + value, 0) / WEEK.length);
  return (
    <>
      <View style={{ alignItems: "center", paddingTop: 12 }}>
        <T size={34} weight="800">{avg} min</T>
        <T size={13} color={theme.text2}>Media giornaliera questa settimana</T>
      </View>
      <Week />
      <Kicker>Interazioni</Kicker>
      <Card>
        <Row first label="Like" value={String(store.likes.length)} />
        <Row label="Salvati" value={String(store.saves.length)} onPress={() => router.push("/settings/saved")} />
        <Row label="Persone che segui" value={String(store.follows.length)} />
      </Card>
      <Kicker>Ricerche</Kicker>
      <Card>
        <Row first label="Cronologia di ricerca" meta={store.prefs.searchesCleared ? "Cancellata" : "forno, smalto, Adele"} right={store.prefs.searchesCleared ? null : <T size={14} weight="600" color={theme.blue}>Cancella</T>} onPress={store.prefs.searchesCleared ? undefined : () => store.setPrefs({ searchesCleared: true })} />
      </Card>
    </>
  );
}

function People({ list, onChange }) {
  return (
    <>
      <Kicker>{list.length ? `${list.length} selezionati` : "Nessuno selezionato"}</Kicker>
      <Card>
        {CONTACTS.slice(0, 8).map((person, index) => {
          const on = list.includes(person.name);
          return (
            <Row
              key={person.name}
              first={index === 0}
              icon={<Avatar src={person.src} size={40} />}
              label={person.name}
              meta={person.meta}
              right={<Pick on={on} />}
              onPress={() => onChange(on ? list.filter((name) => name !== person.name) : [...list, person.name])}
            />
          );
        })}
      </Card>
    </>
  );
}

function Words() {
  const theme = useTheme();
  const store = useStore();
  const [word, setWord] = useState("");
  const words = store.prefs.hiddenWords;
  function add() {
    const next = word.trim().toLowerCase();
    if (!next || words.includes(next)) return;
    tap();
    store.setPrefs({ hiddenWords: [...words, next] });
    setWord("");
  }
  return (
    <>
      <View style={[styles.input, { backgroundColor: theme.fill }]}>
        <TextInput value={word} onChangeText={setWord} onSubmitEditing={add} placeholder="Aggiungi una parola" placeholderTextColor={theme.text2} style={{ flex: 1, fontSize: 15.5, color: theme.text }} autoCapitalize="none" returnKeyType="done" />
        <Pressable onPress={add} hitSlop={8} style={[styles.add, { backgroundColor: word.trim() ? theme.blue : theme.text3 }]}><Plus size={16} weight="bold" color="#fff" /></Pressable>
      </View>
      <Note>I commenti e le richieste con queste parole restano nascosti. Tocca una parola per toglierla.</Note>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: INSET, paddingTop: 14 }}>
        {words.map((item) => (
          <Pressable key={item} onPress={() => { tap(); store.setPrefs({ hiddenWords: words.filter((value) => value !== item) }); }} style={[styles.word, { backgroundColor: theme.text }]}>
            <T size={14} weight="600" color={theme.bg}>{item}  ×</T>
          </Pressable>
        ))}
      </View>
    </>
  );
}

function Saved() {
  const theme = useTheme();
  const store = useStore();
  const pool = [...POSTS, ...EXPLORE, ...REELS.map((reel) => ({ ...reel, image: /\.(jpe?g|png|webp)|unsplash/.test(reel.src) ? reel.src : reel.avatar }))];
  const items = store.saves.map((id) => pool.find((item) => item.id === id)).filter(Boolean);
  if (!items.length) return <Empty icon={Bookmark} title="Niente qui" text="Salva un post dal feed: lo ritrovi qui. Solo tu vedi cosa hai salvato." />;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, paddingTop: 1 }}>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => item.text && router.push(`/post/${item.id}`)}>
          <Image source={{ uri: item.image }} style={{ width: CELL, height: CELL * 1.33, backgroundColor: theme.fill }} contentFit="cover" transition={150} />
        </Pressable>
      ))}
    </View>
  );
}

function EditProfile() {
  const theme = useTheme();
  const store = useStore();
  const [name, setName] = useState(store.profile.name);
  const [handle, setHandle] = useState(String(store.profile.handle).replace(/^@/, ""));
  const [bio, setBio] = useState(store.profile.bio || "");
  const clean = handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
  const changed = name.trim() !== store.profile.name || `@${clean}` !== store.profile.handle || bio.trim() !== (store.profile.bio || "");
  const valid = name.trim().length > 1 && clean.length > 2;

  function save() {
    store.setProfile({ name: name.trim(), handle: `@${clean}`, bio: bio.trim() });
    router.back();
  }

  return (
    <>
      <View style={{ alignItems: "center", paddingTop: 6 }}>
        <Avatar src={store.profile.src} size={86} />
        <Pressable onPress={() => Alert.alert("Foto profilo", "Il cambio foto arriva con la fotocamera nativa.")}><T size={14} weight="600" color={theme.blue} style={{ marginTop: 10 }}>Modifica foto</T></Pressable>
      </View>
      <Kicker>Profilo</Kicker>
      <Card>
        <Field label="Nome" value={name} onChange={setName} max={40} first />
        <Field label="Nome utente" value={handle} onChange={setHandle} max={30} prefix="@" lower />
        <Field label="Bio" value={bio} onChange={setBio} max={150} multiline />
      </Card>
      <Note>{`${bio.length}/150 · Il nome utente usa solo lettere, numeri, punto e trattino basso.`}</Note>
      <View style={{ paddingHorizontal: INSET, paddingTop: 22 }}>
        <Btn title="Salva" kind="primary" height={44} disabled={!changed || !valid} onPress={save} />
      </View>
    </>
  );
}

function Field({ label, value, onChange, max, multiline, prefix, lower, first }) {
  const theme = useTheme();
  return (
    <>
      {first ? null : <Divider />}
      <View style={[styles.field, multiline ? { alignItems: "flex-start" } : null]}>
        <T size={15} style={{ width: 106, paddingTop: multiline ? 2 : 0 }}>{label}</T>
        {prefix ? <T size={15.5} color={theme.text2}>{prefix}</T> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={max}
          multiline={multiline}
          autoCapitalize={lower ? "none" : "sentences"}
          autoCorrect={!lower}
          style={{ flex: 1, fontSize: 15.5, color: theme.text, minHeight: multiline ? 66 : undefined, padding: 0 }}
        />
      </View>
    </>
  );
}

function Accounts() {
  const theme = useTheme();
  const store = useStore();
  return (
    <>
      <Kicker>Account su questo telefono</Kicker>
      <Card>
        {(store.auth?.users || []).map((user, index) => {
          const on = user.handle === store.auth?.handle;
          const demo = user.handle === "forno.neri";
          return (
            <Row
              key={user.handle}
              first={index === 0}
              icon={<Avatar src={demo ? store.profile.src : avatarFor(user.name || user.handle) || store.profile.src} size={40} />}
              label={demo ? store.profile.name : user.name || user.handle}
              meta={`@${user.handle}${on ? " · in uso" : ""}`}
              right={<Pick on={on} />}
              onPress={on ? undefined : () => { store.signIn(user.handle); router.dismissAll(); router.replace("/"); }}
            />
          );
        })}
        <Row icon={<View style={[styles.plus, { borderColor: theme.text3 }]}><Plus size={18} weight="bold" color={theme.text} /></View>} label="Aggiungi account" onPress={() => { router.dismissAll(); router.replace("/"); store.addAccount(); }} />
      </Card>
      <Note>Cambiando account resti connesso a tutti gli account di questo telefono.</Note>
      <Card style={{ marginTop: 22 }}>
        <Pressable
          onPress={() => Alert.alert("Uscire?", "Puoi rientrare quando vuoi.", [
            { text: "Annulla", style: "cancel" },
            { text: "Esci", style: "destructive", onPress: () => { router.dismissAll(); router.replace("/"); store.logout(); } },
          ])}
          style={({ pressed }) => [{ height: 50, alignItems: "center", justifyContent: "center" }, pressed ? { backgroundColor: theme.fill } : null]}
        >
          <T size={15.5} weight="600" color={theme.red}>Esci da @{store.auth?.handle || String(store.profile.handle).replace(/^@/, "")}</T>
        </Pressable>
      </Card>
    </>
  );
}

function Business() {
  const theme = useTheme();
  const store = useStore();
  const biz = store.business;
  const types = [
    { id: "personal", icon: User, tone: "#8e8e93", label: "Personale", meta: "Per condividere con amici e follower." },
    { id: "creator", icon: Star, tone: "#bf5af2", label: "Creator", meta: "Per chi crea e vuole farsi conoscere." },
    { id: "business", icon: Store, tone: "#0a84ff", label: "Azienda / Bottega", meta: "Shop, orari, contatti e statistiche." },
  ];
  const days = [[1, "L"], [2, "M"], [3, "M"], [4, "G"], [5, "V"], [6, "S"], [0, "D"]];
  const patch = (next) => store.setBusiness(next);
  return (
    <>
      <Kicker>Tipo di account</Kicker>
      <Card>
        {types.map((type, index) => (
          <Row
            key={type.id}
            first={index === 0}
            icon={<View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: type.tone, alignItems: "center", justifyContent: "center" }}><type.icon size={18} weight="fill" color="#fff" /></View>}
            label={type.label}
            meta={type.meta}
            right={<Pick on={store.accountType === type.id} />}
            onPress={() => store.setAccountType(type.id)}
          />
        ))}
      </Card>
      {store.accountType === "business" ? (
        <>
          <Kicker>La tua attività</Kicker>
          <Card>
            <Field first label="Nome" value={biz.title} onChange={(title) => patch({ title })} max={40} />
            <Field label="Indirizzo" value={biz.address} onChange={(address) => patch({ address })} max={60} />
            <Field label="Città" value={biz.city} onChange={(city) => patch({ city })} max={40} />
            <Field label="Telefono" value={biz.phone} onChange={(phone) => patch({ phone })} max={24} lower />
            <Field label="Email" value={biz.email} onChange={(email) => patch({ email })} max={60} lower />
          </Card>
          <Kicker>Categoria</Kicker>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: INSET }}>
            {KINDS.map((kind) => {
              const on = biz.category === kind;
              return (
                <Pressable key={kind} onPress={() => { tap(); patch({ category: kind }); }} style={[styles.word, { backgroundColor: on ? theme.text : theme.fill }]}>
                  <T size={14} weight="600" color={on ? theme.bg : theme.text}>{kind}</T>
                </Pressable>
              );
            })}
          </View>
          <Kicker>Orari di apertura</Kicker>
          <Card style={{ padding: 14, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {days.map(([day, label]) => {
                const on = biz.hours.days.includes(day);
                return (
                  <Pressable key={day} onPress={() => { tap(); patch({ hours: { ...biz.hours, days: on ? biz.hours.days.filter((value) => value !== day) : [...biz.hours.days, day] } }); }} style={[styles.day, { backgroundColor: on ? theme.blue : theme.fill }]}>
                    <T size={14} weight="700" color={on ? "#fff" : theme.text2}>{label}</T>
                  </Pressable>
                );
              })}
            </View>
            <T size={14} color={theme.text2}>{biz.hours.days.length ? `Aperto ${biz.hours.open}–${biz.hours.close}` : "Chiuso tutta la settimana"}</T>
          </Card>
          <Card style={{ marginTop: 14 }}>
            <ToggleRow first on={biz.shop !== false} label="Mostra lo shop sul profilo" meta="Una scheda Shop con i tuoi prodotti." onPress={() => { tap(); patch({ shop: biz.shop === false }); }} />
          </Card>
          <Note>Il profilo mostra contatti, orari e la scheda Shop. I clienti ti mandano le richieste d'ordine in chat.</Note>
        </>
      ) : null}
    </>
  );
}

function Payments() {
  const theme = useTheme();
  const store = useStore();
  const business = store.accountType === "business";
  return (
    <>
      <Kicker>Come vendi oggi</Kicker>
      <Card>
        <Row first label="Richiesta d'ordine in chat" meta="Il cliente sceglie, tu confermi e concordi il pagamento." right={<Pick on />} />
        <Row label="Pagamento con carta" meta="Con Stripe, nella versione web di Space." />
      </Card>
      <Note>{business ? "Gli ordini ricevuti e quelli fatti sono in Ordini." : "Per vendere passa a un account Azienda in Tipo di account e shop."}</Note>
      <View style={{ paddingHorizontal: INSET, paddingTop: 18, gap: 10 }}>
        <Btn title="Vedi gli ordini" height={44} onPress={() => router.push("/shop/orders")} />
        {business ? null : <Btn title="Passa ad Azienda" kind="primary" height={44} onPress={() => router.replace("/settings/account-type")} />}
      </View>
      <T size={12} color={theme.text3} style={{ textAlign: "center", marginTop: 16 }}>Nessun dato della carta passa da Space.</T>
    </>
  );
}

function Help() {
  const theme = useTheme();
  const [open, setOpen] = useState(null);
  return (
    <Card style={{ marginTop: 14 }}>
      {HELP.map(([label, text], index) => (
        <View key={label}>
          {index ? <Divider /> : null}
          <Pressable onPress={() => { tap(); setOpen(open === label ? null : label); }} style={{ paddingHorizontal: 14, paddingVertical: 14, gap: 6 }}>
            <T size={15.5} weight={open === label ? "600" : "400"}>{label}</T>
            {open === label ? <T size={14} color={theme.text2} style={{ lineHeight: 20 }}>{text}</T> : null}
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

function Legal({ sections }) {
  const theme = useTheme();
  return (
    <Card style={{ marginTop: 14, padding: 16, gap: 16 }}>
      {sections.map(([h, p]) => (
        <View key={h} style={{ gap: 4 }}>
          <T size={15.5} weight="700">{h}</T>
          <T size={14} color={theme.text2} style={{ lineHeight: 20 }}>{p}</T>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  input: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: INSET, marginTop: 16, height: 46, borderRadius: 12, paddingLeft: 14, paddingRight: 6 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  word: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  field: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 14 },
  plus: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
