import { memo, useEffect, useId, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { router } from "expo-router";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useStore } from "../lib/store";
import { filterOf, GIF_TONES } from "../lib/stories";
import { euro, findProduct, productRef, reviewsFor, stockLabel, storeOf } from "../data";
import { At, Bag, Bell, Check, ChevronRight, Hash, Heart, MapPin, Send } from "./icons";
import { HelpCircle, LinkIcon, MessageCircle, Music, Timer } from "./storyIcons";
import { Btn, Rating, Sheet, T, tap } from "./kit";
import { productHref } from "./market";
import { INSET, useTheme } from "../theme";
import { t } from "../lib/i18n";

const MONO = Platform.select({ ios: "Courier New", default: "monospace" });

// ---------------------------------------------------------------------------
// Media: photo, clip, gradient ("Crea") or collage ("Layout"), with the story filter.

export const StoryMedia = memo(function StoryMedia({ frame, live = false, paused = false, onReady, onDuration, onEnd, style }) {
  const look = filterOf(frame?.filter);
  let body = null;
  if (frame?.gradient) {
    body = <LinearGradient colors={frame.gradient} start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }} style={StyleSheet.absoluteFill} />;
  } else if (frame?.cells?.length) {
    const four = frame.layout === 4;
    body = (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", flexDirection: "row", flexWrap: "wrap", gap: 2 }]}>
        {Array.from({ length: four ? 4 : 2 }, (_, i) => (
          <View key={i} style={{ width: four ? "49.6%" : "100%", height: "49.8%", backgroundColor: "#111", overflow: "hidden" }}>
            {frame.cells[i] ? <Image source={{ uri: frame.cells[i] }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={frame.cells[i]} /> : null}
          </View>
        ))}
      </View>
    );
  } else if (frame?.video && live) {
    body = <StoryClip uri={frame.video} mirror={frame.mirror} muted={frame.muted} paused={paused} onReady={onReady} onDuration={onDuration} onEnd={onEnd} />;
  } else if (frame?.image) {
    body = (
      <Image
        source={{ uri: frame.image }}
        style={[StyleSheet.absoluteFill, frame.mirror && !frame.video ? { transform: [{ scaleX: -1 }] } : null]}
        contentFit="cover"
        transition={120}
        recyclingKey={frame.image}
        onLoad={live ? onReady : undefined}
        onError={live ? onReady : undefined}
      />
    );
  } else {
    body = <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />;
  }
  useEffect(() => {
    // Gradients and collages have nothing to wait for.
    if (live && (frame?.gradient || frame?.cells?.length)) onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id, live]);
  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, look.css ? { filter: look.css } : null]}>{body}</View>
      {look.tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: look.tint[0], opacity: look.tint[1] }]} /> : null}
    </View>
  );
});

function StoryClip({ uri, mirror, muted, paused, onReady, onDuration, onEnd, loop = false }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = Boolean(muted);
    p.timeUpdateEventInterval = 0;
  });
  useEffect(() => {
    const subs = [
      player.addListener("statusChange", ({ status }) => {
        if (status === "readyToPlay") {
          onReady?.();
          if (player.duration) onDuration?.(player.duration);
        }
        if (status === "error") onReady?.();
      }),
      player.addListener("playToEnd", () => onEnd?.()),
    ];
    return () => subs.forEach((sub) => sub.remove());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);
  useEffect(() => {
    player.muted = Boolean(muted);
  }, [muted, player]);
  useEffect(() => {
    if (paused) player.pause();
    else player.play();
  }, [paused, player]);
  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, mirror ? { transform: [{ scaleX: -1 }] } : null]}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

// Editor preview of a clip: loops, can be muted.
export function LoopClip({ uri, mirror, muted, filter }) {
  const look = filterOf(filter);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, look.css ? { filter: look.css } : null]}>
        <StoryClip uri={uri} mirror={mirror} muted={muted} loop paused={false} />
      </View>
      {look.tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: look.tint[0], opacity: look.tint[1] }]} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stickers

// Places a sticker at its x/y percentage, centred, scaled and turned like the web's stickerStyle().
export function StickerSpot({ item, w, h, children }) {
  const s = Number(item.s) || 1;
  const r = Number(item.r) || 0;
  const max = item.type === "text" ? w * 0.88 : w * 0.78;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: ((item.x ?? 50) / 100) * w - 600, top: ((item.y ?? 40) / 100) * h - 600, width: 1200, height: 1200, alignItems: "center", justifyContent: "center" }}>
      <View pointerEvents="box-none" style={{ maxWidth: max, transform: [{ scale: s }, { rotate: `${r}deg` }] }}>{children}</View>
    </View>
  );
}

export function textStyle(item, u) {
  const font = item.font || "classic";
  const color = item.color || "#fff";
  const base = { fontSize: 30 * u, lineHeight: 30 * u * 1.15, color, fontWeight: "700", letterSpacing: -0.9 * u, textAlign: item.align || "center", textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };
  if (font === "modern") Object.assign(base, { fontWeight: "500", textTransform: "uppercase", letterSpacing: 1.44 * u, fontSize: 24 * u, lineHeight: 24 * u * 1.15 });
  if (font === "neon") Object.assign(base, { fontWeight: "600", color: "#fff", textShadowColor: color, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } });
  if (font === "type") Object.assign(base, { fontFamily: MONO, fontSize: 26 * u, lineHeight: 26 * u * 1.15, letterSpacing: -0.5 * u });
  if (font === "strong") Object.assign(base, { fontWeight: "800", fontStyle: "italic", fontSize: 34 * u, lineHeight: 34 * u * 1.15, letterSpacing: -1.7 * u });
  if (item.bg === "solid") Object.assign(base, { color: "#111", textShadowColor: "transparent" });
  if (item.bg === "soft") Object.assign(base, { textShadowColor: "transparent" });
  return base;
}

export function textBox(item, u) {
  return {
    paddingVertical: 4 * u,
    paddingHorizontal: 10 * u,
    borderRadius: 8 * u,
    backgroundColor: item.bg === "solid" ? item.color || "#fff" : item.bg === "soft" ? "rgba(0,0,0,0.55)" : "transparent",
  };
}

function Equalizer({ on, u }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 * u, height: 14 * u }}>
      {[0.4, 0.8, 0.55].map((rest, i) => <EqBar key={i} rest={rest} on={on} u={u} delay={i * 150} />)}
    </View>
  );
}

function EqBar({ rest, on, u, delay }) {
  const v = useSharedValue(rest);
  useEffect(() => {
    if (on) {
      const timer = setTimeout(() => { v.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, delay);
      return () => { clearTimeout(timer); cancelAnimation(v); };
    }
    cancelAnimation(v);
    v.value = withTiming(rest, { duration: 150 });
    return undefined;
  }, [on, rest, delay, v]);
  const style = useAnimatedStyle(() => ({ height: `${v.value * 100}%` }));
  return <Animated.View style={[{ width: 2.5 * u, borderRadius: 2 * u, backgroundColor: "#fff" }, style]} />;
}

function Kicker({ icon: Icon, children, u }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 * u }}>
      {Icon ? <Icon size={15 * u} weight="bold" color="rgba(0,0,0,0.45)" /> : null}
      <T size={11 * u} weight="700" color="rgba(0,0,0,0.45)" style={{ letterSpacing: 0.44 * u, textTransform: "uppercase" }}>{children}</T>
    </View>
  );
}

function PollOpt({ label, on, bad, fill, percent, onPress, u }) {
  return (
    <Pressable onPress={onPress} style={[st.pollOpt(u), on ? { borderColor: "#111" } : bad ? { borderColor: "#ff3b30" } : null]}>
      {fill != null ? <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fill}%`, backgroundColor: "rgba(0,0,0,0.1)" }} /> : null}
      <T size={13 * u} weight="600" color="#111">{label}</T>
      {percent != null ? <T size={13 * u} weight="600" color="#111">{percent}%</T> : null}
    </Pressable>
  );
}

function SliderTrack({ item, u, onAct, live }) {
  const [value, setValue] = useState(item.value || 60);
  const width = useRef(1);
  const set = (x) => setValue(Math.max(0, Math.min(100, Math.round((x / width.current) * 100))));
  return (
    <View
      onLayout={(e) => { width.current = e.nativeEvent.layout.width || 1; }}
      onStartShouldSetResponder={() => live}
      onMoveShouldSetResponder={() => live}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => set(e.nativeEvent.locationX)}
      onResponderMove={(e) => set(e.nativeEvent.locationX)}
      onResponderRelease={() => onAct?.(item, value)}
      style={{ height: 24 * u, justifyContent: "center" }}
    >
      <View style={{ height: 4 * u, borderRadius: 2 * u, backgroundColor: "rgba(0,0,0,0.15)" }}>
        <View style={{ width: `${value}%`, height: "100%", borderRadius: 2 * u, backgroundColor: "#111" }} />
      </View>
      <View style={{ position: "absolute", left: `${value}%`, marginLeft: -9 * u, width: 18 * u, height: 18 * u, borderRadius: 9 * u, backgroundColor: "#111" }} />
    </View>
  );
}

export const StickerFace = memo(function StickerFace({ item, u = 1, vote, quizPick, playing, notified, onAct, live = false }) {
  const act = (value) => onAct?.(item, value);
  switch (item.type) {
    case "text":
      return (
        <Pressable disabled={!live} onPress={() => act()} style={textBox(item, u)}>
          <T style={textStyle(item, u)}>{item.text}</T>
        </Pressable>
      );
    case "music":
      return (
        <Pressable disabled={!live} onPress={() => act()} style={st.music(u)}>
          <Music size={15 * u} weight="bold" color="#fff" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={13.5 * u} weight="700" color="#fff" lines={1}>{item.title}</T>
            <T size={11 * u} color="rgba(255,255,255,0.7)" lines={1}>{item.artist}</T>
          </View>
          <Equalizer on={playing} u={u} />
        </Pressable>
      );
    case "place":
    case "tag":
    case "hash":
    case "link":
    case "notify": {
      const Icon = { place: MapPin, tag: At, hash: Hash, link: LinkIcon, notify: Bell }[item.type];
      const label = { place: item.name, tag: item.name, hash: item.tag, link: item.label, notify: notified ? t("Notifiche attive") : t("Attiva notifiche") }[item.type];
      const on = item.type === "notify" && notified;
      return (
        <Pressable disabled={!live} onPress={() => act()} style={[st.pill(u), on ? { backgroundColor: "#0095f6" } : null]}>
          <Icon size={15 * u} weight="bold" color={on ? "#fff" : "#111"} />
          <T size={14 * u} weight="700" color={on ? "#fff" : "#111"} lines={1} style={{ letterSpacing: -0.28 * u }}>{label}</T>
        </Pressable>
      );
    }
    case "product":
      return (
        <Pressable disabled={!live} onPress={() => act()} style={st.product(u)}>
          {item.image ? <Image source={{ uri: item.image }} style={{ width: 42 * u, height: 42 * u, borderRadius: 10 * u }} /> : <View style={{ width: 42 * u, height: 42 * u, borderRadius: 10 * u, backgroundColor: "#efefef", alignItems: "center", justifyContent: "center" }}><Bag size={20 * u} weight="fill" color="#111" /></View>}
          <View style={{ flexShrink: 1 }}>
            <T size={14 * u} weight="700" color="#111" lines={1}>{item.name}</T>
            <T size={13 * u} weight="600" color="#555">{euro(item.price)}</T>
          </View>
          <View style={{ width: 30 * u, height: 30 * u, borderRadius: 15 * u, backgroundColor: "#111", alignItems: "center", justifyContent: "center", marginLeft: 4 * u }}><Bag size={15 * u} weight="bold" color="#fff" /></View>
        </Pressable>
      );
    case "emoji":
      return (
        <Pressable disabled={!live} onPress={() => act()}>
          <T size={54 * u} style={{ lineHeight: 62 * u, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 4 } }}>{item.char}</T>
        </Pressable>
      );
    case "gif":
      return <T size={34 * u} weight="800" color={GIF_TONES[item.tone] || "#fff"} style={{ letterSpacing: -1.7 * u, textShadowColor: "#111", textShadowRadius: 0.1, textShadowOffset: { width: 0, height: 3 * u } }}>{item.label}</T>;
    case "slider":
      return (
        <View style={st.card(u)}>
          <T size={15 * u} weight="700" color="#111" style={{ letterSpacing: -0.45 * u }}>{item.prompt}</T>
          <T size={28 * u} style={{ textAlign: "center" }}>{item.char || "❤️"}</T>
          <SliderTrack item={item} u={u} onAct={onAct} live={live} />
        </View>
      );
    case "yours":
    case "ask":
      return (
        <Pressable disabled={!live} onPress={() => act()} style={st.card(u)}>
          <Kicker icon={item.type === "ask" ? MessageCircle : null} u={u}>{item.type === "ask" ? t("Domanda") : t("Aggiungi il tuo")}</Kicker>
          <T size={15 * u} weight="700" color="#111" style={{ letterSpacing: -0.45 * u }}>{item.prompt}</T>
          <T size={12 * u} color="rgba(0,0,0,0.5)">{item.type === "ask" ? t("Rispondi") : t("Tocca e rispondi")}</T>
        </Pressable>
      );
    case "count":
      return (
        <View style={st.card(u)}>
          <Kicker icon={Timer} u={u}>{t("Countdown")}</Kicker>
          <T size={15 * u} weight="700" color="#111" style={{ letterSpacing: -0.45 * u }}>{item.label}</T>
          <T size={12 * u} color="rgba(0,0,0,0.5)">{item.when}</T>
        </View>
      );
    case "poll": {
      const left = (item.av || 0) + (vote === "a" ? 1 : 0);
      const right = (item.bv || 0) + (vote === "b" ? 1 : 0);
      const total = left + right || 1;
      return (
        <View style={st.card(u)}>
          <T size={15 * u} weight="700" color="#111" style={{ letterSpacing: -0.45 * u }}>{item.question}</T>
          {[["a", item.a, left], ["b", item.b, right]].map(([key, label, count]) => {
            const pct = Math.round((count / total) * 100);
            return <PollOpt key={key} u={u} label={label} on={vote === key} fill={vote ? pct : null} percent={vote ? pct : null} onPress={live ? () => act(key) : undefined} />;
          })}
        </View>
      );
    }
    case "quiz":
      return (
        <View style={st.card(u)}>
          <Kicker icon={HelpCircle} u={u}>{t("Quiz")}</Kicker>
          <T size={15 * u} weight="700" color="#111" style={{ letterSpacing: -0.45 * u }}>{item.question}</T>
          {item.options.map((label, index) => {
            const picked = quizPick === index;
            const right = quizPick != null && index === item.answer;
            const wrong = picked && index !== item.answer;
            return <PollOpt key={label} u={u} label={label} on={right} bad={wrong} onPress={live ? () => act(index) : undefined} />;
          })}
        </View>
      );
    default:
      return null;
  }
});

// A drawing sticker: strokes stored as SVG paths in a 1000-unit-wide box.
export function DrawingLayer({ item, w, h }) {
  if (!item?.paths?.length || !w || !h) return null;
  const vw = item.vw || 1000;
  const vh = item.vh || Math.round((1000 * h) / w);
  return (
    <Svg pointerEvents="none" width={w} height={h} viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      {item.paths.map((path, i) => <StrokePath key={i} path={path} />)}
    </Svg>
  );
}

export function StrokePath({ path }) {
  const cap = path.marker ? "square" : "round";
  return (
    <>
      {path.glow ? <Path d={path.d} stroke={path.color} strokeWidth={path.width * 3} strokeOpacity={0.25} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      {path.glow ? <Path d={path.d} stroke={path.color} strokeWidth={path.width * 1.8} strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
      <Path d={path.d} stroke={path.glow ? "#fff" : path.color} strokeWidth={path.glow ? path.width * 0.6 : path.width} strokeOpacity={path.alpha ?? 1} strokeLinecap={cap} strokeLinejoin="round" fill="none" />
    </>
  );
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

// The interactive sticker layer of a live story: polls, quizzes, questions, products, notifications.
export function StoryStickers({ items, quiet, w, h, u, onNote, onPause, onLeave, bottomInset = 0 }) {
  const [shopping, setShopping] = useState(null);
  const [vote, setVote] = useState(null);
  const [quizPick, setQuizPick] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [ask, setAsk] = useState(false);
  const [answer, setAnswer] = useState("");
  const keyboard = useKeyboardHeight();
  useEffect(() => () => onPause?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items?.length || !w) return null;
  const products = items.filter((item) => item.type === "product");

  function act(item, value) {
    if (quiet || !item) return;
    const type = item.type;
    tap();
    if (type === "music") {
      // The web plays a short demo tone; there is no audio file for it here, so only the equalizer runs.
      setPlaying((on) => {
        onPause?.(!on);
        if (!on) onNote?.(`♫ ${item.title}`);
        return !on;
      });
      return;
    }
    if (type === "product") {
      setShopping([item]);
      onPause?.(true);
      return;
    }
    if (type === "place") onNote?.(item.name);
    if (type === "tag") onNote?.(`@${item.name}`);
    if (type === "hash") onNote?.(`#${item.tag}`);
    if (type === "link") onNote?.(item.label);
    if (type === "emoji" || type === "gif") onNote?.(item.char || item.label);
    if (type === "slider") onNote?.(`${value}%`);
    if (type === "notify") {
      setNotified((on) => {
        onNote?.(on ? t("Notifiche spente") : t("Notifiche attive"));
        return !on;
      });
    }
    if (type === "poll" && !vote) setVote(value);
    if (type === "quiz" && quizPick == null) {
      setQuizPick(value);
      onNote?.(value === item.answer ? t("Giusto") : t("Quasi"));
    }
    if (type === "ask" || type === "yours") {
      setAsk(true);
      onPause?.(true);
    }
  }

  function send() {
    const text = answer.trim();
    if (!text) return;
    setAnswer("");
    setAsk(false);
    Keyboard.dismiss();
    onPause?.(false);
    onNote?.(t("Risposta inviata"));
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {items.map((item, index) => (item.type === "draw" ? (
        <DrawingLayer key={`draw-${index}`} item={item} w={w} h={h} />
      ) : (
        <StickerSpot key={`${item.type}-${index}`} item={item} w={w} h={h}>
          <StickerFace item={item} u={u} vote={vote} quizPick={quizPick} playing={playing} notified={notified} onAct={act} live={!quiet} />
        </StickerSpot>
      )))}
      {ask ? (
        <View style={{ position: "absolute", left: INSET, right: INSET, bottom: keyboard ? keyboard + 12 : 78 * u + bottomInset, flexDirection: "row", gap: 8 }}>
          <TextInput
            autoFocus
            value={answer}
            onChangeText={setAnswer}
            placeholder={t("La tua risposta")}
            placeholderTextColor="#8e8e8e"
            returnKeyType="send"
            onSubmitEditing={send}
            onBlur={() => { if (!answer.trim()) { setAsk(false); onPause?.(false); } }}
            style={{ flex: 1, height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: "#fff", color: "#111", fontSize: 15 }}
          />
          <Pressable onPress={send} accessibilityLabel={t("Invia")} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Send size={20} color="#111" />
          </Pressable>
        </View>
      ) : null}
      {!quiet && products.length ? (
        <Pressable style={[st.shopPill, { bottom: 18 + bottomInset }]} onPress={() => { tap(); setShopping(products); onPause?.(true); }}>
          <Bag size={15} weight="fill" color="#111" />
          <T size={13.5} weight="700" color="#111">{products.length === 1 ? t("Vedi prodotto") : t("Vedi {n} prodotti", { n: products.length })}</T>
        </Pressable>
      ) : null}
      {!quiet ? (
        <ProductSheet
          items={shopping}
          onClose={() => { setShopping(null); onPause?.(false); }}
          onOpen={(href) => { setShopping(null); onLeave?.(() => router.push(href)); }}
        />
      ) : null}
    </View>
  );
}

// The sheet a viewer opens from a product sticker: see it, save it, add it to the cart.
export function ProductSheet({ items, onClose, onOpen }) {
  const store = useStore();
  const theme = useTheme();
  const [added, setAdded] = useState("");
  const list = (items || []).map((item) => {
    const product = findProduct(item.owner || null, item.productId, store.myProducts) || { id: item.productId, name: item.name, price: item.price, images: [item.image].filter(Boolean) };
    return { product, owner: item.owner || null };
  });
  return (
    <Sheet open={Boolean(items)} onClose={onClose} title={list.length > 1 ? t("{n} prodotti", { n: list.length }) : t("Prodotto in questa storia")}>
      {list.map(({ product, owner }, index) => {
        const ref = productRef(product, owner);
        const shop = owner ? storeOf(owner) : null;
        const stock = stockLabel(product);
        const rating = reviewsFor(ref.key, store.reviews, store.profile);
        const wished = store.wishlist.some((entry) => entry.key === ref.key);
        return (
          <View key={ref.key} style={{ paddingTop: index ? 12 : 0, marginTop: index ? 12 : 0, borderTopWidth: index ? StyleSheet.hairlineWidth : 0, borderTopColor: theme.line }}>
            <Pressable onPress={() => onOpen(productHref(ref))} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              {product.images?.[0] ? <Image source={{ uri: product.images[0] }} style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: theme.fill }} contentFit="cover" /> : <View style={{ width: 76, height: 76, borderRadius: 10, backgroundColor: theme.fill, alignItems: "center", justifyContent: "center" }}><Bag size={26} weight="fill" color={theme.text2} /></View>}
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} weight="700" lines={1}>{product.name}</T>
                <T size={15} weight="700">{euro(product.price)}</T>
                {owner ? <Rating avg={rating.avg} count={rating.count} /> : null}
                <T size={12.5} lines={1} color={theme.text2}>{shop ? shop.title : t("Il tuo shop")} · <T size={12.5} color={stock.tone === "out" ? theme.red : stock.tone === "low" ? "#ff8a00" : theme.green}>{stock.text}</T></T>
              </View>
              <ChevronRight size={14} weight="bold" color={theme.text3} />
            </Pressable>
            {owner ? (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }}>
                <Btn icon={Heart} kind={wished ? "done" : "gray"} height={40} onPress={() => store.toggleWish(ref)} />
                <Btn title={added === ref.key ? t("Aggiunto") : t("Aggiungi al carrello")} icon={added === ref.key ? Check : null} kind={added === ref.key ? "done" : "gray"} height={40} flex={1} onPress={() => { store.addToCart(ref, 1, product.variants?.[0] || ""); setAdded(ref.key); setTimeout(() => setAdded(""), 1400); }} />
                <Btn title={t("Vedi")} kind="primary" height={40} flex={1} onPress={() => onOpen(productHref(ref))} />
              </View>
            ) : null}
          </View>
        );
      })}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Rings

// Segmented ring like the web StoryRing: orange-pink-purple, green for close friends, gray when seen.
export function StoryRing({ src, size = 66, total = 1, seen = 0, tone = "live" }) {
  const theme = useTheme();
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const count = Math.max(1, Math.min(total, 30));
  const gap = count > 1 ? 11 : 0;
  const sweep = (360 - gap * count) / count;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (sweep / 360) * circ;
  const image = size * 0.84;
  const muted = theme.scheme === "dark" ? "#3a3a3a" : "#c7c7c7";
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id={`${raw}b`} x1="18" y1="88" x2="82" y2="12" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ffb800" />
            <Stop offset="0.45" stopColor="#ff2d55" />
            <Stop offset="1" stopColor="#c013d1" />
          </SvgGradient>
          <SvgGradient id={`${raw}g`} x1="18" y1="88" x2="82" y2="12" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#1fd15a" />
            <Stop offset="1" stopColor="#0aa344" />
          </SvgGradient>
        </Defs>
        {Array.from({ length: count }, (_, index) => {
          const watched = tone === "empty" || tone === "seen" || index < seen;
          const stroke = watched ? muted : tone === "close" ? `url(#${raw}g)` : `url(#${raw}b)`;
          return (
            <Circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={watched ? 2 : 3.6}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              transform={`rotate(${-90 + index * (sweep + gap) + gap / 2} 50 50)`}
            />
          );
        })}
      </Svg>
      <Image source={src ? { uri: src } : null} style={{ width: image, height: image, borderRadius: image / 2, backgroundColor: theme.fill }} contentFit="cover" transition={150} />
    </View>
  );
}

export function ringTone(deck, seenIds, closeFriends = []) {
  const seenCount = deck.frames.filter((frame) => seenIds.includes(frame.id)).length;
  const allSeen = seenCount === deck.frames.length;
  const close = deck.mine ? deck.frames.some((frame) => frame.close) : closeFriends.includes(deck.full);
  return { seenCount, allSeen, tone: allSeen ? "seen" : close ? "close" : "live" };
}

const shadow = { shadowColor: "#000", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 6 };

export const st = {
  pill: (u) => ({ flexDirection: "row", alignItems: "center", gap: 6 * u, height: 36 * u, paddingHorizontal: 12 * u, borderRadius: 999, backgroundColor: "#fff", ...shadow }),
  card: (u) => ({ minWidth: 196 * u, gap: 6 * u, padding: 12 * u, borderRadius: 18 * u, backgroundColor: "#fff", ...shadow }),
  music: (u) => ({ flexDirection: "row", alignItems: "center", gap: 8 * u, minWidth: 180 * u, paddingVertical: 8 * u, paddingHorizontal: 10 * u, borderRadius: 14 * u, backgroundColor: "rgba(0,0,0,0.72)" }),
  product: (u) => ({ flexDirection: "row", alignItems: "center", gap: 9 * u, maxWidth: 260 * u, padding: 5 * u, paddingRight: 6 * u, borderRadius: 14 * u, backgroundColor: "#fff", ...shadow }),
  pollOpt: (u) => ({ height: 32 * u, borderRadius: 10 * u, paddingHorizontal: 10 * u, backgroundColor: "rgba(0,0,0,0.06)", overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5 * u, borderColor: "transparent" }),
  shopPill: { position: "absolute", bottom: 18, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.95)" },
};

