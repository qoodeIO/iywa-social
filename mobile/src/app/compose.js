import { useEffect } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import ThoughtComposer from "../ui/thought-composer";

// Write a Pensiero (threads, photos, polls, replies and quotes live in the thought composer).
// kind=story hands over to the story camera.
export default function Compose() {
  const { kind, reply, quote } = useLocalSearchParams();
  if (kind === "story") return <StoryCameraRedirect />;
  return <ThoughtComposer replyId={reply} quoteId={quote} />;
}

// The story camera lives at /story/new (full screen, black), so hand over to it.
function StoryCameraRedirect() {
  useEffect(() => {
    router.replace("/story/new");
  }, []);
  return <View style={{ flex: 1, backgroundColor: "#000" }} />;
}
