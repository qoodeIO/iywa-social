import { createElement as h, useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { INSET, useTheme } from "../theme";
import { ChevronLeft, Star, Verified } from "./icons";
import { t } from "../lib/i18n";

export function tap(style = "light") {
  Haptics.impactAsync(style === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function T({ style, color, size = 14, weight = "400", children, lines, ...rest }) {
  const theme = useTheme();
  return (
    <Text numberOfLines={lines} style={[{ color: color || theme.text, fontSize: size, fontWeight: weight, letterSpacing: size >= 17 ? -0.3 : -0.1 }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Avatar({ src, size = 32, ring = false, seen = false, style }) {
  const theme = useTheme();
  const image = <Image source={src ? { uri: src } : null} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.fill }} contentFit="cover" transition={150} />;
  if (!ring) return <View style={style}>{image}</View>;
  const pad = Math.max(2, Math.round(size * 0.045));
  const outer = size + pad * 4;
  const inner = (
    <View style={{ padding: pad, borderRadius: outer, backgroundColor: theme.bg }}>{image}</View>
  );
  if (seen) return <View style={[{ padding: pad * 0.5, borderRadius: outer, borderWidth: 1, borderColor: theme.line }, style]}>{inner}</View>;
  return (
    <LinearGradient colors={["#feda75", "#fa7e1e", "#d62976", "#962fbf"]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={[{ padding: pad, borderRadius: outer }, style]}>
      {inner}
    </LinearGradient>
  );
}

export function Name({ children, verified, size = 14, weight = "600", style }) {
  const theme = useTheme();
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 }, style]}>
      <T size={size} weight={weight} lines={1} style={{ flexShrink: 1 }}>{children}</T>
      {verified ? <Verified size={size} weight="fill" color={theme.blue} /> : null}
    </View>
  );
}

export function IconBtn({ icon: Icon, onPress, size = 26, color, weight = "regular", label, badge, style, hit = 8 }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={hit} onPress={onPress} style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.5 : 1 }, style]}>
      <Icon size={size} color={color || theme.text} weight={weight} />
      {badge ? (
        <View style={[styles.badge, { borderColor: theme.bg, backgroundColor: theme.red }]}>
          <T size={10.5} weight="700" color="#fff">{badge > 9 ? "9+" : badge}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

// Top bar of a pushed screen: back, centered title with an optional subtitle, actions on the right.
export function Header({ title, subtitle, right, back = true, onBack, border = false }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: theme.bg, borderBottomWidth: border ? StyleSheet.hairlineWidth : 0, borderBottomColor: theme.line }}>
      <View style={styles.header}>
        <View style={styles.side}>
          {back ? <IconBtn icon={ChevronLeft} size={26} weight="bold" label={t("Indietro")} onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/"))} /> : null}
        </View>
        <View style={styles.titleBox}>
          {typeof title === "string" ? <T size={16} weight="700" lines={1}>{title}</T> : title}
          {subtitle ? <T size={12} color={theme.text2} lines={1}>{subtitle}</T> : null}
        </View>
        <View style={[styles.side, { justifyContent: "flex-end" }]}>{right}</View>
      </View>
    </View>
  );
}

export function Btn({ title, onPress, kind = "gray", icon: Icon, style, disabled, height = 34, size = 14, flex }) {
  const theme = useTheme();
  const bg = kind === "primary" ? theme.blue : kind === "done" ? "#e3f8e8" : kind === "outline" ? "transparent" : theme.btn;
  const fg = kind === "primary" ? theme.accentInk || "#fff" : kind === "done" ? "#12a33f" : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={(event) => { tap(); onPress?.(event); }}
      style={({ pressed }) => [{ height, borderRadius: 8, paddingHorizontal: 14, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, opacity: disabled ? 0.45 : pressed ? 0.7 : 1, borderWidth: kind === "outline" ? 1 : 0, borderColor: theme.line, flex }, style]}
    >
      {Icon ? <Icon size={size + 1} color={fg} weight="bold" /> : null}
      {title ? <T size={size} weight="600" color={fg} lines={1}>{title}</T> : null}
    </Pressable>
  );
}

export function Chip({ title, on, onPress, icon: Icon, badge }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress?.(); }} style={({ pressed }) => [styles.chip, { borderColor: on ? theme.text : theme.line, backgroundColor: on ? theme.text : "transparent", transform: [{ scale: pressed ? 0.96 : 1 }] }]}>
      {Icon ? <Icon size={15} color={on ? theme.bg : theme.text} weight="bold" /> : null}
      <T size={14} weight="600" color={on ? theme.bg : theme.text}>{title}</T>
      {badge ? <View style={[styles.chipBadge, { backgroundColor: theme.blue }]}><T size={11} weight="700" color={theme.accentInk || "#fff"}>{badge}</T></View> : null}
    </Pressable>
  );
}

export function Stars({ value, size = 12 }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((index) => {
        const on = value >= index - 0.25;
        return <Star key={index} size={size} weight={on ? "fill" : "regular"} color={on ? theme.star : theme.text3} />;
      })}
    </View>
  );
}

export function Rating({ avg, count, size = 12, extra }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 1 }}>
      <Star size={size} weight="fill" color={theme.star} />
      <T size={size} weight="600">{avg.toFixed(1)}</T>
      <T size={size} color={theme.text2} lines={1} style={{ flexShrink: 1 }}>({count}){extra ? ` · ${extra}` : ""}</T>
    </View>
  );
}

export function Section({ title, right, children, style }) {
  return (
    <View style={[{ paddingTop: 22 }, style]}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: INSET, marginBottom: 10 }}>
          <T size={17} weight="700">{title}</T>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Hairline({ style }) {
  const theme = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }, style]} />;
}

// Bottom sheet with a grab handle, a dim backdrop and a spring.
export function Sheet({ open, onClose, children, title, dark }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (open) Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
    else y.setValue(600);
  }, [open, y]);
  const bg = dark ? "#1c1c1e" : theme.bg;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={onClose} />
      <Animated.View style={[styles.sheet, { backgroundColor: bg, paddingBottom: insets.bottom + 16, transform: [{ translateY: y }] }]}>
        <View style={[styles.grab, { backgroundColor: dark ? "#555" : theme.line }]} />
        {title ? <T size={16} weight="700" style={{ textAlign: "center", marginBottom: 10 }} color={dark ? "#fff" : theme.text}>{title}</T> : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

export function Toggle({ on }) {
  const theme = useTheme();
  return (
    <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: on ? "#34c759" : theme.btn, padding: 3, alignItems: on ? "flex-end" : "flex-start" }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }} />
    </View>
  );
}

export function Empty({ icon: Icon, title, text, children }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 56, paddingHorizontal: 32, gap: 8 }}>
      {Icon ? <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: theme.text, alignItems: "center", justifyContent: "center", marginBottom: 6 }}><Icon size={34} color={theme.text} weight="light" /></View> : null}
      <T size={20} weight="700" style={{ textAlign: "center" }}>{title}</T>
      {text ? <T size={14} color={theme.text2} style={{ textAlign: "center" }}>{text}</T> : null}
      {children}
    </View>
  );
}

export const styles = StyleSheet.create({
  header: { height: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  side: { width: 92, flexDirection: "row", alignItems: "center" },
  titleBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 2, right: 0, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  chipBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, marginLeft: 2 },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: INSET, paddingTop: 8 },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 10 },
});

export { h };
