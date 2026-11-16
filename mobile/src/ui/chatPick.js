import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { INSET } from "../theme";
import { GROUP_TONES } from "../live/format";
import { Face, GroupAvatar, useChatTheme } from "./chat";
import { Check } from "./chatIcons";
import { T, tap } from "./kit";
import { t } from "../lib/i18n";

// Pickers shared by new group, group info and folders: colour tones and checkable people rows.
export function ToneRow({ photo, title, onPick, extra }) {
  const theme = useChatTheme();
  return (
    <View style={styles.tones}>
      {GROUP_TONES.map((_, index) => {
        const on = photo === `tone:${index}`;
        return (
          <Pressable key={index} accessibilityLabel={t("Colore {n}", { n: index + 1 })} onPress={() => { tap(); onPick(`tone:${index}`); }} style={({ pressed }) => [{ borderRadius: 22, padding: 2, borderWidth: 2, borderColor: on ? theme.blue : "transparent", transform: [{ scale: pressed ? 0.88 : 1 }] }]}>
            <GroupAvatar photo={`tone:${index}`} title={title || "?"} size={38} />
          </Pressable>
        );
      })}
      {extra}
    </View>
  );
}

export function CheckRow({ on, src, name, meta, metaBlue, online, onPress, face }) {
  const theme = useChatTheme();
  const s = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(on ? 1 : 0, { damping: 13, stiffness: 300 });
  }, [on, s]);
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - s.value * 0.14 }] }));
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.member, pressed && { backgroundColor: theme.fill }]}>
      <View style={{ width: 46, height: 46 }}>
        <Animated.View style={faceStyle}>{face || <Face src={src} name={name} size={46} online={online} dot={13} />}</Animated.View>
        <Animated.View style={[styles.checkMark, { backgroundColor: theme.blue, borderColor: theme.bg }, markStyle]}><Check size={12} weight="bold" color="#fff" /></Animated.View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={15} weight="600" lines={1}>{name}</T>
        {meta ? <T size={13.5} lines={1} color={metaBlue ? theme.blue : theme.text2}>{meta}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  member: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 7, paddingHorizontal: INSET },
  checkMark: { position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  tones: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingTop: 6, paddingHorizontal: INSET, paddingBottom: 10 },
});
