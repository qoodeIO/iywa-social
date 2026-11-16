import { useEffect, useRef } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { T } from "../../ui/kit";
import { findPost } from "../../ui/feedData";
import { CommentComposer, CommentRow, NoComments, useCommentLines, useComposerState, useKeyboardPad } from "../../ui/comments";

// Comments sheet (web CommentsScreen): presented as a native page sheet.
export default function CommentsSheet() {
  const theme = useTheme();
  const store = useStore();
  const { id } = useLocalSearchParams();
  const post = findPost(String(id), store.library);
  return (
    <View style={{ flex: 1, backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : theme.bg }}>
      <View style={[styles.grab, { backgroundColor: theme.text3 }]} />
      <T size={16} weight="700" style={[styles.title, { borderBottomColor: theme.line }]}>Commenti</T>
      {post ? <Thread post={post} /> : <NoComments />}
    </View>
  );
}

function Thread({ post }) {
  const insets = useSafeAreaInsets();
  const lines = useCommentLines(post);
  const { draft, setDraft, inputRef, reply } = useComposerState();
  const listRef = useRef(null);
  const pad = useKeyboardPad(insets.bottom);
  const mineCount = lines.filter((line) => line.mine).length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [mineCount]);
  return (
    <Animated.View style={[{ flex: 1 }, pad]}>
      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(note) => note.id}
        renderItem={({ item }) => <CommentRow post={post} note={item} onReply={reply} />}
        ListEmptyComponent={<NoComments />}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 6 }}
      />
      <CommentComposer post={post} draft={draft} setDraft={setDraft} inputRef={inputRef} bottom={insets.bottom} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grab: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginTop: 8, opacity: 0.6 },
  title: { textAlign: "center", paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
