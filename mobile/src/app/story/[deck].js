import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing, cancelAnimation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useStore } from "../../lib/store";
import { STORY_MS, STORY_REACTIONS, openFrame, useHighlightDecks, useStoryDecks } from "../../lib/stories";
import { PEOPLE } from "../../data";
import { Close, Eye, Heart, More, Send } from "../../ui/icons";
import { Music } from "../../ui/storyIcons";
import { Avatar, T, tap } from "../../ui/kit";
import { StoryMedia, StoryStickers } from "../../ui/story";

const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export default function StoryViewer() {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const u = W / 390;
  const store = useStore();
  const { deck: deckParam } = useLocalSearchParams();
  const deckId = String(deckParam);
  const highlight = deckId.startsWith("hl-");
  const storyDecks = useStoryDecks();
  const highlightDecks = useHighlightDecks();
  const decks = highlight ? highlightDecks : storyDecks;

  const [who, setWho] = useState(() => Math.max(0, decks.findIndex((deck) => deck.id === deckId)));
  const [frame, setFrame] = useState(() => openFrame(decks[Math.max(0, decks.findIndex((deck) => deck.id === deckId))], store.seenStories));
  const [loaded, setLoaded] = useState(false);
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [menu, setMenu] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [focused, setFocused] = useState(false);
  const [stickerBusy, setStickerBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState(null);
  const [reacts, setReacts] = useState([]);
  const [likePop, setLikePop] = useState(0);
  const [clipMs, setClipMs] = useState(0);
  const [keyboard, setKeyboard] = useState(0);
  const inputRef = useRef(null);
  const closing = useRef(false);
  const toastTimer = useRef(0);

  const deck = decks[who];
  const story = deck?.frames[frame];
  const prevDeck = decks[who - 1];
  const nextDeck = decks[who + 1];
  const nextIndex = nextDeck ? openFrame(nextDeck, store.seenStories) : 0;
  const prevIndex = prevDeck ? prevDeck.frames.length - 1 : 0;
  const stateRef = useRef({});
  stateRef.current = { who, frame, deck, prevDeck, nextDeck, nextIndex, prevIndex };
  const paused = !loaded || holding || dragging || spinning || menu || viewers || focused || stickerBusy;

  // Shared values: deck position (for the cube), progress of the current bar, the drag-to-close card.
  const pos = useSharedValue(who);
  const progress = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const enter = useSharedValue(0);
  const mode = useSharedValue(0);
  const whoSV = useSharedValue(who);
  const edges = useSharedValue({ prev: Boolean(prevDeck), next: Boolean(nextDeck) });
  useEffect(() => {
    whoSV.value = who;
    edges.value = { prev: Boolean(prevDeck), next: Boolean(nextDeck) };
  }, [who, prevDeck, nextDeck, whoSV, edges]);

  useEffect(() => {
    enter.value = withTiming(1, { duration: 380, easing: EASE });
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); clearTimeout(toastTimer.current); };
  }, [enter]);

  // New frame: restart the bar and wait for the picture.
  useLayoutEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    setLoaded(false);
    setClipMs(0);
    setStickerBusy(false);
  }, [who, frame, progress]);

  useEffect(() => {
    if (!story) return undefined;
    store.markStorySeen(story.id);
    // Warm the cache so the next taps are instant.
    const next = [deck?.frames[frame + 1]?.image, nextDeck?.frames[nextIndex]?.image, prevDeck?.frames[prevIndex]?.image].filter(Boolean);
    if (next.length) Image.prefetch(next).catch(() => {});
    const safety = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, frame, story?.id]);

  // Frames or decks deleted while open.
  useEffect(() => {
    if (!decks.length) {
      close("down");
      return;
    }
    if (!decks[who]) {
      const back = Math.max(0, Math.min(who, decks.length - 1));
      pos.value = back;
      setWho(back);
      setFrame(0);
      return;
    }
    if (frame >= decks[who].frames.length) setFrame(Math.max(0, decks[who].frames.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks]);

  const frameKey = `${who}:${frame}`;
  const keyRef = useRef(frameKey);
  keyRef.current = frameKey;
  const duration = clipMs || STORY_MS;

  // Progress clock on the UI thread; it resumes where it stopped. Elapsed time is kept on the
  // JS side (reading the shared value from JS can return a stale 1 right after a frame ends).
  const clock = useRef({ key: "", elapsed: 0, started: 0 });
  useEffect(() => {
    const c = clock.current;
    if (c.key !== frameKey) {
      c.key = frameKey;
      c.elapsed = 0;
      c.started = 0;
    }
    if (paused || !story) {
      if (c.started) c.elapsed += Date.now() - c.started;
      c.started = 0;
      cancelAnimation(progress);
      return undefined;
    }
    const key = frameKey;
    const from = Math.min(1, c.elapsed / duration);
    c.started = Date.now();
    progress.value = withSequence(
      withTiming(from, { duration: 0 }),
      withTiming(1, { duration: Math.max(0, duration - c.elapsed), easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(timeUp)(key);
      }),
    );
    return () => {
      if (c.started && c.key === key) {
        c.elapsed += Date.now() - c.started;
        c.started = 0;
      }
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, frameKey, duration]);

  function timeUp(key) {
    if (key === keyRef.current) step(1);
  }

  function note(text) {
    setToast({ text, at: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1100);
  }

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  function close(direction = "ring") {
    if (closing.current) return;
    closing.current = true;
    setHolding(false);
    Keyboard.dismiss();
    if (direction === "down") {
      dragY.value = withTiming(H * 0.9, { duration: 280, easing: Easing.bezier(0.4, 0, 0.6, 1) });
      enter.value = withTiming(0, { duration: 280 }, () => runOnJS(leave)());
    } else {
      enter.value = withTiming(0, { duration: 260, easing: Easing.bezier(0.4, 0, 0.6, 1) }, () => runOnJS(leave)());
    }
  }

  function landed(target, direction) {
    const { nextIndex: ni, prevIndex: pi } = stateRef.current;
    setWho(target);
    setFrame(direction > 0 ? ni : pi);
    setSpinning(false);
  }

  function spin(direction) {
    const { who: current, nextDeck: next, prevDeck: prev } = stateRef.current;
    const target = direction > 0 ? next : prev;
    if (!target) {
      if (direction > 0) close();
      else pos.value = withTiming(current, { duration: 300, easing: EASE });
      return;
    }
    setSpinning(true);
    const to = current + direction;
    pos.value = withTiming(to, { duration: 440, easing: EASE }, (finished) => {
      if (finished) runOnJS(landed)(to, direction);
    });
  }

  function step(direction) {
    if (closing.current) return;
    const { deck: current, frame: index, prevDeck: prev } = stateRef.current;
    if (!current) return;
    const next = index + direction;
    if (next >= 0 && next < current.frames.length) {
      setFrame(next);
      return;
    }
    if (direction < 0 && !prev) {
      progress.value = 0;
      return;
    }
    spin(direction);
  }

  function swipeUp() {
    if (stateRef.current.deck?.mine) setViewers(true);
    else inputRef.current?.focus();
  }

  // Gestures: tap left/right, hold to pause, swipe sideways between people, down to close, up to reply.
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(10)
      .onStart((e) => {
        const ax = Math.abs(e.translationX);
        const ay = Math.abs(e.translationY);
        if (ax > ay) mode.value = 1;
        else if (e.translationY > 0) mode.value = 2;
        else mode.value = 3;
        if (mode.value !== 3) runOnJS(setDragging)(true);
      })
      .onUpdate((e) => {
        if (mode.value === 1) {
          let p = -e.translationX / W;
          const blocked = p > 0 ? !edges.value.next : !edges.value.prev;
          if (blocked) p *= 0.22;
          pos.value = whoSV.value + Math.max(-1, Math.min(1, p));
        } else if (mode.value === 2) {
          dragY.value = Math.max(0, e.translationY);
          dragX.value = e.translationX * 0.5;
        }
      })
      .onEnd((e) => {
        if (mode.value === 1) {
          const p = -e.translationX / W;
          const direction = e.translationX < 0 ? 1 : -1;
          const target = direction > 0 ? edges.value.next : edges.value.prev;
          const fast = Math.abs(e.velocityX) > 500;
          if (target && (Math.abs(p) > 0.28 || fast)) runOnJS(spin)(direction);
          else pos.value = withTiming(whoSV.value, { duration: 300, easing: EASE });
        } else if (mode.value === 2) {
          if (e.translationY > 120 || e.velocityY > 600) runOnJS(close)("down");
          else {
            dragY.value = withSpring(0, { damping: 20, stiffness: 220 });
            dragX.value = withSpring(0, { damping: 20, stiffness: 220 });
          }
        } else if (mode.value === 3 && e.translationY < -40) {
          runOnJS(swipeUp)();
        }
      })
      .onFinalize(() => {
        mode.value = 0;
        runOnJS(setDragging)(false);
      });
    const hold = Gesture.LongPress()
      .minDuration(200)
      .maxDistance(12)
      .onStart(() => runOnJS(setHolding)(true))
      .onFinalize(() => runOnJS(setHolding)(false));
    const tapGesture = Gesture.Tap()
      .maxDuration(240)
      .onEnd((e) => runOnJS(step)(e.x < W * 0.3 ? -1 : 1));
    return Gesture.Race(pan, hold, tapGesture);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W]);

  const cardStyle = useAnimatedStyle(() => {
    const dy = dragY.value;
    const scale = Math.max(0.72, 1 - dy / 1400) * interpolate(enter.value, [0, 1], [0.86, 1]);
    return {
      opacity: interpolate(enter.value, [0, 0.4, 1], [0, 1, 1]),
      borderRadius: Math.min(28, dy / 6) + (1 - enter.value) * 40,
      transform: [{ translateX: dragX.value }, { translateY: dy + (1 - enter.value) * H * 0.08 }, { scale }],
    };
  });
  const dimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0.15, 1 - dragY.value / 520) * enter.value,
  }));

  if (!deck || !story) return <View style={{ flex: 1 }} />;
  const mine = Boolean(deck.mine);
  const liked = store.storyLikes.includes(story.id);
  const views = Math.max(deck.frames.length + 2, 3);
  const canReply = (() => {
    const rule = store.prefs?.storyReplies || "everyone";
    if (rule === "off") return false;
    if (rule === "following") return store.follows.includes(deck.full || deck.name);
    return true;
  })();
  const chrome = holding ? 0 : 1;
  const bottom = keyboard ? keyboard + 8 : insets.bottom + 14;

  function sendReply(text) {
    const name = deck.full || deck.name;
    const id = store.ensureChat({ name, src: deck.src });
    store.sendMessage(id, { text });
  }

  function react(char) {
    const now = Date.now();
    setReacts((prev) => [...prev, ...Array.from({ length: 6 }, (_, i) => ({ id: `${now}-${i}`, char, x: 18 + Math.random() * 64, d: i * 70, r: Math.random() * 40 - 20 }))]);
    setTimeout(() => setReacts((prev) => prev.filter((item) => !item.id.startsWith(`${now}-`))), 1800);
    sendReply(char);
    setReply("");
    inputRef.current?.blur();
    note("Reazione inviata");
  }

  const faces = [who - 1, who, who + 1].filter((index) => decks[index]);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ statusBarHidden: !keyboard && !menu && !viewers }} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, dimStyle]} />
      <Animated.View style={[styles.card, cardStyle]}>
        {faces.map((index) => {
          const item = decks[index];
          const live = index === who;
          return (
            <CubeFace key={item.id} index={index} front={index === who} pos={pos} w={W}>
              {live ? (
                <>
                  <GestureDetector gesture={gesture}>
                    <View style={StyleSheet.absoluteFill}>
                      <StoryMedia frame={story} live paused={paused} onReady={() => setLoaded(true)} onDuration={(sec) => setClipMs(Math.min(60, sec) * 1000)} />
                      <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.42)", "transparent"]} locations={[0, 0.22]} style={StyleSheet.absoluteFill} />
                      <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.45)"]} locations={[0.78, 1]} style={StyleSheet.absoluteFill} />
                      {story.text ? <T size={26 * u} weight="700" color={story.textColor || "#fff"} style={styles.caption}>{story.text}</T> : null}
                    </View>
                  </GestureDetector>
                  <View style={[StyleSheet.absoluteFill, { opacity: focused ? 0 : 1 }]} pointerEvents={focused ? "none" : "box-none"}>
                    <StoryStickers
                      key={`st-${story.id}`}
                      items={story.stickers}
                      w={W}
                      h={H}
                      u={u}
                      bottomInset={insets.bottom + 62}
                      onNote={note}
                      onPause={setStickerBusy}
                      onLeave={(go) => { close("down"); setTimeout(go, 360); }}
                    />
                  </View>
                  <Bars count={deck.frames.length} index={frame} progress={progress} top={insets.top + 6} opacity={chrome} ids={deck.frames.map((f) => f.id)} />
                  <Head deck={deck} story={story} top={insets.top + 16} opacity={chrome} u={u} onMore={() => setMenu(true)} onClose={() => close()} />
                  {!loaded ? <View pointerEvents="none" style={styles.spin}><Spinner /></View> : null}
                </>
              ) : (
                <QuietFace deck={item} index={index < who ? item.frames.length - 1 : openFrame(item, store.seenStories)} u={u} w={W} h={H} top={insets.top} />
              )}
            </CubeFace>
          );
        })}

        {reacts.map((item) => <FlyEmoji key={item.id} item={item} u={u} />)}
        {likePop ? <LikeBurst key={likePop} u={u} /> : null}

        {focused && !reply.trim() ? (
          <Pressable style={styles.reactions} onPress={() => inputRef.current?.blur()}>
            <T size={14} weight="600" color="rgba(255,255,255,0.85)">Reazioni rapide</T>
            <View style={styles.reactGrid}>
              {STORY_REACTIONS.map((char, i) => <ReactButton key={char} char={char} delay={i * 25} onPress={() => react(char)} />)}
            </View>
          </Pressable>
        ) : null}

        {mine ? (
          <View style={[styles.foot, { bottom, opacity: chrome, justifyContent: "space-between" }]}>
            <Pressable onPress={() => setViewers(true)} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row" }}>
                {PEOPLE.slice(0, 3).map((person) => <Image key={person.name} source={{ uri: person.src }} style={styles.face} />)}
              </View>
              <T size={12.5} weight="600" color="#fff">{`Attività · ${views}`}</T>
            </Pressable>
            <Pressable hitSlop={8} style={styles.icon} accessibilityLabel="Elimina" onPress={() => setMenu(true)}><More size={26} color="#fff" weight="bold" /></Pressable>
          </View>
        ) : !canReply ? (
          <T size={13} color="rgba(255,255,255,0.75)" style={[styles.closed, { bottom: insets.bottom + 24, opacity: chrome }]}>Risposte disattivate</T>
        ) : (
          <View style={[styles.foot, { bottom, opacity: chrome }]}>
            <View style={[styles.reply, focused ? { backgroundColor: "rgba(0,0,0,0.35)", borderColor: "#fff" } : null]}>
              <TextInput
                ref={inputRef}
                value={reply}
                onChangeText={setReply}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 120)}
                placeholder={`Rispondi a ${deck.name}…`}
                placeholderTextColor="rgba(255,255,255,0.85)"
                returnKeyType="send"
                onSubmitEditing={() => {
                  const text = reply.trim();
                  if (!text) return;
                  setReply("");
                  sendReply(text);
                  inputRef.current?.blur();
                  note("Messaggio inviato");
                }}
                style={styles.replyInput}
                accessibilityLabel="Rispondi alla storia"
              />
            </View>
            {reply.trim() ? (
              <Pressable
                hitSlop={8}
                style={{ paddingHorizontal: 12, height: 46, justifyContent: "center" }}
                onPress={() => {
                  const text = reply.trim();
                  setReply("");
                  sendReply(text);
                  inputRef.current?.blur();
                  note("Messaggio inviato");
                }}
              >
                <T size={15} weight="700" color="#fff">Invia</T>
              </Pressable>
            ) : (
              <>
                <Pressable
                  hitSlop={6}
                  style={styles.icon}
                  accessibilityLabel="Mi piace"
                  onPress={() => {
                    store.toggleStoryLike(story.id);
                    if (!liked) {
                      tap("medium");
                      setLikePop(Date.now());
                    }
                  }}
                >
                  <LikeIcon on={liked} />
                </Pressable>
                <Pressable hitSlop={6} style={styles.icon} accessibilityLabel="Condividi" onPress={() => { tap(); note("Inviata"); }}>
                  <Send size={26} color="#fff" />
                </Pressable>
              </>
            )}
          </View>
        )}

        {toast ? <Toast key={toast.at} text={toast.text} bottom={keyboard ? keyboard + 70 : insets.bottom + 84} /> : null}
      </Animated.View>

      {menu ? (
        <DarkSheet onClose={() => setMenu(false)} bottom={insets.bottom}>
          {mine ? (
            <SheetRow
              warn
              label="Elimina"
              onPress={() => {
                setMenu(false);
                const id = story.id;
                if (deck.frames.length <= 1) {
                  // Last frame of this deck: close first so the next person's story never flashes in.
                  close("down");
                  setTimeout(() => store.deleteStory(id), 320);
                } else {
                  store.deleteStory(id);
                  note("Eliminata");
                }
              }}
            />
          ) : (
            <>
              <SheetRow label={`Silenzia ${deck.name}`} onPress={() => { setMenu(false); deck.frames.forEach((item) => store.markStorySeen(item.id)); spin(1); }} />
              <SheetRow warn label="Segnala" onPress={() => { setMenu(false); note("Segnalata"); }} />
            </>
          )}
          <SheetRow label="Annulla" onPress={() => setMenu(false)} />
        </DarkSheet>
      ) : null}

      {viewers ? (
        <DarkSheet onClose={() => setViewers(false)} bottom={insets.bottom}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 }}>
            <Eye size={20} color="#fff" />
            <T size={16} weight="700" color="#fff">{views}</T>
          </View>
          {PEOPLE.slice(0, 5).map((person, index) => (
            <View key={person.name} style={styles.viewer}>
              <Avatar src={person.src} size={44} />
              <T size={14.5} weight="600" color="#fff" style={{ flex: 1 }}>{person.name}</T>
              {index === 0 ? <Heart size={18} weight="fill" color="#ff3040" /> : null}
              <T size={13} color="rgba(255,255,255,0.55)">{index === 0 ? "Ora" : `${index + 1} h`}</T>
            </View>
          ))}
        </DarkSheet>
      ) : null}
    </View>
  );
}

// One side of the cube. Its place follows the deck position: -1 left, 0 front, 1 right.
function CubeFace({ index, front, pos, w, children }) {
  const style = useAnimatedStyle(() => {
    const x = Math.max(-1, Math.min(1, index - pos.value));
    const pivot = x >= 0 ? -w / 2 : w / 2;
    return {
      opacity: Math.abs(x) >= 0.999 ? 0 : 1,
      zIndex: Math.round(3 - Math.abs(x) * 2),
      transform: [{ perspective: w * 2.4 }, { translateX: x * w }, { translateX: pivot }, { rotateY: `${x * 90}deg` }, { translateX: -pivot }],
    };
  });
  const shade = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.abs(index - pos.value)) * 0.55 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backfaceVisibility: "hidden", overflow: "hidden", backgroundColor: "#111" }, front ? { zIndex: 3 } : { zIndex: 1, opacity: 0 }, style]}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#000" }, shade]} />
    </Animated.View>
  );
}

// A neighbouring face during the swipe: photo, caption, stickers and header, nothing interactive.
const QuietFace = memo(function QuietFace({ deck, index, u, w, h, top }) {
  const story = deck.frames[Math.max(0, Math.min(index, deck.frames.length - 1))];
  if (!story) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <StoryMedia frame={story} />
      <LinearGradient colors={["rgba(0,0,0,0.42)", "transparent"]} locations={[0, 0.22]} style={StyleSheet.absoluteFill} />
      {story.text ? <T size={26 * u} weight="700" color={story.textColor || "#fff"} style={styles.caption}>{story.text}</T> : null}
      <StoryStickers items={story.stickers} quiet w={w} h={h} u={u} />
      <View style={[styles.bars, { top: top + 6 }]}>
        {deck.frames.map((item, i) => <View key={item.id} style={styles.bar}><View style={[styles.barFill, { width: i < index ? "100%" : "0%" }]} /></View>)}
      </View>
      <Head deck={deck} story={story} top={top + 16} opacity={1} u={u} />
    </View>
  );
});

function Bars({ count, index, progress, top, opacity, ids }) {
  return (
    <View pointerEvents="none" style={[styles.bars, { top, opacity }]}>
      {ids.map((id, i) => (
        <View key={id} style={styles.bar}>
          {i === index ? <LiveBar progress={progress} /> : <View style={[styles.barFill, { width: i < index ? "100%" : "0%" }]} />}
        </View>
      ))}
    </View>
  );
}

function LiveBar({ progress }) {
  const style = useAnimatedStyle(() => ({ width: `${Math.min(1, progress.value) * 100}%` }));
  return <Animated.View style={[styles.barFill, style]} />;
}

function Head({ deck, story, top, opacity, u, onMore, onClose }) {
  const music = (story.stickers || []).find((item) => item.type === "music");
  const time = story.time === "Now" ? "Adesso" : story.time || "2 h";
  return (
    <View pointerEvents="box-none" style={[styles.head, { top, opacity }]}>
      <Image source={{ uri: deck.src }} style={{ width: 34 * u, height: 34 * u, borderRadius: 17 * u }} contentFit="cover" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
          <T size={14} weight="600" color="#fff" lines={1} style={styles.textShadow}>{deck.mine ? "La tua storia" : deck.name}</T>
          <T size={13} color="rgba(255,255,255,0.75)" style={styles.textShadow}>{time}</T>
        </View>
        {music ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Music size={12} weight="bold" color="rgba(255,255,255,0.9)" />
            <T size={12} color="rgba(255,255,255,0.9)" lines={1} style={styles.textShadow}>{music.title} · {music.artist}</T>
          </View>
        ) : null}
      </View>
      {onMore ? <Pressable hitSlop={8} style={styles.icon} accessibilityLabel="Altro" onPress={onMore}><More size={26} weight="bold" color="#fff" /></Pressable> : null}
      {onClose ? <Pressable hitSlop={8} style={styles.icon} accessibilityLabel="Chiudi" onPress={onClose}><Close size={26} color="#fff" /></Pressable> : null}
    </View>
  );
}

function LikeIcon({ on }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (on) scale.value = withSequence(withTiming(1.3, { duration: 160 }), withSpring(1, { damping: 8, stiffness: 300 }));
  }, [on, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Heart size={26} weight={on ? "fill" : "regular"} color={on ? "#ff3040" : "#fff"} />
    </Animated.View>
  );
}

function LikeBurst({ u }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withSpring(1, { damping: 9, stiffness: 260 }), withDelay(300, withTiming(2, { duration: 260 })));
  }, [v]);
  const style = useAnimatedStyle(() => ({
    opacity: v.value <= 1 ? v.value : 2 - v.value,
    transform: [{ scale: v.value <= 1 ? 0.4 + v.value * 0.6 : 1 + (v.value - 1) * 0.2 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.burst, style]}>
      <Heart size={110 * u} weight="fill" color="#ff3040" />
    </Animated.View>
  );
}

function FlyEmoji({ item, u }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(item.d, withTiming(1, { duration: 1500, easing: Easing.bezier(0.2, 0.7, 0.3, 1) }));
  }, [item.d, v]);
  const style = useAnimatedStyle(() => {
    const t = v.value;
    const early = Math.min(1, t / 0.15);
    return {
      opacity: t === 0 ? 0 : t < 0.15 ? early : 1 - (t - 0.15) / 0.85,
      transform: [
        { translateY: t < 0.15 ? -60 * u * early : -60 * u - (520 - 60) * u * ((t - 0.15) / 0.85) },
        { scale: t < 0.15 ? 0.4 + 0.75 * early : 1.15 - 0.25 * ((t - 0.15) / 0.85) },
        { rotate: `${t < 0.15 ? item.r * early : item.r - 2 * item.r * ((t - 0.15) / 0.85)}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", zIndex: 21, bottom: 90 * u, left: `${item.x}%` }, style]}>
      <T size={46 * u}>{item.char}</T>
    </Animated.View>
  );
}

function ReactButton({ char, delay, onPress }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 260 }));
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value), transform: [{ scale: 0.3 + 0.7 * v.value }, { translateY: (1 - v.value) * 18 }] }));
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ width: 64, height: 64, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 1.25 : 1 }] })}>
      <Animated.View style={style}><T size={42} style={{ lineHeight: 52 }}>{char}</T></Animated.View>
    </Pressable>
  );
}

function Toast({ text, bottom }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withTiming(1, { duration: 160 }), withDelay(720, withTiming(2, { duration: 220 })));
  }, [v]);
  const style = useAnimatedStyle(() => ({
    opacity: v.value <= 1 ? v.value : 2 - v.value,
    transform: [{ translateY: v.value <= 1 ? 8 * (1 - v.value) : -6 * (v.value - 1) }, { scale: v.value <= 1 ? 0.9 + 0.1 * v.value : 1 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom }, style]}>
      <T size={13.5} weight="600" color="#fff">{text}</T>
    </Animated.View>
  );
}

function Spinner() {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withTiming(360 * 40, { duration: 800 * 40, easing: Easing.linear });
    return () => cancelAnimation(v);
  }, [v]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value}deg` }] }));
  return <Animated.View style={[{ width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: "rgba(255,255,255,0.25)", borderTopColor: "#fff" }, style]} />;
}

function DarkSheet({ children, onClose, bottom }) {
  const y = useSharedValue(400);
  useEffect(() => {
    y.value = withTiming(0, { duration: 380, easing: EASE });
  }, [y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }]} onPress={onClose} />
      <Animated.View style={[styles.sheet, { paddingBottom: bottom + 22 }, style]}>
        <View style={styles.grab} />
        {children}
      </Animated.View>
    </View>
  );
}

function SheetRow({ label, warn, onPress }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [styles.sheetRow, pressed ? { backgroundColor: "rgba(255,255,255,0.06)" } : null]}>
      <T size={15.5} color={warn ? "#ff3040" : "#fff"}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...StyleSheet.absoluteFill, overflow: "hidden", backgroundColor: "#000" },
  caption: { position: "absolute", left: "8%", right: "8%", top: "44%", textAlign: "center", letterSpacing: -0.8, textShadowColor: "rgba(0,0,0,0.45)", textShadowRadius: 14, textShadowOffset: { width: 0, height: 2 } },
  bars: { position: "absolute", left: 8, right: 8, flexDirection: "row", gap: 3 },
  bar: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.35)", overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: "#fff" },
  head: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 12, paddingRight: 4 },
  textShadow: { textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  spin: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  foot: { position: "absolute", zIndex: 20, left: 12, right: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  reply: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", paddingHorizontal: 18, justifyContent: "center" },
  replyInput: { color: "#fff", fontSize: 15, height: 44, padding: 0 },
  face: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#000", marginRight: -9 },
  closed: { position: "absolute", zIndex: 20, left: 0, right: 0, textAlign: "center" },
  reactions: { ...StyleSheet.absoluteFill, zIndex: 19, alignItems: "center", justifyContent: "center", gap: 22, paddingBottom: 80, backgroundColor: "rgba(0,0,0,0.62)" },
  reactGrid: { width: 4 * 64 + 3 * 10, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 14 },
  burst: { position: "absolute", zIndex: 21, left: 0, right: 0, top: "40%", alignItems: "center" },
  toast: { position: "absolute", zIndex: 22, alignSelf: "center", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 99, backgroundColor: "rgba(38,38,38,0.92)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 8, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: "#262626" },
  grab: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.3)" },
  sheetRow: { paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.08)" },
  viewer: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 20 },
});
