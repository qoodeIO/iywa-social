import { useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useTheme, INSET } from "../theme";
import { useStore } from "../lib/store";
import { addComment, ago, deleteComment, toggleCommentLike, useComments } from "../lib/social";
import { myHandle, useMe } from "../lib/session";
import { Close, Heart } from "./icons";
import { T, tap } from "./kit";
import { Face, MentionSuggest, Rich, failAlert, openHandle } from "./feed";
import { personHidden, textHidden } from "./feedData";
import { t } from "../lib/i18n";

export const EMOJI = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

// Comments of a post from the server, each top-level comment followed by its replies.
export function useCommentLines(postId) {
  const store = useStore();
  const prefs = store.prefs;
  const { data, loading, error, refresh } = useComments(postId);
  const lines = useMemo(() => {
    const me = myHandle();
    const visible = (data || []).filter((c) => c.author?.handle === me || (!personHidden(prefs, c.author?.handle, true) && !textHidden(prefs, c.text)));
    const ids = new Set(visible.map((c) => c.id));
    const byTime = (a, b) => a.createdAt - b.createdAt;
    const top = visible.filter((c) => !c.parent || !ids.has(c.parent)).sort(byTime);
    const out = [];
    for (const comment of top) {
      out.push({ ...comment, depth: 0 });
      for (const reply of visible.filter((c) => c.parent === comment.id).sort(byTime)) out.push({ ...reply, depth: 1 });
    }
    return out;
  }, [data, prefs]);
  return { lines, loading: loading && !data, error: data ? null : error, refresh };
}

// The caption as the first line (post page).
export function CaptionRow({ post }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => openHandle(post.owner)}>
        <Face src={post.src} name={post.name || post.owner} size={34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Rich text={post.text} prefix={<T size={14} weight="600" onPress={() => openHandle(post.owner)}>{post.owner} </T>} />
        {post.time ? <T size={12.5} color={theme.text2} style={{ marginTop: 3 }}>{post.time}</T> : null}
      </View>
    </View>
  );
}

// One comment: like, reply, and (long press) delete when it is mine or on my post.
export function CommentRow({ post, note, onReply }) {
  const theme = useTheme();
  const author = note.author || {};
  const me = myHandle();
  const canDelete = author.handle === me || post.owner === me;
  const remove = () => {
    if (!canDelete) return;
    tap("medium");
    Alert.alert(t("Eliminare il commento?"), note.depth ? undefined : t("Verranno eliminate anche le risposte."), [
      { text: t("Annulla"), style: "cancel" },
      { text: t("Elimina"), style: "destructive", onPress: () => deleteComment(post.id, note.id).catch(failAlert) },
    ]);
  };
  return (
    <Pressable onLongPress={canDelete ? remove : undefined} delayLongPress={350} style={[styles.row, note.depth ? styles.reply : null]}>
      <Pressable onPress={() => openHandle(author.handle)}>
        <Face src={author.avatar} name={author.name || author.handle} size={note.depth ? 26 : 34} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <T size={13} weight="600" onPress={() => openHandle(author.handle)}>{author.handle}</T>
          <T size={12} color={theme.text2}>{ago(note.createdAt)}</T>
          {author.handle === post.owner ? <T size={12} color={theme.text2}>{t("· Autore")}</T> : null}
        </View>
        <Rich text={note.text} />
        <View style={styles.tools}>
          {note.likes > 0 ? <T size={12.5} weight="600" color={theme.text2}>{note.likes === 1 ? t("1 Mi piace") : t("{n} Mi piace", { n: note.likes })}</T> : null}
          {onReply ? <Pressable hitSlop={6} onPress={() => onReply(note)}><T size={12.5} weight="600" color={theme.text2}>{t("Rispondi")}</T></Pressable> : null}
          {canDelete ? <Pressable hitSlop={6} onPress={remove}><T size={12.5} weight="600" color={theme.text2}>{t("Elimina")}</T></Pressable> : null}
        </View>
      </View>
      <Pressable accessibilityLabel={t("Mi piace al commento")} accessibilityState={{ selected: Boolean(note.liked) }} hitSlop={10} onPress={() => { tap(); toggleCommentLike(post.id, note).catch(failAlert); }} style={styles.like}>
        <Heart size={15} weight={note.liked ? "fill" : "regular"} color={note.liked ? theme.red : theme.text2} />
      </Pressable>
    </Pressable>
  );
}

// Footer: @ suggestions, quick emoji, my face + input + "Pubblica".
export function CommentComposer({ post, draft, setDraft, inputRef, replyTo, setReplyTo, onSent, bottom = 0 }) {
  const theme = useTheme();
  const me = useMe();
  const store = useStore();
  const [busy, setBusy] = useState(false);
  const mine = post.owner === me?.handle;
  if (post.commentsOff && !mine) {
    return (
      <View style={[styles.foot, { borderTopColor: theme.line, paddingBottom: bottom + 14 }]}>
        <T size={13} color={theme.text2} style={{ textAlign: "center", paddingTop: 4 }}>{t("I commenti sono disattivati.")}</T>
      </View>
    );
  }
  const send = () => {
    const text = draft.trim();
    if (!text || busy) return;
    if (textHidden(store.prefs, text)) {
      Alert.alert(t("Il commento contiene una parola che hai nascosto."));
      return;
    }
    tap();
    setBusy(true);
    addComment(post.id, text, replyTo?.id)
      .then(() => {
        setDraft("");
        setReplyTo?.(null);
        onSent?.();
      })
      .catch(failAlert)
      .finally(() => setBusy(false));
  };
  return (
    <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg, paddingBottom: bottom + 8 }]}>
      <MentionSuggest value={draft} onPick={(next) => { setDraft(next); inputRef.current?.focus(); }} style={{ marginHorizontal: INSET }} />
      {replyTo ? (
        <View style={[styles.replying, { backgroundColor: theme.fill }]}>
          <T size={13} color={theme.text2} style={{ flex: 1 }}>{t("Rispondi a {name}", { name: replyTo.handle })}</T>
          <Pressable accessibilityLabel={t("Annulla")} hitSlop={8} onPress={() => { setReplyTo?.(null); setDraft(""); }}>
            <Close size={16} color={theme.text2} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.emoji}>
        {EMOJI.map((char) => (
          <Pressable key={char} hitSlop={4} onPress={() => { tap(); setDraft((value) => `${value}${char}`); }} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.25 : 1 }] })}>
            <T size={24}>{char}</T>
          </Pressable>
        ))}
      </View>
      <View style={styles.compose}>
        <Face src={me?.avatar} name={me?.name || me?.handle} size={34} />
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          maxLength={1000}
          placeholder={t("Commenta per {name}…", { name: post.owner })}
          placeholderTextColor={theme.text2}
          accessibilityLabel={t("Aggiungi un commento")}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
          editable={!busy}
          style={[styles.input, { color: theme.text, borderColor: theme.line }]}
        />
        {draft.trim() ? (
          <Pressable hitSlop={8} disabled={busy} onPress={send}><T size={15} weight="700" color={busy ? theme.text3 : theme.blue}>{t("Pubblica")}</T></Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Draft, input and the comment being answered. A reply always hangs under the top-level comment.
export function useComposerState() {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const inputRef = useRef(null);
  const reply = (note) => {
    const handle = note.author?.handle || "";
    setReplyTo({ id: note.parent || note.id, handle });
    setDraft(handle ? `@${handle} ` : "");
    setTimeout(() => inputRef.current?.focus(), 30);
  };
  return { draft, setDraft, inputRef, reply, replyTo, setReplyTo };
}

// Lifts content above the keyboard; `under` is how far the screen's bottom edge sits above the
// phone's bottom (tab bar), so the same code works in pushed screens and in sheets.
export function useKeyboardPad(under = 0) {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({ paddingBottom: Math.max(0, keyboard.height.value - under) }));
}

export function NoComments({ off }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 28, gap: 4 }}>
      <T size={17} weight="700">{off ? t("I commenti sono disattivati.") : t("Ancora nessun commento")}</T>
      {off ? null : <T size={14} color={theme.text2}>{t("Inizia tu la conversazione.")}</T>}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 9, paddingHorizontal: INSET },
  reply: { paddingLeft: INSET + 46 },
  tools: { flexDirection: "row", gap: 14, marginTop: 3 },
  like: { alignSelf: "center", paddingLeft: 4 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  replying: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: INSET, marginBottom: 2, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  emoji: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, paddingHorizontal: 12 },
  compose: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET, paddingTop: 6 },
  input: { flex: 1, minHeight: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, fontSize: 15 },
});
