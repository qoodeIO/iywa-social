import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { ACCENTS, INSET, useTheme } from "../../theme";
import { usageWeek, useStore, useUsage } from "../../lib/store";
import { changeEmail, changePassword, deleteAccount, signOut, switchAccount, updateMe, useMe, useSession } from "../../lib/session";
import { errorText } from "../../lib/api";
import { editPost, postCard, useLikedPosts, useProfile, useSavedPosts, useSearch, useUserPosts } from "../../lib/social";
import { openGridItem } from "../../lib/profile-data";
import { todayMinutes } from "../../ui/time-limit";
import { LANGS, applyDirection, deviceLanguage, resolveLanguage, setLanguage, t, tk, weekdayLetter } from "../../lib/i18n";
import { BUSINESS } from "../../data";
import { Archive, Bookmark, Check, Heart, Minus, Plus, Search, Store, User } from "../../ui/icons";
import { Btn, Empty, Header, T, tap } from "../../ui/kit";
import { Face } from "../../ui/profile";
import { Card, ChoiceList, Divider, Kicker, Pick, Row, SettingIcon, ToggleRow, rowById } from "../../ui/settings";

const W = Dimensions.get("window").width;
const CELL = (W - 2) / 3;

const AUDIENCE = [
  { id: "everyone", label: tk("Tutti") },
  { id: "following", label: tk("Persone che segui") },
  { id: "off", label: tk("Nessuno") },
];

const audience = () => AUDIENCE.map((option) => ({ ...option, label: t(option.label) }));

// Pages that are not rows of the settings list.
const TITLES = {
  liked: tk("Mi piace"),
  email: tk("Email"),
  password: tk("Password"),
  delete: tk("Elimina account"),
};

const HEROES = {
  edit: tk("Come ti vedono gli altri"),
  login: tk("Il tuo account iywa"),
  saved: tk("Solo tu li vedi"),
  archive: tk("Nascosti dal profilo"),
  activity: tk("Su questo telefono"),
  notifications: tk("Cosa può raggiungerti"),
  time: tk("Un promemoria al giorno"),
  privacy: tk("Chi vede i tuoi post"),
  close: tk("Anello verde sulle storie"),
  blocked: tk("Non vedi i loro contenuti"),
  messages: tk("Risposte e attività"),
  tags: tk("Prima che finisca su di te"),
  comments: tk("Chi può rispondere"),
  words: tk("Commenti e richieste"),
  restricted: tk("I loro commenti restano da te"),
  muted: tk("I loro post escono dal feed"),
  content: tk("Cosa mostra il feed"),
  theme: tk("Il colore di iywa"),
  language: tk("Lingua dell'app"),
  accessibility: tk("Leggere l'app"),
  data: tk("Con poca rete"),
  "account-type": tk("Strumenti per il laboratorio"),
  payments: tk("Vendere su iywa"),
  help: tk("Risposte brevi"),
  email: tk("Per accedere e recuperare l'account"),
  password: tk("Almeno 6 caratteri"),
  delete: tk("Per sempre, con tutto ciò che hai pubblicato"),
  "privacy-policy": "iywa",
  terms: "iywa",
  about: "iywa",
};

const LEGAL = {
  "privacy-policy": [
    [tk("Cosa conserva iywa"), tk("Nome, nome utente, email, foto, bio, i post, le storie e i messaggi che pubblichi o mandi.")],
    [tk("Chi ti vede"), tk("Un account privato nasconde post, reel e storie a chi non hai approvato. Nome, foto e bio restano visibili.")],
    [tk("Sul telefono"), tk("Tema, lingua, account silenziati e bloccati, parole nascoste e tempo di utilizzo restano su questo telefono.")],
    [tk("Eliminare i dati"), tk("Da Impostazioni → Account puoi eliminare l'account: profilo, post, storie e commenti vengono cancellati.")],
  ],
  terms: [
    [tk("Il tuo account"), tk("Sei responsabile di ciò che pubblichi e della sicurezza della tua password.")],
    [tk("I tuoi contenuti"), tk("Le foto e le didascalie che pubblichi restano tue. Non pubblicare ciò che non hai diritto di condividere.")],
    [tk("Le altre persone"), tk("Rispetta chi usa iywa. Puoi bloccare, silenziare o limitare chi non vuoi vedere.")],
    [tk("Modifiche"), tk("Questi termini possono cambiare mentre iywa cresce: te lo diremo nell'app.")],
  ],
};

const HELP = [
  [tk("Account privato"), tk("Chi non hai approvato smette di vedere post, storie e reel. Il nome resta visibile. Le richieste arrivano sul tuo profilo.")],
  [tk("Shop"), tk("Con un account azienda il profilo mostra la scheda Shop. I clienti ti mandano una richiesta d'ordine in chat.")],
  [tk("Aspetto"), tk("Automatico segue il tema del telefono. Chiaro e Scuro lo fissano solo per iywa.")],
  [tk("Eliminare l'account"), tk("Impostazioni → Account → Elimina account. Ti chiediamo la password per conferma.")],
];

const KINDS = [tk("Bottega artigiana"), tk("Negozio"), tk("Ristorante"), tk("Laboratorio tessile"), tk("Studio di design"), tk("Scuola e corsi"), tk("Azienda")];

const GRIDS = new Set(["saved", "liked", "archive"]);

export default function SettingPage() {
  const theme = useTheme();
  const { page } = useLocalSearchParams();
  const row = rowById(page);
  const title = row?.label ? t(row.label) : TITLES[page] ? t(TITLES[page]) : t("Impostazioni");
  if (GRIDS.has(page)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={title} border />
        {page === "saved" ? <SavedGrid /> : page === "liked" ? <LikedGrid /> : <ArchiveGrid />}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title} border />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {page === "edit" ? null : <Hero id={page === "email" || page === "password" || page === "delete" ? "login" : page} title={title} meta={HEROES[page] ? t(HEROES[page]) : HEROES[page]} />}
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
      {meta ? <T size={13.5} color={theme.text2} style={{ textAlign: "center", paddingHorizontal: 24 }}>{meta}</T> : null}
    </View>
  );
}

function Body({ page }) {
  const store = useStore();
  const prefs = store.prefs;
  const set = (patch) => { tap(); store.setPrefs(patch); };
  switch (page) {
    case "edit": return <Redirect href="/edit-profile" />;
    case "login": return <Accounts />;
    case "email": return <EmailPage />;
    case "password": return <PasswordPage />;
    case "delete": return <DeletePage />;
    case "activity": return <Activity />;
    case "notifications":
      return (
        <>
          <Kicker>{t("Notifiche push")}</Kicker>
          <Card>
            {[["likes", t("Like")], ["comments", t("Commenti")], ["follows", t("Nuovi follower")], ["messages", t("Messaggi")], ["mentions", t("Menzioni")]].map(([key, label], index) => (
              <ToggleRow key={key} first={index === 0} on={prefs.notes[key]} label={label} onPress={() => set({ notes: { [key]: !prefs.notes[key] } })} />
            ))}
          </Card>
        </>
      );
    case "time":
      return (
        <>
          <Today />
          <Week />
          <Kicker>{t("Limite giornaliero")}</Kicker>
          <ChoiceList value={prefs.timeLimit} onPick={(timeLimit) => set({ timeLimit })} options={[
            { id: "off", label: t("Spento") }, { id: "30", label: t("{n} minuti", { n: 30 }) }, { id: "45", label: t("{n} minuti", { n: 45 }) }, { id: "60", label: t("1 ora") },
          ]} />
        </>
      );
    case "privacy": return <Privacy />;
    case "close": return <People listKey="closeFriends" note={t("Le storie che condividi con gli amici più stretti hanno l'anello verde e le vedono solo loro.")} />;
    case "blocked": return <People listKey="blocked" note={t("Non vedi i post, i reel e i pensieri degli account bloccati.")} />;
    case "muted": return <People listKey="muted" note={t("I post degli account silenziati escono dal tuo feed. Non lo sapranno.")} />;
    case "restricted": return <People listKey="restricted" note={t("I commenti di chi limiti restano visibili solo a te.")} />;
    case "messages":
      return (
        <>
          <Kicker>{t("Richieste di messaggio")}</Kicker>
          <ChoiceList value={prefs.messages} options={audience()} onPick={(messages) => set({ messages })} />
          <Kicker>{t("Risposte alle storie")}</Kicker>
          <ChoiceList value={prefs.storyReplies} options={audience()} onPick={(storyReplies) => set({ storyReplies })} />
          <Kicker>{t("Attività")}</Kicker>
          <Card>
            <ToggleRow first on={prefs.activity} label={t("Stato attività")} meta={t("Il pallino attivo, da entrambe le parti.")} onPress={() => set({ activity: !prefs.activity })} />
            <ToggleRow on={prefs.readReceipts} label={t("Conferme di lettura")} meta={t("Visto, da entrambe le parti.")} onPress={() => set({ readReceipts: !prefs.readReceipts })} />
          </Card>
        </>
      );
    case "tags":
      return (
        <>
          <Kicker>{t("Tag")}</Kicker>
          <ChoiceList value={prefs.tags} options={audience()} onPick={(tags) => set({ tags })} />
          <Kicker>{t("Menzioni")}</Kicker>
          <ChoiceList value={prefs.mentions} options={audience()} onPick={(mentions) => set({ mentions })} />
        </>
      );
    case "comments":
      return (
        <>
          <Kicker>{t("Chi può commentare")}</Kicker>
          <ChoiceList value={prefs.comments} options={audience()} onPick={(comments) => set({ comments })} />
        </>
      );
    case "words": return <Words />;
    case "content":
      return (
        <>
          <Kicker>{t("Contenuti sensibili")}</Kicker>
          <ChoiceList value={prefs.sensitive} onPick={(sensitive) => set({ sensitive })} options={[
            { id: "less", label: t("Meno") }, { id: "standard", label: t("Standard") }, { id: "more", label: t("Più") },
          ]} />
          <Kicker>{t("Feed")}</Kicker>
          <Card>
            <ToggleRow first on={prefs.likeCounts} label={t("Conteggi di like e condivisioni")} meta={t("I numeri su post e reel.")} onPress={() => set({ likeCounts: !prefs.likeCounts })} />
            <ToggleRow on={prefs.suggested} label={t("Contenuti suggeriti")} meta={t("Nuove persone in Home.")} onPress={() => set({ suggested: !prefs.suggested })} />
          </Card>
        </>
      );
    case "theme":
      return (
        <>
          <Kicker>{t("Aspetto")}</Kicker>
          <ChoiceList value={prefs.appearance} onPick={(appearance) => set({ appearance })} options={[
            { id: "auto", label: t("Automatico"), meta: t("Segue il tema del telefono") }, { id: "light", label: t("Chiaro") }, { id: "dark", label: t("Scuro") },
          ]} />
          <Kicker>{t("Colore principale")}</Kicker>
          <AccentPicker value={prefs.accent || "default"} onPick={(accent) => set({ accent })} />
          <Note>{t("Link, pulsanti e selezioni usano questo colore.")}</Note>
        </>
      );
    case "language":
      return (
        <LanguagePicker />
      );
    case "accessibility":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.captions} label={t("Sottotitoli")} meta={t("Mostrali sui reel.")} onPress={() => set({ captions: !prefs.captions })} />
          <ToggleRow on={prefs.altText} label={t("Testo alternativo")} meta={t("Scrivilo quando pubblichi una foto.")} onPress={() => set({ altText: !prefs.altText })} />
        </Card>
      );
    case "data":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.dataSaver} label={t("Risparmio dati")} meta={t("Carica foto più leggere.")} onPress={() => set({ dataSaver: !prefs.dataSaver })} />
        </Card>
      );
    case "account-type": return <Business />;
    case "payments": return <Payments />;
    case "help": return <Help />;
    case "privacy-policy":
    case "terms":
      return <Legal sections={LEGAL[page].map(([h, p]) => [t(h), t(p)])} />;
    case "about":
      return <Legal sections={[["iywa", t("Un telefono per il laboratorio. Post, storie, reel, messaggi e shop.")], [t("Versione"), t("{version} · iOS e Android", { version: Constants.expoConfig?.version || "1.0.0" })]]} />;
    default:
      return <Empty title={t("Pagina non trovata")} text={t("Torna alle impostazioni.")} />;
  }
}

function LanguagePicker() {
  const store = useStore();
  const choice = store.prefs.language || "auto";
  const device = LANGS.find((lang) => lang.id === deviceLanguage());
  function pick(id) {
    tap();
    const next = resolveLanguage(id);
    store.setPrefs({ language: id });
    setLanguage(next);
    if (applyDirection(next)) {
      Alert.alert(t("Riavvia iywa"), t("Chiudi e riapri l'app per completare il cambio di lingua."));
    }
  }
  return (
    <>
      <Kicker>{t("Lingua")}</Kicker>
      <ChoiceList value={choice} onPick={pick} options={[
        { id: "auto", label: t("Lingua del telefono"), meta: device ? `${device.label} · ${t("Automatico")}` : t("Automatico") },
        ...LANGS.map((lang) => ({ id: lang.id, label: lang.label, meta: lang.en })),
      ]} />
      <Note>{t("iywa usa la lingua del telefono finché non ne scegli un'altra.")}</Note>
    </>
  );
}

function Note({ children, color }) {
  const theme = useTheme();
  return <T size={13} color={color || theme.text2} style={{ paddingHorizontal: INSET + 4, paddingTop: 10, lineHeight: 18 }}>{children}</T>;
}

// Today's minutes on iywa, counted by ui/time-limit.js.
function Today() {
  const theme = useTheme();
  const usage = useUsage();
  const limit = Number(useStore().prefs.timeLimit);
  const used = todayMinutes(usage);
  return (
    <View style={{ alignItems: "center", paddingTop: 12 }}>
      <T size={34} weight="800">{t("{n} min", { n: used })}</T>
      <T size={13} color={theme.text2}>{limit ? t("Oggi · limite {n} min", { n: limit }) : t("Oggi")}</T>
    </View>
  );
}

// The last seven days, today on the right in the accent colour.
function Week() {
  const theme = useTheme();
  const week = usageWeek(useUsage());
  const top = Math.max(1, ...week.map((entry) => entry.minutes));
  return (
    <Card style={{ marginTop: 14, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 96, gap: 10 }}>
        {week.map((entry, index) => (
          <View key={entry.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }} accessibilityLabel={t("{n} min", { n: entry.minutes })}>
            <View style={{ width: "100%", height: Math.max(4, Math.round((entry.minutes / top) * 96)), borderRadius: 6, backgroundColor: index === week.length - 1 ? theme.blue : theme.text3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        {week.map((entry) => <T key={entry.day} size={11} color={theme.text2} style={{ flex: 1, textAlign: "center" }}>{weekdayLetter(entry.weekday)}</T>)}
      </View>
    </Card>
  );
}

function Activity() {
  const theme = useTheme();
  const store = useStore();
  const me = useMe();
  const usage = useUsage();
  const week = usageWeek(usage);
  const counted = week.filter((entry) => entry.minutes > 0);
  const avg = counted.length ? Math.round(counted.reduce((sum, entry) => sum + entry.minutes, 0) / counted.length) : 0;
  const recent = store.recentSearches || [];
  return (
    <>
      <View style={{ alignItems: "center", paddingTop: 12 }}>
        <T size={34} weight="800">{t("{n} min", { n: avg })}</T>
        <T size={13} color={theme.text2}>{t("Media giornaliera questa settimana")}</T>
        <T size={13} color={theme.text2} style={{ marginTop: 2 }}>{t("{n} minuti oggi", { n: todayMinutes(usage) })}</T>
      </View>
      <Week />
      <Kicker>{t("Interazioni")}</Kicker>
      <Card>
        <Row first label={t("Mi piace")} meta={t("Post e reel a cui hai messo mi piace")} onPress={() => router.push("/settings/liked")} />
        <Row label={t("Salvati")} onPress={() => router.push("/settings/saved")} />
        <Row label={t("Persone che segui")} value={String(me?.following || 0)} onPress={() => router.push("/people/following")} />
        <Row label={t("Archivio")} onPress={() => router.push("/settings/archive")} />
      </Card>
      <Kicker>{t("Ricerche")}</Kicker>
      <Card>
        <Row
          first
          label={t("Cronologia di ricerca")}
          meta={recent.length ? recent.slice(0, 3).map((item) => item.label || item.key).filter(Boolean).join(", ") : t("Vuota")}
          right={recent.length ? <T size={14} weight="600" color={theme.blue}>{t("Cancella")}</T> : null}
          onPress={recent.length ? () => store.forgetSearch() : undefined}
        />
      </Card>
    </>
  );
}

// Close friends, blocked, muted, restricted: people by handle, kept on this phone.
function People({ listKey, note }) {
  const theme = useTheme();
  const store = useStore();
  const list = store.prefs[listKey] || [];
  const [query, setQuery] = useState("");
  const [needle, setNeedle] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setNeedle(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const search = useSearch(needle);
  const results = (search.data?.people || []).filter((person) => person.handle !== store.auth?.handle);
  const toggle = (handle) => { tap(); store.setPrefs({ [listKey]: list.includes(handle) ? list.filter((item) => item !== handle) : [...list, handle] }); };
  return (
    <>
      <View style={[styles.input, { backgroundColor: theme.fill }]}>
        <Search size={17} color={theme.text2} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t("Cerca persone")} placeholderTextColor={theme.text2} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, fontSize: 15.5, color: theme.text }} returnKeyType="search" />
      </View>
      {needle ? (
        <>
          <Kicker>{t("Risultati")}</Kicker>
          <Card>
            {search.loading && !results.length ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={theme.text2} /></View> : null}
            {!search.loading && !results.length ? <T size={14} color={theme.text2} style={{ padding: 16 }}>{t("Nessun account trovato.")}</T> : null}
            {results.map((person, index) => (
              <Row key={person.handle} first={index === 0} icon={<Face src={person.avatar} name={person.name || person.handle} size={40} />} label={person.handle} meta={person.name} right={<Pick on={list.includes(person.handle)} />} onPress={() => toggle(person.handle)} />
            ))}
          </Card>
        </>
      ) : null}
      <Kicker>{list.length ? t("{n} selezionati", { n: list.length }) : t("Nessuno selezionato")}</Kicker>
      {list.length ? (
        <Card>
          {list.map((handle, index) => <PersonRow key={handle} handle={handle} first={index === 0} onPress={() => toggle(handle)} />)}
        </Card>
      ) : null}
      {note ? <Note>{note}</Note> : null}
    </>
  );
}

function PersonRow({ handle, first, onPress }) {
  const { data } = useProfile(handle);
  return <Row first={first} icon={<Face src={data?.avatar} name={data?.name || handle} size={40} />} label={handle} meta={data?.name} right={<Pick on />} onPress={onPress} />;
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
        <TextInput value={word} onChangeText={setWord} onSubmitEditing={add} placeholder={t("Aggiungi una parola")} placeholderTextColor={theme.text2} style={{ flex: 1, fontSize: 15.5, color: theme.text }} autoCapitalize="none" returnKeyType="done" />
        <Pressable onPress={add} hitSlop={8} style={[styles.add, { backgroundColor: word.trim() ? theme.blue : theme.text3 }]}><Plus size={16} weight="bold" color="#fff" /></Pressable>
      </View>
      <Note>{t("I commenti e le richieste con queste parole restano nascosti. Tocca una parola per toglierla.")}</Note>
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

// ---------------------------------------------------------------------------
// Saved, liked and archived posts: server grids with refresh and infinite scroll.
// ---------------------------------------------------------------------------
function Tile({ item, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {item.image ? (
        <Image source={{ uri: item.image }} recyclingKey={item.image} style={{ width: CELL, height: CELL * 1.33, backgroundColor: theme.fill }} contentFit="cover" transition={150} />
      ) : (
        <View style={{ width: CELL, height: CELL * 1.33, backgroundColor: theme.card, padding: 10, justifyContent: "space-between" }}>
          <T size={13} lines={6} style={{ lineHeight: 18 }}>{item.text}</T>
          {item.name ? <T size={11} weight="600" color={theme.text2} lines={1}>{item.name}</T> : null}
        </View>
      )}
    </Pressable>
  );
}

function PostGrid({ list, empty, onPick, head }) {
  const theme = useTheme();
  const cards = list.items.map(postCard);
  return (
    <FlatList
      data={cards}
      numColumns={3}
      keyExtractor={(item) => item.id}
      columnWrapperStyle={{ gap: 1 }}
      contentContainerStyle={{ gap: 1, paddingTop: 1, paddingBottom: 40 }}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.more}
      onEndReachedThreshold={0.6}
      ListHeaderComponent={head}
      ListEmptyComponent={
        list.loading ? <View style={{ paddingVertical: 50 }}><ActivityIndicator color={theme.text2} /></View>
          : list.error ? (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 50 }}>
              <T size={14} color={theme.text2}>{errorText(list.error, t)}</T>
              <Btn title={t("Riprova")} height={32} onPress={list.refresh} />
            </View>
          ) : empty
      }
      ListFooterComponent={list.moreLoading ? <View style={{ paddingVertical: 18 }}><ActivityIndicator color={theme.text2} /></View> : null}
      renderItem={({ item }) => <Tile item={item} onPress={() => { tap(); onPick(item, cards); }} />}
    />
  );
}

function SavedGrid() {
  const list = useSavedPosts();
  return (
    <PostGrid
      list={list}
      empty={<Empty icon={Bookmark} title={t("Niente qui")} text={t("Salva un post dal feed: lo ritrovi qui. Solo tu vedi cosa hai salvato.")} />}
      onPick={(item, cards) => openGridItem(item, cards, t("Salvati"))}
    />
  );
}

function LikedGrid() {
  const list = useLikedPosts();
  return (
    <PostGrid
      list={list}
      empty={<Empty icon={Heart} title={t("Niente qui")} text={t("I post a cui metti mi piace appaiono qui.")} />}
      onPick={(item, cards) => openGridItem(item, cards, t("Mi piace"))}
    />
  );
}

// Archived posts: tap one to put it back on the profile.
function ArchiveGrid() {
  const theme = useTheme();
  const me = useMe();
  const list = useUserPosts(me?.handle || null, "archived");
  function pick(item, cards) {
    Alert.alert(t("Post archiviato"), t("Solo tu lo vedi. Ripristinalo per rimetterlo sul profilo."), [
      {
        text: t("Ripristina"),
        onPress: () => {
          tap();
          editPost(item.id, { archived: false }).then(() => list.refresh()).catch((err) => Alert.alert(errorText(err, t)));
        },
      },
      { text: t("Apri"), onPress: () => openGridItem(item, cards, t("Archivio")) },
      { text: t("Annulla"), style: "cancel" },
    ]);
  }
  return (
    <PostGrid
      list={list}
      head={list.items.length ? <T size={13} color={theme.text2} style={{ padding: 12, paddingHorizontal: INSET + 4 }}>{t("Tocca un post per ripristinarlo sul profilo.")}</T> : null}
      empty={<Empty icon={Archive} title={t("Niente qui")} text={t("I post che archivi aspettano qui.")} />}
      onPick={pick}
    />
  );
}

function AccentPicker({ value, onPick }) {
  const theme = useTheme();
  return (
    <Card style={{ flexDirection: "row", flexWrap: "wrap", paddingVertical: 12, paddingHorizontal: 6 }}>
      {ACCENTS.map((accent) => {
        const on = value === accent.id;
        return (
          <Pressable key={accent.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onPick(accent.id)} style={{ width: "20%", alignItems: "center", paddingVertical: 8, gap: 6 }}>
            <View style={[styles.swatch, { backgroundColor: accent.color, borderColor: on ? theme.text : "transparent" }]}>
              {on ? <Check size={18} weight="bold" color={accent.ink} /> : null}
            </View>
            <T size={11.5} weight={on ? "700" : "400"} color={on ? theme.text : theme.text2} lines={1}>{accent.id === "space" ? accent.label : t(accent.label)}</T>
          </Pressable>
        );
      })}
    </Card>
  );
}

function Field({ label, value, onChange, max, multiline, prefix, lower, first, secure, keyboardType, onBlur }) {
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
          onBlur={onBlur}
          maxLength={max}
          multiline={multiline}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          accessibilityLabel={label}
          autoCapitalize={lower || secure ? "none" : "sentences"}
          autoCorrect={!lower && !secure}
          style={{ flex: 1, fontSize: 15.5, color: theme.text, minHeight: multiline ? 66 : undefined, padding: 0 }}
        />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Account: accounts on this phone, email, password, privacy, sign out, delete.
// ---------------------------------------------------------------------------
function Accounts() {
  const theme = useTheme();
  const session = useSession();
  const me = session.me;
  const [switching, setSwitching] = useState(null);

  async function pick(user) {
    setSwitching(user.handle);
    const ok = user.token ? await switchAccount(user.handle) : false;
    setSwitching(null);
    if (ok) { router.dismissAll(); router.replace("/"); } else router.push("/auth");
  }

  return (
    <>
      <Kicker>{t("Il tuo account")}</Kicker>
      <Card>
        <Row first label={t("Email")} value={me?.email || ""} onPress={() => router.push("/settings/email")} />
        <Row label={t("Password")} meta={t("Cambia la password")} onPress={() => router.push("/settings/password")} />
        <Row label={t("Privacy dell'account")} value={me?.private ? t("Privato") : t("Pubblico")} onPress={() => router.push("/settings/privacy")} />
        <Row label={t("Tipo di account e shop")} value={me?.kind === "business" ? t("Azienda") : t("Personale")} onPress={() => router.push("/settings/account-type")} />
      </Card>
      <Kicker>{t("Account su questo telefono")}</Kicker>
      <Card>
        {(session.accounts || []).map((user, index) => {
          const on = user.handle === me?.handle;
          return (
            <Row
              key={user.handle}
              first={index === 0}
              icon={<Face src={on ? me?.avatar : user.avatar} name={user.name || user.handle} size={40} />}
              label={user.name || user.handle}
              meta={on ? t("@{handle} · in uso", { handle: user.handle }) : user.token ? `@${user.handle}` : t("@{handle} · accedi di nuovo", { handle: user.handle })}
              right={switching === user.handle ? <ActivityIndicator color={theme.text2} /> : <Pick on={on} />}
              onPress={on || switching ? undefined : () => pick(user)}
            />
          );
        })}
        <Row icon={<View style={[styles.plus, { borderColor: theme.text3 }]}><Plus size={18} weight="bold" color={theme.text} /></View>} label={t("Aggiungi account")} onPress={() => router.push("/auth")} />
      </Card>
      <Note>{t("Cambiando account resti connesso a tutti gli account di questo telefono.")}</Note>
      <Card style={{ marginTop: 22 }}>
        <Pressable
          onPress={() => Alert.alert(t("Uscire?"), t("Puoi rientrare quando vuoi."), [
            { text: t("Annulla"), style: "cancel" },
            { text: t("Esci"), style: "destructive", onPress: () => { router.dismissAll(); signOut(); } },
          ])}
          style={({ pressed }) => [styles.center, pressed ? { backgroundColor: theme.fill } : null]}
        >
          <T size={15.5} weight="600" color={theme.blue}>{t("Esci da @{handle}", { handle: me?.handle || "" })}</T>
        </Pressable>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Pressable onPress={() => router.push("/settings/delete")} style={({ pressed }) => [styles.center, pressed ? { backgroundColor: theme.fill } : null]}>
          <T size={15.5} color={theme.red}>{t("Elimina account")}</T>
        </Pressable>
      </Card>
    </>
  );
}

function SaveButton({ title, busy, disabled, onPress, danger }) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled || busy}
      onPress={() => { tap("medium"); onPress(); }}
      style={({ pressed }) => [styles.save, { backgroundColor: danger ? theme.red : theme.blue, opacity: disabled ? 0.4 : pressed || busy ? 0.7 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <T size={15.5} weight="600" color={danger ? "#fff" : theme.accentInk || "#fff"}>{title}</T>}
    </Pressable>
  );
}

function EmailPage() {
  const theme = useTheme();
  const me = useMe();
  const [email, setEmail] = useState(me?.email || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const next = email.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await changeEmail(next);
      setDone(true);
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Kicker>{t("Email")}</Kicker>
      <Card>
        <Field first label={t("Email")} value={email} onChange={(value) => { setEmail(value); setDone(false); setError(""); }} max={120} lower keyboardType="email-address" />
      </Card>
      {error ? <Note color={theme.red}>{error}</Note> : done ? <Note>{t("Email aggiornata.")}</Note> : <Note>{t("La usi per accedere. Non è visibile sul profilo.")}</Note>}
      <View style={{ paddingHorizontal: INSET, paddingTop: 18 }}>
        <SaveButton title={t("Salva")} busy={busy} disabled={!valid || next === (me?.email || "")} onPress={save} />
      </View>
    </>
  );
}

function PasswordPage() {
  const theme = useTheme();
  const [form, setForm] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (key) => (value) => { setForm((prev) => ({ ...prev, [key]: value })); setError(""); setDone(false); };
  const problem = form.next && form.next.length < 6
    ? t("La password deve avere almeno 6 caratteri.")
    : form.again && form.again !== form.next ? t("Le due password non coincidono.") : "";
  const ready = form.current && form.next.length >= 6 && form.again === form.next;
  async function save() {
    setBusy(true);
    setError("");
    try {
      await changePassword(form.current, form.next);
      setForm({ current: "", next: "", again: "" });
      setDone(true);
    } catch (err) {
      setError(err?.code === "password" ? t("La password attuale non è corretta.") : errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Kicker>{t("Password")}</Kicker>
      <Card>
        <Field first label={t("Attuale")} value={form.current} onChange={set("current")} max={200} secure />
        <Field label={t("Nuova")} value={form.next} onChange={set("next")} max={200} secure />
        <Field label={t("Ripeti")} value={form.again} onChange={set("again")} max={200} secure />
      </Card>
      {error || problem ? <Note color={theme.red}>{error || problem}</Note> : done ? <Note>{t("Password aggiornata.")}</Note> : null}
      <View style={{ paddingHorizontal: INSET, paddingTop: 18 }}>
        <SaveButton title={t("Cambia password")} busy={busy} disabled={!ready} onPress={save} />
      </View>
    </>
  );
}

// Account deletion (required by the App Store): confirm, then the password.
function DeletePage() {
  const theme = useTheme();
  const me = useMe();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function ask() {
    Alert.alert(t("Eliminare @{handle}?", { handle: me?.handle || "" }), t("Profilo, post, storie, commenti e messaggi vengono cancellati per sempre. Non si può annullare."), [
      { text: t("Annulla"), style: "cancel" },
      { text: t("Elimina"), style: "destructive", onPress: remove },
    ]);
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteAccount(password);
      // Signed out now: the sign-in screen takes over.
      if (router.canDismiss()) router.dismissAll();
    } catch (err) {
      setError(err?.code === "password" ? t("Password errata. Riprova.") : errorText(err, t));
      setBusy(false);
    }
  }
  return (
    <>
      <Card style={{ marginTop: 14, padding: 16, gap: 8 }}>
        <T size={15.5} weight="700">{t("Cosa succede")}</T>
        <T size={14} color={theme.text2} style={{ lineHeight: 20 }}>{t("Il tuo profilo @{handle}, i post, i reel, i pensieri, le storie, i commenti e i prodotti dello shop vengono eliminati. Chi ti segue non ti vedrà più.", { handle: me?.handle || "" })}</T>
      </Card>
      <Kicker>{t("Conferma con la password")}</Kicker>
      <Card>
        <Field first label={t("Password")} value={password} onChange={(value) => { setPassword(value); setError(""); }} max={200} secure />
      </Card>
      {error ? <Note color={theme.red}>{error}</Note> : null}
      <View style={{ paddingHorizontal: INSET, paddingTop: 18 }}>
        <SaveButton title={t("Elimina account")} danger busy={busy} disabled={!password} onPress={ask} />
      </View>
    </>
  );
}

function Privacy() {
  const theme = useTheme();
  const store = useStore();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = Boolean(me?.private);
  async function flip() {
    if (busy) return;
    tap();
    setBusy(true);
    setError("");
    try {
      await updateMe({ private: !on });
      store.setPrefs({ private: !on });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Card style={{ marginTop: 14 }}>
        <ToggleRow first on={on} label={t("Account privato")} meta={t("Solo chi approvi vede post, storie e reel.")} onPress={flip} />
        {on ? <Row label={t("Richieste di follow")} onPress={() => router.push("/people/requests")} /> : null}
      </Card>
      {error ? <Note color={theme.red}>{error}</Note> : <Note>{on ? t("Chi ti segue già continua a vederti. Le nuove richieste aspettano la tua conferma.") : t("Se torni pubblico, le richieste in attesa vengono accettate.")}</Note>}
    </>
  );
}

function Business() {
  const theme = useTheme();
  const me = useMe();
  const kind = me?.kind === "business" ? "business" : "personal";
  const [biz, setBiz] = useState(() => ({ ...BUSINESS, ...(me?.business || {}), hours: { ...BUSINESS.hours, ...(me?.business?.hours || {}) } }));
  const [error, setError] = useState("");
  const pending = useRef(null);
  const timer = useRef(0);
  const types = [
    { id: "personal", icon: User, tone: "#8e8e93", label: t("Personale"), meta: t("Per condividere con amici e follower.") },
    { id: "business", icon: Store, tone: "#0a84ff", label: t("Azienda / Bottega"), meta: t("Shop, orari, contatti e la scheda Shop.") },
  ];
  const days = [1, 2, 3, 4, 5, 6, 0].map((day) => [day, weekdayLetter(day)]);

  // Business details are saved a moment after the last change, not on every key.
  function flush() {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (next) updateMe({ business: next }).catch((err) => setError(errorText(err, t)));
  }
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (change) => {
    setError("");
    setBiz((prev) => {
      const next = { ...prev, ...change };
      pending.current = next;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
      return next;
    });
  };
  function pickKind(id) {
    if (id === kind) return;
    tap();
    updateMe(id === "business" ? { kind: id, business: biz } : { kind: id }).catch((err) => setError(errorText(err, t)));
  }
  return (
    <>
      <Kicker>{t("Tipo di account")}</Kicker>
      <Card>
        {types.map((type, index) => (
          <Row
            key={type.id}
            first={index === 0}
            icon={<View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: type.tone, alignItems: "center", justifyContent: "center" }}><type.icon size={18} weight="fill" color="#fff" /></View>}
            label={type.label}
            meta={type.meta}
            right={<Pick on={kind === type.id} />}
            onPress={() => pickKind(type.id)}
          />
        ))}
      </Card>
      {error ? <Note color={theme.red}>{error}</Note> : null}
      {kind === "business" ? (
        <>
          <Kicker>{t("La tua attività")}</Kicker>
          <Card>
            <Field first label={t("Nome")} value={biz.title} onChange={(title) => patch({ title })} onBlur={flush} max={40} />
            <Field label={t("Indirizzo")} value={biz.address} onChange={(address) => patch({ address })} onBlur={flush} max={60} />
            <Field label={t("Città")} value={biz.city} onChange={(city) => patch({ city })} onBlur={flush} max={40} />
            <Field label={t("Telefono")} value={biz.phone} onChange={(phone) => patch({ phone })} onBlur={flush} max={24} lower keyboardType="phone-pad" />
            <Field label={t("Email")} value={biz.email} onChange={(email) => patch({ email })} onBlur={flush} max={60} lower keyboardType="email-address" />
          </Card>
          <Kicker>{t("Categoria")}</Kicker>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: INSET }}>
            {KINDS.map((item) => {
              const on = biz.category === t(item);
              return (
                <Pressable key={item} onPress={() => { tap(); patch({ category: on ? "" : t(item) }); }} style={[styles.word, { backgroundColor: on ? theme.text : theme.fill }]}>
                  <T size={14} weight="600" color={on ? theme.bg : theme.text}>{t(item)}</T>
                </Pressable>
              );
            })}
          </View>
          <Kicker>{t("Orari di apertura")}</Kicker>
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
            <T size={14} color={theme.text2}>{biz.hours.days.length ? t("Aperto {open}–{close}", { open: biz.hours.open, close: biz.hours.close }) : t("Chiuso tutta la settimana")}</T>
          </Card>
          {biz.hours.days.length ? (
            <Card style={{ marginTop: 10 }}>
              <HourRow first label={t("Apre")} value={biz.hours.open} onChange={(open) => patch({ hours: { ...biz.hours, open } })} />
              <HourRow label={t("Chiude")} value={biz.hours.close} onChange={(close) => patch({ hours: { ...biz.hours, close } })} />
            </Card>
          ) : null}
          <Card style={{ marginTop: 14 }}>
            <ToggleRow first on={biz.shop !== false} label={t("Mostra lo shop sul profilo")} meta={t("Una scheda Shop con i tuoi prodotti.")} onPress={() => { tap(); patch({ shop: biz.shop === false }); }} />
          </Card>
          <Note>{t("Il profilo mostra contatti, orari e la scheda Shop. I clienti ti mandano le richieste d'ordine in chat.")}</Note>
        </>
      ) : null}
    </>
  );
}

// "HH:MM" moved by half an hour, wrapping round midnight.
function shiftTime(value, delta) {
  const [h, m] = String(value || "09:00").split(":").map((part) => Number(part) || 0);
  const total = (((h * 60 + m + delta) % 1440) + 1440) % 1440;
  const step = Math.round(total / 30) * 30 % 1440;
  return `${String(Math.floor(step / 60)).padStart(2, "0")}:${String(step % 60).padStart(2, "0")}`;
}

function HourRow({ label, value, onChange, first }) {
  const theme = useTheme();
  const step = (delta) => { tap(); onChange(shiftTime(value, delta)); };
  return (
    <>
      {first ? null : <Divider />}
      <View style={[styles.field, { paddingVertical: 10 }]}>
        <T size={15} style={{ flex: 1 }}>{label}</T>
        <Pressable onPress={() => step(-30)} hitSlop={6} accessibilityLabel={t("{label}: 30 minuti prima", { label })} style={[styles.step, { backgroundColor: theme.fill }]}><Minus size={15} weight="bold" color={theme.text} /></Pressable>
        <T size={16} weight="600" style={{ width: 64, textAlign: "center", fontVariant: ["tabular-nums"] }}>{value}</T>
        <Pressable onPress={() => step(30)} hitSlop={6} accessibilityLabel={t("{label}: 30 minuti dopo", { label })} style={[styles.step, { backgroundColor: theme.fill }]}><Plus size={15} weight="bold" color={theme.text} /></Pressable>
      </View>
    </>
  );
}

function Payments() {
  const theme = useTheme();
  const store = useStore();
  const business = store.accountType === "business";
  return (
    <>
      <Kicker>{t("Come vendi oggi")}</Kicker>
      <Card>
        <Row first label={t("Richiesta d'ordine in chat")} meta={t("Il cliente sceglie, tu confermi e concordi il pagamento.")} right={<Pick on />} />
        <Row label={t("Pagamento con carta")} meta={t("Con Stripe, da Pagamenti.")} onPress={() => router.push("/payments")} />
      </Card>
      <Note>{business ? t("Gli ordini ricevuti e quelli fatti sono in Ordini.") : t("Per vendere passa a un account Azienda in Tipo di account e shop.")}</Note>
      <View style={{ paddingHorizontal: INSET, paddingTop: 18, gap: 10 }}>
        <Btn title={t("Vedi gli ordini")} height={44} onPress={() => router.push("/shop/orders")} />
        {business ? null : <Btn title={t("Passa ad Azienda")} kind="primary" height={44} onPress={() => router.replace("/settings/account-type")} />}
      </View>
      <T size={12} color={theme.text3} style={{ textAlign: "center", marginTop: 16 }}>{t("Nessun dato della carta passa da iywa.")}</T>
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
            <T size={15.5} weight={open === label ? "600" : "400"}>{t(label)}</T>
            {open === label ? <T size={14} color={theme.text2} style={{ lineHeight: 20 }}>{t(text)}</T> : null}
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
  step: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  center: { height: 50, alignItems: "center", justifyContent: "center" },
  save: { height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
