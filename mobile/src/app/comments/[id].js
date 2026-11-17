import { useEffect, useRef } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme";
import { cachedPost, postCard, usePost } from "../../lib/social";
import { myHandle } from "../../lib/session";
import { T } from "../../ui/kit";
import { RetryLine, Spinner } from "../../ui/feed";
import { t } from "../../lib/i18n";
import { CaptionRow, CommentComposer, CommentRow, NoComments, useCommentLines, useComposerState, useKeyboardPad } from "../../ui/comments";

// Comments sheet (web CommentsScreen): presented as a native page sheet.
export default function CommentsSheet() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const key = String(id || "");
  const { data, error, refresh } = usePost(key);
  const server = data?.post || cachedPost(key);
  const post = server ? postCard(server) : null;
  return (
    <View style={{ flex: 1, backgroundColor: theme.scheme === "dark" ? "#1c1c1e" : theme.bg }}>
      <View style={[styles.grab, { backgroundColor: theme.text3 }]} />
      <T size={16} weight="700" style={[styles.title, { borderBottomColor: theme.line }]}>{t("Commenti")}</T>
      {post ? <Thread post={post} /> : error ? <RetryLine error={error} onRetry={refresh} /> : <View style={styles.center}><Spinner /></View>}
    </View>
  );
}

function Thread({ post }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { lines, loading, error, refresh } = useCommentLines(post.id);
  const { draft, setDraft, inputRef, reply, replyTo, setReplyTo } = useComposerState();
  const listRef = useRef(null);
  const pad = useKeyboardPad(insets.bottom);
  // My new top-level comment lands at the bottom: follow it there.
  const seen = useRef(-1);
  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    if (loading) return;
    const grew = seen.current >= 0 && lines.length > seen.current;
    seen.current = lines.length;
    if (grew && lastLine?.author?.handle === myHandle() && !lastLine.depth) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  }, [lines.length, lastLine, loading]);
  const off = post.commentsOff && !post.mine;
  return (
    <Animated.View style={[{ flex: 1 }, pad]}>
      <FlatList
        ref={listRef}
        data={lines}
        keyExtractor={(note) => note.id}
        renderItem={({ item }) => <CommentRow post={post} note={item} onReply={off ? null : reply} />}
        ListHeaderComponent={post.text ? <View style={[styles.caption, { borderBottomColor: theme.line }]}><CaptionRow post={post} /></View> : null}
        ListEmptyComponent={loading ? <View style={styles.center}><Spinner /></View> : error ? <RetryLine error={error} onRetry={refresh} /> : <NoComments off={off} />}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={theme.text2} />}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingVertical: 6 }}
      />
      <CommentComposer
        post={post}
        draft={draft}
        setDraft={setDraft}
        inputRef={inputRef}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        bottom={insets.bottom}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grab: { alignSelf: "center", width: 36, height: 5, borderRadius: 3, marginTop: 8, opacity: 0.6 },
  title: { textAlign: "center", paddingTop: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  caption: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4, marginBottom: 4 },
  center: { alignItems: "center", paddingVertical: 32 },
});
