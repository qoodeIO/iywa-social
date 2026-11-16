import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useTheme, INSET } from "../theme";
import { useStore } from "../lib/store";
import { PEOPLE } from "../data";
import { Heart } from "./icons";
import { T, tap } from "./kit";
import { MentionSuggest, Rich, openPerson } from "./feed";
import { canReach, faceOf, textHidden } from "./feedData";
import { commentPost } from "./feedEcho";

export const EMOJI = ["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"];

export function commentsLocked(store, post) {
  return post.name !== store.profile.name && !canReach(store.prefs, store.follows, post.name, "comments");
}

// Lines of a post's thread plus my own comments (web CommentThread).
export function useCommentLines(post) {
  const store = useStore();
  const me = store.profile;
  const mine = store.postComments?.[post.id];
  return useMemo(() => [
    ...(post.thread || []).map((note, i) => ({ ...note, id: `t-${i}`, time: `${i + 2} h` })),
    ...(mine || []).map((text, i) => ({ id: `m-${i}`, name: me.name, text, mine: true, time: "ora" })),
  ].filter((note) => !textHidden(store.prefs, note.text)), [post.thread, mine, me.name, store.prefs]);
}

export function CaptionRow({ post }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Image source={{ uri: post.src || post.avatar || faceOf(post.name) }} style={styles.face} transition={120} />
      <View style={{ flex: 1 }}>
        <Rich text={post.text} prefix={<T size={14} weight="600">{post.name} </T>} />
        {post.time ? <T size={12.5} color={theme.text2} style={{ marginTop: 3 }}>{post.time === "Now" ? "Adesso" : post.time}</T> : null}
      </View>
    </View>
  );
}

export function CommentRow({ post, note, onReply }) {
  const theme = useTheme();
  const store = useStore();
  const key = `${post.id}:${note.id}`;
  const on = (store.commentLikes || []).includes(key);
  const restricted = (store.prefs?.restricted || []).includes(note.name);
  return (
    <View style={styles.row}>
      <Pressable onPress={() => openPerson(note.name)}>
        <Image source={{ uri: faceOf(note.name, store.profile) }} style={styles.face} transition={120} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <T size={13} weight="600" onPress={() => openPerson(note.name)}>{note.name}</T>
          <T size={12} color={theme.text2}>{note.time}</T>
        </View>
        <Rich text={note.text} />
        {restricted ? <T size={12} color={theme.text2}>Solo tu</T> : null}
        <View style={styles.tools}>
          {on ? <T size={12.5} weight="600" color={theme.text2}>1 Mi piace</T> : null}
          <Pressable hitSlop={6} onPress={() => onReply(note)}><T size={12.5} weight="600" color={theme.text2}>Rispondi</T></Pressable>
        </View>
      </View>
      <Pressable accessibilityLabel="Mi piace al commento" hitSlop={10} onPress={() => { tap(); store.toggleCommentLike(key); }} style={styles.like}>
        <Heart size={15} weight={on ? "fill" : "regular"} color={on ? theme.red : theme.text2} />
      </Pressable>
    </View>
  );
}

// Footer: @ suggestions, quick emoji, avatar + input + "Pubblica".
export function CommentComposer({ post, draft, setDraft, inputRef, onSent, bottom = 0 }) {
  const theme = useTheme();
  const store = useStore();
  const locked = commentsLocked(store, post) || post.noComments;
  if (locked) {
    return (
      <View style={[styles.foot, { borderTopColor: theme.line, paddingBottom: bottom + 14 }]}>
        <T size={13} color={theme.text2} style={{ textAlign: "center", paddingTop: 4 }}>I commenti sono disattivati.</T>
      </View>
    );
  }
  const send = () => {
    const text = draft.trim();
    if (!text || textHidden(store.prefs, text)) return;
    tap();
    commentPost(store, post.id, text);
    setDraft("");
    onSent?.();
  };
  const first = String(post.name || "").split(" ")[0];
  return (
    <View style={[styles.foot, { borderTopColor: theme.line, backgroundColor: theme.bg, paddingBottom: bottom + 8 }]}>
      <MentionSuggest value={draft} onPick={(next) => { setDraft(next); inputRef.current?.focus(); }} style={{ marginHorizontal: INSET }} />
      <View style={styles.emoji}>
        {EMOJI.map((char) => (
          <Pressable key={char} hitSlop={4} onPress={() => { tap(); setDraft((value) => `${value}${char}`); }} style={({ pressed }) => ({ transform: [{ scale: pressed ? 1.25 : 1 }] })}>
            <T size={24}>{char}</T>
          </Pressable>
        ))}
      </View>
      <View style={styles.compose}>
        <Image source={{ uri: store.profile.src }} style={styles.meFace} />
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Commenta per ${first}…`}
          placeholderTextColor={theme.text2}
          accessibilityLabel="Aggiungi un commento"
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
          style={[styles.input, { color: theme.text, borderColor: theme.line }]}
        />
        {draft.trim() ? (
          <Pressable hitSlop={8} onPress={send}><T size={15} weight="700" color={theme.blue}>Pubblica</T></Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function useReply(setDraft, inputRef) {
  return (note) => {
    const who = PEOPLE.find((entry) => entry.name === note.name);
    setDraft(`@${who ? who.handle : String(note.name).split(" ")[0].toLowerCase()} `);
    setTimeout(() => inputRef.current?.focus(), 30);
  };
}

export function useComposerState() {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const reply = useReply(setDraft, inputRef);
  return { draft, setDraft, inputRef, reply };
}

// Lifts content above the keyboard; `under` is how far the screen's bottom edge sits above the
// phone's bottom (tab bar), so the same code works in pushed screens and in sheets.
export function useKeyboardPad(under = 0) {
  const keyboard = useAnimatedKeyboard();
  return useAnimatedStyle(() => ({ paddingBottom: Math.max(0, keyboard.height.value - under) }));
}

export function NoComments() {
  const theme = useTheme();
  return <T size={14} color={theme.text2} style={{ textAlign: "center", paddingVertical: 28 }}>Ancora nessun commento. Inizia tu.</T>;
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, paddingVertical: 9, paddingHorizontal: INSET },
  face: { width: 34, height: 34, borderRadius: 17 },
  tools: { flexDirection: "row", gap: 14, marginTop: 3 },
  like: { alignSelf: "center", paddingLeft: 4 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  emoji: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, paddingHorizontal: 12 },
  compose: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET, paddingTop: 6 },
  meFace: { width: 34, height: 34, borderRadius: 17 },
  input: { flex: 1, minHeight: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, fontSize: 15 },
});
