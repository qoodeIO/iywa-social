import { useEffect, useRef } from "react";
import { ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { TAB_HEIGHT, useTheme } from "../../theme";
import { useStore } from "../../lib/store";
import { Empty, Header } from "../../ui/kit";
import { ImageIcon } from "../../ui/icons";
import { PostCard } from "../../ui/feed";
import { findPost } from "../../ui/feedData";
import { t } from "../../lib/i18n";
import { CaptionRow, CommentComposer, CommentRow, NoComments, useCommentLines, useComposerState, useKeyboardPad } from "../../ui/comments";

export default function PostScreen() {
  const theme = useTheme();
  const store = useStore();
  const { id } = useLocalSearchParams();
  const post = findPost(String(id), store.library);
  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Header title={t("Post")} border />
        <Empty icon={ImageIcon} title={t("Post non disponibile")} text={t("Potrebbe essere stato eliminato.")} />
      </View>
    );
  }
  return <PostPage post={post} />;
}

function PostPage({ post }) {
  const theme = useTheme();
  const lines = useCommentLines(post);
  const { draft, setDraft, inputRef, reply } = useComposerState();
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const pad = useKeyboardPad(TAB_HEIGHT + insets.bottom);
  const mineCount = lines.filter((line) => line.mine).length;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [mineCount]);

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: theme.bg }, pad]}>
      <Header title={t("Post")} subtitle={String(post.handle || "").replace(/^@/, "")} border />
      <ScrollView ref={scrollRef} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        <PostCard post={post} onOpen={() => {}} />
        {post.text ? <CaptionRow post={post} /> : null}
        {lines.length ? lines.map((note) => <CommentRow key={note.id} post={post} note={note} onReply={reply} />) : <NoComments />}
        <View style={{ height: 12 }} />
      </ScrollView>
      <CommentComposer post={post} draft={draft} setDraft={setDraft} inputRef={inputRef} bottom={0} />
    </Animated.View>
  );
}
