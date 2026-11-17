import { useEffect, useRef } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { TAB_HEIGHT, useTheme } from "../../theme";
import { cachedPost, postCard, usePost } from "../../lib/social";
import { myHandle } from "../../lib/session";
import { Empty, Header } from "../../ui/kit";
import { ImageIcon } from "../../ui/icons";
import { PostCard, RetryLine, Spinner } from "../../ui/feed";
import { t } from "../../lib/i18n";
import { CaptionRow, CommentComposer, CommentRow, NoComments, useCommentLines, useComposerState, useKeyboardPad } from "../../ui/comments";

export default function PostScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const key = String(id || "");
  const { data, error, loading, refresh } = usePost(key);
  const server = data?.post || cachedPost(key);
  // A thought has its own page.
  useEffect(() => {
    if (server?.kind === "thought") router.replace(`/thought/${encodeURIComponent(key)}`);
  }, [server?.kind, key]);
  if (!server || server.kind === "thought") {
    const gone = error?.status === 404 || error?.code === "not-found";
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Post")} border />
        {gone ? (
          <Empty icon={ImageIcon} title={t("Post non disponibile")} text={t("Potrebbe essere stato eliminato o l'account è privato.")} />
        ) : error && !loading ? (
          <RetryLine error={error} onRetry={refresh} />
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 40 }}><Spinner /></View>
        )}
      </View>
    );
  }
  return <PostPage post={postCard(server)} refresh={refresh} />;
}

function PostPage({ post, refresh }) {
  const theme = useTheme();
  const comments = useCommentLines(post.id);
  const { lines } = comments;
  const { draft, setDraft, inputRef, reply, replyTo, setReplyTo } = useComposerState();
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const pad = useKeyboardPad(TAB_HEIGHT + insets.bottom);
  const seen = useRef(-1);
  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    if (comments.loading) return;
    const grew = seen.current >= 0 && lines.length > seen.current;
    seen.current = lines.length;
    if (grew && lastLine?.author?.handle === myHandle() && !lastLine.depth) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [lines.length, lastLine, comments.loading]);
  const off = post.commentsOff && !post.mine;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: theme.bg }, pad]}>
      <Header title={t("Post")} subtitle={post.owner} border />
      <ScrollView
        ref={scrollRef}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} tintColor={theme.text2} onRefresh={() => { refresh(); comments.refresh(); }} />}
      >
        <PostCard post={post} />
        {post.text ? <CaptionRow post={post} /> : null}
        {comments.loading ? (
          <View style={{ alignItems: "center", paddingVertical: 24 }}><Spinner /></View>
        ) : comments.error ? (
          <RetryLine error={comments.error} onRetry={comments.refresh} />
        ) : lines.length ? (
          lines.map((note) => <CommentRow key={note.id} post={post} note={note} onReply={off ? null : reply} />)
        ) : (
          <NoComments off={off} />
        )}
        <View style={{ height: 12 }} />
      </ScrollView>
      <CommentComposer post={post} draft={draft} setDraft={setDraft} inputRef={inputRef} replyTo={replyTo} setReplyTo={setReplyTo} bottom={0} />
    </Animated.View>
  );
}
