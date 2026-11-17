import { useState } from "react";
import { Alert, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import Constants from "expo-constants";
import { ACCENTS, INSET, useTheme } from "../../theme";
import { ALL_THOUGHTS, resolveSaved, savedSnapshot, usageWeek, useStore, useUsage } from "../../lib/store";
import { openTab } from "../../lib/tabs";
import { todayMinutes } from "../../ui/time-limit";
import { LANGS, applyDirection, deviceLanguage, resolveLanguage, setLanguage, t, tk, weekdayLetter } from "../../lib/i18n";
import { CONTACTS, POSTS, REELS, avatarFor } from "../../data";
import { Archive, Bookmark, Check, Minus, Plus, Star, Store, User } from "../../ui/icons";
import { Avatar, Btn, Empty, Header, T, tap } from "../../ui/kit";
import { Card, ChoiceList, Divider, Kicker, Pick, Row, SettingIcon, ToggleRow, rowById } from "../../ui/settings";

const W = Dimensions.get("window").width;
const CELL = (W - 2) / 3;

const AUDIENCE = [
  { id: "everyone", label: tk("Tutti") },
  { id: "following", label: tk("Persone che segui") },
  { id: "off", label: tk("Nessuno") },
];

const audience = () => AUDIENCE.map((option) => ({ ...option, label: t(option.label) }));

const HEROES = {
  edit: tk("Come ti vedono gli altri"),
  login: tk("Su questo telefono"),
  saved: tk("Solo tu li vedi"),
  archive: tk("Nascosti dal profilo"),
  activity: tk("Su questo telefono"),
  notifications: tk("Cosa può raggiungerti"),
  time: tk("Un promemoria al giorno"),
  privacy: tk("Chi vede i tuoi post"),
  close: tk("Anello verde sulle storie"),
  blocked: tk("Non possono trovarti"),
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
  "privacy-policy": "iywa",
  terms: "iywa",
  about: "iywa",
};

const LEGAL = {
  "privacy-policy": [
    [tk("Cosa conserva iywa"), tk("Nome, handle, bio, i post che pubblichi in questa anteprima e le preferenze su questo telefono.")],
    [tk("Chi ti vede"), tk("Un account privato nasconde post, reel e storie a chi non hai approvato. Nome, foto e bio restano visibili.")],
    [tk("Messaggi"), tk("Stato attività e conferme di lettura seguono gli interruttori in Impostazioni. Se li spegni, si nascondono da entrambe le parti.")],
    [tk("Le tue scelte"), tk("Account silenziati, bloccati e parole nascoste restano sul telefono finché non li cancelli.")],
  ],
  terms: [
    [tk("L'anteprima"), tk("iywa è una demo privata. Post, chat e account che aggiungi vivono su questo telefono.")],
    [tk("I tuoi contenuti"), tk("Le didascalie che scrivi restano tue. Non pubblicare ciò che non hai diritto di condividere.")],
    [tk("Le altre persone"), tk("Bloccare, limitare e silenziare cambia ciò che vedi in questa anteprima.")],
    [tk("Modifiche"), tk("Questi termini descrivono l'anteprima di oggi. L'app può cambiare mentre la demo cresce.")],
  ],
};

const HELP = [
  [tk("Account privato"), tk("Chi non hai approvato smette di vedere post, storie e reel. Il nome resta visibile.")],
  [tk("Shop"), tk("Con un account azienda il profilo mostra la scheda Shop. I clienti ti mandano una richiesta d'ordine in chat.")],
  [tk("Aspetto"), tk("Automatico segue il tema del telefono. Chiaro e Scuro lo fissano solo per iywa.")],
  [tk("I miei dati"), tk("Like, carrello, messaggi e impostazioni restano su questo telefono. Azzera i dati li riporta all'inizio.")],
];

const KINDS = [tk("Bottega artigiana"), tk("Negozio"), tk("Ristorante"), tk("Laboratorio tessile"), tk("Studio di design"), tk("Scuola e corsi"), tk("Azienda")];

export default function SettingPage() {
  const theme = useTheme();
  const { page } = useLocalSearchParams();
  const row = rowById(page);
  const title = row?.label ? t(row.label) : t("Impostazioni");
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={title} border />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {page === "saved" || page === "edit" ? null : <Hero id={page} title={title} meta={HEROES[page] ? t(HEROES[page]) : HEROES[page]} />}
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
    case "edit": return <Redirect href="/edit-profile" />;
    case "login": return <Accounts />;
    case "saved": return <Saved />;
    case "archive": return <ArchiveGrid />;
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
    case "privacy":
      return (
        <Card style={{ marginTop: 14 }}>
          <ToggleRow first on={prefs.private} label={t("Account privato")} meta={t("Solo chi approvi vede post, storie e reel.")} onPress={() => set({ private: !prefs.private })} />
        </Card>
      );
    case "close": return <People list={prefs.closeFriends} onChange={(closeFriends) => set({ closeFriends })} />;
    case "blocked": return <People list={prefs.blocked} onChange={(blocked) => set({ blocked })} />;
    case "muted": return <People list={prefs.muted} onChange={(muted) => set({ muted })} />;
    case "restricted": return <People list={prefs.restricted} onChange={(restricted) => set({ restricted })} />;
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

function Note({ children }) {
  const theme = useTheme();
  return <T size={13} color={theme.text2} style={{ paddingHorizontal: INSET + 4, paddingTop: 10, lineHeight: 18 }}>{children}</T>;
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
  const usage = useUsage();
  const week = usageWeek(usage);
  const counted = week.filter((entry) => entry.minutes > 0);
  const avg = counted.length ? Math.round(counted.reduce((sum, entry) => sum + entry.minutes, 0) / counted.length) : 0;
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
        <Row first label={t("Like")} value={String(store.likes.length)} />
        <Row label={t("Salvati")} value={String(store.saves.length)} onPress={() => router.push("/settings/saved")} />
        <Row label={t("Persone che segui")} value={String(store.follows.length)} />
      </Card>
      <Kicker>{t("Ricerche")}</Kicker>
      <Card>
        <Row first label={t("Cronologia di ricerca")} meta={store.prefs.searchesCleared ? t("Cancellata") : "forno, smalto, Adele"} right={store.prefs.searchesCleared ? null : <T size={14} weight="600" color={theme.blue}>{t("Cancella")}</T>} onPress={store.prefs.searchesCleared ? undefined : () => store.setPrefs({ searchesCleared: true })} />
      </Card>
    </>
  );
}

function People({ list, onChange }) {
  return (
    <>
      <Kicker>{list.length ? t("{n} selezionati", { n: list.length }) : t("Nessuno selezionato")}</Kicker>
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

// Where a saved or archived tile leads.
function openItem(item, store) {
  const reelId = item.reelId || String(item.id).replace(/^reel-/, "");
  if (item.kind === "reel" && (REELS.some((reel) => reel.id === reelId) || (store.library || []).some((post) => post.id === item.id))) {
    openTab("reels", { id: REELS.some((reel) => reel.id === reelId) ? reelId : item.id });
    return;
  }
  const thought = item.kind === "thought" && [...(store.myThoughts || []), ...ALL_THOUGHTS].some((entry) => entry.id === item.id);
  router.push(thought ? `/thought/${encodeURIComponent(item.id)}` : `/post/${encodeURIComponent(item.id)}`);
}

function Tile({ item, onPress }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={{ width: CELL, height: CELL * 1.33, backgroundColor: theme.fill }} contentFit="cover" transition={150} />
      ) : (
        <View style={{ width: CELL, height: CELL * 1.33, backgroundColor: theme.card, padding: 10, justifyContent: "space-between" }}>
          <T size={13} lines={6} style={{ lineHeight: 18 }}>{item.text}</T>
          {item.name ? <T size={11} weight="600" color={theme.text2} lines={1}>{item.name}</T> : null}
        </View>
      )}
    </Pressable>
  );
}

function Saved() {
  const store = useStore();
  // Live copy first (fresh caption and photo), then the snapshot taken when it was saved.
  const items = [...store.saves].reverse()
    .map((id) => savedSnapshot(resolveSaved(store, id)) || store.savedItems?.[id])
    .filter(Boolean);
  if (!items.length) return <Empty icon={Bookmark} title={t("Niente qui")} text={t("Salva un post dal feed: lo ritrovi qui. Solo tu vedi cosa hai salvato.")} />;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, paddingTop: 1 }}>
      {items.map((item) => <Tile key={item.id} item={item} onPress={() => { tap(); openItem(item, store); }} />)}
    </View>
  );
}

// Archived posts (web ArchiveList): tap one to put it back on the profile.
function ArchiveGrid() {
  const theme = useTheme();
  const store = useStore();
  const archived = store.archived || [];
  const seen = new Set();
  const items = [...(store.library || []), ...POSTS]
    .filter((post) => archived.includes(post.id) && !seen.has(post.id) && seen.add(post.id))
    .map((post) => savedSnapshot({ ...post, kind: post.kind || post.type || "post" }));
  if (!items.length) return <Empty icon={Archive} title={t("Niente qui")} text={t("I post che archivi aspettano qui.")} />;
  function pick(item) {
    tap();
    Alert.alert(t("Post archiviato"), t("Solo tu lo vedi. Ripristinalo per rimetterlo sul profilo."), [
      { text: t("Ripristina"), onPress: () => { tap(); store.toggleArchive(item.id); } },
      { text: t("Apri"), onPress: () => openItem(item, store) },
      { text: t("Annulla"), style: "cancel" },
    ]);
  }
  return (
    <>
      <Note>{t("Tocca un post per ripristinarlo sul profilo.")}</Note>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 1, paddingTop: 12, backgroundColor: theme.bg }}>
        {items.map((item) => <Tile key={item.id} item={item} onPress={() => pick(item)} />)}
      </View>
    </>
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
      <Kicker>{t("Account su questo telefono")}</Kicker>
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
              meta={on ? t("@{handle} · in uso", { handle: user.handle }) : `@${user.handle}`}
              right={<Pick on={on} />}
              onPress={on ? undefined : () => { store.signIn(user.handle); router.dismissAll(); router.replace("/"); }}
            />
          );
        })}
        <Row icon={<View style={[styles.plus, { borderColor: theme.text3 }]}><Plus size={18} weight="bold" color={theme.text} /></View>} label={t("Aggiungi account")} onPress={() => { router.dismissAll(); router.replace("/"); store.addAccount(); }} />
      </Card>
      <Note>{t("Cambiando account resti connesso a tutti gli account di questo telefono.")}</Note>
      <Card style={{ marginTop: 22 }}>
        <Pressable
          onPress={() => Alert.alert(t("Uscire?"), t("Puoi rientrare quando vuoi."), [
            { text: t("Annulla"), style: "cancel" },
            { text: t("Esci"), style: "destructive", onPress: () => { router.dismissAll(); router.replace("/"); store.logout(); } },
          ])}
          style={({ pressed }) => [{ height: 50, alignItems: "center", justifyContent: "center" }, pressed ? { backgroundColor: theme.fill } : null]}
        >
          <T size={15.5} weight="600" color={theme.red}>{t("Esci da @{handle}", { handle: store.auth?.handle || String(store.profile.handle).replace(/^@/, "") })}</T>
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
    { id: "personal", icon: User, tone: "#8e8e93", label: t("Personale"), meta: t("Per condividere con amici e follower.") },
    { id: "creator", icon: Star, tone: "#bf5af2", label: t("Creator"), meta: t("Per chi crea e vuole farsi conoscere.") },
    { id: "business", icon: Store, tone: "#0a84ff", label: t("Azienda / Bottega"), meta: t("Shop, orari, contatti e statistiche.") },
  ];
  const days = [1, 2, 3, 4, 5, 6, 0].map((day) => [day, weekdayLetter(day)]);
  const patch = (next) => store.setBusiness(next);
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
            right={<Pick on={store.accountType === type.id} />}
            onPress={() => store.setAccountType(type.id)}
          />
        ))}
      </Card>
      {store.accountType === "business" ? (
        <>
          <Kicker>{t("La tua attività")}</Kicker>
          <Card>
            <Field first label={t("Nome")} value={biz.title} onChange={(title) => patch({ title })} max={40} />
            <Field label={t("Indirizzo")} value={biz.address} onChange={(address) => patch({ address })} max={60} />
            <Field label={t("Città")} value={biz.city} onChange={(city) => patch({ city })} max={40} />
            <Field label={t("Telefono")} value={biz.phone} onChange={(phone) => patch({ phone })} max={24} lower />
            <Field label={t("Email")} value={biz.email} onChange={(email) => patch({ email })} max={60} lower />
          </Card>
          <Kicker>{t("Categoria")}</Kicker>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: INSET }}>
            {KINDS.map((kind) => {
              const on = biz.category === kind;
              return (
                <Pressable key={kind} onPress={() => { tap(); patch({ category: kind }); }} style={[styles.word, { backgroundColor: on ? theme.text : theme.fill }]}>
                  <T size={14} weight="600" color={on ? theme.bg : theme.text}>{t(kind)}</T>
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
        <Row label={t("Pagamento con carta")} meta={t("Con Stripe, nella versione web di iywa.")} />
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
});
