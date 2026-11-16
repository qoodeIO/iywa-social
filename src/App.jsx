import { Fragment, createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { LiveProvider, useLive } from "./live/LiveStore.jsx";
import { sounds } from "./live/sounds.js";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Archive,
  ChevronLeft,
  ChevronRight,
  SquarePlay,
  Heart,
  House,
  Image,
  MessageCircle,
  PenLine,
  MessageSquareText,
  AtSign,
  LayoutGrid,
  Play,
  Plus,
  Camera,
  SwitchCamera,
  BarChart2,
  CheckCheck,
  Hash,
  HelpCircle,
  Pencil,
  Link as LinkIcon,
  MapPin,
  Mic,
  MicOff,
  Music,
  Pause,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  Smile,
  Timer,
  X,
  Eye,
  EyeOff,
  MoreHorizontal,
  Search,
  Send,
  Settings,
  Users,
  Check,
  Clock,
  RotateCcw,
  UserPlus,
  UserMinus,
  LogOut,
  Minimize2,
  PhoneIncoming,
  Info,
  SquarePen,
  ChevronDown,
  Menu,
  SquarePlus,
  Flash,
  FlashOff,
  Hand,
  Sparkle,
  Download,
  Brush,
  Highlighter,
  Eraser,
  Undo,
  SoundOn,
  SoundOff,
  Star,
  TextIcon,
  Rows,
  Grid4,
  Checked,
  Ring,
  StickerIcon,
  BellOff,
  Trash,
  Reply,
  Carousel,
  Verified,
  Recent,
  PhoneOutgoing,
  PhoneMissed,
  Inbox,
  ArrowDown,
  Feather,
  Bag,
  Shop,
  Mail,
  Directions,
  Box,
  Truck,
  PriceTag,
  Trend,
  Lock,
  UserIcon,
  Warn,
  Sliders,
  Folder,
  AddCircle,
  MarkRead,
  ArrowRight,
  ChevronUp,
  Forward,
  Repost,
  Quote,
  Poll,
  Globe,
  Scribble,
  Pin,
  QrCode,
  Copy,
  NoteIcon,
  Medal,
  ReturnIcon,
  ShieldCheck,
  Bolt,
} from "./icons.jsx";
import qrcode from "qrcode-generator";

const SpacePrefs = createContext({ language: "en", likeCounts: true, suggested: true });

const PORTRAIT =
  "https://images.unsplash.com/photo-1633527068411-d479d0b782b6?auto=format&fit=crop&w=1400&h=1800&q=85&crop=faces";

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=240&h=240&q=80";
// The signed-in profile photo; SpaceStore updates it when the user changes it.
let AVATAR = DEFAULT_AVATAR;

const PEOPLE = [
  {
    name: "Marta Colle",
    meta: "Cucina · Torino",
    src: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Leo Bassi",
    meta: "Liuteria · Cremona",
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Adele Romano",
    meta: "Tessuti · Prato",
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&h=700&q=80",
  },
  {
    name: "Nico Serra",
    meta: "Ricerca · Bologna",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&h=700&q=80",
  },
];

const TAB_ORDER = ["home", "search", "reel", "messages", "profile"];

const TABS = [
  { id: "home", label: "Home" },
  { id: "reel", label: "Reel" },
  { id: "search", label: "Search" },
  { id: "messages", label: "Messages" },
  { id: "profile", label: "Profile" },
];

const DIRECTORY = [
  { name: "Marta Colle", handle: "@cucina.colle", craft: "Cucina", city: "Torino", src: PEOPLE[0].src },
  { name: "Leo Bassi", handle: "@bassi.liuteria", craft: "Liuteria", city: "Cremona", src: PEOPLE[1].src },
  { name: "Adele Romano", handle: "@romano.tessuti", craft: "Tessuti", city: "Prato", src: PEOPLE[2].src },
  { name: "Nico Serra", handle: "@serra.ricerca", craft: "Ricerca", city: "Bologna", src: PEOPLE[3].src },
  { name: "Giulia Neri", handle: "@forno.neri", craft: "Ceramica", city: "Milano", src: AVATAR },
];

const CRAFTS = ["All", "Ceramica", "Cucina", "Liuteria", "Tessuti", "Ricerca"];

const CITIES = [
  { name: "Milano", count: "1 cantiere" },
  { name: "Torino", count: "1 cantiere" },
  { name: "Cremona", count: "1 cantiere" },
  { name: "Prato", count: "1 cantiere" },
  { name: "Bologna", count: "1 cantiere" },
];

function voiceTone() {
  const rate = 8000;
  const seconds = 2.4;
  const n = rate * seconds;
  const bytes = new Uint8Array(44 + n);
  const view = new DataView(bytes.buffer);
  const write = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + n, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  write(36, "data");
  view.setUint32(40, n, true);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    const env = Math.min(1, t * 14) * Math.min(1, (seconds - t) * 8);
    const wobble = 0.55 + 0.45 * Math.sin(t * 9);
    const sample = Math.sin(2 * Math.PI * 196 * t) * 0.34 + Math.sin(2 * Math.PI * 294 * t) * 0.18;
    bytes[44 + i] = 128 + Math.round(sample * env * wobble * 96);
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 4096) bin += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return `data:audio/wav;base64,${btoa(bin)}`;
}

const VOICE_DEMO = voiceTone();
const VOICE_WAVE = [28, 46, 72, 40, 90, 58, 34, 76, 96, 48, 36, 82, 62, 42, 88, 54, 32, 70, 44, 84, 38, 66, 50, 78, 34, 60];
const SHOT_FIRE = "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&h=1200&q=80";
const SHOT_CUPS = "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&h=1200&q=80";

function clockNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

const THREADS = [
  {
    id: "t1",
    name: "Leo Bassi",
    kind: "Riferimento",
    preview: "Il bordo regge se lo lasci raffreddare.",
    time: "2h",
    unread: true,
    src: PEOPLE[1].src,
    messages: [
      { from: "them", text: "Ho visto il bordo. Il rosso regge.", time: "13:40" },
      { from: "them", kind: "image", image: SHOT_FIRE, text: "Da vicino.", time: "13:41" },
      { from: "me", text: "L'ho lasciato raffreddare tutta la notte.", time: "13:58" },
      { from: "them", text: "Il bordo regge se lo lasci raffreddare.", time: "14:11" },
    ],
  },
  {
    id: "t2",
    name: "Marta Colle",
    kind: "Domanda",
    preview: "Che temperatura per il secondo fuoco?",
    time: "5h",
    unread: true,
    src: PEOPLE[0].src,
    messages: [
      { from: "them", text: "Che temperatura per il secondo fuoco?", time: "09:12" },
      { from: "me", text: "Millequattro, lento. Il rosso non brucia.", time: "09:18" },
      { from: "them", kind: "audio", audio: VOICE_DEMO, duration: 2, wave: VOICE_WAVE, time: "09:19" },
    ],
  },
  {
    id: "t3",
    name: "Adele Romano",
    kind: "Offerta",
    preview: "Ho un rosso di Prato, se ti serve.",
    time: "Ieri",
    unread: false,
    src: PEOPLE[2].src,
    messages: [
      { from: "them", text: "Ho un rosso di Prato, se ti serve.", time: "18:40" },
      { from: "me", kind: "image", image: SHOT_CUPS, text: "Queste, se ci sta.", time: "18:44" },
      { from: "them", text: "Te lo tengo da parte, vicino al telaio.", time: "18:51" },
    ],
  },
  {
    id: "t4",
    name: "Nico Serra",
    kind: "Domanda",
    preview: "Posso passare dal forno giovedì?",
    time: "3g",
    unread: false,
    src: PEOPLE[3].src,
    messages: [
      { from: "them", text: "Posso passare dal forno giovedì?", time: "11:02" },
      { from: "me", text: "Giovedì il forno è acceso. Vieni dopo le quattro.", time: "11:16" },
    ],
  },
  {
    id: "t5",
    name: "Chiara Valli",
    kind: "Offerta",
    preview: "Il lino sul banco.",
    time: "4g",
    unread: false,
    src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=480&h=480&q=80",
    messages: [
      { from: "them", text: "Ho del lino grezzo, se ti serve per il banco.", time: "16:20" },
      { from: "me", text: "Sì. Lo passo a prendere sabato.", time: "16:28" },
      { from: "them", kind: "image", image: SHOT_CUPS, text: "Il lino sul banco.", time: "16:30" },
    ],
  },
  {
    id: "t6",
    name: "Pietro Lama",
    kind: "Domanda",
    preview: "Il forno regge una teglia larga?",
    time: "5g",
    unread: true,
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&h=480&q=80",
    messages: [
      { from: "them", text: "Il forno regge una teglia larga?", time: "12:04" },
      { from: "me", text: "Sì, se la infili dopo il primo calore.", time: "12:11" },
    ],
  },
  {
    id: "t7",
    name: "Sara Conte",
    kind: "Riferimento",
    preview: "A Faenza il rosso si ferma un tono sotto.",
    time: "1sett",
    unread: false,
    src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=480&h=480&q=80",
    messages: [
      { from: "them", text: "A Faenza il rosso si ferma un tono sotto.", time: "15:33" },
      { from: "me", text: "Lo segno. Grazie del riferimento.", time: "15:40" },
    ],
  },
  {
    id: "t8",
    name: "Elena Marini",
    kind: "Domanda",
    preview: "Posso citare il forno nella nota di Padova?",
    time: "1sett",
    unread: false,
    src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=480&h=480&q=80",
    messages: [
      { from: "them", text: "Posso citare il forno nella nota di Padova?", time: "10:18" },
      { from: "me", text: "Certo. Scrivi solo che il rosso regge.", time: "10:26" },
    ],
  },
];

const RECENT_CALLS = [
  { id: "seed-adele", threadId: "t3", call: "video", from: "them", duration: 0, time: "Ieri" },
  { id: "seed-leo", threadId: "t1", call: "voice", from: "me", duration: 184, time: "Lun" },
  { id: "seed-marta", threadId: "t2", call: "voice", from: "them", duration: 46, time: "Dom" },
];

const CONTACTS = [
  { name: "Marta Colle", meta: "Cucina · Torino", src: PEOPLE[0].src },
  { name: "Leo Bassi", meta: "Liuteria · Cremona", src: PEOPLE[1].src },
  { name: "Adele Romano", meta: "Tessuti · Prato", src: PEOPLE[2].src },
  { name: "Nico Serra", meta: "Ricerca · Bologna", src: PEOPLE[3].src },
  { name: "Chiara Valli", meta: "Tessuti · Firenze", src: THREADS[4].src },
  { name: "Pietro Lama", meta: "Cucina · Genova", src: THREADS[5].src },
  { name: "Sara Conte", meta: "Ceramica · Faenza", src: THREADS[6].src },
  { name: "Elena Marini", meta: "Ricerca · Padova", src: THREADS[7].src },
  { name: "Irene Fossati", meta: "Ceramica · Venezia", src: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=480&h=480&q=80" },
  { name: "Marco Dente", meta: "Liuteria · Napoli", src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=480&h=480&q=80" },
];

const WORKS = [
  { src: PORTRAIT, caption: "Smalto rosso" },
  { src: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?auto=format&fit=crop&w=900&h=1200&q=80", caption: "Secondo fuoco" },
  { src: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=900&h=1200&q=80", caption: "Coppe" },
  { src: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&h=1200&q=80", caption: "Argilla" },
];

const STATS = [
  { id: "works", value: "12", label: "Works" },
  { id: "following", value: "86", label: "Following" },
  { id: "followers", value: "1.4k", label: "Followers" },
];

const HERO = {
  id: "hero",
  name: "Giulia Neri",
  handle: "@forno.neri",
  avatar: AVATAR,
  image: PORTRAIT,
  text: "Prima prova del nuovo smalto con @bassi.liuteria. Il rosso regge. #ceramica #secondoFuoco",
  likes: "1.8k",
  saves: "98",
  kind: "post",
  mine: true,
  tags: ["Leo Bassi", "Sara Conte"],
  thread: [
    { name: "Leo Bassi", text: "Il bordo tiene. #ceramica" },
    { name: "Marta Colle", text: "Lo voglio sul banco. @forno.neri quando lo porti?" },
    { name: "Adele Romano", text: "@forno.neri guarda questo rosso! #ceramica" },
  ],
};

const POSTS = [
  HERO,
  {
    id: "w2",
    name: "Giulia Neri",
    handle: "@forno.neri",
    avatar: AVATAR,
    image: WORKS[1].src,
    text: "Secondo fuoco, lento.",
    likes: "640",
    saves: "40",
    kind: "post",
    mine: true,
    thread: [{ name: "Nico Serra", text: "La temperatura è giusta." }],
  },
  {
    id: "w3",
    name: "Giulia Neri",
    handle: "@forno.neri",
    avatar: AVATAR,
    image: WORKS[2].src,
    text: "Le coppe hanno tenuto.",
    likes: "410",
    saves: "22",
    kind: "post",
    mine: true,
    thread: [{ name: "Pietro Lama", text: "Le voglio a tavola." }],
  },
  {
    id: "w4",
    name: "Giulia Neri",
    handle: "@forno.neri",
    avatar: AVATAR,
    image: WORKS[3].src,
    text: "Argilla ancora aperta.",
    likes: "220",
    saves: "18",
    kind: "post",
    mine: true,
    thread: [{ name: "Sara Conte", text: "Un tono sotto." }],
  },
  {
    id: "p-marta",
    name: "Marta Colle",
    handle: "@cucina.colle",
    avatar: PEOPLE[0].src,
    image: WORKS[2].src,
    text: "Prima prova a tavola.",
    likes: "612",
    saves: "88",
    kind: "post",
    tagged: true,
    thread: [{ name: "Giulia Neri", text: "Il fuoco era lento, giusto." }],
  },
  {
    id: "p-adele",
    name: "Adele Romano",
    handle: "@romano.tessuti",
    avatar: PEOPLE[2].src,
    image: PEOPLE[2].src,
    text: "Il rosso di Prato, sul telaio.",
    likes: "2.4k",
    saves: "140",
    kind: "post",
    tagged: true,
    thread: [{ name: "Giulia Neri", text: "Tienilo lontano dal forno." }],
  },
];

const STORY_DECKS = [
  {
    id: "marta",
    name: "Marta",
    full: "Marta Colle",
    src: PEOPLE[0].src,
    frames: [
      {
        id: "st-marta-1",
        image: WORKS[2].src,
        text: "Impasto del mattino.",
        time: "2h",
        stickers: [
          { type: "music", title: "Impasto", artist: "Marta Colle", x: 50, y: 20 },
          { type: "place", name: "Torino", x: 50, y: 32 },
        ],
      },
      {
        id: "st-marta-2",
        image: WORKS[1].src,
        text: "Secondo fuoco, lento.",
        time: "2h",
        stickers: [{ type: "poll", question: "Il secondo fuoco?", a: "1400", b: "1600", av: 28, bv: 9, x: 50, y: 64 }],
      },
    ],
  },
  {
    id: "adele",
    name: "Adele",
    full: "Adele Romano",
    src: PEOPLE[2].src,
    frames: [
      {
        id: "st-adele-1",
        image: PEOPLE[2].src,
        text: "Rosso di Prato.",
        time: "4h",
        stickers: [
          { type: "music", title: "Rosso di Prato", artist: "Adele Romano", x: 50, y: 20 },
          { type: "tag", name: "Giulia Neri", x: 50, y: 33 },
          { type: "product", owner: "Adele Romano", productId: "ar1", name: "Camicia in lino", price: 120, image: "https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=200&h=200&q=80", x: 50, y: 70 },
        ],
      },
      {
        id: "st-adele-2",
        image: WORKS[0].src,
        text: "Il telaio tiene il colore.",
        time: "4h",
        stickers: [
          { type: "hash", tag: "rosso", x: 50, y: 22 },
          { type: "gif", label: "ROSSO", tone: "red", x: 50, y: 36 },
        ],
      },
    ],
  },
  {
    id: "leo",
    name: "Leo",
    full: "Leo Bassi",
    src: PEOPLE[1].src,
    frames: [
      {
        id: "st-leo-0",
        image: "https://images.unsplash.com/photo-1465821185615-20b3c2fbf41b?auto=format&fit=crop&w=900&h=1125&q=80",
        text: "Pronto per la vernice.",
        time: "5h",
        stickers: [{ type: "product", owner: "Leo Bassi", productId: "lb1", name: "Violino su misura", price: 6800, image: "https://images.unsplash.com/photo-1465821185615-20b3c2fbf41b?auto=format&fit=crop&w=200&h=200&q=80", x: 50, y: 72 }],
      },
      {
        id: "st-leo-1",
        image: PEOPLE[1].src,
        text: "Il bordo, da vicino.",
        time: "6h",
        stickers: [{ type: "ask", prompt: "Che temperatura usi?", x: 50, y: 62 }],
      },
      {
        id: "st-leo-2",
        image: WORKS[3].src,
        text: "Ancora umido.",
        time: "6h",
        stickers: [{ type: "slider", prompt: "Quanto è umido?", char: "💧", value: 70, x: 50, y: 64 }],
      },
    ],
  },
  {
    id: "nico",
    name: "Nico",
    full: "Nico Serra",
    src: PEOPLE[3].src,
    frames: [
      {
        id: "st-nico-1",
        image: WORKS[3].src,
        text: "Argilla di Bologna.",
        time: "8h",
        stickers: [{ type: "quiz", question: "L'argilla è di?", options: ["Faenza", "Bologna", "Prato"], answer: 1, x: 50, y: 62 }],
      },
    ],
  },
  {
    id: "chiara",
    name: "Chiara",
    full: "Chiara Valli",
    src: THREADS[4].src,
    frames: [
      {
        id: "st-chiara-1",
        image: THREADS[4].src,
        text: "Lino grezzo.",
        time: "12h",
        stickers: [
          { type: "place", name: "Firenze", x: 50, y: 22 },
          { type: "link", label: "Il lino", x: 50, y: 34 },
        ],
      },
      {
        id: "st-chiara-2",
        image: WORKS[2].src,
        text: "Taglio del mattino.",
        time: "12h",
        stickers: [
          { type: "count", label: "Taglio", when: "Domani", x: 50, y: 22 },
          { type: "emoji", char: "✨", x: 30, y: 42 },
          { type: "notify", x: 50, y: 68 },
        ],
      },
    ],
  },
];

const HIGHLIGHTS = [
  {
    id: "h-forno",
    name: "Forno",
    full: "Giulia Neri",
    src: WORKS[1].src,
    mine: true,
    frames: [
      { id: "h-forno-1", image: WORKS[1].src, text: "Secondo fuoco, lento.", time: "3g" },
      { id: "h-forno-2", image: PORTRAIT, text: "Il rosso regge.", time: "3g" },
    ],
  },
  {
    id: "h-rosso",
    name: "Rosso",
    full: "Giulia Neri",
    src: PORTRAIT,
    mine: true,
    frames: [
      { id: "h-rosso-1", image: PORTRAIT, text: "Prima prova dello smalto.", time: "1sett" },
      { id: "h-rosso-2", image: WORKS[0].src, text: "Un tono sotto.", time: "1sett" },
    ],
  },
  {
    id: "h-banco",
    name: "Banco",
    full: "Giulia Neri",
    src: WORKS[2].src,
    mine: true,
    frames: [
      { id: "h-banco-1", image: WORKS[2].src, text: "Coppe sul banco.", time: "2sett" },
      { id: "h-banco-2", image: WORKS[3].src, text: "Argilla ancora aperta.", time: "2sett" },
    ],
  },
  {
    id: "h-lino",
    name: "Lino",
    full: "Giulia Neri",
    src: WORKS[0].src,
    mine: true,
    frames: [
      { id: "h-lino-1", image: WORKS[0].src, text: "Il telaio tiene il colore.", time: "1m" },
    ],
  },
];

const NOTES = [
  { id: "ns1", name: "Marta Colle", text: "Ha risposto alla tua storia.", time: "20m", src: PEOPLE[0].src, storyId: "marta" },
  { id: "ns2", name: "Leo Bassi", text: "Ha votato il sondaggio della storia.", time: "1h", src: PEOPLE[1].src, storyId: "leo" },
  { id: "ns3", name: "Adele Romano", text: "Ha messo mi piace alla tua storia.", time: "3h", src: PEOPLE[2].src, storyId: "adele" },
  { id: "ns4", name: "Nico Serra", text: "Ha risposto al quiz della storia.", time: "5h", src: PEOPLE[3].src, storyId: "nico" },
  { id: "n5", name: "Chiara Valli", text: "Ti ha taggato in una storia.", time: "2g", src: THREADS[4].src, storyId: "chiara" },
  { id: "n1", name: "Leo Bassi", text: "Ha lasciato un riferimento sul bordo.", time: "2h", src: PEOPLE[1].src, postId: "hero" },
  { id: "n2", name: "Marta Colle", text: "Ha iniziato a seguirti.", time: "5h", src: PEOPLE[0].src },
  { id: "n3", name: "Adele Romano", text: "Ha salvato le note del forno.", time: "1g", src: PEOPLE[2].src, postId: "w2" },
  { id: "n4", name: "Nico Serra", text: "Ha scritto: il bordo tiene.", time: "1g", src: PEOPLE[3].src, postId: "w4" },
];

function asPost(item) {
  return {
    id: item.id,
    name: item.name,
    handle: item.handle,
    avatar: item.src,
    image: item.image || null,
    text: item.text,
    likes: item.likes,
    saves: item.saves,
    kind: item.type || item.kind || "post",
    thread: [
      { name: "Leo Bassi", text: "Il bordo tiene." },
      { name: "Marta Colle", text: "Lo voglio sul banco." },
    ],
  };
}

const REELS = [
  {
    id: "r1",
    name: "Adele Romano",
    handle: "@romano.tessuti",
    caption: "Il rosso di Prato, sul telaio.",
    audio: "Telaio",
    length: "0:12",
    src: PEOPLE[2].src,
    avatar: PEOPLE[2].src,
    likes: "2.4k",
    comments: "86",
    saves: "140",
    thread: [
      { name: "Giulia Neri", text: "Quel rosso tiene anche sul banco." },
      { name: "Leo Bassi", text: "Lo voglio vedere da vicino." },
    ],
  },
  {
    id: "r2",
    name: "Giulia Neri",
    handle: "@forno.neri",
    caption: "Secondo fuoco, lento. Il rosso non brucia.",
    audio: "Forno",
    length: "0:18",
    src: PORTRAIT,
    avatar: AVATAR,
    likes: "8.1k",
    comments: "347",
    saves: "980",
    thread: [
      { name: "Marta Colle", text: "Millequattro, giusto." },
      { name: "Nico Serra", text: "Il bordo resta aperto." },
    ],
  },
  {
    id: "r3",
    name: "Marta Colle",
    handle: "@cucina.colle",
    caption: "Impasto del mattino. Il fuoco era lento.",
    audio: "Impasto",
    length: "0:09",
    src: WORKS[2].src,
    avatar: PEOPLE[0].src,
    likes: "3.2k",
    comments: "64",
    saves: "210",
    thread: [
      { name: "Pietro Lama", text: "Le coppe hanno tenuto." },
      { name: "Adele Romano", text: "Lo voglio a tavola." },
    ],
  },
  {
    id: "r4",
    name: "Leo Bassi",
    handle: "@bassi.liuteria",
    caption: "Il bordo, da vicino. Un tono sotto, e tiene.",
    audio: "Bordo",
    length: "0:21",
    src: PEOPLE[1].src,
    avatar: PEOPLE[1].src,
    likes: "1.6k",
    comments: "41",
    saves: "88",
    thread: [
      { name: "Giulia Neri", text: "Non forzare il rosso." },
      { name: "Sara Conte", text: "A Faenza si ferma lì." },
    ],
  },
  {
    id: "r5",
    name: "Nico Serra",
    handle: "@serra.ricerca",
    caption: "Argilla di Bologna, ancora aperta.",
    audio: "Argilla",
    length: "0:15",
    src: WORKS[3].src,
    avatar: PEOPLE[3].src,
    likes: "903",
    comments: "54",
    saves: "120",
    thread: [
      { name: "Elena Marini", text: "La cito nella nota di Padova." },
      { name: "Leo Bassi", text: "Giovedì il forno è acceso." },
    ],
  },
  {
    id: "r6",
    name: "Chiara Valli",
    handle: "@valli.lino",
    caption: "Lino grezzo, prima del taglio.",
    audio: "Lino",
    length: "0:11",
    src: THREADS[4].src,
    avatar: THREADS[4].src,
    likes: "740",
    comments: "19",
    saves: "66",
    thread: [
      { name: "Adele Romano", text: "Tienilo lontano dal forno." },
      { name: "Marta Colle", text: "Sul banco ci sta." },
    ],
  },
];

const MEET = [
  { name: "Chiara Valli", meta: "Tessuti · Firenze", src: THREADS[4].src },
  { name: "Pietro Lama", meta: "Cucina · Genova", src: THREADS[5].src },
  { name: "Sara Conte", meta: "Ceramica · Faenza", src: THREADS[6].src },
  { name: "Elena Marini", meta: "Ricerca · Padova", src: THREADS[7].src },
  ...PEOPLE,
];

const FEED_PAGES = [
  [
    {
      id: "tw1",
      type: "tweet",
      name: "Leo Bassi",
      handle: "@bassi.liuteria",
      time: "2h",
      src: PEOPLE[1].src,
      text: "Il bordo regge se lo lasci raffreddare. Non forzare il rosso: un tono sotto, e tiene.",
      likes: "248",
      comments: "36",
      saves: "19",
    },
    {
      id: "ph1",
      type: "post",
      name: "Marta Colle",
      handle: "@cucina.colle",
      time: "5h",
      src: PEOPLE[0].src,
      image: WORKS[2].src,
      text: "Prima prova a tavola. Il fuoco era lento, le coppe hanno tenuto.",
      likes: "612",
      comments: "41",
      saves: "88",
    },
  ],
  [
    {
      id: "rl1",
      type: "reel",
      name: "Nico Serra",
      handle: "@serra.ricerca",
      time: "1g",
      src: PEOPLE[3].src,
      image: WORKS[3].src,
      text: "Argilla di Bologna, ancora aperta.",
      length: "0:15",
      likes: "903",
      comments: "54",
      saves: "120",
    },
    {
      id: "tw2",
      type: "tweet",
      name: "Adele Romano",
      handle: "@romano.tessuti",
      time: "1g",
      src: PEOPLE[2].src,
      text: "Ho un rosso di Prato, se ti serve. Sta vicino al telaio, non al forno.",
      likes: "176",
      comments: "22",
      saves: "64",
    },
  ],
  [
    {
      id: "ph2",
      type: "post",
      name: "Sara Conte",
      handle: "@conte.faenza",
      time: "3g",
      src: THREADS[6].src,
      image: WORKS[1].src,
      text: "A Faenza il rosso si ferma un tono sotto. Seconda cottura domani.",
      likes: "390",
      comments: "18",
      saves: "47",
    },
    {
      id: "tw3",
      type: "tweet",
      name: "Pietro Lama",
      handle: "@lama.cucina",
      time: "4g",
      src: THREADS[5].src,
      text: "Il forno regge una teglia larga, se la infili dopo il primo calore. Non prima.",
      likes: "128",
      comments: "15",
      saves: "9",
    },
  ],
];

const THEMES = [
  { id: "space", label: "Space", accent: "124 58 237", ink: "255 255 255" },
  { id: "rosso", label: "Rosso", accent: "255 64 58", ink: "255 255 255" },
  { id: "arancio", label: "Arancio", accent: "255 149 0", ink: "42 24 0" },
  { id: "giallo", label: "Giallo", accent: "255 214 10", ink: "42 32 0" },
  { id: "verde", label: "Verde", accent: "48 209 88", ink: "6 40 16" },
  { id: "teal", label: "Teal", accent: "32 210 198", ink: "0 36 34" },
  { id: "blu", label: "Blu", accent: "10 132 255", ink: "255 255 255" },
  { id: "viola", label: "Viola", accent: "191 90 242", ink: "255 255 255" },
  { id: "rosa", label: "Rosa", accent: "255 55 120", ink: "255 255 255" },
];

const TAB_ICONS = {
  reel: SquarePlay,
  search: Search,
  messages: MessageSquareText,
};

function Glyph({ icon: Icon }) {
  return <Icon strokeWidth={2} aria-hidden="true" />;
}

function StatusBar() {
  return (
    <div className="statusbar">
      <span className="time">9:38</span>
      <div className="island" aria-hidden="true">
        <span className="lens" />
      </div>
      <div className="status-icons" aria-hidden="true">
        <svg width="17" height="12" viewBox="0 0 17 12">
          <rect x="0" y="7.2" width="3" height="4.8" rx="0.7" fill="white" />
          <rect x="4.6" y="4.8" width="3" height="7.2" rx="0.7" fill="white" />
          <rect x="9.2" y="2.4" width="3" height="9.6" rx="0.7" fill="white" />
          <rect x="13.8" y="0" width="3" height="12" rx="0.7" fill="white" />
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12">
          <path
            d="M1.4 4.6a9.2 9.2 0 0 1 13.2 0"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3.8 7.2a5.6 5.6 0 0 1 8.4 0"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="10" r="1.15" fill="white" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13">
          <rect
            x="0.7"
            y="0.7"
            width="22"
            height="11.6"
            rx="3.2"
            fill="none"
            stroke="white"
            strokeOpacity="0.42"
            strokeWidth="1.2"
          />
          <rect x="2.3" y="2.3" width="16.4" height="8.4" rx="1.6" fill="white" />
          <path
            d="M24.2 4.4c.7.5 1.1 1.2 1.1 2.1s-.4 1.6-1.1 2.1"
            fill="none"
            stroke="white"
            strokeOpacity="0.5"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function Frame({ children }) {
  return (
    <div className="fit">
    <div className="device">
      <span className="side silent" />
      <span className="side vol-up" />
      <span className="side vol-down" />
      <span className="side power" />
      <div className="bezel">
        <div className="screen">{children}</div>
      </div>
    </div>
    </div>
  );
}

function RemoteImage({ src, alt, className, priority = false }) {
  const saver = useContext(SpacePrefs).dataSaver === true;
  const sized = saver && typeof src === "string"
    ? src.replace(/w=\d+/g, "w=480").replace(/q=\d+/g, "q=40")
    : src;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const imgRef = useRef(null);
  useEffect(() => {
    setReady(Boolean(imgRef.current?.complete && imgRef.current.naturalWidth));
  }, [sized]);
  if (failed) {
    return (
      <div className={`figure ${className || ""}`} role="img" aria-label={alt}>
        <span className="figure-head" />
        <span className="figure-body" />
      </div>
    );
  }
  return (
    <img
      ref={imgRef}
      className={`${className ? `${className} ` : ""}rimg${ready ? " ready" : ""}`}
      src={sized}
      alt={alt}
      draggable="false"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onLoad={() => setReady(true)}
      onError={() => setFailed(true)}
    />
  );
}

function HeartBurst() {
  return (
    <span className="burst" aria-hidden="true">
      <Heart weight="fill" aria-hidden="true" />
    </span>
  );
}

function parseCount(label) {
  const text = String(label ?? "0").trim().toLowerCase().replace(/\s/g, "");
  if (text.endsWith("k")) {
    const n = parseFloat(text);
    return Number.isFinite(n) ? Math.round(n * 1000) : 0;
  }
  const n = Number(text.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function tally(label, on) {
  if (!on) return label;
  return String(parseCount(label) + 1);
}

function commentCount(post, extras) {
  const added = Array.isArray(extras) ? extras.length : 0;
  const base = post.comments != null ? parseCount(post.comments) : (post.thread || []).length;
  return String(base + added);
}

function ActionRow({ liked, saved, likes, comments, saves, onLike, onSave, onComment, onShare }) {
  const showCounts = useContext(SpacePrefs).likeCounts !== false;
  return (
    <div className="actions">
      <button type="button" className={liked ? "pill on" : "pill"} onClick={onLike} aria-pressed={liked}>
        <Glyph icon={Heart} />
        {showCounts ? <span>{tally(likes, liked)}</span> : null}
      </button>
      <button type="button" className="pill" aria-label={`Commenti, ${comments}`} onClick={onComment}>
        <Glyph icon={MessageCircle} />
        {showCounts ? <span>{comments}</span> : null}
      </button>
      <button type="button" className={saved ? "pill on" : "pill"} onClick={onSave} aria-pressed={saved}>
        <Glyph icon={Bookmark} />
        {showCounts ? <span>{tally(saves, saved)}</span> : null}
      </button>
      <button type="button" className="pill share" aria-label="Condividi" onClick={onShare}>
        <Glyph icon={ArrowUpRight} />
      </button>
    </div>
  );
}

function StoryRing({ src, total = 1, seen = 0, tone = "live" }) {
  const raw = useId().replace(/:/g, "");
  const count = Math.max(1, total);
  const gap = count > 1 ? 11 : 0;
  const sweep = (360 - gap * count) / count;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (sweep / 360) * circ;
  return (
    <i className="story-ring">
      <svg viewBox="0 0 100 100" className="ring-svg" aria-hidden="true">
        <defs>
          <linearGradient id={`${raw}-b`} x1="18" y1="88" x2="82" y2="12">
            <stop offset="0" stopColor="#ffb800" />
            <stop offset="0.45" stopColor="#ff2d55" />
            <stop offset="1" stopColor="#c013d1" />
          </linearGradient>
          <linearGradient id={`${raw}-g`} x1="18" y1="88" x2="82" y2="12">
            <stop offset="0" stopColor="#1fd15a" />
            <stop offset="1" stopColor="#0aa344" />
          </linearGradient>
        </defs>
        {Array.from({ length: count }, (_, index) => {
          const watched = tone === "empty" || tone === "seen" || index < seen;
          const stroke = watched ? "var(--ring-muted)" : tone === "close" ? `url(#${raw}-g)` : `url(#${raw}-b)`;
          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              transform={`rotate(${-90 + index * (sweep + gap)} 50 50)`}
            />
          );
        })}
      </svg>
      <RemoteImage src={src} alt="" />
    </i>
  );
}

function personHidden(prefs, name, blockOnly = false) {
  if (!name) return false;
  const blocked = Array.isArray(prefs?.blocked) && prefs.blocked.includes(name);
  if (blocked || blockOnly) return blocked;
  return Array.isArray(prefs?.muted) && prefs.muted.includes(name);
}

function textHidden(prefs, text) {
  const blob = String(text || "").toLowerCase();
  const words = Array.isArray(prefs?.hiddenWords) ? prefs.hiddenWords : [];
  return words.some((word) => {
    const needle = String(word || "").trim().toLowerCase();
    return needle && blob.includes(needle);
  });
}

function shown(prefs, item) {
  return !personHidden(prefs, item?.name) && !textHidden(prefs, item?.text || item?.caption);
}

function canReach(prefs, follows, name, key) {
  const rule = prefs?.[key] || "everyone";
  if (rule === "off") return false;
  if (rule === "following") return Boolean(follows?.has?.(name));
  return true;
}

function FeedPost({ item, kind, liked, saved, onLike, onSave, onComment, onShare, onOpen, onDoubleLike, burst, playing, onPlay, mine, onArchive, onDelete, following, onFollow, extraComments }) {
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const showCounts = prefs.likeCounts !== false;
  const [menu, setMenu] = useState(false);
  const [slide, setSlide] = useState(0);
  const [showTags, setShowTags] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const nav = useContext(ThoughtNav);
  const shopItems = (item.products || []).map((ref) => ({ owner: ref.owner, product: SHOPS[ref.owner]?.products.find((entry) => entry.id === ref.id) })).filter((entry) => entry.product);
  const tapRef = useRef({ at: 0, timer: 0 });
  const comments = Number(commentCount(item, extraComments)) || 0;
  const images = Array.isArray(item.images) && item.images.length ? item.images : [item.image];
  const look = item.filter ? { filter: filterCss(item.filter) } : undefined;
  function tapMedia() {
    const now = Date.now();
    if (now - tapRef.current.at < 280) {
      window.clearTimeout(tapRef.current.timer);
      tapRef.current.at = 0;
      onDoubleLike?.();
      return;
    }
    tapRef.current.at = now;
    tapRef.current.timer = window.setTimeout(() => {
      tapRef.current.at = 0;
      if (kind === "reel") onPlay?.();
      else onOpen?.();
    }, 260);
  }
  return (
    <article className={`ig-post ${kind}`}>
      <header className="ig-head">
        <span className="ig-head-ring"><RemoteImage src={item.src || AVATAR} alt="" /></span>
        <span className="ig-head-copy">
          <strong>{item.name}</strong>
          <span>{kind === "reel" ? (item.audio || (it ? "Audio originale" : "Original audio")) : (item.handle || "")}</span>
        </span>
        {!mine && onFollow && !following ? (
          <button type="button" className="ig-follow-link" onClick={onFollow}>{it ? "Segui" : "Follow"}</button>
        ) : null}
        <button type="button" className="ig-icon" aria-label={it ? "Altro" : "More"} aria-expanded={menu} onClick={() => setMenu((value) => !value)}>
          <MoreHorizontal strokeWidth={2} />
        </button>
        {menu ? (
          <div className="ig-menu" role="menu">
            {mine ? (
              <>
                {onArchive ? <button type="button" role="menuitem" onClick={() => { setMenu(false); onArchive(); }}>{it ? "Archivia" : "Archive"}</button> : null}
                {onDelete ? <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); onDelete(); }}>{it ? "Elimina" : "Delete"}</button> : null}
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); onSave(); }}>{saved ? (it ? "Rimuovi dai salvati" : "Unsave") : (it ? "Salva" : "Save")}</button>
                {onFollow ? <button type="button" role="menuitem" onClick={() => { setMenu(false); onFollow(); }}>{following ? (it ? "Non seguire più" : "Unfollow") : (it ? "Segui" : "Follow")}</button> : null}
              </>
            )}
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onShare(); }}>{it ? "Condividi" : "Share"}</button>
          </div>
        ) : null}
      </header>
      {kind === "tweet" ? (
        <p className="ig-text">{item.text}</p>
      ) : (
        <div className={`ig-media${kind === "reel" ? " reel" : ""}${playing ? " on" : ""}${item.aspect === "1:1" ? " square" : ""}`}>
          {images.length > 1 ? (
            <>
              <div
                className="ig-track"
                role="group"
                aria-label={`${images.length} ${it ? "foto" : "photos"}`}
                onClick={tapMedia}
                onScroll={(event) => setSlide(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))}
              >
                {images.map((src, i) => <img key={`${i}-${String(src).slice(-24)}`} src={src} alt="" draggable="false" loading={i ? "lazy" : "eager"} style={look} />)}
              </div>
              <span key={slide} className="ig-count">{slide + 1}/{images.length}</span>
            </>
          ) : (
            <button type="button" className="ig-media-hit" aria-label={kind === "reel" ? `${playing ? "Pause" : "Play"} reel, ${item.name}` : `${it ? "Apri post di" : "Open post,"} ${item.name}`} onClick={tapMedia}>
              <img className="ig-one" src={item.image} alt="" draggable="false" style={look} />
            </button>
          )}
          {kind === "reel" ? (
            <>
              <span className="ig-reel-mark" aria-hidden="true"><SquarePlay strokeWidth={2} /></span>
              {!playing ? <span className="ig-play" aria-hidden="true"><Play strokeWidth={0} /></span> : null}
              <span className="reel-bar" aria-hidden="true"><i /></span>
            </>
          ) : null}
          {item.tags?.length && kind !== "reel" ? (
            <>
              <button type="button" className={`ig-tagbtn${showTags ? " on" : ""}`} aria-label={it ? "Persone taggate" : "Tagged people"} aria-pressed={showTags} onClick={(event) => { event.stopPropagation(); setShowTags((value) => !value); }}>
                <UserIcon weight="fill" />
              </button>
              {showTags ? (
                <div className="ig-tags">
                  {item.tags.map((name, index) => (
                    <TagName key={name} name={name} className="ig-tag-pill" style={{ "--x": `${18 + ((index * 37) % 60)}%`, "--y": `${30 + ((index * 23) % 45)}%`, "--i": index }} />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {shopItems.length ? (
            <>
              <button type="button" className={`ig-shopbtn${showShop ? " on" : ""}`} aria-label={it ? "Prodotti" : "Products"} aria-pressed={showShop} onClick={(event) => { event.stopPropagation(); setShowShop((value) => !value); }}>
                <Bag weight="fill" />
              </button>
              {showShop ? (
                <div className="ig-tags">
                  {shopItems.map(({ owner, product }, index) => (
                    <button key={product.id} type="button" className="ig-tag-pill ig-prod-pill" style={{ "--x": `${30 + ((index * 41) % 45)}%`, "--y": `${32 + ((index * 29) % 40)}%`, "--i": index }} onClick={(event) => { event.stopPropagation(); nav.product?.(product, owner); }}>
                      <strong>{product.name}</strong>
                      <em>{euro(product.price, it)}</em>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {burst ? <HeartBurst key={burst} /> : null}
        </div>
      )}
      {shopItems.length ? (
        <button type="button" className="ig-shop-strip" onClick={() => nav.product?.(shopItems[0].product, shopItems[0].owner)}>
          <Bag weight="fill" />
          <span>{it ? "Visualizza prodotti" : "View products"}{shopItems.length > 1 ? ` · ${shopItems.length}` : ""}</span>
          <ChevronRight strokeWidth={2.4} />
        </button>
      ) : null}
      <div className="ig-actions">
        <button type="button" className={liked ? "ig-act liked" : "ig-act"} aria-pressed={liked} aria-label={it ? "Mi piace" : "Like"} onClick={onLike}>
          <Heart weight={liked ? "fill" : "regular"} />
        </button>
        <button type="button" className="ig-act" aria-label={it ? "Commenta" : "Comment"} onClick={onComment}>
          <MessageCircle strokeWidth={2} />
        </button>
        <button type="button" className="ig-act" aria-label={it ? "Condividi" : "Share"} onClick={onShare}>
          <Send strokeWidth={2} />
        </button>
        {images.length > 1 ? (
          <span className="ig-dots" aria-hidden="true">{images.map((src, i) => <i key={`${i}-${String(src).slice(-16)}`} className={i === slide ? "on" : ""} />)}</span>
        ) : null}
        <button type="button" className={saved ? "ig-act save on" : "ig-act save"} aria-pressed={saved} aria-label={it ? "Salva" : "Save"} onClick={onSave}>
          <Bookmark weight={saved ? "fill" : "regular"} />
        </button>
      </div>
      <div className="ig-meta">
        {showCounts && !item.hideLikes ? <strong className="ig-likes">{tally(item.likes || "0", liked)} {it ? "Mi piace" : "likes"}</strong> : null}
        {item.tags?.length ? (
          <p className="ig-tagged"><AtSign />{item.tags.map((name, index) => (
            <Fragment key={name}>{index ? ", " : " "}<TagName name={name} /></Fragment>
          ))}</p>
        ) : null}
        {kind !== "tweet" && item.text ? <p className="ig-caption"><strong>{item.name}</strong> <RichText text={item.text} /></p> : null}
        {comments > 0 ? (
          <button type="button" className="ig-more" onClick={onComment}>
            {it ? `Mostra tutti i ${comments} commenti` : `View all ${comments} comments`}
          </button>
        ) : null}
        {item.time ? <time className="ig-time">{item.time}</time> : null}
      </div>
    </article>
  );
}

function Home({
  decks,
  seenStories,
  onOpenStory,
  onOpenCamera,
  onCameraMove,
  onCameraRelease,
  onOpenPost,
  profile,
  drops,
  onComment,
  onShare,
  onDrop,
  onChrome,
  postedAt = 0,
}) {
  const space = useSpace();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(null);
  const sentinel = useRef(null);
  const scrollRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [fresh, setFresh] = useState(false);
  const pullStart = useRef(null);
  const tap = useRef({ id: "", at: 0, timer: 0 });
  const camStart = useRef(null);
  const camPull = useRef(0);
  const camApi = useRef({});
  camApi.current = { move: onCameraMove, release: onCameraRelease };
  const [burst, setBurst] = useState(null);
  const prefs = useContext(SpacePrefs);
  const showPeople = prefs.suggested !== false;
  const nav = useContext(ThoughtNav);
  const thoughts = useThoughts();
  const myThoughts = thoughts.all.filter((item) => item.mine);
  const featured = ["th-thread", "th-poll"].map((id) => thoughts.byId.get(id)).filter(Boolean);

  function arm(id, single, double) {
    return () => {
      const now = Date.now();
      if (tap.current.id === id && now - tap.current.at < 280) {
        window.clearTimeout(tap.current.timer);
        tap.current = { id: "", at: 0, timer: 0 };
        double();
        return;
      }
      tap.current = { id, at: now, timer: window.setTimeout(single, 260) };
    };
  }
  const items = FEED_PAGES.slice(0, page).flat().filter((item) => shown(prefs, item) && !space.archived.has(item.id));
  const done = page >= FEED_PAGES.length;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || loading) return undefined;
    const root = node.closest(".home-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLoading(true);
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, loading, page]);

  useEffect(() => {
    if (!loading) return undefined;
    const timer = window.setTimeout(() => {
      setPage((current) => Math.min(FEED_PAGES.length, current + 1));
      setLoading(false);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [loading]);

  // Hide the top bar while scrolling down, bring it back when scrolling up.
  const chromeRef = useRef(onChrome);
  chromeRef.current = onChrome;
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    let last = node.scrollTop;
    let hidden = false;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = node.scrollTop;
        const next = top > 80 && top > last + 4 ? true : top < last - 4 || top < 40 ? false : hidden;
        last = top;
        if (next !== hidden) {
          hidden = next;
          chromeRef.current?.(next);
        }
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
      chromeRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    function down(event) {
      if (event.target.closest(".compose-card, input, textarea")) return;
      camStart.current = { x: event.clientX, y: event.clientY, mode: "" };
      if (node.scrollTop <= 0) pullStart.current = event.clientY;
    }
    function move(event) {
      const start = camStart.current;
      if (start && !start.mode) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          const rail = node.querySelector(".story-rail");
          start.mode = dx > 14 && dx > Math.abs(dy) && (!rail || rail.scrollLeft <= 2) ? "cam" : "scroll";
        }
      }
      if (start?.mode === "cam") {
        event.preventDefault();
        const screen = node.closest(".screen");
        const width = screen?.clientWidth || node.clientWidth;
        const next = Math.max(0, Math.min(event.clientX - start.x, width));
        camPull.current = next;
        camApi.current.move(next);
        return;
      }
      if (pullStart.current == null || node.scrollTop > 0 || start?.mode === "cam") return;
      const next = event.clientY - pullStart.current;
      if (next > 0) setPull(Math.min(next, 110));
    }
    function up() {
      if (camStart.current?.mode === "cam") {
        const screen = node.closest(".screen");
        const width = screen?.clientWidth || node.clientWidth;
        const open = camPull.current > width * 0.28;
        camPull.current = 0;
        camStart.current = null;
        pullStart.current = null;
        camApi.current.release(open, width);
        return;
      }
      camStart.current = null;
      if (pullStart.current == null) return;
      pullStart.current = null;
      setPull((value) => {
        if (value > 64) {
          setFresh(true);
          window.setTimeout(() => setFresh(false), 800);
        }
        return 0;
      });
    }
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move, { passive: false });
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
    };
  }, []);


  const yours = decks[0]?.mine ? decks[0] : null;
  const rest = (yours ? decks.slice(1) : decks).slice().sort((a, b) => {
    const aSeen = a.frames.every((frame) => seenStories.has(frame.id)) ? 1 : 0;
    const bSeen = b.frames.every((frame) => seenStories.has(frame.id)) ? 1 : 0;
    return aSeen - bSeen;
  });
  const yoursSeen = Boolean(yours?.frames.every((frame) => seenStories.has(frame.id)));
  function watched(deck) {
    return deck.frames.filter((frame) => seenStories.has(frame.id)).length;
  }

  const it = prefs.language === "it";
  function postProps(item, kind) {
    const post = asPost({ ...item, type: kind });
    const liked = space.likes.has(item.id);
    return {
      item,
      kind,
      liked,
      saved: space.saves.has(item.id),
      extraComments: space.comments[item.id],
      onLike: () => space.toggleLike(item.id),
      onSave: () => space.toggleSave(post),
      onComment: () => onComment(post),
      onShare: () => onShare(post),
      onOpen: () => onOpenPost(post),
      onDoubleLike: () => {
        navigator.vibrate?.(12);
        if (!liked) space.toggleLike(item.id);
        setBurst({ id: item.id, at: Date.now() });
      },
      burst: burst?.id === item.id ? burst.at : 0,
      playing: playing === item.id,
      onPlay: () => setPlaying(playing === item.id ? null : item.id),
      following: space.follows.has(item.name),
      onFollow: item.name && item.name !== profile.name ? () => space.toggleFollow(item.name) : undefined,
    };
  }
  const hero = {
    ...HERO,
    id: "hero",
    name: "Giulia Neri",
    handle: "Milano",
    src: AVATAR,
    image: PORTRAIT,
    text: "Prima prova del nuovo smalto con @bassi.liuteria. Il rosso regge. #ceramica #secondoFuoco",
    likes: "1.8k",
    time: it ? "2 ore fa" : "2 hours ago",
  };

  return (
    <div className="home view">
      <div className="home-scroll" ref={scrollRef}>
        <div className={fresh || pull > 12 ? "pull on" : "pull"} style={{ height: fresh ? "calc(28 * var(--u))" : `calc(${Math.round(pull * 0.35)} * var(--u))` }}>
          <span className="pull-spin" aria-hidden="true" />
        </div>
        <div className="story-rail">
          <div key={postedAt} className={`${yours ? (yoursSeen ? "story yours seen" : "story yours") : "story yours empty"}${postedAt && Date.now() - postedAt < 3000 ? " posted" : ""}`}>
            <button
              type="button"
              className="story-hit"
              onClick={(event) => {
                if (!yours) {
                  onOpenCamera();
                  return;
                }
                onOpenStory(yours.id, event.currentTarget.querySelector(".story-ring") || event.currentTarget);
              }}
            >
              <StoryRing src={AVATAR} total={yours?.frames.length || 1} seen={yours ? watched(yours) : 0} tone={yours ? (yoursSeen ? "seen" : yours.frames.some((frame) => frame.close) ? "close" : "live") : "empty"} />
              <b>{it ? "La tua storia" : "Your story"}</b>
            </button>
            <button type="button" className="story-add" aria-label={it ? "Nuova storia" : "New story"} onClick={onOpenCamera}>
              <Plus strokeWidth={3} aria-hidden="true" />
            </button>
          </div>
          {rest.map((story) => {
            const seenCount = watched(story);
            const seen = seenCount === story.frames.length;
            const close = (prefs.closeFriends || []).includes(story.full);
            return (
              <button
                key={story.id}
                type="button"
                className={seen ? "story seen" : close ? "story close" : "story"}
                onClick={(event) => onOpenStory(story.id, event.currentTarget.querySelector(".story-ring") || event.currentTarget)}
              >
                <StoryRing src={story.src} total={story.frames.length} seen={seenCount} tone={seen ? "seen" : close ? "close" : "live"} />
                <b>{story.name}</b>
              </button>
            );
          })}
        </div>

        <ComposePrompt onCompose={() => nav.compose?.({})} />

        {myThoughts.map((thought, index) => <ThoughtEntry key={thought.id} thought={thought} delay={index * 40} />)}

        {drops.filter((item) => shown(prefs, item) && !space.archived.has(item.id)).map((item) => {
          const shaped = {
            ...item,
            src: item.src || AVATAR,
            time: item.time === "Now" ? (it ? "Adesso" : "Just now") : (item.time || ""),
            comments: item.comments || "0",
            likes: item.likes || "0",
            saves: item.saves || "0",
          };
          return (
            <FeedPost
              key={shaped.id}
              {...postProps(shaped, shaped.kind === "tweet" ? "tweet" : shaped.kind === "reel" ? "reel" : "post")}
              mine
              onFollow={undefined}
              onArchive={() => space.toggleArchive(shaped.id)}
              onDelete={() => onDrop?.(shaped.id)}
            />
          );
        })}

        <FeedPost
          {...postProps(hero, "post")}
          onOpen={() => onOpenPost(HERO)}
          onSave={() => space.toggleSave(HERO)}
          onComment={() => onComment(HERO)}
          onShare={() => onShare(HERO)}
          extraComments={space.comments.hero}
          mine={profile.name === "Giulia Neri"}
          onArchive={undefined}
          onDelete={undefined}
        />

        {showPeople ? (
          <section className="ig-suggest">
            <header>
              <strong>{it ? "Persone che potresti conoscere" : "Suggested for you"}</strong>
            </header>
            <div className="h-rail meet-rail">
              {MEET.filter((person) => !personHidden(prefs, person.name)).map((person) => {
                const on = space.follows.has(person.name);
                return (
                  <article key={person.name} className="ig-suggest-card">
                    <RemoteImage className="ig-suggest-face" src={person.src} alt="" />
                    <strong>{person.name}</strong>
                    <span>{person.meta}</span>
                    <button
                      type="button"
                      className={on ? "ig-btn" : "ig-btn primary"}
                      aria-pressed={on}
                      onClick={() => space.toggleFollow(person.name)}
                    >
                      {on ? (it ? "Segui già" : "Following") : (it ? "Segui" : "Follow")}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {featured.length ? (
          <section className="tc-featured">
            <header>
              <strong><Feather weight="fill" />{it ? "Pensieri per te" : "Thoughts for you"}</strong>
              <button type="button" onClick={() => nav.list?.()}>{it ? "Vedi tutti" : "See all"}</button>
            </header>
            {featured.map((thought) => <ThoughtEntry key={thought.id} thought={thought} />)}
          </section>
        ) : null}

        <section className="ig-suggest reels">
          <header>
            <strong>Reels</strong>
          </header>
          <div className="h-rail">
            {REELS.filter((reel) => shown(prefs, reel)).map((reel) => {
              const on = playing === reel.id;
              return (
                <button
                  key={reel.id}
                  type="button"
                  className={on ? "reel-card on" : "reel-card"}
                  onClick={() => setPlaying(on ? null : reel.id)}
                  aria-pressed={on}
                  aria-label={`${on ? "Pause" : "Play"} reel, ${reel.name}`}
                >
                  <RemoteImage src={reel.src} alt="" />
                  <span className="reel-shade" />
                  <span className="reel-views"><Play strokeWidth={0} aria-hidden="true" />{reel.likes}</span>
                  <span className="reel-bar" aria-hidden="true"><i /></span>
                  <span className="reel-name">{reel.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {items.map((item) => (
          item.type === "tweet" && thoughts.byId.get(item.id)
            ? <ThoughtEntry key={item.id} thought={thoughts.byId.get(item.id)} />
            : <FeedPost key={item.id} {...postProps(item, item.type === "tweet" ? "tweet" : item.type === "reel" ? "reel" : "post")} />
        ))}

        <div className="feed-more" ref={sentinel}>
          {done ? (
            <span className="ig-caught">
              <i><CheckCheck strokeWidth={2} /></i>
              <strong>{it ? "Sei aggiornato" : "You're all caught up"}</strong>
              <span>{it ? "Hai visto tutti i nuovi post" : "You've seen all new posts"}</span>
            </span>
          ) : <span className="pull-spin" aria-label={it ? "Caricamento" : "Loading"} />}
        </div>
      </div>
    </div>
  );
}

function parseLength(label, fallback = 12) {
  const [m, s] = String(label || "").split(":").map(Number);
  const total = (m || 0) * 60 + (s || 0);
  return total > 0 ? total : fallback;
}

function clockLabel(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function reelClips(reel) {
  if (Array.isArray(reel.clips) && reel.clips.length) return reel.clips;
  if (reel.video) return [{ type: "video", src: reel.video, duration: parseLength(reel.length) }];
  return [{ type: "image", src: reel.image || reel.src, duration: parseLength(reel.length) }];
}

const REEL_SPEEDS = [0.5, 1, 1.5, 2];

// Plays a list of clips (video or photo with Ken Burns motion) as one reel.
function ReelPlayer({ clips, active, paused, rate = 1, muted, filter, loop = true, seekRef, onProgress, poster }) {
  const [index, setIndex] = useState(0);
  const [nonce, setNonce] = useState(0);
  const videoRef = useRef(null);
  const offset = useRef(0);
  const state = useRef({});
  const clip = clips[Math.min(index, clips.length - 1)];
  const lengths = clips.map((item) => Math.max(0.5, (item.duration || 3) / (item.rate || 1)));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  state.current = { index, clip, lengths, total, paused, active, rate };

  useEffect(() => {
    if (!active) return;
    offset.current = 0;
    setIndex(0);
    setNonce((value) => value + 1);
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }, [active]);

  function advance() {
    const { index: at } = state.current;
    offset.current = 0;
    if (at + 1 < clips.length) setIndex(at + 1);
    else if (loop) setIndex(0);
    setNonce((value) => value + 1);
  }

  if (seekRef) {
    seekRef.current = (fraction) => {
      const { lengths: list, total: sum } = state.current;
      let target = Math.max(0, Math.min(0.999, fraction)) * sum;
      let at = 0;
      while (at < list.length - 1 && target > list[at]) {
        target -= list[at];
        at += 1;
      }
      offset.current = target;
      setIndex(at);
      setNonce((value) => value + 1);
      window.requestAnimationFrame(() => {
        const video = videoRef.current;
        if (video && clips[at]?.type === "video") video.currentTime = target * (clips[at].rate || 1);
      });
    };
  }

  // Play / pause / speed for video clips.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate * (clip.rate || 1);
    video.muted = Boolean(muted);
    if (active && !paused) video.play().catch(() => { video.muted = true; video.play().catch(() => {}); });
    else video.pause();
  }, [active, paused, rate, muted, index, nonce, clip]);

  // One clock for progress and photo clips.
  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const s = state.current;
      if (s.clip.type === "video") {
        const video = videoRef.current;
        if (video && Number.isFinite(video.duration)) offset.current = video.currentTime / (s.clip.rate || 1);
      } else if (!s.paused) {
        offset.current += dt * s.rate;
        if (offset.current >= s.lengths[s.index]) {
          advance();
          raf = requestAnimationFrame(tick);
          return;
        }
      }
      const before = s.lengths.slice(0, s.index).reduce((sum, value) => sum + value, 0);
      onProgress?.((before + offset.current) / s.total, before + offset.current, s.total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const look = { filter: filterCss(filter) };
  if (!active) {
    return <img className="rp-media rp-poster" src={poster || (clips[0].type === "image" ? clips[0].src : "")} alt="" draggable="false" style={look} />;
  }
  if (clip.type === "video") {
    return (
      <video
        key={`${index}-${clip.src}`}
        ref={videoRef}
        className={`rp-media${clip.mirror ? " mirror" : ""}`}
        src={clip.src}
        style={look}
        playsInline
        muted={muted}
        preload="auto"
        loop={loop && clips.length === 1}
        onEnded={advance}
      />
    );
  }
  const seconds = lengths[index];
  return (
    <img
      key={`${index}-${nonce}`}
      className={`rp-media rp-kb kb-${index % 3}`}
      src={clip.src}
      alt=""
      draggable="false"
      style={{
        ...look,
        animationDuration: `${seconds}s`,
        animationDelay: `-${offset.current}s`,
        animationPlayState: paused ? "paused" : "running",
      }}
    />
  );
}

function ReelSlide({ reel, active, near, muted, onMute, onLike, onSave, onFollow, onComments, onShare, onMore, onAudio, liked, saved, following, mine, rate, captions, sheetOpen, it }) {
  const prefs = useContext(SpacePrefs);
  const showCounts = prefs.likeCounts !== false;
  const [paused, setPaused] = useState(false);
  const [boost, setBoost] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [flash, setFlash] = useState(null);
  const [scrub, setScrub] = useState(null);
  const barRef = useRef(null);
  const seekRef = useRef(null);
  const press = useRef(null);
  const lastTap = useRef({ at: 0, timer: 0 });
  const clips = reelClips(reel);

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setBoost(false);
      setExpanded(false);
    }
  }, [active]);

  function down(event) {
    if (event.target.closest("button, a, input, .rs-bar-hit")) return;
    press.current = { x: event.clientX, y: event.clientY, at: Date.now(), moved: false };
    press.current.timer = window.setTimeout(() => {
      if (press.current && !press.current.moved) {
        press.current.long = true;
        setBoost(true);
        navigator.vibrate?.(8);
      }
    }, 320);
  }
  function move(event) {
    const p = press.current;
    if (!p) return;
    if (Math.hypot(event.clientX - p.x, event.clientY - p.y) > 10) {
      p.moved = true;
      window.clearTimeout(p.timer);
    }
  }
  function up(event) {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    if (p.long) {
      setBoost(false);
      return;
    }
    if (p.moved) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const now = Date.now();
    if (now - lastTap.current.at < 280) {
      window.clearTimeout(lastTap.current.timer);
      lastTap.current.at = 0;
      const id = now;
      setHearts((prev) => [...prev, { id, x, y, r: Math.random() * 30 - 15 }]);
      window.setTimeout(() => setHearts((prev) => prev.filter((item) => item.id !== id)), 900);
      navigator.vibrate?.(12);
      if (!liked) onLike();
      return;
    }
    lastTap.current.at = now;
    lastTap.current.timer = window.setTimeout(() => {
      setPaused((value) => {
        setFlash({ id: Date.now(), kind: value ? "play" : "pause" });
        return !value;
      });
    }, 260);
  }

  function scrubAt(event) {
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    seekRef.current?.(fraction);
    if (barRef.current) barRef.current.style.transform = `scaleX(${fraction})`;
    const total = clips.reduce((sum, item) => sum + (item.duration || 3) / (item.rate || 1), 0);
    setScrub({ fraction, label: `${clockLabel(fraction * total)} / ${clockLabel(total)}` });
  }

  const caption = reel.caption || reel.text || "";
  const music = reel.music ? `${reel.music.title} · ${reel.music.artist}` : `${reel.audio || (it ? "Audio originale" : "Original audio")} · ${reel.name}`;

  return (
    <article className={`rs-slide${active ? " on" : ""}${boost ? " clean" : ""}${expanded ? " expanded" : ""}`} inert={active ? undefined : true}>
      <div className="rs-media">
        {near ? (
          <ReelPlayer
            clips={clips}
            active={active}
            paused={paused || sheetOpen || Boolean(scrub)}
            rate={(boost ? 2 : 1) * rate}
            muted={muted || reel.muted}
            filter={reel.filter}
            seekRef={seekRef}
            poster={reel.src || reel.image}
            onProgress={(fraction) => {
              if (barRef.current && !scrub) barRef.current.style.transform = `scaleX(${Math.min(1, fraction)})`;
            }}
          />
        ) : (
          <img className="rp-media rp-poster" src={reel.src || reel.image} alt="" draggable="false" loading="lazy" />
        )}
      </div>
      <div className="rs-scrim" />
      <div className="rs-hit" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { press.current = null; setBoost(false); }} />
      {hearts.map((item) => (
        <span key={item.id} className="rs-heart" style={{ left: item.x, top: item.y, "--r": `${item.r}deg` }}><Heart weight="fill" /></span>
      ))}
      {flash ? <span key={flash.id} className="rs-flash">{flash.kind === "pause" ? <Pause weight="fill" /> : <Play weight="fill" />}</span> : null}
      {paused && active && !flash ? <span className="rs-paused"><Play weight="fill" /></span> : null}
      {boost ? <span className="rs-boost">2× ▸▸</span> : null}

      <div className="rs-rail">
        <button type="button" className={liked ? "rs-act liked" : "rs-act"} aria-pressed={liked} aria-label={it ? "Mi piace" : "Like"} onClick={onLike}>
          <Heart weight={liked ? "fill" : "regular"} />
          {showCounts ? <span>{tally(reel.likes || "0", liked)}</span> : null}
        </button>
        <button type="button" className="rs-act" aria-label={it ? "Commenti" : "Comments"} onClick={onComments}>
          <MessageCircle />
          {showCounts ? <span>{reel.comments || "0"}</span> : null}
        </button>
        <button type="button" className="rs-act" aria-label={it ? "Condividi" : "Share"} onClick={onShare}>
          <Send />
          {showCounts ? <span>{it ? "Invia" : "Send"}</span> : null}
        </button>
        <button type="button" className={saved ? "rs-act on" : "rs-act"} aria-pressed={saved} aria-label={it ? "Salva" : "Save"} onClick={onSave}>
          <Bookmark weight={saved ? "fill" : "regular"} />
        </button>
        <button type="button" className="rs-act" aria-label={it ? "Altro" : "More"} onClick={onMore}>
          <MoreHorizontal />
        </button>
        <button type="button" className="rs-disc" aria-label={music} onClick={onAudio}>
          <RemoteImage src={reel.avatar || AVATAR} alt="" />
        </button>
      </div>

      <div className="rs-meta">
        <div className="rs-who">
          <RemoteImage className="rs-avatar" src={reel.avatar || AVATAR} alt="" />
          <strong>{String(reel.handle || reel.name).replace(/^@/, "")}</strong>
          {!mine ? (
            <button type="button" className={following ? "rs-follow on" : "rs-follow"} aria-pressed={following} onClick={onFollow}>
              {following ? (it ? "Segui già" : "Following") : (it ? "Segui" : "Follow")}
            </button>
          ) : null}
        </div>
        {caption ? (
          <div role="button" tabIndex={0} className="rs-caption" onClick={() => setExpanded((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter") setExpanded((value) => !value); }}>
            <RichText text={caption} />
          </div>
        ) : null}
        {captions && active ? <p className="rs-cc">{caption}</p> : null}
        <button type="button" className="rs-audio" onClick={onAudio}>
          <Music />
          <span className="rs-marquee"><span>{music}</span><span aria-hidden="true">{music}</span></span>
        </button>
      </div>

      <button type="button" className="rs-mute" aria-label={muted ? (it ? "Attiva audio" : "Unmute") : (it ? "Silenzia" : "Mute")} onClick={onMute}>
        {muted ? <SoundOff weight="fill" /> : <SoundOn weight="fill" />}
      </button>

      <div
        className={`rs-bar-hit${scrub ? " scrubbing" : ""}`}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); scrubAt(event); }}
        onPointerMove={(event) => { if (scrub) scrubAt(event); }}
        onPointerUp={() => setScrub(null)}
        onPointerCancel={() => setScrub(null)}
      >
        <div className="rs-bar"><b ref={barRef} /></div>
        {scrub ? <span className="rs-time" style={{ left: `${scrub.fraction * 100}%` }}>{scrub.label}</span> : null}
      </div>
    </article>
  );
}

function ReelScreen({ onCreate }) {
  const space = useSpace();
  const live = useLive();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const scroller = useRef(null);
  const [index, setIndex] = useState(0);
  const [feed, setFeed] = useState("foryou");
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [captions, setCaptions] = useState(Boolean(prefs.captions));
  const [hidden, setHidden] = useState(() => new Set());
  const [sheet, setSheet] = useState(null);
  const [draft, setDraft] = useState("");
  const [likedNotes, setLikedNotes] = useState(() => new Set());
  const [sentTo, setSentTo] = useState(() => new Set());
  const [toast, setToast] = useState("");
  const [muteHint, setMuteHint] = useState(0);
  const mine = space.library.filter((item) => item.kind === "reel").slice().reverse().map((item) => ({
    ...item,
    avatar: item.avatar || AVATAR,
    caption: item.caption || item.text,
    likes: item.likes || "0",
    comments: String((space.comments[item.id] || []).length),
    saves: item.saves || "0",
    thread: item.thread || [],
  }));
  const all = [...mine, ...REELS]
    .filter((reel) => shown(prefs, reel) && !space.archived.has(reel.id) && !hidden.has(reel.id))
    .filter((reel) => feed === "foryou" || reel.mine || space.follows.has(reel.name));
  const reel = all[index];

  function note(text) {
    setToast(text);
    window.clearTimeout(note.timer);
    note.timer = window.setTimeout(() => setToast(""), 1400);
  }

  useEffect(() => {
    const node = scroller.current;
    if (!node) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = Math.round(node.scrollTop / Math.max(node.clientHeight, 1));
        setIndex((current) => (current === next ? current : next));
      });
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    setSheet(null);
    setDraft("");
  }, [index]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setIndex(0);
  }, [feed, mine.length]);

  // Keyboard on desktop: arrows to move, space to pause is handled by tap, m to mute.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.("input, textarea")) return;
      const node = scroller.current;
      if (!node) return;
      if (event.key === "ArrowDown") node.scrollBy({ top: node.clientHeight, behavior: "smooth" });
      if (event.key === "ArrowUp") node.scrollBy({ top: -node.clientHeight, behavior: "smooth" });
      if (event.key === "m") setMuted((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function goNext() {
    const node = scroller.current;
    node?.scrollBy({ top: node.clientHeight, behavior: "smooth" });
  }

  const notes = reel ? [
    ...(reel.thread || []).map((item, i) => ({ ...item, id: `t-${i}`, src: item.name === space.profile.name ? AVATAR : (PEOPLE.find((p) => p.name === item.name)?.src || CONTACTS.find((p) => p.name === item.name)?.src || avatarFor(item.name)) })),
    ...(space.comments[reel.id] || []).map((text, i) => ({ id: `m-${i}`, name: space.profile.name, text, src: AVATAR, mine: true })),
  ] : [];
  const livePeople = live ? Object.values(live.people).filter((person) => person.handle !== live.me?.handle) : [];

  async function sendTo(person) {
    if (!reel || sentTo.has(person.handle)) return;
    setSentTo((prev) => new Set(prev).add(person.handle));
    try {
      const convId = await live.openDm(person.handle);
      const image = reel.src || reel.image;
      if (image && !String(image).startsWith("blob:")) live.send(convId, { kind: "image", image, text: `Reel · ${reel.name}: ${reel.caption || ""}`.trim() });
      else live.send(convId, `Reel · ${reel.name}: ${reel.caption || ""}`);
    } catch {
      note(say("Couldn't send", "Invio non riuscito"));
    }
  }

  return (
    <div className={`rs view${sheet === "comments" ? " comments-open" : ""}`}>
      <header className="rs-head">
        <strong>Reels</strong>
        <div className="rs-feeds" role="tablist">
          <button type="button" role="tab" aria-selected={feed === "foryou"} className={feed === "foryou" ? "on" : ""} onClick={() => setFeed("foryou")}>{say("For you", "Per te")}</button>
          <button type="button" role="tab" aria-selected={feed === "following"} className={feed === "following" ? "on" : ""} onClick={() => setFeed("following")}>{say("Following", "Seguiti")}</button>
        </div>
        <button type="button" className="rs-cam" aria-label={say("Create reel", "Crea reel")} onClick={onCreate}><Camera /></button>
      </header>
      <div className="rs-stage" ref={scroller} aria-label="Reels">
        {all.map((item, i) => (
          <ReelSlide
            key={item.id}
            reel={item}
            it={it}
            active={i === index}
            near={Math.abs(i - index) <= 1}
            muted={muted}
            rate={rate}
            captions={captions}
            sheetOpen={Boolean(sheet) && i === index}
            mine={Boolean(item.mine)}
            liked={space.likes.has(item.id)}
            saved={space.saves.has(item.id)}
            following={space.follows.has(item.name)}
            onMute={() => { setMuted((value) => !value); setMuteHint(Date.now()); }}
            onLike={() => space.toggleLike(item.id)}
            onSave={() => {
              const on = space.saves.has(item.id);
              space.toggleSave(item);
              note(on ? say("Removed from saved", "Rimosso dai salvati") : say("Saved", "Salvato"));
            }}
            onFollow={() => space.toggleFollow(item.name)}
            onComments={() => setSheet("comments")}
            onShare={() => { setSentTo(new Set()); setSheet("share"); }}
            onMore={() => setSheet("more")}
            onAudio={() => note(`♫ ${item.music ? item.music.title : item.audio || say("Original audio", "Audio originale")}`)}
          />
        ))}
        {all.length === 0 ? (
          <div className="rs-empty">
            <i><SquarePlay /></i>
            <strong>{feed === "following" ? say("No reels from people you follow", "Nessun reel da chi segui") : say("No reels yet", "Ancora nessun reel")}</strong>
            <button type="button" className="ig-btn primary" onClick={onCreate}>{say("Create a reel", "Crea un reel")}</button>
          </div>
        ) : null}
      </div>
      {muteHint ? <span key={muteHint} className="rs-mute-hint">{muted ? <SoundOff weight="fill" /> : <SoundOn weight="fill" />}</span> : null}
      {toast ? <span key={toast} className="sv-toast rs-toast">{toast}</span> : null}

      {sheet === "comments" && reel ? (
        <div className="rs-sheet-back" onClick={() => setSheet(null)}>
          <div className="rs-sheet comments" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <strong className="rs-sheet-title">{say("Comments", "Commenti")}</strong>
            <div className="rs-notes">
              {notes.length ? notes.map((item) => {
                const on = likedNotes.has(item.id);
                return (
                  <div key={item.id} className="rs-note">
                    <RemoteImage className="row-avatar" src={item.src} alt="" />
                    <span>
                      <strong>{item.name}<em>{item.mine ? say("now", "ora") : "2 h"}</em></strong>
                      <p>{item.text}</p>
                      <button type="button" className="rs-reply" onClick={() => setDraft(`@${item.name.split(" ")[0]} `)}>{say("Reply", "Rispondi")}</button>
                    </span>
                    <button type="button" className={on ? "rs-note-like on" : "rs-note-like"} aria-label={say("Like comment", "Mi piace al commento")} onClick={() => setLikedNotes((prev) => { const next = new Set(prev); if (on) next.delete(item.id); else next.add(item.id); return next; })}>
                      <Heart weight={on ? "fill" : "regular"} />
                    </button>
                  </div>
                );
              }) : <p className="rs-none">{say("No comments yet. Start the conversation.", "Ancora nessun commento. Inizia tu.")}</p>}
            </div>
            <div className="rs-emoji">
              {["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"].map((char) => (
                <button key={char} type="button" onClick={() => setDraft((value) => `${value}${char}`)}>{char}</button>
              ))}
            </div>
            <form
              className="rs-compose"
              onSubmit={(event) => {
                event.preventDefault();
                const text = draft.trim();
                if (!text || textHidden(prefs, text)) return;
                space.addComment(reel.id, text);
                setDraft("");
              }}
            >
              <RemoteImage className="row-avatar" src={AVATAR} alt="" />
              <input
                value={draft}
                placeholder={say(`Add a comment for ${reel.name.split(" ")[0]}…`, `Commenta per ${reel.name.split(" ")[0]}…`)}
                aria-label={say("Add a comment", "Aggiungi un commento")}
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.target.scrollIntoView?.({ block: "nearest" })}
              />
              {draft.trim() ? <button type="submit">{say("Post", "Pubblica")}</button> : null}
            </form>
          </div>
        </div>
      ) : null}

      {sheet === "share" && reel ? (
        <div className="rs-sheet-back" onClick={() => setSheet(null)}>
          <div className="rs-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <strong className="rs-sheet-title">{say("Share", "Condividi")}</strong>
            {livePeople.length ? (
              <div className="rs-people">
                {livePeople.map((person) => {
                  const done = sentTo.has(person.handle);
                  return (
                    <button key={person.handle} type="button" className={done ? "done" : ""} onClick={() => sendTo(person)}>
                      <span className="rs-face">
                        <RemoteImage src={person.src || avatarFor(person.name)} alt="" />
                        {done ? <i><Check weight="bold" /></i> : null}
                        {person.online ? <b className="online-dot" /> : null}
                      </span>
                      <em>{person.name.split(" ")[0]}</em>
                    </button>
                  );
                })}
              </div>
            ) : <p className="rs-none">{say("Nobody to send to yet.", "Ancora nessuno a cui inviarlo.")}</p>}
            <div className="rs-share-row">
              <button type="button" onClick={() => {
                navigator.clipboard?.writeText(`${window.location.origin}/?tab=reel#${reel.id}`).catch(() => {});
                note(say("Link copied", "Link copiato"));
              }}>
                <i><LinkIcon /></i><span>{say("Copy link", "Copia link")}</span>
              </button>
              <button type="button" onClick={() => {
                space.publish({ id: `made-${Date.now()}`, kind: "story", image: reel.src || reel.image, text: "", stickers: [{ type: "tag", name: reel.name, x: 50, y: 82, s: 1, r: 0 }], time: "Now", mine: true, src: AVATAR, avatar: AVATAR, name: "Tu" });
                setSheet(null);
                note(say("Added to your story", "Aggiunto alla tua storia"));
              }}>
                <i><SquarePlus /></i><span>{say("Add to story", "Aggiungi alla storia")}</span>
              </button>
              {navigator.share ? (
                <button type="button" onClick={() => navigator.share({ title: reel.name, text: reel.caption, url: window.location.href }).catch(() => {})}>
                  <i><ArrowUpRight /></i><span>{say("Share to…", "Condividi su…")}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {sheet === "more" && reel ? (
        <div className="rs-sheet-back" onClick={() => setSheet(null)}>
          <div className="rs-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <div className="rs-speeds">
              <span>{say("Speed", "Velocità")}</span>
              {REEL_SPEEDS.map((value) => (
                <button key={value} type="button" className={rate === value ? "on" : ""} onClick={() => setRate(value)}>{value}×</button>
              ))}
            </div>
            <button type="button" className="rs-line" onClick={() => { setCaptions((value) => !value); setSheet(null); }}>
              <Hash /> {captions ? say("Hide captions", "Nascondi sottotitoli") : say("Show captions", "Mostra sottotitoli")}
            </button>
            <button type="button" className="rs-line" onClick={() => { space.toggleSave(reel); setSheet(null); }}>
              <Bookmark /> {space.saves.has(reel.id) ? say("Unsave", "Rimuovi dai salvati") : say("Save", "Salva")}
            </button>
            <button type="button" className="rs-line" onClick={() => {
              setHidden((prev) => new Set(prev).add(reel.id));
              setSheet(null);
              note(say("We'll show fewer like this", "Ne vedrai meno così"));
            }}>
              <EyeOff /> {say("Not interested", "Non mi interessa")}
            </button>
            {reel.mine ? (
              <button type="button" className="rs-line warn" onClick={() => { space.drop(reel.id); setSheet(null); }}>
                <X /> {say("Delete", "Elimina")}
              </button>
            ) : (
              <button type="button" className="rs-line warn" onClick={() => { setSheet(null); note(say("Reported", "Segnalato")); goNext(); }}>
                <Info /> {say("Report", "Segnala")}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const REEL_LENGTHS = [15, 30, 60, 90];
const REEL_RECORD_SPEEDS = [0.5, 1, 2, 3];

function ReelCamera({ onClose, onPublish }) {
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startRef = useRef(0);
  const fileRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState("user");
  const [flipping, setFlipping] = useState(false);
  const [clips, setClips] = useState([]);
  const [recording, setRecording] = useState(0);
  const [now, setNow] = useState(0);
  const [limit, setLimit] = useState(30);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [music, setMusic] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [stage, setStage] = useState("capture");
  const [filter, setFilter] = useState("normal");
  const [filterHint, setFilterHint] = useState(0);
  const [caption, setCaption] = useState("");
  const [cover, setCover] = useState(0);
  const [alsoStory, setAlsoStory] = useState(false);
  const [toast, setToast] = useState("");
  const swipe = useRef(null);
  const used = clips.reduce((sum, item) => sum + item.duration / (item.rate || 1), 0);
  const live = recording ? (now - recording) / 1000 / speed : 0;
  const left = Math.max(0, limit - used - live);

  function note(text) {
    setToast(text);
    window.clearTimeout(note.t);
    note.t = window.setTimeout(() => setToast(""), 1500);
  }

  useEffect(() => {
    if (stage !== "capture") return undefined;
    let gone = false;
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) return undefined;
    const video = { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } };
    devices.getUserMedia({ video, audio: true })
      .catch(() => devices.getUserMedia({ video, audio: false }))
      .then((stream) => {
        if (gone) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOn(true);
        setFlipping(false);
      })
      .catch(() => {
        setCamOn(false);
        setFlipping(false);
      });
    return () => {
      gone = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing, stage]);

  useEffect(() => {
    if (!recording) return undefined;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [recording]);

  useEffect(() => {
    if (recording && left <= 0) stopClip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, recording]);

  function startClip() {
    if (left <= 0.3) {
      note(say("Reel is full", "Il reel è completo"));
      return;
    }
    const stream = streamRef.current;
    if (!stream || !window.MediaRecorder) {
      note(say("Camera not available: add clips from the gallery", "Fotocamera non disponibile: aggiungi clip dalla galleria"));
      return;
    }
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((item) => MediaRecorder.isTypeSupported?.(item)) || "";
    let recorder;
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 3_000_000 } : undefined);
    } catch {
      note(say("Recording isn't supported here", "Registrazione non supportata qui"));
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    const rate = speed;
    const mirror = facing === "user";
    recorder.onstop = () => {
      const seconds = (Date.now() - startRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      if (blob.size < 2000 || seconds < 0.3) return;
      setClips((prev) => [...prev, { type: "video", src: URL.createObjectURL(blob), duration: seconds, rate, mirror }]);
    };
    startRef.current = Date.now();
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(Date.now());
    setNow(Date.now());
    navigator.vibrate?.(12);
  }

  function stopClip() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(0);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    navigator.vibrate?.(6);
  }

  function shutter() {
    if (recording) {
      stopClip();
      return;
    }
    if (timer) {
      let n = timer;
      setCountdown(n);
      const id = window.setInterval(() => {
        n -= 1;
        if (n <= 0) {
          window.clearInterval(id);
          setCountdown(0);
          startClip();
        } else setCountdown(n);
      }, 1000);
      return;
    }
    startClip();
  }

  function removeLast() {
    setClips((prev) => {
      const last = prev[prev.length - 1];
      if (last?.type === "video") URL.revokeObjectURL(last.src);
      return prev.slice(0, -1);
    });
  }

  function addPhotoClip(src) {
    if (left < 1) {
      note(say("Reel is full", "Il reel è completo"));
      return;
    }
    setClips((prev) => [...prev, { type: "image", src, duration: Math.min(3, left), rate: 1 }]);
  }

  function fromLibrary(event) {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    let room = left;
    files.forEach((file) => {
      if (room <= 0.5) return;
      if (file.type.startsWith("video/")) {
        const url = URL.createObjectURL(file);
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => {
          const seconds = Math.min(Number.isFinite(probe.duration) ? probe.duration : 5, room);
          room -= seconds;
          setClips((prev) => [...prev, { type: "video", src: url, duration: seconds, rate: 1 }]);
        };
        probe.src = url;
        return;
      }
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const img = await loadImage(reader.result).catch(() => null);
        if (!img) return;
        const scale = Math.min(1, 1440 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setClips((prev) => [...prev, { type: "image", src: canvas.toDataURL("image/jpeg", 0.85), duration: 3, rate: 1 }]);
      };
      reader.readAsDataURL(file);
      room -= 3;
    });
  }

  function publish() {
    const poster = clips.find((item, i) => i === cover && item.type === "image")?.src
      || clips.find((item) => item.type === "image")?.src
      || WORKS[0].src;
    const total = clips.reduce((sum, item) => sum + item.duration / (item.rate || 1), 0);
    const item = {
      id: `made-${Date.now()}`,
      kind: "reel",
      clips,
      image: poster,
      src: poster,
      filter,
      caption: caption.trim(),
      text: caption.trim(),
      music,
      audio: music ? music.title : say("Original audio", "Audio originale"),
      length: clockLabel(total),
      name: "Giulia Neri",
      handle: "@forno.neri",
      avatar: AVATAR,
      likes: "0",
      comments: "0",
      saves: "0",
      time: "Now",
      mine: true,
      thread: [],
    };
    onPublish(item, alsoStory);
  }

  function mediaDown(event) {
    swipe.current = { x: event.clientX, y: event.clientY };
  }
  function mediaUp(event) {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
    const i = STORY_FILTERS.findIndex((item) => item.id === filter);
    const next = STORY_FILTERS[(i + (dx < 0 ? 1 : -1) + STORY_FILTERS.length) % STORY_FILTERS.length];
    setFilter(next.id);
    setFilterHint(Date.now());
  }

  const filterNow = STORY_FILTERS.find((item) => item.id === filter) || STORY_FILTERS[0];

  if (stage === "edit") {
    return (
      <div className="rc rc-edit">
        <div className="rc-preview" onPointerDown={mediaDown} onPointerUp={mediaUp}>
          <ReelPlayer clips={clips} active paused={sheet === "caption"} muted={false} filter={filter} poster={clips[0]?.src} />
          {filterHint ? <span key={filterHint} className="sc-filter-name">{filterNow.label}</span> : null}
        </div>
        <div className="sc-scrim" />
        <div className="sc-top">
          <button type="button" className="sc-btn" aria-label={say("Back", "Indietro")} onClick={() => setStage("capture")}><ChevronLeft /></button>
          <div className="sc-tools">
            <button type="button" className="sc-btn" aria-label={say("Music", "Musica")} onClick={() => setSheet("music")}><Music /></button>
            <button type="button" className="sc-btn" aria-label={say("Filters", "Filtri")} onClick={() => setSheet(sheet === "filters" ? null : "filters")}><Sparkle /></button>
          </div>
        </div>
        {music ? <span className="rc-music-chip"><Music /> {music.title} · {music.artist}</span> : null}

        {sheet === "filters" ? (
          <div className="sc-filters">
            <div className="sc-filter-row">
              {STORY_FILTERS.map((item) => (
                <button key={item.id} type="button" className={filter === item.id ? "on" : ""} onClick={() => { setFilter(item.id); setFilterHint(Date.now()); }}>
                  <span style={{ backgroundImage: `url(${clips.find((c) => c.type === "image")?.src || WORKS[0].src})`, filter: item.css }} />
                  <b>{item.label}</b>
                </button>
              ))}
            </div>
            <button type="button" className="sc-done" onClick={() => setSheet(null)}>{say("Done", "Fine")}</button>
          </div>
        ) : null}

        {sheet !== "filters" ? (
          <div className="rc-finish">
            <label className="rc-caption">
              <textarea
                rows={2}
                maxLength={2200}
                value={caption}
                placeholder={say("Write a caption… #hashtag @mention", "Scrivi una didascalia… #hashtag @menzione")}
                aria-label={say("Caption", "Didascalia")}
                onFocus={() => setSheet("caption")}
                onBlur={() => setSheet(null)}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            {clips.some((item) => item.type === "image") ? (
              <div className="rc-covers" aria-label={say("Cover", "Copertina")}>
                <span>{say("Cover", "Copertina")}</span>
                {clips.map((item, i) => (item.type === "image" ? (
                  <button key={i} type="button" className={cover === i ? "on" : ""} onClick={() => setCover(i)}>
                    <img src={item.src} alt="" draggable="false" />
                  </button>
                ) : null))}
              </div>
            ) : null}
            <button type="button" className="rc-toggle" aria-pressed={alsoStory} onClick={() => setAlsoStory((value) => !value)}>
              <span>{say("Also share to your story", "Condividi anche nella storia")}</span>
              <i className={alsoStory ? "switch on" : "switch"}><b /></i>
            </button>
            <button type="button" className="rc-share" onClick={publish}>{say("Share reel", "Condividi reel")}</button>
          </div>
        ) : null}

        {sheet === "music" ? (
          <div className="sc-sheet-back" onClick={() => setSheet(null)}>
            <div className="sc-tray" onClick={(event) => event.stopPropagation()}>
              <i className="sv-grab" />
              <strong className="rs-sheet-title">{say("Music", "Musica")}</strong>
              <div className="sc-tray-body">
                {music ? <button type="button" onClick={() => { setMusic(null); setSheet(null); }}><X /> <strong>{say("Remove music", "Togli la musica")}</strong></button> : null}
                {STORY_MUSIC.map((song) => (
                  <button key={song.title} type="button" onClick={() => { setMusic(song); setSheet(null); }}>
                    <Music /> <strong>{song.title}</strong><span>{song.artist}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {toast ? <span key={toast} className="sv-toast">{toast}</span> : null}
      </div>
    );
  }

  let offset = 0;
  return (
    <div className={`rc${recording ? " recording" : ""}`}>
      {camOn ? (
        <video ref={videoRef} className={`sc-live${facing === "user" ? " mirror" : ""}${flipping ? " flipping" : ""}`} autoPlay playsInline muted />
      ) : (
        <div className="rc-nocam">
          <i><Camera /></i>
          <strong>{say("Camera not available", "Fotocamera non disponibile")}</strong>
          <span>{say("Add photos or videos to build your reel", "Aggiungi foto o video per creare il reel")}</span>
          <div className="rc-demo">
            {WORKS.map((work) => (
              <button key={work.src} type="button" onClick={() => addPhotoClip(work.src)} aria-label={work.caption}>
                <img src={work.src} alt="" draggable="false" />
                <i><Plus /></i>
              </button>
            ))}
          </div>
        </div>
      )}
      {clips.length && !recording && clips[clips.length - 1].type === "image" ? (
        <img className="rc-ghost" src={clips[clips.length - 1].type === "image" ? clips[clips.length - 1].src : ""} alt="" aria-hidden="true" />
      ) : null}
      <div className="sc-scrim" />
      {countdown ? <span key={countdown} className="sc-count">{countdown}</span> : null}

      <div className="rc-segments" aria-label={say(`${Math.round(used)} of ${limit} seconds`, `${Math.round(used)} di ${limit} secondi`)}>
        {clips.map((item, i) => {
          const width = ((item.duration / (item.rate || 1)) / limit) * 100;
          const style = { left: `${offset}%`, width: `${width}%` };
          offset += width;
          return <b key={i} style={style} />;
        })}
        {recording ? <b className="live" style={{ left: `${offset}%`, width: `${(live / limit) * 100}%` }} /> : null}
      </div>

      <div className="sc-top rc-top">
        <button type="button" className="sc-btn" aria-label={say("Close", "Chiudi")} onClick={onClose}><X /></button>
        <button type="button" className="rc-music" onClick={() => setSheet("music")}>
          <Music /> <span>{music ? music.title : say("Add music", "Aggiungi musica")}</span>
        </button>
        <span className="rc-left">{clockLabel(left)}</span>
      </div>

      <div className="sc-rail rc-rail">
        <button type="button" onClick={() => setLimit((value) => REEL_LENGTHS[(REEL_LENGTHS.indexOf(value) + 1) % REEL_LENGTHS.length])}>
          <i><b className="rc-len">{limit}</b></i><span>{say("Length", "Durata")}</span>
        </button>
        <button type="button" className={speed !== 1 ? "on" : ""} onClick={() => setSpeedOpen((value) => !value)}>
          <i><b className="rc-len">{speed}×</b></i><span>{say("Speed", "Velocità")}</span>
        </button>
        {speedOpen ? (
          <div className="rc-speeds">
            {REEL_RECORD_SPEEDS.map((value) => (
              <button key={value} type="button" className={speed === value ? "on" : ""} onClick={() => { setSpeed(value); setSpeedOpen(false); }}>{value}×</button>
            ))}
          </div>
        ) : null}
        <button type="button" className={timer ? "on" : ""} onClick={() => setTimer((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))}>
          <i><Timer />{timer ? <b>{timer}</b> : null}</i><span>Timer</span>
        </button>
      </div>

      <div className="sc-bottom rc-bottom">
        <button type="button" className="sc-roll" aria-label={say("Gallery", "Galleria")} onClick={() => fileRef.current?.click()}>
          <RemoteImage src={WORKS[clips.length % WORKS.length].src} alt="" />
        </button>
        <button type="button" className={`rc-shutter${recording ? " rec" : ""}`} aria-label={recording ? say("Stop", "Ferma") : say("Record", "Registra")} onClick={shutter}>
          <i />
        </button>
        <div className="rc-right">
          {clips.length && !recording ? (
            <>
              <button type="button" className="sc-btn" aria-label={say("Delete last clip", "Elimina ultima clip")} onClick={removeLast}><Undo /></button>
              <button type="button" className="rc-next" aria-label={say("Next", "Avanti")} onClick={() => { setStage("edit"); setSheet(null); }}><ChevronRight strokeWidth={2.6} /></button>
            </>
          ) : (
            <button
              type="button"
              className={`sc-btn sc-flip${flipping ? " spin" : ""}`}
              aria-label={say("Flip camera", "Gira fotocamera")}
              onClick={() => {
                if (!camOn || recording) return;
                setFlipping(true);
                setFacing((value) => (value === "environment" ? "user" : "environment"));
              }}
            >
              <SwitchCamera />
            </button>
          )}
        </div>
      </div>
      <p className="sc-tip rc-tip">{recording ? say("Tap to stop", "Tocca per fermare") : clips.length ? say(`${clips.length} clip · tap to add more`, `${clips.length} clip · tocca per aggiungerne`) : say("Tap to record a clip", "Tocca per registrare una clip")}</p>
      <input ref={fileRef} className="sr" type="file" accept="image/*,video/*" multiple onChange={fromLibrary} />

      {sheet === "music" ? (
        <div className="sc-sheet-back" onClick={() => setSheet(null)}>
          <div className="sc-tray" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <strong className="rs-sheet-title">{say("Music", "Musica")}</strong>
            <div className="sc-tray-body">
              {music ? <button type="button" onClick={() => { setMusic(null); setSheet(null); }}><X /> <strong>{say("Remove music", "Togli la musica")}</strong></button> : null}
              {STORY_MUSIC.map((song) => (
                <button key={song.title} type="button" onClick={() => { setMusic(song); setSheet(null); }}>
                  <Music /> <strong>{song.title}</strong><span>{song.artist}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <span key={toast} className="sv-toast">{toast}</span> : null}
    </div>
  );
}

const shot = (id, w = 900, h = 1125) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

// People you can find in Search, with a profile page of their own.
const SEARCH_PEOPLE = [
  { name: "Marta Colle", handle: "cucina.colle", craft: "Cucina", city: "Torino", src: PEOPLE[0].src, followers: 12400, following: 318, bio: "Cucina di stagione, a mano. Pasta tirata col mattarello ogni mattina.", verified: true },
  { name: "Leo Bassi", handle: "bassi.liuteria", craft: "Musica", city: "Cremona", src: PEOPLE[1].src, followers: 8650, following: 204, bio: "Liutaio a Cremona. Abete rosso, acero, e tanta pazienza." },
  { name: "Adele Romano", handle: "romano.tessuti", craft: "Tessuti", city: "Prato", src: PEOPLE[2].src, followers: 21900, following: 512, bio: "Telai, lana cardata e il rosso di Prato.", verified: true },
  { name: "Nico Serra", handle: "serra.ricerca", craft: "Design", city: "Bologna", src: PEOPLE[3].src, followers: 3120, following: 410, bio: "Ricerca sui materiali. Smalti, impasti, temperature." },
  { name: "Chiara Valli", handle: "valli.lino", craft: "Tessuti", city: "Firenze", src: THREADS[4].src, followers: 5480, following: 290, bio: "Lino lavato a mano, tinture vegetali." },
  { name: "Pietro Lama", handle: "lama.cucina", craft: "Cucina", city: "Genova", src: THREADS[5].src, followers: 9730, following: 150, bio: "Pesto al mortaio, sempre. Trattoria di famiglia dal 1962." },
  { name: "Sara Conte", handle: "conte.faenza", craft: "Ceramica", city: "Faenza", src: THREADS[6].src, followers: 15200, following: 388, bio: "Maiolica di Faenza. Pezzi unici, cottura a legna.", verified: true },
  { name: "Elena Marini", handle: "marini.studio", craft: "Design", city: "Padova", src: THREADS[7].src, followers: 4310, following: 620, bio: "Interni caldi, oggetti che durano." },
];

// [id, person, photo, caption, likes, tag, extra photos]
const EXPLORE_SEED = [
  ["x1", 6, "1493106641515-6b5631de4bb9", "Al tornio dalle sei. #ceramica #faenza", 2140, "Ceramica", ["1590422749897-47036da0b0ff", "1612196808214-b8e1d6145a8c"]],
  ["x2", 0, "1473093295043-cdd812d0e601", "Farfalle, pomodorini, basilico dell'orto. #cucina", 3890, "Cucina"],
  ["x3", 1, "1465821185615-20b3c2fbf41b", "Prima prova del violino nuovo. #liuteria #cremona", 5120, "Musica"],
  ["x4", 2, "1558171813-4c088753af8f", "Camicia in lino, cucita a mano. #tessuti", 1760, "Tessuti"],
  ["x5", 5, "1534080564583-6be75777b70a", "Domenica di mare. #cucina #genova", 4410, "Cucina"],
  ["x6", 7, "1513519245088-0e12902e5a38", "Parete nuova in studio. #design", 980, "Design"],
  ["x7", 6, "1576020799627-aeac74d58064", "Piatti appena sfornati, smalto avorio. #ceramica", 2760, "Ceramica"],
  ["x8", 0, "1556910103-1c02745aae4d", "Corso di cucina del giovedì. #cucina #torino", 1990, "Cucina", ["1551218808-94e220e084d2"]],
  ["x9", 1, "1507838153414-b4b713384a76", "Partiture e colla di pesce. #musica", 860, "Musica"],
  ["x10", 3, "1597484661643-2f5fef640dd1", "Campioni di colore per la nuova serie. #design", 1320, "Design"],
  ["x11", 5, "1565299624946-b28f40a0ae38", "Focaccia? No, oggi pizza. #cucina", 6080, "Cucina"],
  ["x12", 1, "1520523839897-bd0b52f945a0", "Accordatura del mattino. #musica", 2230, "Musica"],
  ["x13", 4, "1544441893-675973e31985", "Denim grezzo e tela. #tessuti #firenze", 1450, "Tessuti"],
  ["x14", 6, "1612196808214-b8e1d6145a8c", "Vaso bianco, linea semplice. #ceramica", 3310, "Ceramica"],
  ["x15", 0, "1498837167922-ddd27525d352", "Mercato del sabato. #cucina", 2050, "Cucina"],
  ["x16", 7, "1519710164239-da123dc03ef4", "Luce del pomeriggio. #design #padova", 1880, "Design"],
  ["x17", 1, "1519892300165-cb5542fb47c7", "Tamburi restaurati. #musica", 740, "Musica"],
  ["x18", 5, "1414235077428-338989a2e8c0", "Piatto del giorno. #cucina", 2970, "Cucina"],
  ["x19", 3, "1517248135467-4c7edcad34c4", "Il ristorante che abbiamo arredato. #design", 1120, "Design"],
  ["x20", 1, "1511192336575-5a79af67a629", "Ottoni in laboratorio. #musica", 1530, "Musica"],
  ["x21", 6, "1590422749897-47036da0b0ff", "Tazze impilate per la cottura. #ceramica", 4020, "Ceramica"],
  ["x22", 0, "1504674900247-0877df9cc836", "Cena per dieci. #cucina", 3650, "Cucina"],
  ["x23", 7, "1495474472287-4d71bcdd2085", "Caffè in studio. #design", 2210, "Design"],
  ["x24", 5, "1551218808-94e220e084d2", "Prep del mattino. #cucina", 1690, "Cucina"],
  ["x25", 0, "1509042239860-f550ce710b93", "Pausa caffè tra un impasto e l'altro. #cucina", 2580, "Cucina"],
];

const EXPLORE_POSTS = EXPLORE_SEED.map(([id, who, photo, text, likes, tag, extra]) => {
  const person = SEARCH_PEOPLE[who];
  const image = shot(photo);
  return {
    id,
    name: person.name,
    handle: `@${person.handle}`,
    avatar: person.src,
    image,
    images: extra ? [image, ...extra.map((item) => shot(item))] : undefined,
    text,
    likes: likes >= 1000 ? `${(likes / 1000).toFixed(1).replace(".0", "")}k` : String(likes),
    saves: String(Math.round(likes / 9)),
    kind: "post",
    tag,
    place: person.city,
    thread: [
      { name: SEARCH_PEOPLE[(who + 1) % SEARCH_PEOPLE.length].name, text: "Bellissimo. 🔥" },
      { name: SEARCH_PEOPLE[(who + 3) % SEARCH_PEOPLE.length].name, text: "Dove si trova?" },
    ],
  };
});

for (const post of EXPLORE_POSTS) {
  if (post.id === "x8") post.tags = ["Pietro Lama", "Nico Serra"];
  if (post.id === "x7") post.tags = ["Giulia Neri"];
  if (post.id === "x1") post.tags = ["Elena Marini"];
  const products = { x1: [["Sara Conte", "sc4"]], x7: [["Sara Conte", "sc2"], ["Sara Conte", "sc1"]], x14: [["Sara Conte", "sc3"]], x21: [["Sara Conte", "sc1"]], x4: [["Adele Romano", "ar1"]], x13: [["Adele Romano", "ar2"]], x3: [["Leo Bassi", "lb1"]], x5: [["Pietro Lama", "pl3"]], x11: [["Pietro Lama", "pl3"]], x24: [["Pietro Lama", "pl2"]] }[post.id];
  if (products) post.products = products.map(([owner, id]) => ({ owner, id }));
}

const EXPLORE_TOPICS = ["Ceramica", "Cucina", "Musica", "Tessuti", "Design"];

function personByName(name) {
  return SEARCH_PEOPLE.find((person) => person.name === name) || null;
}

function hashtagsOf(text) {
  return (String(text || "").match(/#[\p{L}\d_]+/gu) || []).map((tag) => tag.slice(1).toLowerCase());
}

function countLabel(value, it) {
  return compact(value, it);
}

// Long-press on a tile shows a quick preview, like Instagram's peek.
function usePeek(onPeek) {
  const timer = useRef(0);
  const fired = useRef(false);
  const origin = useRef(null);
  return {
    bind(item) {
      return {
        onPointerDown(event) {
          fired.current = false;
          origin.current = { x: event.clientX, y: event.clientY };
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            fired.current = true;
            onPeek(item);
          }, 380);
        },
        onPointerMove(event) {
          if (!origin.current) return;
          if (Math.abs(event.clientX - origin.current.x) > 8 || Math.abs(event.clientY - origin.current.y) > 8) window.clearTimeout(timer.current);
        },
        onPointerUp() {
          window.clearTimeout(timer.current);
          origin.current = null;
          if (fired.current) onPeek(null);
        },
        onPointerCancel() {
          window.clearTimeout(timer.current);
          origin.current = null;
          if (fired.current) onPeek(null);
        },
        onContextMenu(event) {
          event.preventDefault();
        },
      };
    },
    consumed() {
      const value = fired.current;
      fired.current = false;
      return value;
    },
  };
}

function ExploreTile({ post, tall, onOpen, peek }) {
  const multi = Array.isArray(post.images) && post.images.length > 1;
  const reel = post.kind === "reel";
  return (
    <button
      type="button"
      className={`sx-tile${tall ? " tall" : ""}`}
      aria-label={`${reel ? "Reel" : "Post"}, ${post.name}`}
      onClick={() => {
        if (peek.consumed()) return;
        onOpen(post);
      }}
      {...peek.bind(post)}
    >
      <RemoteImage src={post.image} alt="" />
      {reel ? <i className="sx-badge"><SquarePlay weight="fill" /></i> : multi ? <i className="sx-badge"><Carousel /></i> : null}
      {reel && post.views ? <b className="sx-views"><Play weight="fill" />{post.views}</b> : null}
    </button>
  );
}

function ExploreGrid({ posts, onOpen, peek, limit }) {
  const shown = posts.slice(0, limit);
  return (
    <div className="sx-grid">
      {shown.map((post, index) => {
        const block = Math.floor(index / 5);
        const tall = index % 5 === 0 && posts.length >= 5;
        return (
          <div key={`${post.id}-${index}`} className={`sx-cell${tall ? (block % 2 ? " tall left" : " tall right") : ""}`} style={{ "--i": index % 15 }}>
            <ExploreTile post={post} tall={tall} onOpen={onOpen} peek={peek} />
          </div>
        );
      })}
    </div>
  );
}

function PeekCard({ post, it }) {
  if (!post) return null;
  return (
    <div className="sx-peek" aria-hidden="true">
      <div className="sx-peek-card">
        <header>
          <RemoteImage src={post.avatar || AVATAR} alt="" />
          <strong>{String(post.handle || post.name).replace(/^@/, "")}</strong>
        </header>
        <RemoteImage className="sx-peek-media" src={post.image} alt="" />
        <footer>
          <Heart strokeWidth={2} />
          <MessageCircle strokeWidth={2} />
          <Send strokeWidth={2} />
          <em>{post.likes ? `${post.likes} ${it ? "Mi piace" : "likes"}` : ""}</em>
        </footer>
      </div>
    </div>
  );
}

function SearchScreen({ explore, onOpenPost, onOpenPerson }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(false);
  const [topic, setTopic] = useState("all");
  const [tab, setTab] = useState("top");
  const [scope, setScope] = useState(null);
  const [limit, setLimit] = useState(30);
  const [peeked, setPeeked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(0);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const peek = usePeek(setPeeked);
  const needle = query.trim().toLowerCase().replace(/^[@#]/, "");
  const searching = focus || Boolean(query.trim());

  const pool = useMemo(() => {
    const reels = REELS.map((reel) => ({
      id: `reel-${reel.id}`,
      name: reel.name,
      handle: reel.handle,
      avatar: reel.avatar || reel.src,
      image: reel.src,
      text: reel.caption,
      likes: reel.likes,
      saves: reel.saves,
      kind: "reel",
      views: reel.likes ? `${(parseCount(reel.likes) * 7 / 1000).toFixed(0)}k` : "",
      tag: personByName(reel.name)?.craft,
      thread: reel.thread,
    }));
    const seen = new Set();
    return [...explore, ...EXPLORE_POSTS, ...reels].filter((post) => {
      if (!post.image || seen.has(post.image) || String(post.image).startsWith("blob:")) return false;
      if (!shown(prefs, post) || personHidden(prefs, post.name, true)) return false;
      seen.add(post.image);
      return true;
    });
  }, [explore, prefs]);

  // "For you": interleave so the same person never sits side by side; reshuffled on refresh.
  const feed = useMemo(() => {
    const base = topic === "all" ? pool : pool.filter((post) => post.tag === topic || hashtagsOf(post.text).includes(topic.toLowerCase()));
    const rotated = base.map((post, index) => ({ post, rank: ((index + 1) * 7919 + seed * 104729) % 9973 })).sort((a, b) => a.rank - b.rank).map((entry) => entry.post);
    // Keep scrolling: repeat the pool in a new order instead of ending.
    const loops = Math.max(1, Math.ceil(limit / Math.max(1, rotated.length)));
    const out = [];
    for (let loop = 0; loop < loops; loop += 1) {
      const pass = loop % 2 ? [...rotated].reverse() : rotated;
      out.push(...pass);
    }
    return out;
  }, [pool, topic, seed, limit]);

  const people = SEARCH_PEOPLE.filter((person) => !personHidden(prefs, person.name, true));
  const accountHits = needle
    ? people.filter((person) => `${person.name} ${person.handle} ${person.craft} ${person.city}`.toLowerCase().includes(needle))
    : [];
  const tagCounts = useMemo(() => {
    const counts = new Map();
    for (const post of pool) {
      for (const tag of new Set([...hashtagsOf(post.text), ...(post.tag ? [post.tag.toLowerCase()] : [])])) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    return counts;
  }, [pool]);
  const tagHits = needle ? [...tagCounts.entries()].filter(([tag]) => tag.includes(needle)).sort((a, b) => b[1] - a[1]) : [];
  const placeHits = needle
    ? [...new Set([...CITIES.map((city) => city.name), ...people.map((person) => person.city)])].filter((city) => city.toLowerCase().includes(needle))
    : [];
  const postHits = needle
    ? pool.filter((post) => `${post.text || ""} ${post.name || ""} ${post.handle || ""} ${post.tag || ""} ${post.place || ""}`.toLowerCase().includes(needle))
    : [];
  const placeCount = (city) => pool.filter((post) => post.place === city || personByName(post.name)?.city === city).length;

  function remember(entry) {
    space.rememberSearch(entry);
  }

  function openPerson(person) {
    remember({ key: `p:${person.handle}`, type: "account", label: person.handle, meta: person.name, src: person.src });
    onOpenPerson(person);
  }

  function openScope(next) {
    remember({ key: `${next.type}:${next.value}`, type: next.type, label: next.value });
    setScope(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  function leave() {
    setQuery("");
    setFocus(false);
    setTab("top");
    inputRef.current?.blur();
  }

  function onScroll(event) {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) setLimit((value) => Math.min(value + 15, 240));
  }

  // Pull down at the top to refresh the grid.
  const pull = useRef({ y: 0, on: false });
  const [pullBy, setPullBy] = useState(0);
  function pullStart(event) {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0 || searching || scope) return;
    pull.current = { y: event.touches ? event.touches[0].clientY : event.clientY, on: true };
  }
  function pullMove(event) {
    if (!pull.current.on) return;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    const by = Math.max(0, Math.min(90, (y - pull.current.y) * 0.5));
    setPullBy(by);
  }
  function pullEnd() {
    if (!pull.current.on) return;
    pull.current.on = false;
    if (pullBy > 60) {
      setRefreshing(true);
      setPullBy(48);
      window.setTimeout(() => {
        setSeed((value) => value + 1);
        setLimit(30);
        setRefreshing(false);
        setPullBy(0);
      }, 700);
    } else setPullBy(0);
  }

  const recents = space.recentSearches || [];

  function recentIcon(entry) {
    if (entry.type === "account") return <RemoteImage className="sx-avatar" src={entry.src || avatarFor(entry.meta || entry.label)} alt="" />;
    if (entry.type === "tag") return <i className="sx-round"><Hash strokeWidth={2} /></i>;
    if (entry.type === "place") return <i className="sx-round"><MapPin strokeWidth={2} /></i>;
    return <i className="sx-round"><Search strokeWidth={2} /></i>;
  }

  function openRecent(entry) {
    if (entry.type === "account") {
      const person = people.find((item) => item.handle === entry.label);
      if (person) openPerson(person);
      return;
    }
    if (entry.type === "tag" || entry.type === "place") {
      openScope({ type: entry.type, value: entry.label });
      return;
    }
    setQuery(entry.label);
  }

  function accountRow(person, big = false) {
    const on = space.follows.has(person.name);
    const friend = SEARCH_PEOPLE.find((item) => item.name !== person.name && space.follows.has(item.name));
    return (
      <div key={person.handle} className={`sx-account${big ? " big" : ""}`}>
        <button type="button" className="sx-account-open" onClick={() => openPerson(person)}>
          <RemoteImage className="sx-avatar" src={person.src} alt="" />
          <span>
            <strong>{person.handle}{person.verified ? <Verified className="sx-verified" /> : null}</strong>
            <em>{person.name} · {friend ? say(`Followed by ${friend.handle}`, `Seguito da ${friend.handle}`) : `${countLabel(person.followers, it)} follower`}</em>
          </span>
        </button>
        {big ? (
          <button type="button" className={on ? "ig-btn small" : "ig-btn small primary"} aria-pressed={on} onClick={() => space.toggleFollow(person.name)}>
            {on ? say("Following", "Segui già") : say("Follow", "Segui")}
          </button>
        ) : null}
      </div>
    );
  }

  let body;
  if (scope) {
    const matches = scope.type === "tag"
      ? pool.filter((post) => hashtagsOf(post.text).includes(scope.value) || post.tag?.toLowerCase() === scope.value)
      : pool.filter((post) => post.place === scope.value || personByName(post.name)?.city === scope.value);
    const cover = matches[0]?.image;
    const followTag = space.follows.has(`#${scope.value}`);
    body = (
      <div className="sx-scope">
        <div className="sx-scope-head">
          {scope.type === "tag" ? (
            <span className="sx-scope-face">{cover ? <RemoteImage src={cover} alt="" /> : null}<i><Hash strokeWidth={2.4} /></i></span>
          ) : (
            <span className="sx-scope-face place"><i><MapPin weight="fill" /></i></span>
          )}
          <div>
            <strong>{scope.type === "tag" ? `#${scope.value}` : scope.value}</strong>
            <em>{matches.length} {matches.length === 1 ? "post" : "post"}</em>
            {scope.type === "tag" ? (
              <button type="button" className={followTag ? "ig-btn small" : "ig-btn small primary"} onClick={() => space.toggleFollow(`#${scope.value}`)}>
                {followTag ? say("Following", "Segui già") : say("Follow", "Segui")}
              </button>
            ) : (
              <span className="sx-scope-meta">{say("Italy", "Italia")}</span>
            )}
          </div>
        </div>
        <div className="sx-scope-tabs" role="tablist">
          <button type="button" className="on" role="tab" aria-selected="true">{say("Top", "Più popolari")}</button>
          <button type="button" role="tab" aria-selected="false" onClick={() => setSeed((value) => value + 1)}>{say("Recent", "Recenti")}</button>
        </div>
        {matches.length ? (
          <ExploreGrid posts={matches} onOpen={onOpenPost} peek={peek} limit={60} />
        ) : (
          <div className="ig-empty"><i><Hash strokeWidth={1.4} /></i><strong>{say("No posts yet", "Ancora nessun post")}</strong></div>
        )}
      </div>
    );
  } else if (!searching) {
    body = (
      <>
        <div className="sx-pull" style={{ height: pullBy }} aria-hidden={!pullBy}>
          <i className={refreshing ? "spin" : ""} style={{ transform: `rotate(${pullBy * 4}deg)`, opacity: Math.min(1, pullBy / 50) }} />
        </div>
        <div className="sx-topics" role="group" aria-label={say("Topics", "Argomenti")}>
          {["all", ...EXPLORE_TOPICS].map((item) => (
            <button
              key={item}
              type="button"
              className={topic === item ? "on" : ""}
              aria-pressed={topic === item}
              onClick={() => {
                setTopic(item);
                setLimit(30);
                scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {item === "all" ? say("For you", "Per te") : item}
            </button>
          ))}
        </div>
        <ExploreGrid key={`${topic}-${seed}`} posts={feed} onOpen={onOpenPost} peek={peek} limit={limit} />
      </>
    );
  } else if (!needle) {
    body = (
      <div className="sx-recent">
        {recents.length ? (
          <>
            <div className="sx-head">
              <strong>{say("Recent", "Recenti")}</strong>
              <button type="button" onClick={() => space.forgetSearch()}>{say("Clear all", "Cancella tutto")}</button>
            </div>
            {recents.map((entry) => (
              <div key={entry.key} className="sx-recent-row">
                <button type="button" className="sx-recent-open" onClick={() => openRecent(entry)}>
                  {recentIcon(entry)}
                  <span>
                    <strong>{entry.type === "tag" ? `#${entry.label}` : entry.label}</strong>
                    {entry.meta ? <em>{entry.meta}</em> : entry.type === "place" ? <em>{say("Place", "Luogo")}</em> : null}
                  </span>
                </button>
                <button type="button" className="sx-x" aria-label={say("Remove", "Rimuovi")} onClick={() => space.forgetSearch(entry.key)}><X strokeWidth={2} /></button>
              </div>
            ))}
          </>
        ) : null}
        <div className="sx-head"><strong>{say("Suggested for you", "Suggeriti per te")}</strong></div>
        {people.filter((person) => !space.follows.has(person.name)).slice(0, 6).map((person) => accountRow(person, true))}
      </div>
    );
  } else {
    const tabs = [
      ["top", say("For you", "Per te")],
      ["accounts", say("Accounts", "Account")],
      ["shop", "Shop"],
      ["tags", "Tag"],
      ["places", say("Places", "Luoghi")],
    ];
    const productHits = Object.entries(SHOPS).flatMap(([owner, shop]) => shop.products.map((product) => ({ owner, shop, product })))
      .filter(({ shop, product }) => `${product.name} ${product.category} ${product.description} ${shop.title} ${shop.city}`.toLowerCase().includes(needle));
    const none = !accountHits.length && !tagHits.length && !placeHits.length && !postHits.length && !productHits.length;
    body = (
      <>
        <div className="sx-tabs" role="tablist">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
          <i className="sx-tabs-bar" style={{ "--n": tabs.findIndex(([key]) => key === tab) }} />
        </div>
        <div className="sx-results" key={tab}>
          {none ? (
            <div className="ig-empty">
              <i><Search strokeWidth={1.4} /></i>
              <strong>{say(`No results for “${query.trim()}”`, `Nessun risultato per «${query.trim()}»`)}</strong>
              <span>{say("Try another name, place or tag.", "Prova un altro nome, luogo o tag.")}</span>
            </div>
          ) : null}
          {tab === "top" ? (
            <>
              {accountHits.slice(0, 3).map((person) => accountRow(person))}
              {tagHits.slice(0, 2).map(([tag, count]) => (
                <button key={tag} type="button" className="sx-line" onClick={() => openScope({ type: "tag", value: tag })}>
                  <i className="sx-round"><Hash strokeWidth={2} /></i>
                  <span><strong>#{tag}</strong><em>{count} post</em></span>
                </button>
              ))}
              {placeHits.slice(0, 1).map((city) => (
                <button key={city} type="button" className="sx-line" onClick={() => openScope({ type: "place", value: city })}>
                  <i className="sx-round"><MapPin strokeWidth={2} /></i>
                  <span><strong>{city}</strong><em>{placeCount(city)} post</em></span>
                </button>
              ))}
              {postHits.length ? <ExploreGrid posts={postHits} onOpen={onOpenPost} peek={peek} limit={30} /> : null}
            </>
          ) : null}
          {tab === "accounts" ? accountHits.map((person) => accountRow(person, true)) : null}
          {tab === "shop" ? (
            productHits.length ? (
              <div className="shop-grid sx-shop">
                {productHits.map(({ owner, shop, product }, index) => (
                  <button key={product.id} type="button" className="shop-card" style={{ "--i": Math.min(index, 8) }} onClick={() => nav.product?.(product, owner)}>
                    <span className="shop-pic"><RemoteImage src={product.images[0]} alt="" /></span>
                    <strong>{product.name}</strong>
                    <em>{euro(product.price, it)} · {shop.title}</em>
                  </button>
                ))}
              </div>
            ) : <div className="ig-empty"><i><Bag strokeWidth={1.4} /></i><strong>{say("No products", "Nessun prodotto")}</strong></div>
          ) : null}
          {tab === "tags" ? tagHits.map(([tag, count]) => (
            <button key={tag} type="button" className="sx-line" onClick={() => openScope({ type: "tag", value: tag })}>
              <i className="sx-round"><Hash strokeWidth={2} /></i>
              <span><strong>#{tag}</strong><em>{count} post</em></span>
            </button>
          )) : null}
          {tab === "places" ? placeHits.map((city) => (
            <button key={city} type="button" className="sx-line" onClick={() => openScope({ type: "place", value: city })}>
              <i className="sx-round"><MapPin strokeWidth={2} /></i>
              <span><strong>{city}</strong><em>{placeCount(city)} post · {say("Italy", "Italia")}</em></span>
            </button>
          )) : null}
        </div>
      </>
    );
  }

  return (
    <div className={`panel view sx${searching ? " searching" : ""}${scope ? " scoped" : ""}`}>
      <div className="sx-bar">
        {scope ? (
          <button type="button" className="sx-back" aria-label={say("Back", "Indietro")} onClick={() => setScope(null)}><ChevronLeft strokeWidth={2.4} /></button>
        ) : null}
        <label className="sx-field">
          <Search strokeWidth={2} aria-hidden="true" />
          <input
            ref={inputRef}
            value={scope ? (scope.type === "tag" ? `#${scope.value}` : scope.value) : query}
            onChange={(event) => {
              setScope(null);
              setQuery(event.target.value);
            }}
            onFocus={() => {
              if (scope) {
                setQuery(scope.type === "tag" ? `#${scope.value}` : scope.value);
                setScope(null);
              }
              setFocus(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && query.trim()) {
                remember({ key: `q:${query.trim().toLowerCase()}`, type: "query", label: query.trim() });
                inputRef.current?.blur();
              }
            }}
            placeholder={say("Search", "Cerca")}
            aria-label={say("Search people, tags or places", "Cerca persone, tag o luoghi")}
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && !scope ? (
            <button type="button" className="sx-clear" aria-label={say("Clear", "Cancella")} onClick={() => { setQuery(""); inputRef.current?.focus({ preventScroll: true }); }}><X strokeWidth={2.6} /></button>
          ) : null}
        </label>
        <button type="button" className="sx-cancel" tabIndex={searching && !scope ? 0 : -1} aria-hidden={!searching || Boolean(scope)} onClick={leave}>
          {say("Cancel", "Annulla")}
        </button>
      </div>
      <div
        className="panel-scroll sx-scroll"
        ref={scrollRef}
        onScroll={onScroll}
        onTouchStart={pullStart}
        onTouchMove={pullMove}
        onTouchEnd={pullEnd}
        onPointerDown={(event) => { if (event.pointerType === "mouse") pullStart(event); }}
        onPointerMove={(event) => { if (event.pointerType === "mouse" && event.buttons) pullMove(event); }}
        onPointerUp={(event) => { if (event.pointerType === "mouse") pullEnd(); }}
      >
        <div className="sx-body" key={scope ? `scope-${scope.type}-${scope.value}` : searching ? (needle ? "results" : "recent") : "explore"}>
          {body}
        </div>
      </div>
      <PeekCard post={peeked} it={it} />
    </div>
  );
}

// Someone else's profile, opened from Search, comments or Direct.
function PersonScreen({ person, onClose, onOpenPost, onMessage }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [tab, setTab] = useState("grid");
  const [menu, setMenu] = useState(false);
  const following = space.follows.has(person.name);
  const posts = [...EXPLORE_POSTS, ...POSTS.filter((post) => post.image)].filter((post) => post.name === person.name);
  const reels = REELS.filter((reel) => reel.name === person.name).map((reel) => ({ ...asPost({ ...reel, image: reel.src, text: reel.caption, type: "reel" }), avatar: reel.avatar || reel.src }));
  const followers = (person.followers || 0) + (following ? 1 : 0);
  const shownFollowers = useCountUp(followers);
  const shownPosts = useCountUp(posts.length + reels.length);
  const mutual = SEARCH_PEOPLE.filter((item) => item.name !== person.name && space.follows.has(item.name)).slice(0, 2);
  const list = tab === "grid" ? posts : reels;
  const shop = useShop(person.name);
  const nav = useContext(ThoughtNav);
  const tabIds = ["grid", ...(shop ? ["shop"] : []), "reels", "thoughts"];
  return (
    <div className="panel view ps">
      <div className="ps-bar">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <strong>{person.handle}{person.verified ? <Verified className="sx-verified" /> : null}</strong>
        <button type="button" className="ps-icon" aria-label={say("More", "Altro")} onClick={() => setMenu(true)}><MoreHorizontal /></button>
      </div>
      <div className="panel-scroll">
        <div className="ps-top">
          <span className="ps-face"><RemoteImage src={person.src} alt="" /></span>
          <div className="ps-stats">
            <span><b>{shownPosts}</b><em>post</em></span>
            <span><b>{compact(shownFollowers, it)}</b><em>follower</em></span>
            <span><b>{compact(person.following || 0, it)}</b><em>{say("following", "seguiti")}</em></span>
          </div>
        </div>
        <div className="ps-bio">
          <strong>{shop ? shop.title : person.name}</strong>
          <span className="ps-craft">{shop ? shop.category : person.craft}</span>
          <p>{person.bio}</p>
          {shop ? null : <span className="ps-place"><MapPin weight="fill" />{person.city}, {say("Italy", "Italia")}</span>}
          {mutual.length ? (
            <span className="ps-mutual">
              <span className="ps-mutual-faces">{mutual.map((item) => <RemoteImage key={item.handle} src={item.src} alt="" />)}</span>
              {say("Followed by", "Seguito da")} <b>{mutual[0].handle}</b>{mutual[1] ? <>{say(" and ", " e ")}<b>{mutual[1].handle}</b></> : null}
            </span>
          ) : null}
        </div>
        {shop ? <BusinessCard shop={shop} /> : null}
        <div className="ps-actions">
          <button type="button" className={following ? "ig-btn" : "ig-btn primary"} aria-pressed={following} onClick={() => space.toggleFollow(person.name)}>
            {following ? <>{say("Following", "Segui già")}<ChevronDown strokeWidth={2.4} /></> : say("Follow", "Segui")}
          </button>
          <button type="button" className="ig-btn" onClick={() => onMessage(person)}>{say("Message", "Messaggio")}</button>
          <button type="button" className="ig-btn square" aria-label={say("Suggested", "Suggeriti")}><UserPlus strokeWidth={2} /></button>
        </div>
        <div className="ps-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${tabIds.length}, 1fr)` }}>
          <button type="button" role="tab" aria-selected={tab === "grid"} className={tab === "grid" ? "on" : ""} onClick={() => setTab("grid")}><Grid4 weight={tab === "grid" ? "fill" : "regular"} /></button>
          {shop ? <button type="button" role="tab" aria-selected={tab === "shop"} aria-label="Shop" className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}><Bag weight={tab === "shop" ? "fill" : "regular"} /></button> : null}
          <button type="button" role="tab" aria-selected={tab === "reels"} className={tab === "reels" ? "on" : ""} onClick={() => setTab("reels")}><SquarePlay weight={tab === "reels" ? "fill" : "regular"} /></button>
          <button type="button" role="tab" aria-selected={tab === "thoughts"} aria-label={say("Thoughts", "Pensieri")} className={tab === "thoughts" ? "on" : ""} onClick={() => setTab("thoughts")}><Feather weight={tab === "thoughts" ? "fill" : "regular"} /></button>
          <i className="ps-tabs-bar" style={{ "--n": tabIds.indexOf(tab), width: `${100 / tabIds.length}%` }} />
        </div>
        {tab === "shop" && shop ? (
          <ShopGrid shop={shop} onOpen={(product) => nav.product?.(product, person.name)} />
        ) : tab === "thoughts" ? (
          <ThoughtList name={person.name} />
        ) : list.length ? (
          <div className={`ps-grid${tab === "reels" ? " reels" : ""}`} key={tab}>
            {list.map((post, index) => (
              <button key={post.id} type="button" className="ps-tile" style={{ "--i": index }} onClick={() => onOpenPost(post)} aria-label={`Post, ${post.name}`}>
                <RemoteImage src={post.image} alt="" />
                {post.images?.length > 1 ? <i className="sx-badge"><Carousel /></i> : null}
                {tab === "reels" ? <b className="sx-views"><Play weight="fill" />{post.likes}</b> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="ig-empty"><i>{tab === "grid" ? <Camera strokeWidth={1.4} /> : <SquarePlay strokeWidth={1.4} />}</i><strong>{tab === "grid" ? say("No posts yet", "Ancora nessun post") : say("No reels yet", "Ancora nessun reel")}</strong></div>
        )}
      </div>
      {menu ? (
        <div className="ps-sheet-wrap" onClick={() => setMenu(false)}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            <button type="button" onClick={() => { navigator.clipboard?.writeText(`https://space.app/${person.handle}`).catch(() => {}); setMenu(false); }}><LinkIcon strokeWidth={2} />{say("Copy profile URL", "Copia URL del profilo")}</button>
            <button type="button" onClick={() => { setMenu(false); onMessage(person); }}><Send strokeWidth={2} />{say("Send message", "Invia messaggio")}</button>
            {following ? <button type="button" onClick={() => { space.toggleFollow(person.name); setMenu(false); }}><UserMinus strokeWidth={2} />{say("Unfollow", "Non seguire più")}</button> : null}
            <button type="button" className="warn" onClick={() => setMenu(false)}>{say("Cancel", "Annulla")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pensieri (Thoughts): short text posts with photos, polls, threads and quotes.
// ---------------------------------------------------------------------------
const THOUGHT_LIMIT = 500;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const BOOT = Date.now();

function author(index) {
  const person = SEARCH_PEOPLE[index];
  return { name: person.name, handle: person.handle, src: person.src, verified: Boolean(person.verified) };
}

const THOUGHT_SEED = [
  {
    id: "tw1", ...author(1), created: BOOT - 2 * HOUR, likes: 248, reposts: 12,
    text: "Il bordo regge se lo lasci raffreddare. Non forzare il rosso: un tono sotto, e tiene.",
    replies: [
      { id: "tw1-r1", ...author(6), created: BOOT - 90 * MIN, likes: 31, text: "Verissimo. A Faenza diciamo che il forno si ascolta, non si comanda. 🔥" },
      { id: "tw1-r2", ...author(0), created: BOOT - 70 * MIN, likes: 8, text: "@bassi.liuteria vale anche per il pane, giuro." },
    ],
  },
  {
    id: "th-poll", ...author(6), created: BOOT - 3 * HOUR, likes: 512, reposts: 40,
    text: "Domanda seria per chi lavora la ceramica: qual è il momento più bello? #ceramica",
    poll: { options: [{ text: "Al tornio", votes: 184 }, { text: "Aprire il forno", votes: 402 }, { text: "Smaltare", votes: 77 }], endsAt: BOOT + 2 * DAY },
    replies: [{ id: "th-poll-r1", ...author(3), created: BOOT - 2 * HOUR, likes: 12, text: "Aprire il forno, senza dubbio. È come scartare un regalo che hai fatto tu." }],
  },
  {
    id: "th-thread", ...author(2), created: BOOT - 5 * HOUR, likes: 1204, reposts: 96,
    text: "Tre cose che ho imparato in vent'anni di telaio 🧵",
    chain: [
      "1. La lana ha memoria. Se la tiri troppo il primo giorno, te lo ricorda per sempre.",
      "2. Il rosso di Prato non si compra: si fa, si sbaglia, si rifà.",
      "3. Le mani stanche lavorano meglio di quelle nervose. Fermati prima, non dopo.",
    ],
    replies: [{ id: "th-thread-r1", ...author(4), created: BOOT - 4 * HOUR, likes: 64, text: "La numero 3 la stampo e la appendo in laboratorio." }],
  },
  {
    id: "th-photo", ...author(5), created: BOOT - 7 * HOUR, likes: 873, reposts: 22,
    text: "Pesto al mortaio, sempre. Chi usa il frullatore oggi offre la cena a tutti. #cucina #genova",
    images: [shot("1473093295043-cdd812d0e601", 900, 900), shot("1551218808-94e220e084d2", 900, 900)],
    replies: [],
  },
  {
    id: "tw2", ...author(2), created: BOOT - DAY, likes: 176, reposts: 5,
    text: "Ho un rosso di Prato, se ti serve. Sta vicino al telaio, non al forno.",
    replies: [],
  },
  {
    id: "th-quote", ...author(3), created: BOOT - 26 * HOUR, likes: 95, reposts: 3,
    text: "Questo. E aggiungo: misurate la temperatura due volte, sempre.",
    quote: "tw1",
    replies: [],
  },
  {
    id: "th-music", ...author(1), created: BOOT - 2 * DAY, likes: 640, reposts: 18,
    text: "Un violino nuovo suona timido per i primi mesi. Poi impara la voce di chi lo suona. Non c'è niente di più bello nel mio mestiere.",
    images: [shot("1465821185615-20b3c2fbf41b", 900, 1100)],
    replies: [],
  },
  {
    id: "tw3", ...author(5), created: BOOT - 4 * DAY, likes: 128, reposts: 2,
    text: "Il forno regge una teglia larga, se la infili dopo il primo calore. Non prima.",
    replies: [],
  },
  {
    id: "th-design", ...author(7), created: BOOT - 5 * DAY, likes: 302, reposts: 11,
    text: "Gli oggetti più belli che ho in casa li ha fatti qualcuno che conosco per nome. È un buon criterio per arredare.",
    replies: [],
  },
];

const ThoughtNav = createContext({});

function agoLabel(ms, it) {
  const diff = Math.max(0, Date.now() - ms);
  if (diff < MIN) return it ? "ora" : "now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} g`;
  return new Date(ms).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "short" });
}

function fullStamp(ms, it) {
  const date = new Date(ms);
  return `${clockOf(ms)} · ${date.toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

// Everything the UI needs about thoughts, merged from the seed and the store.
function useThoughts() {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  return useMemo(() => {
    const me = space.profile || PROFILE_SEED;
    const mine = (space.thoughts || []).map((item) => ({ ...item, name: me.name, handle: String(me.handle || "").replace(/^@/, ""), src: AVATAR, mine: true }));
    const seeded = THOUGHT_SEED.map((item) => ({
      ...item,
      // A thread written by the author is stored as replies of their own.
      replies: [...(item.chain || []).map((text, index) => ({ id: `${item.id}-c${index}`, name: item.name, handle: item.handle, src: item.src, verified: item.verified, created: item.created + (index + 1) * 1000, likes: Math.round(item.likes / (4 + index)), text, chained: true })), ...(item.replies || [])],
    }));
    const all = [...mine, ...seeded].filter((item) => !personHidden(prefs, item.name, true) && !textHidden(prefs, item.text));
    const byId = new Map();
    for (const item of all) {
      byId.set(item.id, item);
      for (const reply of item.replies || []) byId.set(reply.id, { ...reply, parentId: item.id });
    }
    const shape = (item) => (item.mine ? { ...item, name: me.name, handle: String(me.handle || "").replace(/^@/, ""), src: AVATAR } : item);
    const extras = {};
    for (const [parentId, list] of Object.entries(space.thoughtReplies || {})) {
      extras[parentId] = (list || []).map(shape).filter((item) => !textHidden(prefs, item.text));
      for (const reply of extras[parentId]) if (!byId.has(reply.id)) byId.set(reply.id, { ...reply, parentId });
    }
    function repliesOf(id) {
      const node = byId.get(id);
      return [...(node && !node.parentId ? node.replies || [] : []), ...(extras[id] || [])];
    }
    return { all, byId, repliesOf, me };
  }, [space.thoughts, space.thoughtReplies, space.profile, prefs]);
}

function ThoughtText({ text, big }) {
  const nav = useContext(ThoughtNav);
  return (
    <p className={big ? "tc-text big" : "tc-text"}>
      <RichText text={text} onTag={(tag) => nav.tag?.(tag)} />
    </p>
  );
}

function ThoughtPoll({ thought }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const voted = space.thoughtVotes[thought.id];
  const options = thought.poll.options.map((option, index) => ({ ...option, votes: option.votes + (voted === index ? 1 : 0) }));
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const left = Math.max(0, thought.poll.endsAt - Date.now());
  const ended = left === 0;
  const showResults = voted != null || ended || thought.mine;
  const lead = Math.max(...options.map((option) => option.votes));
  return (
    <div className={`tc-poll${showResults ? " done" : ""}`} onClick={(event) => event.stopPropagation()}>
      {options.map((option, index) => {
        const share = total ? Math.round((option.votes / total) * 100) : 0;
        return (
          <button
            key={index}
            type="button"
            className={`tc-option${voted === index ? " mine" : ""}${showResults && option.votes === lead ? " lead" : ""}`}
            disabled={showResults}
            onClick={() => space.voteThought(thought.id, index)}
            style={{ "--share": `${showResults ? share : 0}%` }}
          >
            <i className="tc-option-bar" />
            <span>{option.text}{voted === index ? <Check weight="bold" /> : null}</span>
            {showResults ? <b>{share}%</b> : null}
          </button>
        );
      })}
      <em className="tc-poll-meta">
        {total.toLocaleString(it ? "it-IT" : "en-GB")} {it ? "voti" : "votes"} · {ended ? (it ? "Concluso" : "Final results") : left > DAY ? (it ? `${Math.ceil(left / DAY)} giorni rimasti` : `${Math.ceil(left / DAY)} days left`) : (it ? `${Math.ceil(left / HOUR)} ore rimaste` : `${Math.ceil(left / HOUR)} hours left`)}
      </em>
    </div>
  );
}

function ThoughtMedia({ images, onZoom }) {
  if (!images?.length) return null;
  if (images.length === 1) {
    return (
      <div className="tc-media one" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => onZoom(images[0])}><img src={images[0]} alt="" draggable="false" loading="lazy" /></button>
      </div>
    );
  }
  return (
    <div className="tc-media rail" data-no-swipe onClick={(event) => event.stopPropagation()}>
      {images.map((src, index) => (
        <button key={`${index}-${String(src).slice(-20)}`} type="button" onClick={() => onZoom(src)}><img src={src} alt="" draggable="false" loading="lazy" /></button>
      ))}
    </div>
  );
}

function QuotedThought({ thought, onOpen }) {
  const it = useContext(SpacePrefs).language === "it";
  if (!thought) return <div className="tc-quote gone">{it ? "Questo pensiero non è più disponibile." : "This thought is unavailable."}</div>;
  return (
    <button type="button" className="tc-quote" onClick={(event) => { event.stopPropagation(); onOpen?.(thought); }}>
      <span className="tc-quote-head">
        <RemoteImage src={thought.src} alt="" />
        <strong>{thought.handle}</strong>
        {thought.verified ? <Verified className="sx-verified" /> : null}
        <time>{agoLabel(thought.created, it)}</time>
      </span>
      <span className="tc-quote-text">{thought.text}</span>
      {thought.images?.length ? <img className="tc-quote-img" src={thought.images[0]} alt="" /> : null}
    </button>
  );
}

function ThoughtCard({ thought, line = false, lineUp = false, big = false, repostedBy, replyCount, onOpen, delay = 0 }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { byId } = useThoughts();
  const [menu, setMenu] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [burst, setBurst] = useState(0);
  const tap = useRef({ at: 0, timer: 0 });
  const liked = space.thoughtLikes.has(thought.id);
  const reposted = space.thoughtReposts.some((item) => item.id === thought.id);
  const likes = (thought.likes || 0) + (liked ? 1 : 0);
  const reposts = (thought.reposts || 0) + (reposted ? 1 : 0);
  const replies = replyCount ?? 0;
  const follows = space.follows.has(thought.name);
  const showCounts = prefs.likeCounts !== false;
  const open = () => (onOpen ? onOpen(thought) : nav.open?.(thought));

  function like() {
    if (!liked) {
      navigator.vibrate?.(8);
      setBurst(Date.now());
    }
    space.toggleThoughtLike(thought.id);
  }

  function onCardClick(event) {
    if (event.target.closest("button, a, .tc-poll")) return;
    const now = Date.now();
    if (now - tap.current.at < 280) {
      window.clearTimeout(tap.current.timer);
      tap.current.at = 0;
      if (!liked) like();
      else setBurst(Date.now());
      return;
    }
    tap.current.at = now;
    if (big) return;
    tap.current.timer = window.setTimeout(() => { tap.current.at = 0; open(); }, 260);
  }

  return (
    <article
      className={`tc${big ? " big" : ""}${line ? " line" : ""}${lineUp ? " line-up" : ""}`}
      style={{ "--d": `${delay}ms` }}
      onClick={onCardClick}
    >
      {repostedBy ? <span className="tc-reposted"><Repost weight="bold" />{repostedBy}</span> : null}
      <div className="tc-side">
        <button type="button" className="tc-face" onClick={() => nav.person?.(thought)} aria-label={thought.name}>
          <RemoteImage src={thought.src || AVATAR} alt="" />
          {!thought.mine && !follows && !lineUp ? (
            <i
              className="tc-follow"
              role="button"
              aria-label={say("Follow", "Segui")}
              onClick={(event) => { event.stopPropagation(); space.toggleFollow(thought.name); }}
            >
              <Plus weight="bold" />
            </i>
          ) : null}
        </button>
        {line ? <i className="tc-line" /> : null}
      </div>
      <div className="tc-main">
        <header className="tc-head">
          <button type="button" className="tc-name" onClick={() => nav.person?.(thought)}>
            <strong>{thought.handle}</strong>
            {thought.verified ? <Verified className="sx-verified" /> : null}
          </button>
          {!big ? <time>{agoLabel(thought.created, it)}</time> : null}
          <button type="button" className="tc-more" aria-label={say("More", "Altro")} onClick={() => setMenu("more")}><MoreHorizontal /></button>
        </header>
        {thought.replyTo ? <span className="tc-replying">{say("Replying to", "In risposta a")} <b>@{thought.replyTo}</b></span> : null}
        {thought.text ? <ThoughtText text={thought.text} big={big} /> : null}
        <ThoughtMedia images={thought.images} onZoom={setZoom} />
        {thought.poll ? <ThoughtPoll thought={thought} /> : null}
        {thought.quote ? <QuotedThought thought={byId.get(thought.quote)} onOpen={(item) => nav.open?.(item)} /> : null}
        {big ? <time className="tc-stamp">{fullStamp(thought.created, it)}</time> : null}
        <div className="tc-actions">
          <button type="button" className={`tc-act like${liked ? " on" : ""}`} aria-pressed={liked} aria-label={say("Like", "Mi piace")} onClick={like}>
            <span className="tc-heart" key={burst}><Heart weight={liked ? "fill" : "regular"} /></span>
            {showCounts && likes ? <b>{compact(likes, it)}</b> : null}
          </button>
          <button type="button" className="tc-act" aria-label={say("Reply", "Rispondi")} onClick={() => nav.compose?.({ replyTo: thought })}>
            <MessageCircle strokeWidth={2} />
            {replies ? <b>{compact(replies, it)}</b> : null}
          </button>
          <button type="button" className={`tc-act repost${reposted ? " on" : ""}`} aria-label={say("Repost", "Ripubblica")} onClick={() => setMenu("repost")}>
            <Repost strokeWidth={2} />
            {reposts ? <b>{compact(reposts, it)}</b> : null}
          </button>
          <button type="button" className="tc-act" aria-label={say("Share", "Condividi")} onClick={() => nav.share?.(thought)}>
            <Send strokeWidth={2} />
          </button>
        </div>
      </div>
      {burst ? <span key={`b${burst}`} className="tc-burst" aria-hidden="true"><Heart weight="fill" /></span> : null}
      {menu ? createPortal((
        <div className="ps-sheet-wrap tc-sheet-wrap" onClick={(event) => { event.stopPropagation(); setMenu(null); }}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            {menu === "repost" ? (
              <>
                <button type="button" className={reposted ? "danger" : ""} onClick={() => { space.toggleThoughtRepost(thought.id); setMenu(null); nav.toast?.(reposted ? say("Repost removed", "Ripubblicazione rimossa") : say("Reposted", "Ripubblicato")); }}>
                  <Repost strokeWidth={2} />{reposted ? say("Remove repost", "Rimuovi ripubblicazione") : say("Repost", "Ripubblica")}
                </button>
                <button type="button" onClick={() => { setMenu(null); nav.compose?.({ quote: thought }); }}><Quote strokeWidth={2} />{say("Quote", "Cita")}</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/t/${thought.id}`).catch(() => {}); setMenu(null); nav.toast?.(say("Link copied", "Link copiato")); }}><LinkIcon strokeWidth={2} />{say("Copy link", "Copia link")}</button>
                {!thought.mine ? (
                  <button type="button" onClick={() => { space.toggleFollow(thought.name); setMenu(null); }}>
                    {follows ? <UserMinus strokeWidth={2} /> : <UserPlus strokeWidth={2} />}{follows ? say(`Unfollow ${thought.handle}`, `Non seguire più ${thought.handle}`) : say(`Follow ${thought.handle}`, `Segui ${thought.handle}`)}
                  </button>
                ) : null}
                {thought.mine ? (
                  <button type="button" className="danger" onClick={() => { space.deleteThought(thought.id); setMenu(null); nav.toast?.(say("Deleted", "Eliminato")); nav.deleted?.(thought.id); }}><Trash strokeWidth={2} />{say("Delete", "Elimina")}</button>
                ) : null}
              </>
            )}
            <button type="button" className="warn" onClick={() => setMenu(null)}>{say("Cancel", "Annulla")}</button>
          </div>
        </div>
      ), document.querySelector(".screen-root") || document.body) : null}
      {zoom ? createPortal((
        <div className="pic-zoom dm-zoom tc-zoom" onClick={(event) => { event.stopPropagation(); setZoom(null); }}>
          <img src={zoom} alt="" />
        </div>
      ), document.querySelector(".screen-root") || document.body) : null}
    </article>
  );
}

// A thought in a feed, followed by the first part of its thread when the author wrote one.
function ThoughtEntry({ thought, delay, repostedBy }) {
  const { repliesOf } = useThoughts();
  const nav = useContext(ThoughtNav);
  const it = useContext(SpacePrefs).language === "it";
  const replies = repliesOf(thought.id);
  const chain = replies.filter((item) => item.chained);
  const others = replies.length - chain.length;
  return (
    <div className="tc-entry">
      <ThoughtCard thought={thought} line={chain.length > 0} replyCount={others} delay={delay} repostedBy={repostedBy} />
      {chain.length ? (
        <>
          <ThoughtCard thought={chain[0]} lineUp line={chain.length > 1} replyCount={0} onOpen={() => nav.open?.(thought)} />
          {chain.length > 1 ? (
            <button type="button" className="tc-more-thread" onClick={() => nav.open?.(thought)}>
              <span className="tc-dots"><i /><i /><i /></span>
              {it ? `Mostra il thread (${chain.length - 1} in più)` : `Show thread (${chain.length - 1} more)`}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CounterRing({ used }) {
  const left = THOUGHT_LIMIT - used;
  const ratio = Math.min(1, used / THOUGHT_LIMIT);
  const r = 9;
  const c = 2 * Math.PI * r;
  const tone = left < 0 ? "over" : left <= 20 ? "warn" : "";
  if (!used) return null;
  return (
    <span className={`tc-ring ${tone}`} aria-label={`${left}`}>
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r={r} className="track" />
        <circle cx="12" cy="12" r={r} className="fill" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - ratio) }} />
      </svg>
      {left <= 20 ? <b>{left}</b> : null}
    </span>
  );
}

const DRAFT_KEY = "space-thought-draft";
const AUDIENCES = ["everyone", "follow", "mention"];

function ThoughtComposer({ replyTo, quote, onClose, onPublish }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const me = space.profile || PROFILE_SEED;
  const myHandle = String(me.handle || "").replace(/^@/, "");
  const plain = !replyTo && !quote;
  const [parts, setParts] = useState(() => {
    if (plain) {
      try {
        const saved = JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "null");
        if (Array.isArray(saved) && saved.length) return saved.map((text, index) => ({ id: index, text, images: [] }));
      } catch {
        // no draft
      }
    }
    return [{ id: 0, text: replyTo && replyTo.handle !== myHandle ? "" : "", images: [] }];
  });
  const [active, setActive] = useState(0);
  const [poll, setPoll] = useState(null);
  const [audience, setAudience] = useState("everyone");
  const [tray, setTray] = useState(false);
  const [mention, setMention] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const fileRef = useRef(null);
  const areas = useRef([]);
  const nextId = useRef(parts.length);

  const filled = parts.some((part) => part.text.trim() || part.images.length);
  const over = parts.some((part) => part.text.length > THOUGHT_LIMIT);
  const pollOk = !poll || poll.options.filter((option) => option.trim()).length >= 2;
  const ready = (filled || (poll && pollOk)) && !over && pollOk && (parts[0].text.trim() || parts[0].images.length || poll);

  useEffect(() => {
    const el = areas.current[active];
    if (el) {
      el.focus({ preventScroll: true });
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [active]);

  useLayoutEffect(() => {
    for (const el of areas.current) {
      if (!el) continue;
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [parts]);

  function update(index, patch) {
    setParts((prev) => prev.map((part, at) => (at === index ? { ...part, ...patch } : part)));
  }

  function onType(index, event) {
    const value = event.target.value;
    update(index, { text: value });
    const caret = event.target.selectionStart || value.length;
    const match = value.slice(0, caret).match(/(^|\s)@([\w.]*)$/);
    setMention(match ? { index, query: match[2].toLowerCase(), at: caret - match[2].length - 1 } : null);
  }

  function pickMention(person) {
    if (!mention) return;
    const part = parts[mention.index];
    const before = part.text.slice(0, mention.at);
    const after = part.text.slice(mention.at + 1 + mention.query.length);
    update(mention.index, { text: `${before}@${person.handle} ${after.replace(/^\s/, "")}` });
    setMention(null);
    window.setTimeout(() => areas.current[mention.index]?.focus({ preventScroll: true }), 0);
  }

  function insert(text) {
    const el = areas.current[active];
    const part = parts[active];
    const at = el ? el.selectionStart : part.text.length;
    const glue = at > 0 && !/\s$/.test(part.text.slice(0, at)) ? " " : "";
    update(active, { text: `${part.text.slice(0, at)}${glue}${text}${part.text.slice(at)}` });
    window.setTimeout(() => {
      const node = areas.current[active];
      if (!node) return;
      node.focus({ preventScroll: true });
      const pos = at + glue.length + text.length;
      node.setSelectionRange(pos, pos);
      if (text === "@") setMention({ index: active, query: "", at: pos - 1 });
    }, 0);
  }

  function addImages(list) {
    setParts((prev) => prev.map((part, at) => (at === active ? { ...part, images: [...part.images, ...list].slice(0, 4) } : part)));
    setPoll(null);
  }

  async function fromDevice(event) {
    const files = [...(event.target.files || [])].filter((file) => file.type.startsWith("image/")).slice(0, 4);
    event.target.value = "";
    const list = [];
    for (const file of files) {
      try {
        list.push(await shrinkImage(file));
      } catch {
        // skip unreadable photo
      }
    }
    if (list.length) addImages(list);
    setTray(false);
  }

  function addPart() {
    const id = nextId.current++;
    setParts((prev) => [...prev, { id, text: "", images: [] }]);
    setActive(parts.length);
  }

  function removePart(index) {
    setParts((prev) => prev.filter((_, at) => at !== index));
    setActive(Math.max(0, index - 1));
  }

  function close(save) {
    if (plain) {
      try {
        if (save && filled) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(parts.map((part) => part.text)));
        else window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // storage unavailable
      }
    }
    onClose();
  }

  function cancel() {
    if (plain && filled) setLeaving(true);
    else close(false);
  }

  function publish() {
    if (!ready) return;
    const now = Date.now();
    const clean = parts.filter((part) => part.text.trim() || part.images.length);
    const [first, ...rest] = clean.length ? clean : [{ text: "", images: [] }];
    const thought = {
      id: `me-${now.toString(36)}`,
      created: now,
      likes: 0,
      reposts: 0,
      text: first.text.trim(),
      images: first.images,
      audience,
      mine: true,
      ...(poll ? { poll: { options: poll.options.filter((option) => option.trim()).map((text) => ({ text: text.trim(), votes: 0 })), endsAt: now + poll.days * DAY } } : {}),
      ...(quote ? { quote: quote.id } : {}),
      ...(replyTo ? { replyTo: replyTo.handle } : {}),
    };
    const chain = rest.map((part, index) => ({ id: `${thought.id}-c${index}`, created: now + index + 1, likes: 0, text: part.text.trim(), images: part.images, mine: true, chained: true }));
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // storage unavailable
    }
    onPublish(thought, chain);
  }

  const people = mention ? SEARCH_PEOPLE.filter((person) => !mention.query || person.handle.includes(mention.query) || person.name.toLowerCase().includes(mention.query)).slice(0, 5) : [];
  const audienceLabel = {
    everyone: say("Anyone can reply", "Tutti possono rispondere"),
    follow: say("Profiles you follow can reply", "Rispondono i profili che segui"),
    mention: say("Only mentioned profiles can reply", "Rispondono solo i profili menzionati"),
  }[audience];

  return (
    <div className="panel view tcc">
      <div className="tcc-bar">
        <button type="button" className="tcc-cancel" onClick={cancel}>{say("Cancel", "Annulla")}</button>
        <strong>{replyTo ? say("Reply", "Rispondi") : quote ? say("Quote", "Cita") : say("New thought", "Nuovo pensiero")}</strong>
        <span className="tcc-spacer" />
      </div>
      <div className="panel-scroll tcc-scroll">
        {replyTo ? (
          <div className="tcc-parent">
            <div className="tc-side"><RemoteImage className="tcc-face" src={replyTo.src} alt="" /><i className="tc-line" /></div>
            <div className="tc-main">
              <header className="tc-head"><strong>{replyTo.handle}</strong><time>{agoLabel(replyTo.created, it)}</time></header>
              <p className="tc-text">{replyTo.text}</p>
            </div>
          </div>
        ) : null}
        {parts.map((part, index) => {
          const last = index === parts.length - 1;
          return (
            <div key={part.id} className={`tcc-part${active === index ? " on" : ""}`} onClick={() => setActive(index)}>
              <div className="tc-side">
                <RemoteImage className="tcc-face" src={AVATAR} alt="" />
                {!last || part.text.trim() || part.images.length ? <i className="tc-line" /> : null}
              </div>
              <div className="tc-main">
                <header className="tc-head">
                  <strong>{myHandle}</strong>
                  {index > 0 ? <button type="button" className="tcc-x" aria-label={say("Remove", "Rimuovi")} onClick={(event) => { event.stopPropagation(); removePart(index); }}><X strokeWidth={2.4} /></button> : null}
                </header>
                <textarea
                  ref={(node) => { areas.current[index] = node; }}
                  rows={1}
                  value={part.text}
                  onChange={(event) => onType(index, event)}
                  onFocus={() => setActive(index)}
                  placeholder={index === 0 ? (replyTo ? say(`Reply to ${replyTo.handle}…`, `Rispondi a ${replyTo.handle}…`) : say("What's new?", "Cosa c'è di nuovo?")) : say("Say more…", "Aggiungi altro…")}
                  aria-label={say("Thought text", "Testo del pensiero")}
                />
                {mention && mention.index === index && people.length ? (
                  <div className="tcc-mentions">
                    {people.map((person) => (
                      <button key={person.handle} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pickMention(person)}>
                        <RemoteImage src={person.src} alt="" />
                        <span><strong>{person.handle}{person.verified ? <Verified className="sx-verified" /> : null}</strong><em>{person.name}</em></span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {part.images.length ? (
                  <div className={`tcc-images n${part.images.length}`}>
                    {part.images.map((src, at) => (
                      <span key={`${at}-${src.slice(-16)}`} className="tcc-image">
                        <img src={src} alt="" />
                        <button type="button" aria-label={say("Remove photo", "Rimuovi foto")} onClick={() => update(index, { images: part.images.filter((_, i) => i !== at) })}><X strokeWidth={2.6} /></button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {index === 0 && poll ? (
                  <div className="tcc-poll">
                    {poll.options.map((option, at) => (
                      <label key={at} className="tcc-poll-row">
                        <input
                          value={option}
                          maxLength={40}
                          placeholder={at < 2 ? say(`Option ${at + 1}`, `Opzione ${at + 1}`) : say("Optional", "Facoltativa")}
                          onChange={(event) => setPoll((prev) => ({ ...prev, options: prev.options.map((value, i) => (i === at ? event.target.value : value)) }))}
                        />
                        {at >= 2 ? <button type="button" aria-label={say("Remove option", "Rimuovi opzione")} onClick={() => setPoll((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== at) }))}><X strokeWidth={2.4} /></button> : null}
                      </label>
                    ))}
                    {poll.options.length < 4 ? <button type="button" className="tcc-poll-add" onClick={() => setPoll((prev) => ({ ...prev, options: [...prev.options, ""] }))}><Plus strokeWidth={2.4} />{say("Add option", "Aggiungi opzione")}</button> : null}
                    <div className="tcc-poll-days">
                      <span>{say("Ends in", "Termina tra")}</span>
                      {[1, 3, 7].map((days) => (
                        <button key={days} type="button" className={poll.days === days ? "on" : ""} onClick={() => setPoll((prev) => ({ ...prev, days }))}>{days === 1 ? say("1 day", "1 giorno") : say(`${days} days`, `${days} giorni`)}</button>
                      ))}
                      <button type="button" className="tcc-poll-remove" onClick={() => setPoll(null)}>{say("Remove poll", "Rimuovi sondaggio")}</button>
                    </div>
                  </div>
                ) : null}
                {index === 0 && quote ? <QuotedThought thought={quote} /> : null}
                {active === index ? (
                  <div className="tcc-tools">
                    <button type="button" aria-label={say("Add photos", "Aggiungi foto")} aria-pressed={tray} disabled={part.images.length >= 4} onClick={(event) => { event.stopPropagation(); setTray((value) => !value); }}><Image strokeWidth={2} /></button>
                    <button type="button" aria-label={say("Mention", "Menziona")} onClick={(event) => { event.stopPropagation(); insert("@"); }}><AtSign strokeWidth={2} /></button>
                    <button type="button" aria-label={say("Hashtag", "Hashtag")} onClick={(event) => { event.stopPropagation(); insert("#"); }}><Hash strokeWidth={2} /></button>
                    {index === 0 && !replyTo ? (
                      <button type="button" aria-label={say("Poll", "Sondaggio")} aria-pressed={Boolean(poll)} disabled={part.images.length > 0} onClick={(event) => { event.stopPropagation(); setPoll((prev) => (prev ? null : { options: ["", ""], days: 1 })); }}><Poll strokeWidth={2} /></button>
                    ) : null}
                    <CounterRing used={part.text.length} />
                  </div>
                ) : null}
                {active === index && tray ? (
                  <div className="tcc-tray" data-no-swipe>
                    <button type="button" className="tcc-tray-lib" onClick={() => fileRef.current?.click()}><Image strokeWidth={2} /><span>{say("Library", "Libreria")}</span></button>
                    {DEMO_GALLERY.slice(0, 10).map((src) => (
                      <button key={src} type="button" onClick={() => { addImages([src]); setTray(false); }}><img src={src} alt="" draggable="false" /></button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {!replyTo && (parts[parts.length - 1].text.trim() || parts[parts.length - 1].images.length) && parts.length < 10 ? (
          <button type="button" className="tcc-add" onClick={addPart}>
            <span className="tc-side"><RemoteImage className="tcc-face small" src={AVATAR} alt="" /></span>
            <span>{say("Add to thread", "Aggiungi al thread")}</span>
          </button>
        ) : null}
      </div>
      <div className="tcc-foot">
        <button type="button" className="tcc-audience" onClick={() => setAudience((value) => AUDIENCES[(AUDIENCES.indexOf(value) + 1) % AUDIENCES.length])}>
          {audience === "everyone" ? <Globe strokeWidth={2} /> : audience === "follow" ? <Users strokeWidth={2} /> : <AtSign strokeWidth={2} />}
          {audienceLabel}
        </button>
        <button type="button" className="tcc-post" disabled={!ready} onClick={publish}>{replyTo ? say("Reply", "Rispondi") : say("Post", "Pubblica")}</button>
      </div>
      <input ref={fileRef} className="sr" type="file" accept="image/*" multiple onChange={fromDevice} />
      {leaving ? (
        <div className="ps-sheet-wrap" onClick={() => setLeaving(false)}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            <button type="button" onClick={() => close(true)}><Feather strokeWidth={2} />{say("Save draft", "Salva bozza")}</button>
            <button type="button" className="danger" onClick={() => close(false)}><Trash strokeWidth={2} />{say("Discard", "Elimina")}</button>
            <button type="button" className="warn" onClick={() => setLeaving(false)}>{say("Keep editing", "Continua a scrivere")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComposePrompt({ onCompose }) {
  const it = useContext(SpacePrefs).language === "it";
  return (
    <button type="button" className="tc-prompt" onClick={() => onCompose()}>
      <RemoteImage src={AVATAR} alt="" />
      <span>{it ? "Cosa c'è di nuovo?" : "What's new?"}</span>
      <i><Image strokeWidth={2} /></i>
      <i><Poll strokeWidth={2} /></i>
    </button>
  );
}

function ThoughtsScreen({ onClose }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { all } = useThoughts();
  const [tab, setTab] = useState("foryou");
  const [fab, setFab] = useState(true);
  const last = useRef(0);
  const list = tab === "foryou"
    ? [...all].sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)) || (b.likes + b.created / HOUR) - (a.likes + a.created / HOUR))
    : all.filter((item) => item.mine || space.follows.has(item.name)).sort((a, b) => b.created - a.created);
  return (
    <div className="panel view tcs">
      <div className="ps-bar tcs-bar">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <strong><Feather weight="fill" />{say("Thoughts", "Pensieri")}</strong>
        <span />
      </div>
      <div className="tcs-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "foryou"} className={tab === "foryou" ? "on" : ""} onClick={() => setTab("foryou")}>{say("For you", "Per te")}</button>
        <button type="button" role="tab" aria-selected={tab === "following"} className={tab === "following" ? "on" : ""} onClick={() => setTab("following")}>{say("Following", "Seguiti")}</button>
        <i className="tcs-tabs-bar" style={{ "--n": tab === "foryou" ? 0 : 1 }} />
      </div>
      <div
        className="panel-scroll tcs-scroll"
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          setFab(top < last.current || top < 60);
          last.current = top;
        }}
      >
        <ComposePrompt onCompose={() => nav.compose?.({})} />
        <div className="tcs-list" key={tab}>
          {list.map((thought, index) => <ThoughtEntry key={thought.id} thought={thought} delay={Math.min(index, 8) * 40} />)}
          {!list.length ? (
            <div className="ig-empty">
              <i><Feather strokeWidth={1.4} /></i>
              <strong>{say("Nothing here yet", "Ancora niente qui")}</strong>
              <span>{say("Follow people to see their thoughts.", "Segui qualcuno per vedere i suoi pensieri.")}</span>
            </div>
          ) : null}
        </div>
      </div>
      <button type="button" className={`tcs-fab${fab ? "" : " away"}`} aria-label={say("New thought", "Nuovo pensiero")} onClick={() => nav.compose?.({})}>
        <Feather weight="bold" />
      </button>
    </div>
  );
}

function ThoughtScreen({ id, onClose }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { byId, repliesOf, me } = useThoughts();
  const [draft, setDraft] = useState("");
  const [freshId, setFreshId] = useState(null);
  const endRef = useRef(null);
  const thought = byId.get(id);
  if (!thought) {
    return (
      <div className="panel view tcs">
        <div className="ps-bar tcs-bar">
          <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
          <strong>{say("Thought", "Pensiero")}</strong><span />
        </div>
        <div className="ig-empty"><i><Feather strokeWidth={1.4} /></i><strong>{say("This thought was deleted", "Questo pensiero è stato eliminato")}</strong></div>
      </div>
    );
  }
  const replies = repliesOf(thought.id);
  const chain = replies.filter((item) => item.chained);
  const others = replies.filter((item) => !item.chained);
  const myHandle = String(me.handle || "").replace(/^@/, "");
  const canReply = thought.mine || thought.audience !== "mention" || String(thought.text || "").includes(`@${myHandle}`);

  function send(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || textHidden(prefs, text)) return;
    const reply = { id: `me-r-${Date.now().toString(36)}`, created: Date.now(), likes: 0, text, mine: true, replyTo: thought.handle };
    space.addThoughtReply(thought.id, reply);
    setDraft("");
    setFreshId(reply.id);
    window.setTimeout(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }), 60);
  }

  return (
    <div className="panel view tcs tcd">
      <div className="ps-bar tcs-bar">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <strong>{say("Thought", "Pensiero")}</strong>
        <span />
      </div>
      <div className="panel-scroll tcs-scroll">
        {thought.parentId ? (
          <button type="button" className="tc-more-thread up" onClick={() => nav.open?.(byId.get(thought.parentId))}>{say("Show the original thought", "Mostra il pensiero originale")}</button>
        ) : null}
        <ThoughtCard thought={thought} big line={chain.length > 0} replyCount={others.length} />
        {chain.map((item, index) => <ThoughtCard key={item.id} thought={item} lineUp line={index < chain.length - 1} replyCount={0} onOpen={() => {}} />)}
        <div className="tcd-head">
          <strong>{say("Replies", "Risposte")}</strong>
          <span>{others.length ? `${others.length}` : ""}</span>
        </div>
        {others.length ? others.map((item, index) => (
          <div key={item.id} className={item.id === freshId ? "tcd-fresh" : ""}>
            <ThoughtCard thought={item} replyCount={repliesOf(item.id).length} delay={Math.min(index, 6) * 40} />
          </div>
        )) : (
          <p className="tcd-empty">{say("No replies yet. Start the conversation.", "Ancora nessuna risposta. Inizia tu la conversazione.")}</p>
        )}
        <div ref={endRef} />
      </div>
      {canReply ? (
        <form className="tcd-reply" onSubmit={send}>
          <RemoteImage src={AVATAR} alt="" />
          <input
            value={draft}
            maxLength={THOUGHT_LIMIT}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={say(`Reply to ${thought.handle}…`, `Rispondi a ${thought.handle}…`)}
            aria-label={say("Reply", "Rispondi")}
          />
          {draft.trim() ? <button type="submit" className="dm-send">{say("Post", "Pubblica")}</button> : (
            <button type="button" className="tcd-expand" aria-label={say("Open editor", "Apri editor")} onClick={() => nav.compose?.({ replyTo: thought })}><Image strokeWidth={2} /></button>
          )}
        </form>
      ) : (
        <p className="tcd-locked">{say("Only mentioned profiles can reply.", "Possono rispondere solo i profili menzionati.")}</p>
      )}
    </div>
  );
}

// Thoughts written by one person (and, on your own profile, your reposts).
function ThoughtList({ name, mine, emptyAction }) {
  const space = useSpace();
  const { all, byId } = useThoughts();
  const it = useContext(SpacePrefs).language === "it";
  const own = all.filter((item) => (mine ? item.mine : item.name === name));
  const reposts = mine ? space.thoughtReposts.map((entry) => ({ entry, thought: byId.get(entry.id) })).filter((row) => row.thought) : [];
  const rows = [
    ...own.map((thought) => ({ key: thought.id, at: thought.created, thought })),
    ...reposts.map((row) => ({ key: `rp-${row.entry.id}`, at: row.entry.at, thought: row.thought, repost: true })),
  ].sort((a, b) => b.at - a.at);
  if (!rows.length) {
    return (
      <div className="ig-empty">
        <i><Feather strokeWidth={1.4} /></i>
        <strong>{mine ? (it ? "Condividi il tuo primo pensiero" : "Share your first thought") : (it ? "Ancora nessun pensiero" : "No thoughts yet")}</strong>
        {mine ? <span>{it ? "Una frase, una domanda, un sondaggio." : "A sentence, a question, a poll."}</span> : null}
        {emptyAction}
      </div>
    );
  }
  return (
    <div className="tc-list">
      {rows.map((row, index) => (
        <ThoughtEntry key={row.key} thought={row.thought} delay={Math.min(index, 6) * 40} repostedBy={row.repost ? (it ? "Hai ripubblicato" : "You reposted") : undefined} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mentions, hashtags and notifications shared across the app.
// ---------------------------------------------------------------------------
const NOTE_KINDS = {
  like: { icon: Heart, tone: "red" },
  comment: { icon: MessageCircle, tone: "blue" },
  mention: { icon: AtSign, tone: "purple" },
  tag: { icon: UserIcon, tone: "orange" },
  follow: { icon: UserPlus, tone: "blue" },
  reply: { icon: Reply, tone: "teal" },
  repost: { icon: Repost, tone: "green" },
  story: { icon: Sparkle, tone: "pink" },
  order: { icon: Bag, tone: "green" },
};

const NOW0 = Date.now();
const NOTIFY_SEED = [
  { id: "s1", type: "mention", name: "Adele Romano", src: PEOPLE[2].src, text: "ti ha menzionato in un commento: “@forno.neri guarda questo rosso! #ceramica”", at: NOW0 - 14 * 60_000, target: { kind: "post", id: "hero" } },
  { id: "s2", type: "like", name: "Marta Colle", src: PEOPLE[0].src, text: "e altre 23 persone hanno messo mi piace al tuo post.", at: NOW0 - 40 * 60_000, target: { kind: "post", id: "hero" } },
  { id: "s3", type: "story", name: "Marta Colle", src: PEOPLE[0].src, text: "ha risposto alla tua storia: “Che colore! 😍”", at: NOW0 - 70 * 60_000, target: { kind: "story", id: "marta" } },
  { id: "s4", type: "comment", name: "Leo Bassi", src: PEOPLE[1].src, text: "ha commentato: “Il bordo tiene, bravissima. #secondoFuoco”", at: NOW0 - 2 * 3_600_000, target: { kind: "post", id: "hero" } },
  { id: "s5", type: "tag", name: "Sara Conte", src: THREADS[6].src, text: "ti ha taggato in un post.", at: NOW0 - 5 * 3_600_000, target: { kind: "post", id: "x7" } },
  { id: "s6", type: "follow", name: "Pietro Lama", src: THREADS[5].src, text: "ha iniziato a seguirti.", at: NOW0 - 7 * 3_600_000, target: { kind: "person", name: "Pietro Lama" } },
  { id: "s7", type: "reply", name: "Chiara Valli", src: THREADS[4].src, text: "ha risposto al tuo pensiero: “La numero 3 la stampo.”", at: NOW0 - 26 * 3_600_000, target: { kind: "thought", id: "th-thread" } },
  { id: "s8", type: "repost", name: "Nico Serra", src: PEOPLE[3].src, text: "ha ripubblicato il tuo pensiero.", at: NOW0 - 3 * 86_400_000, target: { kind: "thought", id: "tw1" } },
  { id: "s9", type: "mention", name: "Elena Marini", src: THREADS[7].src, text: "ti ha menzionato in un pensiero: “Chi fa ceramica a Milano? @forno.neri”", at: NOW0 - 4 * 86_400_000, target: { kind: "thought", id: "th-design" } },
  { id: "s10", type: "follow", name: "Sara Conte", src: THREADS[6].src, text: "ha iniziato a seguirti.", at: NOW0 - 12 * 86_400_000, target: { kind: "person", name: "Sara Conte" } },
];

function noteAgo(at, it) {
  const diff = Math.max(0, Date.now() - at);
  if (diff < 60_000) return it ? "ora" : "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} g`;
  return `${Math.floor(diff / (7 * 86_400_000))} sett`;
}

// Suggestions for "@" while typing; works with any input or textarea value.
function MentionSuggest({ value, onPick, className = "" }) {
  const match = String(value || "").match(/(^|\s)@([\w.]*)$/);
  if (!match) return null;
  const query = match[2].toLowerCase();
  const people = SEARCH_PEOPLE.filter((person) => !query || person.handle.includes(query) || person.name.toLowerCase().includes(query)).slice(0, 5);
  if (!people.length) return null;
  return (
    <div className={`mn-list ${className}`}>
      {people.map((person) => (
        <button
          key={person.handle}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(String(value).replace(/@[\w.]*$/, `@${person.handle} `))}
        >
          <RemoteImage src={person.src} alt="" />
          <span>
            <strong>{person.handle}{person.verified ? <Verified className="sx-verified" /> : null}</strong>
            <em>{person.name}</em>
          </span>
        </button>
      ))}
    </div>
  );
}

function hashtagPool(library) {
  const reels = REELS.map((reel) => ({ id: `reel-${reel.id}`, name: reel.name, handle: reel.handle, avatar: reel.avatar || reel.src, image: reel.src, text: reel.caption, likes: reel.likes, kind: "reel", thread: reel.thread }));
  const seen = new Set();
  return [...library.filter((item) => item.image), ...POSTS.filter((item) => item.image), ...EXPLORE_POSTS, ...reels].filter((post) => {
    if (!post.image || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

function HashtagScreen({ tag, onClose, onOpenPost }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { all } = useThoughts();
  const [tab, setTab] = useState("top");
  const key = String(tag || "").replace(/^#/, "").toLowerCase();
  const has = (text) => hashtagsOf(text).includes(key);
  const posts = hashtagPool(space.library).filter((post) => has(post.text) || post.tag?.toLowerCase() === key);
  const thoughts = all.filter((thought) => has(thought.text));
  const following = space.follows.has(`#${key}`);
  const cover = posts[0]?.image;
  const list = tab === "recent" ? [...posts].reverse() : posts;
  return (
    <div className="panel view ht">
      <div className="ps-bar">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <strong>#{key}</strong>
        <span />
      </div>
      <div className="panel-scroll">
        <div className="ht-head">
          <span className="ht-face">{cover ? <RemoteImage src={cover} alt="" /> : null}<i><Hash weight="bold" /></i></span>
          <div>
            <strong>#{key}</strong>
            <em>{posts.length} post · {thoughts.length} {say("thoughts", "pensieri")}</em>
            <button type="button" className={following ? "ig-btn small" : "ig-btn small primary"} onClick={() => space.toggleFollow(`#${key}`)}>
              {following ? say("Following", "Segui già") : say("Follow", "Segui")}
            </button>
          </div>
        </div>
        <div className="ps-tabs ht-tabs" role="tablist">
          {[["top", say("Top", "Più popolari")], ["recent", say("Recent", "Recenti")], ["thoughts", say("Thoughts", "Pensieri")]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
          <i className="ps-tabs-bar" style={{ "--n": ["top", "recent", "thoughts"].indexOf(tab) }} />
        </div>
        {tab === "thoughts" ? (
          thoughts.length ? <div className="tc-list">{thoughts.map((thought, index) => <ThoughtEntry key={thought.id} thought={thought} delay={Math.min(index, 6) * 40} />)}</div> : (
            <div className="ig-empty"><i><Feather strokeWidth={1.4} /></i><strong>{say("No thoughts with this tag", "Nessun pensiero con questo tag")}</strong></div>
          )
        ) : list.length ? (
          <div className="ps-grid" key={tab}>
            {list.map((post, index) => (
              <button key={post.id} type="button" className="ps-tile" style={{ "--i": index }} onClick={() => onOpenPost(post)} aria-label={`Post, ${post.name}`}>
                <RemoteImage src={post.image} alt="" />
                {post.kind === "reel" ? <i className="sx-badge"><SquarePlay weight="fill" /></i> : post.images?.length > 1 ? <i className="sx-badge"><Carousel /></i> : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="ig-empty"><i><Hash strokeWidth={1.4} /></i><strong>{say("No posts yet", "Ancora nessun post")}</strong><span>{say("Be the first to use this tag.", "Usa tu per primo questo tag.")}</span></div>
        )}
      </div>
    </div>
  );
}

function NotifyBanner({ note, onOpen, onDone }) {
  const it = useContext(SpacePrefs).language === "it";
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => doneRef.current(), 3800);
    return () => window.clearTimeout(id);
  }, [note.id]);
  const kind = NOTE_KINDS[note.type] || NOTE_KINDS.like;
  return (
    <button type="button" className="nb" onClick={onOpen}>
      <span className="nb-face">
        <RemoteImage src={note.src || avatarFor(note.name)} alt="" />
        <i className={`nb-kind ${kind.tone}`}><kind.icon weight="fill" /></i>
      </span>
      <span className="nb-text">
        <strong>Space</strong>
        <span><b>{note.name}</b> {note.text}</span>
      </span>
      <em>{it ? "ora" : "now"}</em>
    </button>
  );
}

function NotesScreen({ onClose, onOpenPost, onOpenStory }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { byId } = useThoughts();
  const [filter, setFilter] = useState("all");
  const unreadIds = useMemo(() => new Set((space.notifications || []).filter((note) => !note.read).map((note) => note.id)), []);
  useEffect(() => {
    space.markNotificationsRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const all = [...(space.notifications || []), ...NOTIFY_SEED]
    .filter((note) => !personHidden(prefs, note.name))
    .sort((a, b) => b.at - a.at);
  const filters = [
    ["all", say("All", "Tutte")],
    ["mention", say("Mentions", "Menzioni")],
    ["comment", say("Comments", "Commenti")],
    ["like", say("Likes", "Mi piace")],
    ["follow", say("Follows", "Follow")],
    ["tag", "Tag"],
  ];
  const shownList = all.filter((note) => filter === "all" || note.type === filter || (filter === "comment" && note.type === "reply") || (filter === "mention" && note.type === "tag" && false));
  const groups = [
    [say("New", "Nuove"), shownList.filter((note) => unreadIds.has(note.id))],
    [say("Today", "Oggi"), shownList.filter((note) => !unreadIds.has(note.id) && Date.now() - note.at < 86_400_000)],
    [say("This week", "Questa settimana"), shownList.filter((note) => !unreadIds.has(note.id) && Date.now() - note.at >= 86_400_000 && Date.now() - note.at < 7 * 86_400_000)],
    [say("Earlier", "Precedenti"), shownList.filter((note) => !unreadIds.has(note.id) && Date.now() - note.at >= 7 * 86_400_000)],
  ].filter(([, list]) => list.length);

  function postOf(id) {
    return [...space.library, ...POSTS, ...EXPLORE_POSTS].find((item) => item.id === id) || (id === "hero" ? HERO : null);
  }

  function open(note) {
    const target = note.target || {};
    if (target.kind === "story") onOpenStory?.(target.id);
    else if (target.kind === "thought") nav.open?.(byId.get(target.id));
    else if (target.kind === "person") nav.person?.({ name: target.name });
    else if (target.kind === "orders") nav.orders?.();
    else if (target.kind === "post") {
      const post = postOf(target.id);
      if (post) onOpenPost(post);
    }
  }

  return (
    <div className="panel view nt nt2">
      <div className="ps-bar">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <strong>{say("Notifications", "Notifiche")}</strong>
        <span />
      </div>
      <div className="nt-filters" role="tablist">
        {filters.map(([id, label]) => {
          const count = id === "all" ? 0 : all.filter((note) => unreadIds.has(note.id) && (note.type === id || (id === "comment" && note.type === "reply"))).length;
          return (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>
              {label}{count ? <b>{count}</b> : null}
            </button>
          );
        })}
      </div>
      <div className="panel-scroll">
        {filter === "all" ? (
          <button type="button" className="nt-requests">
            <span className="nt-stack">
              <RemoteImage src={PEOPLE[3].src} alt="" />
              <RemoteImage src={PEOPLE[1].src} alt="" />
            </span>
            <span className="nt-req-copy">
              <strong>{say("Follow requests", "Richieste di follow")}</strong>
              <span>{say("Nico Serra + 2 others", "Nico Serra e altri 2")}</span>
            </span>
            <i className="ig-dot" />
            <ChevronRight />
          </button>
        ) : null}
        <div key={filter} className="nt-list">
          {groups.map(([label, list]) => (
            <section key={label} className="nt-group">
              <h2>{label}</h2>
              {list.map((note, index) => {
                const kind = NOTE_KINDS[note.type] || NOTE_KINDS.like;
                const target = note.target || {};
                const post = target.kind === "post" ? postOf(target.id) : null;
                const thought = target.kind === "thought" ? byId.get(target.id) : null;
                const deck = target.kind === "story" ? STORY_DECKS.find((entry) => entry.id === target.id) : null;
                const thumb = post?.image || thought?.images?.[0] || deck?.frames?.[0]?.image;
                const on = space.follows.has(note.name);
                return (
                  <div key={note.id} className={`nt-row nt2-row${unreadIds.has(note.id) ? " fresh" : ""}`} style={{ "--i": Math.min(index, 10) }}>
                    <button type="button" className={`nt-face${note.type === "story" ? " ring" : ""}`} onClick={() => nav.person?.({ name: note.name })}>
                      <RemoteImage src={note.src || avatarFor(note.name)} alt="" />
                      <i className={`nt-kind ${kind.tone}`}><kind.icon weight="fill" /></i>
                    </button>
                    <div className="nt-text" role="button" tabIndex={0} onClick={() => open(note)} onKeyDown={(event) => { if (event.key === "Enter") open(note); }}>
                      <strong>{note.name}</strong> <RichText text={note.text} /> <em>{noteAgo(note.at, it)}</em>
                    </div>
                    {note.type === "follow" ? (
                      <button type="button" className={on ? "ig-btn small" : "ig-btn small primary"} onClick={() => space.toggleFollow(note.name)}>
                        {on ? say("Following", "Segui già") : say("Follow back", "Ricambia")}
                      </button>
                    ) : thumb ? (
                      <button type="button" className="nt-thumb" onClick={() => open(note)}><RemoteImage src={thumb} alt="" /></button>
                    ) : thought ? (
                      <button type="button" className="nt-quote" onClick={() => open(note)}><Feather weight="fill" /></button>
                    ) : null}
                  </div>
                );
              })}
            </section>
          ))}
          {!groups.length ? (
            <div className="ig-empty"><i><Bell strokeWidth={1.4} /></i><strong>{say("Nothing here yet", "Ancora niente qui")}</strong><span>{say("When someone mentions or tags you, you'll see it here.", "Quando qualcuno ti menziona o ti tagga, lo vedrai qui.")}</span></div>
          ) : null}
        </div>
        {filter === "all" ? (
          <section className="nt-group">
            <h2>{say("Suggested for you", "Suggeriti per te")}</h2>
            {MEET.filter((person) => !space.follows.has(person.name)).slice(0, 4).map((person) => (
              <div key={person.name} className="nt-row">
                <span className="nt-face"><RemoteImage src={person.src} alt="" /></span>
                <span className="nt-text"><strong>{person.name}</strong> <em>{person.meta}</em></span>
                <button type="button" className="ig-btn small primary" onClick={() => space.toggleFollow(person.name)}>{say("Follow", "Segui")}</button>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Business profiles and shops.
// ---------------------------------------------------------------------------
const WEEK = [1, 2, 3, 4, 5, 6];
const pic = (id) => shot(id, 800, 800);

const SHOPS = {
  "Sara Conte": {
    since: 2016, about: "Ceramiche tornite e smaltate a mano a Faenza. Cottura a legna, smalti nostri, ogni pezzo è unico.", shipsIn: "1–2", returns: 14, responds: "entro un'ora", sales: 1240,
    title: "Ceramiche Conte",
    category: "Bottega artigiana",
    address: "Via Campidori 12",
    city: "Faenza",
    phone: "+39 0546 123 456",
    email: "bottega@ceramicheconte.it",
    hours: { days: WEEK, open: "09:00", close: "19:00" },
    verified: true,
    products: [
      { id: "sc1", name: "Tazza Avorio", price: 28, category: "Tazze", images: [pic("1590422749897-47036da0b0ff"), pic("1612196808214-b8e1d6145a8c")], description: "Tazza tornita a mano, smalto avorio opaco. Ogni pezzo è leggermente diverso.", materials: "Gres, smalto senza piombo", size: "Ø 8 cm · 250 ml", stock: 6, variants: ["Avorio", "Rosso Faenza", "Blu notte"] },
      { id: "sc2", name: "Piatto Maiolica", price: 46, category: "Piatti", images: [pic("1576020799627-aeac74d58064")], description: "Piatto piano in maiolica dipinto a mano con decoro tradizionale faentino.", materials: "Maiolica", size: "Ø 27 cm", stock: 2, variants: [] },
      { id: "sc3", name: "Vaso Linea", price: 85, category: "Vasi", images: [pic("1612196808214-b8e1d6145a8c")], description: "Vaso a collo lungo, cottura a legna. Disponibile su ordinazione nelle tue misure.", materials: "Gres", size: "h 32 cm", stock: 0, madeToOrder: 3, variants: ["32 cm", "45 cm"] },
      { id: "sc4", name: "Corso al tornio", price: 60, category: "Corsi", images: [pic("1493106641515-6b5631de4bb9")], description: "Tre ore al tornio in bottega, materiali e cottura inclusi. Massimo 4 persone.", materials: "Argilla e smalti inclusi", size: "3 ore · sabato mattina", stock: 4, variants: ["Sabato 9:00", "Sabato 14:00"], service: true },
      { id: "sc5", name: "Set ciotole Mare", price: 64, category: "Piatti", images: [pic("1578749556568-bc2c40e68b61")], description: "Quattro ciotole in gres smaltato azzurro mare, impilabili. Vanno in lavastoviglie.", materials: "Gres, smalto alimentare", size: "Ø 15 cm · set da 4", stock: 4 },
      { id: "sc6", name: "Bicchieri Sabbia", price: 36, category: "Tazze", images: [pic("1610701596007-11502861dcfa")], description: "Bicchieri senza manico, esterno grezzo e interno smaltato. Perfetti per acqua e vino.", materials: "Gres", size: "250 ml · set da 2", stock: 8 },
      { id: "sc7", name: "Bottiglie Nebbia", price: 98, category: "Vasi", images: [pic("1565193566173-7a0ee3dbe261")], description: "Tre vasi a bottiglia in tre altezze, smalto bianco nebbia. Per fiori secchi o da soli.", materials: "Gres", size: "h 18 · 24 · 30 cm", madeToOrder: 2 },
      { id: "sc8", name: "Vaso Menta", price: 24, category: "Vasi", images: [pic("1485955900006-10f4d324d411")], description: "Piccolo vaso con foro di drenaggio, per succulente e piante grasse.", materials: "Terracotta smaltata", size: "Ø 10 cm", stock: 12 },
      { id: "sc9", name: "Candela in coppa", price: 32, category: "Casa", images: [pic("1603006905003-be475563bc59")], description: "Cera di soia al fico in una coppa di gres che resta tua quando la candela finisce.", materials: "Gres, cera di soia", size: "40 ore", stock: 2 },
    ],
  },
  "Pietro Lama": {
    since: 2019, about: "Trattoria di famiglia nei vicoli di Genova. Pasta e pesto fatti a mano ogni mattina.", shipsIn: "1", returns: 0, responds: "in poche ore", sales: 410,
    title: "Trattoria Lama",
    category: "Ristorante",
    address: "Vico del Fieno 7",
    city: "Genova",
    phone: "+39 010 765 4321",
    email: "prenota@trattorialama.it",
    hours: { days: [2, 3, 4, 5, 6, 0], open: "12:00", close: "23:00" },
    verified: false,
    products: [
      { id: "pl1", name: "Pesto al mortaio", price: 9, category: "Dispensa", images: [pic("1473093295043-cdd812d0e601")], description: "Basilico di Prà, pinoli, Parmigiano 24 mesi. Fatto ogni mattina, solo al mortaio.", materials: "Vasetto 180 g", size: "180 g", stock: 12, variants: [] },
      { id: "pl2", name: "Corso di cucina ligure", price: 65, category: "Corsi", images: [pic("1556910103-1c02745aae4d")], description: "Una serata in cucina con Pietro: trofie a mano, pesto e cena insieme.", materials: "Ingredienti e cena inclusi", size: "3 ore · giovedì sera", stock: 6, variants: [], service: true },
      { id: "pl3", name: "Menu degustazione", price: 48, category: "Menu", images: [pic("1414235077428-338989a2e8c0"), pic("1534080564583-6be75777b70a")], description: "Cinque portate di stagione. Prenota il tavolo direttamente in chat.", materials: "Vini esclusi", size: "5 portate", stock: null, variants: ["Classico", "Vegetariano"], service: true },
      { id: "pl4", name: "Trofie fresche", price: 7.5, category: "Dispensa", images: [pic("1517686469429-8bdb88b9f907")], description: "Trofie tirate a mano ogni mattina, farina di grano tenero e acqua. Si conservano tre giorni in frigo.", materials: "500 g", size: "Ritiro in trattoria o spedizione refrigerata", stock: 20 },
    ],
  },
  "Adele Romano": {
    since: 2012, about: "Tessiamo su telai a mano a Prato da tre generazioni. Lino, lana cardata e cotone.", shipsIn: "2–3", returns: 30, responds: "entro un'ora", sales: 2380,
    title: "Tessitura Romano",
    category: "Laboratorio tessile",
    address: "Via Pistoiese 210",
    city: "Prato",
    phone: "+39 0574 222 333",
    email: "ciao@tessituraromano.it",
    hours: { days: [1, 2, 3, 4, 5], open: "08:30", close: "18:00" },
    verified: true,
    products: [
      { id: "ar1", name: "Camicia in lino", price: 120, category: "Abbigliamento", images: [pic("1558171813-4c088753af8f")], description: "Lino lavato, cucita a mano a Prato. Taglio morbido, bottoni in corozo.", materials: "100% lino", size: "S · M · L", stock: 3, variants: ["S", "M", "L"] },
      { id: "ar2", name: "Tela grezza (al metro)", price: 22, category: "Tessuti", images: [pic("1544441893-675973e31985")], description: "Tela pesante tessuta sul nostro telaio. Venduta al metro, altezza 140 cm.", materials: "Cotone e lino", size: "h 140 cm", stock: 40, variants: [] },
    ],
  },
  "Leo Bassi": {
    since: 2009, about: "Liuteria a Cremona. Strumenti su misura, restauri e revisioni.", shipsIn: "3–5", returns: 14, responds: "entro un giorno", sales: 186,
    title: "Liuteria Bassi",
    category: "Bottega artigiana",
    address: "Corso Garibaldi 41",
    city: "Cremona",
    phone: "+39 0372 444 555",
    email: "bottega@liuteriabassi.it",
    hours: { days: [1, 2, 3, 4, 5], open: "10:00", close: "18:30" },
    verified: false,
    products: [
      { id: "lb1", name: "Violino su misura", price: 6800, category: "Strumenti", images: [pic("1465821185615-20b3c2fbf41b")], description: "Violino costruito a mano su modello Stradivari, abete della Val di Fiemme e acero dei Balcani.", materials: "Abete, acero, ebano", size: "4/4", stock: 0, madeToOrder: 20, variants: [] },
      { id: "lb2", name: "Revisione strumento", price: 90, category: "Servizi", images: [pic("1507838153414-b4b713384a76")], description: "Controllo anima, ponticello e corde. Ritiro e consegna in bottega.", materials: "", size: "1 settimana", stock: null, variants: [], service: true },
    ],
  },
};

const MY_PRODUCTS_SEED = [
  { id: "me1", name: "Coppa Rossa", price: 34, category: "Coppe", images: [WORKS[0].src], description: "La coppa del nuovo smalto rosso. Il rosso regge: secondo fuoco a 1240°.", materials: "Gres, smalto rosso", size: "Ø 12 cm", stock: 5, variants: ["Rosso", "Rosso scuro"] },
  { id: "me2", name: "Set tazze Secondo Fuoco", price: 72, category: "Tazze", images: [WORKS[1].src, WORKS[2].src], description: "Set di tre tazze dalla stessa infornata.", materials: "Gres", size: "3 × 220 ml", stock: 2, variants: [] },
  { id: "me3", name: "Vaso su commissione", price: 140, category: "Vasi", images: [WORKS[3].src], description: "Vaso nelle tue misure e nel tuo colore. Ti mando le foto di ogni passaggio.", materials: "Gres o terracotta", size: "Su misura", stock: 0, madeToOrder: 4, variants: [] },
];

const DEFAULT_BUSINESS = {
  title: "Forno Neri",
  category: "Bottega artigiana",
  address: "Via Tortona 18",
  city: "Milano",
  phone: "+39 02 1234 5678",
  email: "ciao@fornoneri.it",
  hours: { days: WEEK, open: "09:30", close: "19:00" },
  shop: true,
};

const BUSINESS_KINDS = ["Bottega artigiana", "Negozio", "Ristorante", "Laboratorio tessile", "Studio di design", "Scuola e corsi", "Azienda"];

function euro(value, it) {
  return new Intl.NumberFormat(it ? "it-IT" : "en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: value % 1 ? 2 : 0 }).format(value || 0);
}

function openState(hours, it) {
  if (!hours) return null;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMin = (value) => {
    const [h, m] = String(value).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const open = hours.days.includes(now.getDay()) && minutes >= toMin(hours.open) && minutes < toMin(hours.close);
  const names = it ? ["dom", "lun", "mar", "mer", "gio", "ven", "sab"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let nextDay = null;
  for (let step = minutes < toMin(hours.open) ? 0 : 1; step <= 7; step += 1) {
    const day = (now.getDay() + step) % 7;
    if (hours.days.includes(day)) {
      nextDay = step === 0 ? (it ? "oggi" : "today") : step === 1 ? (it ? "domani" : "tomorrow") : names[day];
      break;
    }
  }
  return open
    ? { open: true, label: it ? `Aperto · chiude alle ${hours.close}` : `Open · closes at ${hours.close}` }
    : { open: false, label: it ? `Chiuso · apre ${nextDay} alle ${hours.open}` : `Closed · opens ${nextDay} at ${hours.open}` };
}

function daysLabel(days, it) {
  const names = it ? ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const order = [1, 2, 3, 4, 5, 6, 0].filter((day) => days.includes(day));
  if (!order.length) return "";
  return order.length > 2 ? `${names[order[0]]}–${names[order[order.length - 1]]}` : order.map((day) => names[day]).join(", ");
}

function stockLabel(product, it) {
  if (product.service && product.stock == null) return { tone: "ok", text: it ? "Su prenotazione" : "Book in chat" };
  if (product.stock == null && !product.madeToOrder) return { tone: "ok", text: it ? "Disponibile" : "In stock" };
  if (product.madeToOrder && !product.stock) return { tone: "order", text: it ? `Su ordinazione · ${product.madeToOrder} sett.` : `Made to order · ${product.madeToOrder} wks` };
  if (!product.stock) return { tone: "out", text: it ? "Esaurito" : "Sold out" };
  if (product.stock <= 3) return { tone: "low", text: it ? `Ultimi ${product.stock}` : `Only ${product.stock} left` };
  return { tone: "ok", text: it ? "Disponibile" : "In stock" };
}

// Shop owners: a demo person, or you when your account is a business.
function useShop(name) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const me = space.profile || PROFILE_SEED;
  if (name === "__none__") return null;
  if (!name || name === me.name) {
    if (prefs.accountType !== "business") return null;
    const business = { ...DEFAULT_BUSINESS, ...(prefs.business || {}) };
    return { ...business, mine: true, owner: { name: me.name, handle: String(me.handle || "").replace(/^@/, ""), src: AVATAR }, products: space.products || MY_PRODUCTS_SEED };
  }
  const shop = SHOPS[name];
  if (!shop) return null;
  const person = SEARCH_PEOPLE.find((entry) => entry.name === name);
  return { ...shop, owner: { name, handle: person?.handle || name, src: person?.src || avatarFor(name) } };
}

function BusinessCard({ shop }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const state = openState(shop.hours, it);
  const [note, setNote] = useState("");
  const maps = `https://maps.google.com/?q=${encodeURIComponent(`${shop.address}, ${shop.city}`)}`;
  function copy(text, label) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setNote(label);
    window.setTimeout(() => setNote(""), 1600);
  }
  return (
    <div className="bz2">
      <a className="bz2-line" href={maps} target="_blank" rel="noreferrer"><MapPin weight="fill" />{shop.address}, {shop.city}</a>
      {state ? (
        <p className={`bz2-open${state.open ? " on" : ""}`}>
          <b>{state.open ? say("Open now", "Aperto ora") : say("Closed", "Chiuso")}</b>
          {" · "}{daysLabel(shop.hours.days, it)} {shop.hours.open}–{shop.hours.close}
        </p>
      ) : null}
      <div className="bz2-btns">
        <button type="button" className="ig-btn" onClick={() => copy(shop.phone, say("Number copied", "Numero copiato"))}><Phone weight="bold" />{say("Call", "Chiama")}</button>
        <a className="ig-btn" href={maps} target="_blank" rel="noreferrer"><Directions weight="bold" />{say("Directions", "Indicazioni")}</a>
        <button type="button" className="ig-btn" onClick={() => copy(shop.email, say("Email copied", "Email copiata"))}><Mail weight="bold" />Email</button>
      </div>
      {note ? <p className="bz2-note">{note}</p> : null}
    </div>
  );
}

function ShopGrid({ shop, onOpen, onAdd }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [cat, setCat] = useState("all");
  const cats = [...new Set(shop.products.map((product) => product.category).filter(Boolean))];
  const list = shop.products.filter((product) => cat === "all" || product.category === cat);
  return (
    <div className="shop">
      {cats.length > 1 ? (
        <div className="shop-cats" data-no-swipe>
          {["all", ...cats].map((item) => (
            <button key={item} type="button" className={cat === item ? "on" : ""} onClick={() => setCat(item)}>{item === "all" ? say("All", "Tutti") : item}</button>
          ))}
        </div>
      ) : null}
      <div className="shop-grid" key={cat}>
        {shop.mine && onAdd ? (
          <button type="button" className="shop-card shop-add" onClick={onAdd}>
            <span className="shop-pic"><i><Plus strokeWidth={1.6} /></i></span>
            <strong>{say("Add product", "Aggiungi prodotto")}</strong>
            <em>{say("Photos, price, stock", "Foto, prezzo, pezzi")}</em>
          </button>
        ) : null}
        {list.map((product, index) => {
          const stock = stockLabel(product, it);
          return (
            <button key={product.id} type="button" className="shop-card" style={{ "--i": Math.min(index, 8) }} onClick={() => onOpen(product)}>
              <span className="shop-pic">
                <RemoteImage src={product.images[0]} alt="" />
                {product.images.length > 1 ? <i className="sx-badge"><Carousel /></i> : null}
                {stock.tone !== "ok" ? <b className={`shop-flag ${stock.tone}`}>{stock.text}</b> : null}
              </span>
              <strong>{product.name}</strong>
              <em>{euro(product.price, it)}</em>
            </button>
          );
        })}
      </div>
      {!list.length && !shop.mine ? (
        <div className="ig-empty"><i><Bag strokeWidth={1.4} /></i><strong>{say("No products yet", "Ancora nessun prodotto")}</strong></div>
      ) : null}
    </div>
  );
}

function BusinessInsights() {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [open, setOpen] = useState(false);
  return (
    <div className={`bz2-dash${open ? " open" : ""}`}>
      <button type="button" className="bz2-dash-row" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>
          <strong>{say("Professional dashboard", "Dashboard professionale")}</strong>
          <em>{say("12.4k accounts reached in the last 30 days", "12,4k account raggiunti negli ultimi 30 giorni")}</em>
        </span>
        <ChevronDown strokeWidth={2.4} />
      </button>
      {open ? (
        <div className="bz2-dash-body">
          <div className="bz2-stat"><span>{say("Accounts reached", "Account raggiunti")}</span><b>12.412</b><em>+18%</em></div>
          <div className="bz2-stat"><span>{say("Profile visits", "Visite al profilo")}</span><b>486</b><em>+9%</em></div>
          <div className="bz2-stat"><span>{say("Shop requests in Direct", "Richieste dello shop nel Direct")}</span><b>37</b><em>+24%</em></div>
          <p className="bz2-dash-note">{say("Sample figures for the preview.", "Dati di esempio per l'anteprima.")}</p>
        </div>
      ) : null}
    </div>
  );
}

function ProductScreen({ product, ownerName, liveShop, onClose, onAsk, onBuy, onEdit, onOwner, onProduct }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const localShop = useShop(liveShop ? "__none__" : ownerName);
  const shop = liveShop
    ? { title: liveShop.shop?.title || `@${liveShop.seller}`, city: liveShop.shop?.city || "", verified: false, owner: { name: liveShop.shop?.title || liveShop.seller, handle: liveShop.seller, src: avatarFor(liveShop.shop?.title || liveShop.seller) }, products: liveShop.products }
    : localShop;
  const canBuy = Boolean(liveShop?.payments);
  const [buying, setBuying] = useState(false);
  const live = (shop?.products || []).find((item) => item.id === product.id) || product;
  const nav = useContext(ThoughtNav);
  const ref = productRef(live, ownerName || null, liveShop);
  const wished = (space.wishlist || []).some((item) => item.key === ref.key);
  const cartCount = (space.cart || []).reduce((sum, item) => sum + item.qty, 0);
  const [added, setAdded] = useState(0);
  useEffect(() => {
    if (!shop?.mine) space.viewProduct(ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.key]);
  const [slide, setSlide] = useState(0);
  const [variant, setVariant] = useState(live.variants?.[0] || "");
  const [qty, setQty] = useState(1);
  const saved = space.saves.has(`prod-${live.id}`);
  const stock = stockLabel(live, it);
  const more = (shop?.products || []).filter((item) => item.id !== live.id).slice(0, 8);
  const soldOut = !live.stock && !live.madeToOrder && !live.service && live.stock != null;
  const market = liveShop ? storeOf(null, liveShop) : ownerName && SHOPS[ownerName] ? storeOf(ownerName) : null;
  const topic = market ? shopTopicOf(market, live) : "";
  const similar = shop?.mine ? [] : demoStores()
    .filter((item) => item.key !== market?.key)
    .flatMap((item) => storeRefs(item).map((refItem) => ({ ...refItem, topic: shopTopicOf(item, refItem.product) })))
    .sort((a, b) => (b.topic === topic) - (a.topic === topic) || hashOf(a.key + live.id) - hashOf(b.key + live.id))
    .slice(0, 8);
  return (
    <div className="panel view pd">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{shop?.title || "Shop"}</strong><em>Shop</em></span>
        <span className="mk-head-r">
          <button type="button" className={`ps-icon${wished ? " mk-on" : ""}`} aria-label={say("Favourite", "Preferito")} aria-pressed={wished} onClick={() => space.toggleWish(ref)}><Heart weight={wished ? "fill" : "regular"} /></button>
          <button type="button" className="ps-icon mk-cart-btn" aria-label={say("Cart", "Carrello")} onClick={() => nav.cart?.()}><Bag strokeWidth={2} />{cartCount ? <b key={cartCount}>{cartCount}</b> : null}</button>
        </span>
      </div>
      <div className="panel-scroll">
        <div className="pd-media">
          <div className="pd-track" data-no-swipe onScroll={(event) => setSlide(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))}>
            {live.images.map((src, index) => <img key={`${index}-${src.slice(-16)}`} src={src} alt="" draggable="false" />)}
          </div>
          {live.images.length > 1 ? <span className="pd-dots">{live.images.map((src, index) => <i key={`${index}-${src.slice(-8)}`} className={index === slide ? "on" : ""} />)}</span> : null}
        </div>
        <div className="pd-body">
          <span className={`pd-stock ${stock.tone}`}><i />{stock.text}</span>
          {canBuy ? <span className="pd-secure"><Lock weight="fill" />{say("Secure payment with Stripe", "Pagamento sicuro con Stripe")}</span> : null}
          <h1>{live.name}</h1>
          {!shop?.mine ? <button type="button" className="mk-rating-link" onClick={() => document.querySelector(".mk-reviews")?.scrollIntoView({ behavior: "smooth", block: "start" })}><RatingLine refKey={ref.key} /></button> : null}
          <p className="pd-price">{euro(live.price, it)}{live.service ? <em> {say("per person", "a persona")}</em> : null}</p>
          {live.variants?.length ? (
            <>
              <p className="pd-label">{live.service ? say("Choose a slot", "Scegli quando") : say("Choose", "Scegli")}</p>
              <div className="pd-variants">
                {live.variants.map((item) => <button key={item} type="button" className={variant === item ? "on" : ""} onClick={() => setVariant(item)}>{item}</button>)}
              </div>
            </>
          ) : null}
          {!soldOut && !shop?.mine ? (
            <div className="pd-qty">
              <span className="pd-label">{live.service ? say("People", "Persone") : say("Quantity", "Quantità")}</span>
              <div>
                <button type="button" aria-label="−" disabled={qty <= 1} onClick={() => setQty((value) => Math.max(1, value - 1))}>−</button>
                <b>{qty}</b>
                <button type="button" aria-label="+" disabled={live.stock != null && live.stock > 0 && qty >= live.stock} onClick={() => setQty((value) => value + 1)}>+</button>
              </div>
            </div>
          ) : null}
          {!shop?.mine ? <TrustRows store={market} product={live} /> : null}
          <p className="pd-desc">{live.description}</p>
          <div className="pd-specs">
            {live.materials ? <div><Box weight="fill" /><span><em>{say("Materials", "Materiali")}</em><strong>{live.materials}</strong></span></div> : null}
            {live.size ? <div><PriceTag weight="fill" /><span><em>{live.service ? say("Details", "Dettagli") : say("Size", "Misure")}</em><strong>{live.size}</strong></span></div> : null}
          </div>
          {market ? <SellerCard store={market} onOpen={onOwner} /> : shop ? (
            <button type="button" className="pd-seller" onClick={onOwner}>
              <RemoteImage src={shop.owner.src} alt="" />
              <span>
                <strong>{shop.title}{shop.verified ? <Verified className="sx-verified" /> : null}</strong>
                <em>@{shop.owner.handle} · {shop.city}</em>
              </span>
              <ChevronRight strokeWidth={2.4} />
            </button>
          ) : null}
          {!shop?.mine ? <ReviewsBlock refKey={ref.key} canWrite /> : null}
          {more.length ? (
            <section className="mk-rail pd-rail">
              <h3>{say("More from this shop", "Altro da questa bottega")}</h3>
              <div className="mk-rail-row" data-no-swipe>
                {more.map((item, index) => <MarketCard key={item.id} refValue={productRef(item, ownerName || null, liveShop)} index={index} showShop={false} onOpen={() => onProduct?.(item)} />)}
              </div>
            </section>
          ) : null}
          {similar.length ? (
            <section className="mk-rail pd-rail">
              <h3>{say("You may also like", "Ti potrebbe piacere")}</h3>
              <div className="mk-rail-row" data-no-swipe>
                {similar.map((item, index) => <MarketCard key={item.key} refValue={item} index={index} onOpen={() => nav.product?.(SHOPS[item.owner]?.products.find((p) => p.id === item.product.id) || item.product, item.owner, null)} />)}
              </div>
            </section>
          ) : null}
        </div>
      </div>
      <div className="pd-foot">
        {shop?.mine ? (
          <button type="button" className="ig-btn pd-cta" onClick={() => onEdit(live)}>{say("Edit product", "Modifica prodotto")}</button>
        ) : (
          <>

            <button type="button" className="ig-btn pd-ask" aria-label={say("Ask in Direct", "Chiedi nel Direct")} onClick={() => onAsk(live, { variant, qty })}><Send weight="bold" /></button>
            <button
              type="button"
              className={`ig-btn pd-add${added ? " done" : ""}`}
              disabled={soldOut}
              onClick={() => {
                space.addToCart({ ...ref, variant, qty });
                setAdded(Date.now());
                window.setTimeout(() => setAdded(0), 1400);
              }}
            >
              {added ? <><Check weight="bold" />{say("Added", "Aggiunto")}</> : say("Add to cart", "Aggiungi al carrello")}
            </button>
            <button
              type="button"
              className="ig-btn primary pd-cta"
              disabled={soldOut || buying}
              onClick={() => {
                if (!canBuy) {
                  space.addToCart({ ...ref, variant, qty });
                  nav.cart?.();
                  return;
                }
                setBuying(true);
                Promise.resolve(onBuy?.(live, { variant, qty })).finally(() => setBuying(false));
              }}
            >
              {buying ? <i className="dm-spin" /> : canBuy && !soldOut ? say("Buy now", "Acquista ora") : !soldOut ? say("Buy", "Compra") : soldOut ? say("Sold out", "Esaurito") : live.service ? say("Book in chat", "Prenota in chat") : live.madeToOrder && !live.stock ? say("Request in chat", "Richiedi in chat") : say("Ask to buy", "Chiedi per acquistare")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProductEditor({ product, onClose, onSave, onDelete }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const fresh = !product;
  const [form, setForm] = useState(() => ({
    name: product?.name || "",
    price: product ? String(product.price) : "",
    category: product?.category || "",
    description: product?.description || "",
    materials: product?.materials || "",
    size: product?.size || "",
    images: product?.images || [],
    mode: product?.madeToOrder && !product?.stock ? "order" : "stock",
    stock: product?.stock != null ? String(product.stock) : "1",
    weeks: String(product?.madeToOrder || 3),
    variants: (product?.variants || []).join(", "),
  }));
  const [tray, setTray] = useState(fresh);
  const fileRef = useRef(null);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const price = Number(String(form.price).replace(",", "."));
  const valid = form.name.trim() && price > 0 && form.images.length;

  async function fromDevice(event) {
    const files = [...(event.target.files || [])].filter((file) => file.type.startsWith("image/")).slice(0, 6);
    event.target.value = "";
    const list = [];
    for (const file of files) {
      try {
        list.push(await shrinkImage(file));
      } catch {
        // skip
      }
    }
    setForm((prev) => ({ ...prev, images: [...prev.images, ...list].slice(0, 6) }));
  }

  function save() {
    if (!valid) return;
    onSave({
      id: product?.id || `p-${Date.now().toString(36)}`,
      name: form.name.trim(),
      price,
      category: form.category.trim() || say("Other", "Altro"),
      description: form.description.trim(),
      materials: form.materials.trim(),
      size: form.size.trim(),
      images: form.images,
      stock: form.mode === "order" ? 0 : Math.max(0, Number(form.stock) || 0),
      madeToOrder: form.mode === "order" ? Math.max(1, Number(form.weeks) || 1) : null,
      variants: form.variants.split(",").map((item) => item.trim()).filter(Boolean),
    });
  }

  return (
    <div className="panel view st ep pe">
      <div className="st-head ep-head">
        <button type="button" className="ep-cancel" onClick={onClose}>{say("Cancel", "Annulla")}</button>
        <strong>{fresh ? say("New product", "Nuovo prodotto") : say("Edit product", "Modifica prodotto")}</strong>
        <button type="button" className="ep-done" disabled={!valid} onClick={save}>{say("Save", "Salva")}</button>
      </div>
      <div className="panel-scroll">
        <h2 className="st-cap">{say("Photos", "Foto")} · {form.images.length}/6</h2>
        <div className="pe-photos" data-no-swipe>
          {form.images.map((src, index) => (
            <span key={`${index}-${src.slice(-12)}`} className="pe-photo">
              <img src={src} alt="" />
              {index === 0 ? <b>{say("Cover", "Copertina")}</b> : null}
              <button type="button" aria-label={say("Remove", "Rimuovi")} onClick={() => setForm((prev) => ({ ...prev, images: prev.images.filter((_, at) => at !== index) }))}><X strokeWidth={2.6} /></button>
            </span>
          ))}
          {form.images.length < 6 ? (
            <button type="button" className="pe-photo add" onClick={() => setTray((value) => !value)}><Plus weight="bold" /><em>{say("Add", "Aggiungi")}</em></button>
          ) : null}
        </div>
        {tray && form.images.length < 6 ? (
          <div className="tcc-tray pe-tray" data-no-swipe>
            <button type="button" className="tcc-tray-lib" onClick={() => fileRef.current?.click()}><Image strokeWidth={2} /><span>{say("Library", "Libreria")}</span></button>
            {DEMO_GALLERY.slice(0, 10).map((src) => (
              <button key={src} type="button" onClick={() => setForm((prev) => ({ ...prev, images: [...prev.images, src].slice(0, 6) }))}><img src={src} alt="" draggable="false" /></button>
            ))}
          </div>
        ) : null}
        <h2 className="st-cap">{say("Product", "Prodotto")}</h2>
        <div className="st-card">
          <label className="ep-row"><span className="ep-label">{say("Name", "Nome")}</span><span className="ep-input"><input value={form.name} maxLength={60} onChange={set("name")} placeholder={say("e.g. Red bowl", "es. Coppa rossa")} /></span></label>
          <label className="ep-row"><span className="ep-label">{say("Price", "Prezzo")}</span><span className="ep-input"><b>€</b><input value={form.price} inputMode="decimal" onChange={set("price")} placeholder="0" /></span></label>
          <label className="ep-row"><span className="ep-label">{say("Category", "Categoria")}</span><span className="ep-input"><input value={form.category} maxLength={30} onChange={set("category")} placeholder={say("e.g. Cups", "es. Tazze")} /></span></label>
        </div>
        <h2 className="st-cap">{say("Availability", "Disponibilità")}</h2>
        <div className="st-card">
          <div className="pe-seg">
            <button type="button" className={form.mode === "stock" ? "on" : ""} onClick={() => setForm((prev) => ({ ...prev, mode: "stock" }))}>{say("Ready to ship", "Pronto")}</button>
            <button type="button" className={form.mode === "order" ? "on" : ""} onClick={() => setForm((prev) => ({ ...prev, mode: "order" }))}>{say("Made to order", "Su ordinazione")}</button>
          </div>
          {form.mode === "stock" ? (
            <label className="ep-row"><span className="ep-label">{say("Pieces", "Pezzi")}</span><span className="ep-input"><input value={form.stock} inputMode="numeric" onChange={set("stock")} /></span></label>
          ) : (
            <label className="ep-row"><span className="ep-label">{say("Weeks", "Settimane")}</span><span className="ep-input"><input value={form.weeks} inputMode="numeric" onChange={set("weeks")} /></span></label>
          )}
          <label className="ep-row"><span className="ep-label">{say("Variants", "Varianti")}</span><span className="ep-input"><input value={form.variants} onChange={set("variants")} placeholder={say("Red, Blue, Ivory", "Rosso, Blu, Avorio")} /></span></label>
        </div>
        <h2 className="st-cap">{say("Details", "Dettagli")}</h2>
        <div className="st-card">
          <label className="ep-row"><span className="ep-label">{say("Materials", "Materiali")}</span><span className="ep-input"><input value={form.materials} onChange={set("materials")} placeholder={say("e.g. Stoneware", "es. Gres")} /></span></label>
          <label className="ep-row"><span className="ep-label">{say("Size", "Misure")}</span><span className="ep-input"><input value={form.size} onChange={set("size")} placeholder="Ø 12 cm" /></span></label>
        </div>
        <div className="st-card ep-bio">
          <textarea value={form.description} maxLength={500} rows={4} onChange={set("description")} placeholder={say("Tell the story of this piece…", "Racconta la storia di questo pezzo…")} />
          <span className="ep-count">{500 - form.description.length}</span>
        </div>
        {!fresh ? (
          <div className="st-card st-out"><button type="button" className="st-row center" onClick={() => onDelete(product.id)}><strong>{say("Delete product", "Elimina prodotto")}</strong></button></div>
        ) : null}
        <p className="ep-note">{say("Buyers ask to buy in Direct: you agree price, payment and shipping in chat.", "Chi compra te lo chiede nel Direct: prezzo, pagamento e spedizione li concordate in chat.")}</p>
      </div>
      <input ref={fileRef} className="sr" type="file" accept="image/*" multiple onChange={fromDevice} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct purchases (Stripe Connect), the Shop section and orders.
// ---------------------------------------------------------------------------
function payBase() {
  const hub = import.meta.env.VITE_HUB_URL;
  if (hub) {
    try {
      const url = new URL(hub);
      return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}/calls/api`;
    } catch {
      // fall back to same origin
    }
  }
  return "/calls/api";
}

async function payApi(path, body) {
  const response = await fetch(`${payBase()}${path}`, body
    ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `http ${response.status}`);
    error.code = data.error;
    error.detail = data.detail;
    throw error;
  }
  return data;
}

function backUrl() {
  const url = new URL(window.location.href);
  for (const key of ["checkout", "order", "stripe", "session_id"]) url.searchParams.delete(key);
  return url.toString();
}

function PaymentsSetup({ handle, lang }) {
  const s = (en, it) => say(lang, en, it);
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setError("");
    payApi("/config").then(setConfig).catch(() => setConfig({ enabled: false, offline: true }));
    if (handle) payApi(`/connect/status?handle=${encodeURIComponent(handle)}`).then(setStatus).catch((err) => setStatus({ connected: false, error: err.code }));
  }
  useEffect(load, [handle]);

  async function onboard() {
    setBusy(true);
    setError("");
    try {
      const { url } = await payApi("/connect/onboard", { handle, returnUrl: backUrl(), country: "IT" });
      window.location.href = url;
    } catch (err) {
      setError(err.detail || err.code || "error");
      setBusy(false);
    }
  }

  async function dashboard() {
    setBusy(true);
    try {
      const { url } = await payApi("/connect/dashboard", { handle });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err.detail || err.code || "error");
    }
    setBusy(false);
  }

  const ready = status?.chargesEnabled;
  const state = !config ? "loading" : !handle ? "nouser" : config.offline ? "offline" : !config.enabled ? "server" : ready ? "ready" : status?.connected ? "pending" : "none";
  const fee = config?.feePercent ?? 5;

  return (
    <div className="set-flow">
      <div className={`set-card pay-state ${state}`}>
        <div className="pay-state-head">
          <i className={`st-ico ${state === "ready" ? "green" : state === "pending" ? "orange" : "indigo"}`}>{state === "ready" ? <Check weight="bold" /> : <PriceTag weight="fill" />}</i>
          <span>
            <strong>
              {state === "ready" ? s("Payments are on", "Pagamenti attivi")
                : state === "pending" ? s("Finish verification on Stripe", "Completa la verifica su Stripe")
                  : state === "none" ? s("Sell directly in the app", "Vendi direttamente nell'app")
                    : state === "server" ? s("Stripe is not set up on the server", "Stripe non è configurato sul server")
                      : state === "nouser" ? s("Sign in to Direct first", "Prima collegati al Direct")
                        : state === "offline" ? s("Server offline", "Server non raggiungibile")
                          : s("Checking…", "Controllo…")}
            </strong>
            <em>
              {state === "ready" ? s("Buyers pay by card, Apple Pay or Google Pay. Money goes to your Stripe account.", "Chi compra paga con carta, Apple Pay o Google Pay. I soldi arrivano sul tuo account Stripe.")
                : state === "pending" ? s("Stripe still needs a few details before you can get paid.", "Stripe ha bisogno di qualche dato prima di poterti pagare.")
                  : state === "none" ? s("Connect your own Stripe account: payments land on it, payouts to your bank.", "Collega il tuo account Stripe: i pagamenti arrivano lì e poi sul tuo conto in banca.")
                    : state === "server" ? s("Add STRIPE_SECRET_KEY to the server (calls/.dev.vars) to turn payments on.", "Aggiungi STRIPE_SECRET_KEY al server (calls/.dev.vars) per attivare i pagamenti.")
                      : state === "offline" ? s("The live server is not reachable right now.", "Il server live ora non risponde.")
                        : ""}
            </em>
          </span>
        </div>
        {config?.testMode ? <span className="pay-test">{s("Test mode", "Modalità test")}</span> : null}
        {state === "none" || state === "pending" ? (
          <button type="button" className="ig-btn primary pay-go" disabled={busy} onClick={onboard}>{busy ? <i className="dm-spin" /> : state === "none" ? s("Connect Stripe", "Collega Stripe") : s("Continue on Stripe", "Continua su Stripe")}</button>
        ) : null}
        {state === "ready" ? (
          <button type="button" className="ig-btn pay-go" disabled={busy} onClick={dashboard}>{s("Open Stripe dashboard", "Apri dashboard Stripe")}</button>
        ) : null}
        {error ? <p className="pay-error"><Warn />{error}</p> : null}
      </div>
      <h2 className="set-kicker">{s("How it works", "Come funziona")}</h2>
      <div className="set-card">
        <div className="feed-row"><i className="st-ico blue"><Bag weight="fill" /></i><span className="feed-copy"><strong>{s("Buy now on your products", "“Acquista ora” sui tuoi prodotti")}</strong><span>{s("Secure checkout by Stripe, with shipping address.", "Pagamento sicuro con Stripe, con indirizzo di spedizione.")}</span></span></div>
        <div className="feed-row"><i className="st-ico green"><Directions weight="fill" /></i><span className="feed-copy"><strong>{s("Paid to your account", "Pagato sul tuo account")}</strong><span>{s("Stripe sends payouts to your bank automatically.", "Stripe versa automaticamente sul tuo conto.")}</span></span></div>
        <div className="feed-row"><i className="st-ico gray"><PriceTag weight="fill" /></i><span className="feed-copy"><strong>{s(`Space fee: ${fee}%`, `Commissione Space: ${fee}%`)}</strong><span>{s("Plus Stripe's card fees. No monthly cost.", "Più le commissioni carta di Stripe. Nessun costo mensile.")}</span></span></div>
        <div className="feed-row"><i className="st-ico orange"><Bell weight="fill" /></i><span className="feed-copy"><strong>{s("Live order alerts", "Avvisi d'ordine in tempo reale")}</strong><span>{s("You get a notification as soon as someone buys.", "Ricevi una notifica appena qualcuno compra.")}</span></span></div>
      </div>
      <p className="msg-hint">{s("Products with photos from your phone sync without the photo: use photos from the web for now.", "I prodotti con foto caricate dal telefono si sincronizzano senza foto: per ora usa foto dal web.")}</p>
    </div>
  );
}

function OrdersScreen({ handle, onClose }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [tab, setTab] = useState("bought");
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  function load() {
    if (!handle) {
      setData({ bought: [], sold: [] });
      return;
    }
    payApi(`/orders?handle=${encodeURIComponent(handle)}`).then(setData).catch(() => setError(true));
  }
  useEffect(load, [handle]);
  useEffect(() => {
    const onOrder = () => load();
    window.addEventListener("space-order", onOrder);
    return () => window.removeEventListener("space-order", onOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);
  const list = data?.[tab] || [];
  const label = (status) => ({ paid: say("Paid", "Pagato"), shipped: say("Shipped", "Spedito"), pending: say("Pending", "In attesa") }[status] || status);
  return (
    <div className="panel view or">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{say("Orders", "Ordini")}</strong></span>
        <span />
      </div>
      <div className="ps-tabs or-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "bought"} className={tab === "bought" ? "on" : ""} onClick={() => setTab("bought")}>{say("Purchases", "Acquisti")}</button>
        <button type="button" role="tab" aria-selected={tab === "sold"} className={tab === "sold" ? "on" : ""} onClick={() => setTab("sold")}>{say("Sales", "Vendite")}</button>
        <i className="ps-tabs-bar" style={{ "--n": tab === "bought" ? 0 : 1, width: "50%" }} />
      </div>
      <div className="panel-scroll">
        {!data && !error ? <p className="tcd-empty">{say("Loading…", "Caricamento…")}</p> : null}
        {error ? <p className="tcd-empty">{say("Orders are not reachable right now.", "Gli ordini ora non sono raggiungibili.")}</p> : null}
        {data && !list.length ? (
          <div className="ig-empty"><i><Box strokeWidth={1.4} /></i><strong>{tab === "bought" ? say("No purchases yet", "Ancora nessun acquisto") : say("No sales yet", "Ancora nessuna vendita")}</strong><span>{say("Orders paid with Stripe appear here.", "Qui compaiono gli ordini pagati con Stripe.")}</span></div>
        ) : null}
        {list.map((order, index) => (
          <div key={order.id} className="or-row" style={{ "--i": Math.min(index, 8) }}>
            {order.image ? <img src={order.image} alt="" /> : <i className="or-ph"><Box weight="fill" /></i>}
            <span className="or-copy">
              <strong>{order.qty > 1 ? `${order.qty} × ` : ""}{order.name}{order.variant ? ` · ${order.variant}` : ""}</strong>
              <em>{tab === "bought" ? `@${order.seller}` : `@${order.buyer}`} · {new Date(order.paidAt || order.createdAt).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "short" })}</em>
              {tab === "sold" && order.shipping?.address ? <em className="or-ship">{order.shipping.name} · {order.shipping.address.line1}, {order.shipping.address.city}</em> : null}
            </span>
            <span className="or-side">
              <b>{euro(order.total, it)}</b>
              <i className={`or-status ${order.status}`}>{label(order.status)}</i>
              {tab === "sold" && order.status === "paid" ? (
                <button type="button" className="ig-btn small" onClick={() => payApi("/orders/ship", { handle, orderId: order.id }).then(load).catch(() => {})}>{say("Mark shipped", "Segna spedito")}</button>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const SHOP_TOPICS = ["Ceramica", "Cucina", "Tessuti", "Musica", "Corsi"];

function shopTopicOf(shop, product) {
  if (product.service || /corso|course/i.test(product.category || "")) return "Corsi";
  if (/ceram/i.test(shop.category + shop.title)) return "Ceramica";
  if (/ristor|trattor|cucina/i.test(shop.category + shop.title)) return "Cucina";
  if (/tess/i.test(shop.category + shop.title)) return "Tessuti";
  if (/liut|music/i.test(shop.category + shop.title)) return "Musica";
  return "";
}

// The Shop section: every shop and product on Space, demo shops and live sellers.
function ShopHome({ onClose, onOrders, me }) {
  const nav = useContext(ThoughtNav);
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sheet, setSheet] = useState(false);
  const [liveShops, setLiveShops] = useState([]);
  useEffect(() => {
    payApi("/shops").then((data) => setLiveShops((data.shops || []).filter((shop) => shop.seller !== me))).catch(() => {});
  }, [me]);
  const stores = [...liveShops.map((shop) => storeOf(null, shop)), ...demoStores()];
  const refs = stores.flatMap((store) => storeRefs(store).map((ref) => ({ ...ref, topic: shopTopicOf(store, ref.product), store })));
  const needle = query.trim().toLowerCase();
  const active = filterCount(filters);
  const matched = applyFilters(refs, filters)
    .filter((item) => topic === "all" || item.topic === topic)
    .filter((item) => !needle || `${item.product.name} ${item.product.category} ${item.store.title} ${item.store.city}`.toLowerCase().includes(needle));
  const sorted = sortRefs(matched, sort === "relevance" ? "mix" : sort);
  const browsing = !needle && topic === "all" && !active;
  const cartCount = (space.cart || []).reduce((sum, item) => sum + item.qty, 0);
  const wishCount = (space.wishlist || []).length;
  const open = (item) => {
    const store = item.store || stores.find((entry) => entry.key === item.seller);
    const full = store?.products.find((product) => product.id === item.product.id) || item.product;
    nav.product?.(full, item.owner, item.live ? { ...item.live, products: store?.products || [item.product] } : null);
  };
  const openStore = (store) => nav.store?.(store.owner, store.live);
  const loved = stores.map((store) => ({ store, rating: sellerRating(store, space) }))
    .sort((a, b) => b.rating.top - a.rating.top || b.rating.avg * Math.log(b.rating.count + 1) - a.rating.avg * Math.log(a.rating.count + 1))
    .map((entry) => entry.store);
  const recent = (space.recentProducts || []).slice(0, 10);
  const rails = browsing ? [
    ["recent", say("Recently viewed", "Visti di recente"), recent],
    ["new", say("New in", "Novità"), [...refs].reverse().slice(0, 10)],
    ["gifts", say("Gifts under €50", "Regali sotto i 50 €"), refs.filter((item) => item.product.price < 50 && !item.product.service)],
    ["order", say("Made to order", "Su ordinazione"), refs.filter((item) => item.product.madeToOrder)],
    ["courses", say("Courses and experiences", "Corsi ed esperienze"), refs.filter((item) => item.product.service)],
  ].filter(([, , list]) => list.length) : [];
  const quick = [
    ["freeShip", say("Free shipping", "Spedizione gratuita")],
    ["ready", say("Ready to ship", "Pronta consegna")],
    ["rating", say("4.8+ stars", "4,8+ stelle")],
  ];

  return (
    <div className="panel view shp">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>Shop</strong></span>
        <span className="mk-head-r">
          <button type="button" className="ps-icon mk-cart-btn" aria-label={say("Favourites", "Preferiti")} onClick={() => nav.wishlist?.()}><Heart strokeWidth={2} />{wishCount ? <b className="soft" key={`w${wishCount}`}>{wishCount}</b> : null}</button>
          <button type="button" className="ps-icon mk-cart-btn" aria-label={say("Cart", "Carrello")} onClick={() => nav.cart?.()}>
            <Bag strokeWidth={2} />
            {cartCount ? <b key={cartCount}>{cartCount}</b> : null}
          </button>
        </span>
      </div>
      <div className="panel-scroll">
        <div className="shp-search">
          <label className="sx-field">
            <Search strokeWidth={2} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={say("Search shops and products", "Cerca botteghe e prodotti")} aria-label={say("Search shop", "Cerca nello shop")} />
            {query ? <button type="button" className="sx-clear" aria-label={say("Clear", "Cancella")} onClick={() => setQuery("")}><X strokeWidth={2.6} /></button> : null}
          </label>
        </div>
        <div className="sx-topics shp-topics" role="group">
          {["all", ...SHOP_TOPICS].map((item) => (
            <button key={item} type="button" className={topic === item ? "on" : ""} aria-pressed={topic === item} onClick={() => setTopic(item)}>{item === "all" ? say("For you", "Per te") : item}</button>
          ))}
        </div>
        {browsing ? (
          <>
            <div className="shp-links">
              <button type="button" onClick={onOrders}><Box weight="fill" /><span>{say("Your orders", "I tuoi ordini")}</span><ChevronRight strokeWidth={2.4} /></button>
            </div>
            <section className="mk-rail">
              <h3>{say("Most loved shops", "Botteghe più amate")}</h3>
              <div className="mk-rail-row mk-stores" data-no-swipe>
                {loved.map((store, index) => <StoreCard key={store.key} store={store} index={index} onOpen={() => openStore(store)} />)}
              </div>
            </section>
          </>
        ) : null}
        {rails.map(([id, title, list]) => (
          <section key={id} className="mk-rail">
            <h3>{title}</h3>
            <div className="mk-rail-row" data-no-swipe>
              {list.map((item, index) => <MarketCard key={`${id}-${item.key}`} refValue={item} index={index} onOpen={() => open(item)} />)}
            </div>
          </section>
        ))}
        <div className="mk-all-head">
          <h3>{browsing ? say("All products", "Tutti i prodotti") : `${sorted.length} ${sorted.length === 1 ? say("result", "risultato") : say("results", "risultati")}`}</h3>
          <SortPill value={sort} onChange={setSort} />
        </div>
        <div className="sx-topics mk-chips mk-filterbar" role="group">
          <button type="button" className={`mk-filter-btn${active ? " on" : ""}`} onClick={() => setSheet(true)}><Sliders strokeWidth={2} />{say("Filters", "Filtri")}{active ? <b>{active}</b> : null}</button>
          {quick.map(([key, label]) => {
            const on = key === "rating" ? filters.rating === 4.8 : filters[key];
            return <button key={key} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => setFilters((prev) => (key === "rating" ? { ...prev, rating: prev.rating === 4.8 ? 0 : 4.8 } : { ...prev, [key]: !prev[key] }))}>{label}</button>;
          })}
          {PRICE_BANDS.slice(1).map(([id]) => <button key={id} type="button" className={filters.price === id ? "on" : ""} aria-pressed={filters.price === id} onClick={() => setFilters((prev) => ({ ...prev, price: prev.price === id ? "all" : id }))}>{priceBandLabel(id, it)}</button>)}
        </div>
        <div className="mk-grid" key={`${topic}-${needle}-${sort}-${JSON.stringify(filters)}`}>
          {sorted.map((item, index) => <MarketCard key={item.key} refValue={item} index={index} onOpen={() => open(item)} />)}
        </div>
        {!sorted.length ? (
          <div className="ig-empty">
            <i><Bag strokeWidth={1.4} /></i>
            <strong>{say("No products found", "Nessun prodotto trovato")}</strong>
            {active ? <button type="button" className="ig-btn" onClick={() => setFilters(NO_FILTERS)}>{say("Clear filters", "Azzera i filtri")}</button> : null}
          </div>
        ) : null}
      </div>
      {sheet ? <FilterSheet filters={filters} count={sortRefs(applyFilters(refs, filters).filter((item) => topic === "all" || item.topic === topic), sort).length} onChange={setFilters} onClose={() => setSheet(false)} /> : null}
    </div>
  );
}

// A live seller's shop, published to the server from another device.
function LiveShopScreen({ shop, onClose }) {
  const nav = useContext(ThoughtNav);
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  return (
    <div className="panel view shp">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{shop.shop?.title || `@${shop.seller}`}</strong><em>@{shop.seller}</em></span>
        <span />
      </div>
      <div className="panel-scroll">
        <div className="lsh-head">
          <RemoteImage src={avatarFor(shop.shop?.title || shop.seller)} alt="" />
          <span>
            <strong>{shop.shop?.title || `@${shop.seller}`}</strong>
            <em>{[shop.shop?.category, shop.shop?.city].filter(Boolean).join(" · ")}</em>
            <em className={shop.payments ? "lsh-pay on" : "lsh-pay"}>{shop.payments ? say("Direct purchase with Stripe", "Acquisto diretto con Stripe") : say("Purchase via Direct", "Acquisto tramite Direct")}</em>
          </span>
        </div>
        <div className="bz2-btns lsh-btns">
          <button type="button" className="ig-btn" onClick={() => nav.dm?.(shop.seller)}><Send weight="bold" />{say("Message", "Messaggio")}</button>
        </div>
        <ShopGrid shop={{ products: shop.products, mine: false }} onOpen={(product) => nav.product?.(product, null, shop)} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marketplace: product references, ratings, reviews, cart, wishlist.
// ---------------------------------------------------------------------------
const SHIPPING_FEE = 6.9;
const FREE_SHIPPING = 80;

// A product as the cart and wishlist store it: who sells it and the product itself.
function productRef(product, owner, liveShop) {
  const seller = liveShop ? `live:${liveShop.seller}` : owner ? `demo:${owner}` : "me";
  return {
    key: `${seller}:${product.id}`,
    seller,
    owner: owner || null,
    live: liveShop ? { seller: liveShop.seller, shop: liveShop.shop || null, payments: Boolean(liveShop.payments) } : null,
    product: { id: product.id, name: product.name, price: product.price, images: (product.images || []).slice(0, 1), service: Boolean(product.service), stock: product.stock ?? null, madeToOrder: product.madeToOrder || null, category: product.category || "" },
  };
}

function hashOf(text) {
  let hash = 0;
  for (const char of String(text)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

const REVIEW_LINES = [
  "Ancora più bello dal vivo. Imballato benissimo.",
  "Si sente che è fatto a mano, ogni dettaglio è curato.",
  "Spedizione veloce e un biglietto scritto a mano. Tornerò!",
  "Colore esattamente come in foto. Consigliatissimo.",
  "Lo uso ogni giorno, regge benissimo.",
  "Ottima comunicazione in chat, mi ha seguito passo passo.",
];

function seededReviews(key) {
  const hash = hashOf(key);
  const count = 3 + (hash % 40);
  const stars = [5, 5, 5, 4, 5, 4, 5].slice(0, 3 + (hash % 3));
  const list = stars.map((value, index) => {
    const pool = SEARCH_PEOPLE.filter((entry) => !String(key).startsWith(`demo:${entry.name}:`));
    const person = pool[(hash + index * 3) % pool.length];
    return { id: `${key}-r${index}`, stars: value, text: REVIEW_LINES[(hash + index) % REVIEW_LINES.length], name: person.name, src: person.src, at: Date.now() - (index + 1) * (3 + (hash % 9)) * 86_400_000 };
  });
  const avg = 4.4 + ((hash % 6) / 10);
  return { count, avg: Math.min(5, avg), list };
}

function useReviews(key) {
  return reviewsFor(key, useSpace());
}

function reviewsFor(key, space) {
  const seed = seededReviews(key);
  const mine = (space.reviews?.[key] || []).map((review, index) => ({ id: `me-${index}`, ...review, name: space.profile?.name || "Tu", src: AVATAR, mine: true }));
  const count = seed.count + mine.length;
  const avg = mine.length ? (seed.avg * seed.count + mine.reduce((sum, review) => sum + review.stars, 0)) / count : seed.avg;
  return { count, avg, list: [...mine, ...seed.list] };
}

function Stars({ value, size = 12 }) {
  return (
    <span className="mk-stars" style={{ "--s": `calc(${size} * var(--u))` }} aria-label={`${value.toFixed(1)} / 5`}>
      {[1, 2, 3, 4, 5].map((index) => <Star key={index} weight={value >= index - 0.25 ? "fill" : "regular"} className={value >= index - 0.25 ? "on" : ""} />)}
    </span>
  );
}

function RatingLine({ refKey }) {
  const { count, avg } = useReviews(refKey);
  return (
    <span className="mk-rating"><Star weight="fill" />{avg.toFixed(1)}<em>({count})</em></span>
  );
}

function shippingFor(items) {
  const physical = items.some((item) => !item.product.service);
  const goods = items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const fee = physical && goods < FREE_SHIPPING ? SHIPPING_FEE : 0;
  return { goods, fee, total: goods + fee, physical, missing: physical && goods < FREE_SHIPPING ? FREE_SHIPPING - goods : 0 };
}

function sellerOf(item) {
  if (item.live) return { title: item.live.shop?.title || `@${item.live.seller}`, src: avatarFor(item.live.shop?.title || item.live.seller), city: item.live.shop?.city || "" };
  if (item.owner && SHOPS[item.owner]) {
    const person = SEARCH_PEOPLE.find((entry) => entry.name === item.owner);
    return { title: SHOPS[item.owner].title, src: person?.src || avatarFor(item.owner), city: SHOPS[item.owner].city };
  }
  return { title: "Shop", src: AVATAR, city: "" };
}

function WishButton({ refValue }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const on = (space.wishlist || []).some((item) => item.key === refValue.key);
  const [pop, setPop] = useState(0);
  return (
    <i
      role="button"
      tabIndex={0}
      className={`mk-wish${on ? " on" : ""}`}
      aria-label={on ? (it ? "Rimuovi dai preferiti" : "Remove from favourites") : (it ? "Aggiungi ai preferiti" : "Add to favourites")}
      aria-pressed={on}
      onClick={(event) => {
        event.stopPropagation();
        space.toggleWish(refValue);
        if (!on) setPop(Date.now());
      }}
    >
      <Heart key={pop} weight={on ? "fill" : "regular"} />
    </i>
  );
}

function MarketCard({ refValue, onOpen, index = 0, showShop = true }) {
  const it = useContext(SpacePrefs).language === "it";
  const { product } = refValue;
  const stock = stockLabel(product, it);
  return (
    <button type="button" className="shop-card mk-card" style={{ "--i": Math.min(index, 10) }} onClick={onOpen}>
      <span className="shop-pic">
        {product.images[0] ? <RemoteImage src={product.images[0]} alt="" /> : <i className="or-ph"><Bag weight="fill" /></i>}
        {stock.tone !== "ok" ? <b className={`shop-flag ${stock.tone}`}>{stock.tone === "order" ? (it ? "Su ordinazione" : "Made to order") : stock.text}</b> : null}
        {refValue.live?.payments ? <b className="shop-buy">{it ? "Acquista" : "Buy"}</b> : null}
        <WishButton refValue={refValue} />
      </span>
      <strong>{product.name}</strong>
      <em>{euro(product.price, it)}</em>
      <span className="mk-meta"><RatingLine refKey={refValue.key} />{showShop ? <span className="shp-by">{sellerOf(refValue).title}</span> : null}</span>
    </button>
  );
}

function ReviewsBlock({ refKey, canWrite }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const { count, avg, list } = useReviews(refKey);
  const [writing, setWriting] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const bars = [5, 4, 3, 2, 1].map((value) => {
    const share = value === 5 ? 0.72 : value === 4 ? 0.2 : value === 3 ? 0.06 : value === 2 ? 0.01 : 0.01;
    return [value, Math.round(share * 100)];
  });
  return (
    <section className="mk-reviews">
      <p className="pd-label">{say("Reviews", "Recensioni")}</p>
      <div className="mk-rev-head">
        <div className="mk-rev-score">
          <b>{avg.toFixed(1)}</b>
          <Stars value={avg} size={13} />
          <em>{count} {say("reviews", "recensioni")}</em>
        </div>
        <div className="mk-rev-bars">
          {bars.map(([value, share]) => (
            <span key={value}><em>{value}</em><i><b style={{ width: `${share}%` }} /></i></span>
          ))}
        </div>
      </div>
      {canWrite ? (
        writing ? (
          <div className="mk-rev-form">
            <div className="mk-rev-pick">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" aria-label={`${value}`} onClick={() => setStars(value)}><Star weight={value <= stars ? "fill" : "regular"} className={value <= stars ? "on" : ""} /></button>
              ))}
            </div>
            <textarea value={text} maxLength={300} rows={3} placeholder={say("What did you like?", "Cosa ti è piaciuto?")} onChange={(event) => setText(event.target.value)} />
            <div className="mk-rev-actions">
              <button type="button" className="ig-btn" onClick={() => setWriting(false)}>{say("Cancel", "Annulla")}</button>
              <button type="button" className="ig-btn primary" disabled={!text.trim()} onClick={() => { space.addReview(refKey, { stars, text: text.trim() }); setText(""); setWriting(false); }}>{say("Publish", "Pubblica")}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="ig-btn mk-rev-write" onClick={() => setWriting(true)}>{say("Write a review", "Scrivi una recensione")}</button>
        )
      ) : null}
      {(all ? list : list.slice(0, 3)).map((review) => (
        <div key={review.id} className="mk-rev">
          <RemoteImage src={review.src} alt="" />
          <span>
            <strong>{review.name}<Stars value={review.stars} size={10} /></strong>
            <p>{review.text}</p>
            <em>{noteAgo(review.at, it)}</em>
          </span>
        </div>
      ))}
      {list.length > 3 && !all ? <button type="button" className="mk-more" onClick={() => setAll(true)}>{say(`Show all ${list.length}`, `Mostra tutte (${list.length})`)}</button> : null}
    </section>
  );
}

function CartScreen({ onClose, onCheckout, onRequest, onOpenProduct }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const cart = space.cart || [];
  const groups = [];
  for (const item of cart) {
    let group = groups.find((entry) => entry.seller === item.seller);
    if (!group) {
      group = { seller: item.seller, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  const [busy, setBusy] = useState(null);
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  return (
    <div className="panel view shp mk-cart">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{say("Cart", "Carrello")}</strong>{count ? <em>{count} {count === 1 ? say("item", "articolo") : say("items", "articoli")}</em> : null}</span>
        <span />
      </div>
      <div className="panel-scroll">
        {!groups.length ? (
          <div className="ig-empty"><i><Bag strokeWidth={1.4} /></i><strong>{say("Your cart is empty", "Il carrello è vuoto")}</strong><span>{say("Add handmade pieces from the shops.", "Aggiungi pezzi fatti a mano dalle botteghe.")}</span></div>
        ) : null}
        {groups.map((group) => {
          const seller = sellerOf(group.items[0]);
          const ship = shippingFor(group.items);
          const payable = Boolean(group.items[0].live?.payments);
          return (
            <section key={group.seller} className="mk-group">
              <header>
                <RemoteImage src={seller.src} alt="" />
                <span><strong>{seller.title}</strong><em>{seller.city}{payable ? ` · ${say("Pay with Stripe", "Pagamento con Stripe")}` : ` · ${say("Order via Direct", "Ordine tramite Direct")}`}</em></span>
              </header>
              {group.items.map((item) => (
                <div key={`${item.key}-${item.variant}`} className="mk-line">
                  <button type="button" className="mk-line-pic" onClick={() => onOpenProduct(item)}>{item.product.images[0] ? <img src={item.product.images[0]} alt="" /> : <i className="or-ph"><Bag weight="fill" /></i>}</button>
                  <span className="mk-line-copy">
                    <strong>{item.product.name}</strong>
                    {item.variant ? <em>{item.variant}</em> : null}
                    <b>{euro(item.product.price * item.qty, it)}</b>
                  </span>
                  <span className="mk-qty">
                    <button type="button" aria-label="−" onClick={() => space.setCartQty(item.key, item.variant, item.qty - 1)}>{item.qty === 1 ? <Trash strokeWidth={2} /> : "−"}</button>
                    <b>{item.qty}</b>
                    <button type="button" aria-label="+" disabled={item.qty >= 20} onClick={() => space.setCartQty(item.key, item.variant, item.qty + 1)}>+</button>
                  </span>
                </div>
              ))}
              {ship.missing > 0 ? (
                <p className="mk-free"><Truck weight="fill" />{say(`Add ${euro(ship.missing, false)} for free shipping`, `Aggiungi ${euro(ship.missing, true)} per la spedizione gratuita`)}<i><b style={{ width: `${Math.min(100, (ship.goods / FREE_SHIPPING) * 100)}%` }} /></i></p>
              ) : ship.physical ? <p className="mk-free ok"><Truck weight="fill" />{say("Free shipping", "Spedizione gratuita")}</p> : null}
              <div className="mk-sum">
                <span><em>{say("Subtotal", "Subtotale")}</em><b>{euro(ship.goods, it)}</b></span>
                {ship.physical ? <span><em>{say("Shipping", "Spedizione")}</em><b>{ship.fee ? euro(ship.fee, it) : say("Free", "Gratis")}</b></span> : null}
                <span className="mk-total"><em>{say("Total", "Totale")}</em><b>{euro(ship.total, it)}</b></span>
              </div>
              <button
                type="button"
                className="ig-btn primary mk-pay"
                disabled={busy === group.seller}
                onClick={async () => {
                  setBusy(group.seller);
                  try {
                    if (payable) await onCheckout(group);
                    else await onRequest(group);
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === group.seller ? <i className="dm-spin" /> : payable ? say(`Pay ${euro(ship.total, false)}`, `Paga ${euro(ship.total, true)}`) : say("Send order request", "Invia richiesta d'ordine")}
              </button>
            </section>
          );
        })}
        {groups.length ? <p className="ep-note">{say("Shops without Stripe receive your order in Direct: you agree payment and shipping in chat.", "Le botteghe senza Stripe ricevono l'ordine nel Direct: pagamento e spedizione li concordate in chat.")}</p> : null}
      </div>
    </div>
  );
}

function WishlistScreen({ onClose, onOpenProduct }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const list = space.wishlist || [];
  return (
    <div className="panel view shp">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{say("Favourites", "Preferiti")}</strong>{list.length ? <em>{list.length}</em> : null}</span>
        <span />
      </div>
      <div className="panel-scroll">
        {list.length ? (
          <div className="shop-grid shp-grid">
            {list.map((item, index) => <MarketCard key={item.key} refValue={item} index={index} onOpen={() => onOpenProduct(item)} />)}
          </div>
        ) : (
          <div className="ig-empty"><i><Heart strokeWidth={1.4} /></i><strong>{say("No favourites yet", "Ancora nessun preferito")}</strong><span>{say("Tap the heart on a product to save it here.", "Tocca il cuore su un prodotto per salvarlo qui.")}</span></div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sellers: one shape for demo shops and live sellers, their rating and reviews.
// ---------------------------------------------------------------------------
function storeOf(owner, live) {
  if (live) {
    const info = live.shop || {};
    return {
      key: `live:${live.seller}`, owner: null, live, handle: live.seller, title: info.title || `@${live.seller}`, city: info.city || "",
      category: info.category || "", src: avatarFor(info.title || live.seller), verified: false, products: live.products || [],
      about: info.about || "", since: null, shipsIn: "2–3", returns: 14, responds: null, sales: null, payments: Boolean(live.payments),
    };
  }
  const shop = SHOPS[owner];
  if (!shop) return null;
  const person = SEARCH_PEOPLE.find((entry) => entry.name === owner);
  return {
    key: `demo:${owner}`, owner, live: null, handle: person?.handle || owner, title: shop.title, city: shop.city, category: shop.category,
    src: person?.src || avatarFor(owner), verified: shop.verified, products: shop.products, about: shop.about || "", since: shop.since || null,
    shipsIn: shop.shipsIn || "2–3", returns: shop.returns ?? 14, responds: shop.responds || null, sales: shop.sales || null, payments: false,
    hours: shop.hours, address: shop.address, phone: shop.phone, email: shop.email,
  };
}

function demoStores() {
  return Object.keys(SHOPS).map((owner) => storeOf(owner)).filter(Boolean);
}

function storeRefs(store) {
  return store.products.map((product) => productRef(product, store.owner, store.live ? { ...store.live, products: store.products } : null));
}

// The seller's score: every review of every product, weighted by count.
function sellerRating(store, space) {
  let count = 0;
  let total = 0;
  const list = [];
  for (const ref of storeRefs(store)) {
    const reviews = reviewsFor(ref.key, space);
    count += reviews.count;
    total += reviews.avg * reviews.count;
    for (const review of reviews.list) list.push({ ...review, product: ref.product, ref });
  }
  list.sort((a, b) => b.at - a.at);
  const avg = count ? total / count : 0;
  return { count, avg, list, top: avg >= 4.75 && count >= 40 };
}

function deliveryWindow(store, it) {
  const [low, high] = String(store?.shipsIn || "2–3").split("–").map(Number);
  const from = new Date(Date.now() + ((low || 2) + 2) * 86_400_000);
  const to = new Date(Date.now() + ((high || low || 3) + 4) * 86_400_000);
  const day = (date) => date.toLocaleDateString(it ? "it-IT" : "en-GB", { weekday: "short", day: "numeric" });
  return `${day(from)} – ${day(to)} ${to.toLocaleDateString(it ? "it-IT" : "en-GB", { month: "short" })}`;
}

function SellerBadges({ store, rating, compact }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const items = [];
  if (rating.top) items.push(["top", <Medal key="i" weight="fill" />, say("Top seller", "Venditore top")]);
  if (store.responds) items.push(["fast", <Bolt key="i" weight="fill" />, say(`Replies ${store.responds}`, `Risponde ${store.responds}`)]);
  if (!compact) items.push(["ship", <Truck key="i" weight="fill" />, say(`Ships in ${store.shipsIn} days`, `Spedisce in ${store.shipsIn} giorni`)]);
  if (!items.length) return null;
  return <div className={`mk-badges${compact ? " compact" : ""}`}>{items.map(([id, icon, label]) => <span key={id} className={`mk-badge ${id}`}>{icon}{label}</span>)}</div>;
}

function SellerCard({ store, onOpen }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const rating = sellerRating(store, space);
  return (
    <button type="button" className="mk-seller" onClick={onOpen}>
      <RemoteImage src={store.src} alt="" />
      <span className="mk-seller-copy">
        <strong>{store.title}{store.verified ? <Verified className="sx-verified" /> : null}</strong>
        <span className="mk-rating"><Star weight="fill" />{rating.avg.toFixed(1)}<em>({rating.count}) · {store.city}</em></span>
        <SellerBadges store={store} rating={rating} compact />
      </span>
      <span className="ig-btn mk-seller-go">{say("Visit", "Visita")}</span>
    </button>
  );
}

// Delivery, returns and payment, the three things a buyer checks first.
function TrustRows({ store, product }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const food = /dispensa|menu/i.test(product.category || "");
  return (
    <div className="mk-trust">
      {product.service ? (
        <div><Clock strokeWidth={2} /><span><strong>{say("Book in chat", "Prenoti in chat")}</strong><em>{store?.responds ? say(`The shop usually replies ${store.responds}`, `La bottega di solito risponde ${store.responds}`) : say("The shop confirms the date with you", "La bottega ti conferma la data")}</em></span></div>
      ) : (
        <div><Truck weight="fill" /><span><strong>{product.madeToOrder && !product.stock ? say(`Made for you in ${product.madeToOrder} weeks`, `Realizzato per te in ${product.madeToOrder} settimane`) : say(`Arrives ${deliveryWindow(store, false)}`, `Arriva ${deliveryWindow(store, true)}`)}</strong><em>{product.price >= FREE_SHIPPING ? say("Free shipping", "Spedizione gratuita") : say(`Shipping ${euro(SHIPPING_FEE, false)} · free over ${euro(FREE_SHIPPING, false)}`, `Spedizione ${euro(SHIPPING_FEE, true)} · gratis sopra ${euro(FREE_SHIPPING, true)}`)}</em></span></div>
      )}
      {!product.service ? (
        <div><ReturnIcon weight="bold" /><span><strong>{food || !store?.returns ? say("No returns on food", "Niente resi sugli alimentari") : say(`Returns within ${store.returns} days`, `Resi entro ${store.returns} giorni`)}</strong><em>{food || !store?.returns ? say("Fresh, made the same day", "Prodotto fresco, fatto in giornata") : say("Write to the shop in Direct to start one", "Scrivi alla bottega nel Direct per avviarlo")}</em></span></div>
      ) : null}
      <div><ShieldCheck weight="fill" /><span><strong>{store?.payments ? say("Secure payment with Stripe", "Pagamento sicuro con Stripe") : say("You pay after the shop confirms", "Paghi dopo la conferma della bottega")}</strong><em>{store?.payments ? say("Card, Apple Pay, Google Pay", "Carta, Apple Pay, Google Pay") : say("Payment and shipping agreed in Direct", "Pagamento e spedizione si concordano nel Direct")}</em></span></div>
    </div>
  );
}

function RatingSummary({ avg, count, onWrite }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const bars = [[5, 74], [4, 19], [3, 5], [2, 1], [1, 1]];
  return (
    <div className="mk-rev-head">
      <div className="mk-rev-score">
        <b>{avg.toFixed(1)}</b>
        <Stars value={avg} size={13} />
        <em>{count} {say("reviews", "recensioni")}</em>
      </div>
      <div className="mk-rev-bars">
        {bars.map(([value, share]) => <span key={value}><em>{value}</em><i><b style={{ width: `${share}%` }} /></i></span>)}
      </div>
      {onWrite ? null : null}
    </div>
  );
}

function SellerReviews({ store, onProduct }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const rating = sellerRating(store, space);
  const [stars, setStars] = useState(0);
  const [limit, setLimit] = useState(8);
  const list = rating.list.filter((review) => !stars || review.stars === stars);
  return (
    <section className="mk-reviews mk-store-reviews">
      <RatingSummary avg={rating.avg} count={rating.count} />
      <div className="sx-topics mk-chips" role="group">
        {[0, 5, 4, 3].map((value) => (
          <button key={value} type="button" className={stars === value ? "on" : ""} aria-pressed={stars === value} onClick={() => { setStars(value); setLimit(8); }}>
            {value ? <>{value}<Star weight="fill" /></> : say("All", "Tutte")}
          </button>
        ))}
      </div>
      {list.slice(0, limit).map((review) => (
        <div key={`${review.ref.key}-${review.id}`} className="mk-rev">
          <RemoteImage src={review.src} alt="" />
          <span>
            <strong>{review.name}<Stars value={review.stars} size={10} /></strong>
            <p>{review.text}</p>
            <button type="button" className="mk-rev-item" onClick={() => onProduct(review.ref)}>
              {review.product.images[0] ? <img src={review.product.images[0]} alt="" /> : null}
              <span>{say("Bought", "Ha acquistato")} <b>{review.product.name}</b></span>
            </button>
            <em>{noteAgo(review.at, it)}</em>
          </span>
        </div>
      ))}
      {!list.length ? <p className="tcd-empty">{say("No reviews with these stars yet.", "Ancora nessuna recensione con queste stelle.")}</p> : null}
      {list.length > limit ? <button type="button" className="mk-more" onClick={() => setLimit((value) => value + 12)}>{say("Show more", "Mostra altre")}</button> : null}
    </section>
  );
}

// A shop's own page on the marketplace: products, reviews and policies.
function StoreScreen({ owner, live, onClose }) {
  const nav = useContext(ThoughtNav);
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const store = storeOf(owner, live);
  const [tab, setTab] = useState("products");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("relevance");
  if (!store) return null;
  const rating = sellerRating(store, space);
  const refs = storeRefs(store);
  const cats = [...new Set(store.products.map((product) => product.category).filter(Boolean))];
  const shown = refs.filter((ref) => cat === "all" || ref.product.category === cat);
  const sorted = sortRefs(shown, sort);
  const following = store.owner ? space.follows.has(store.owner) : false;
  const cartCount = (space.cart || []).reduce((sum, item) => sum + item.qty, 0);
  const cover = store.products.slice(0, 3).map((product) => product.images[0]).filter(Boolean);
  const openRef = (ref) => nav.product?.(store.products.find((product) => product.id === ref.product.id) || ref.product, store.owner, store.live ? { ...store.live, products: store.products } : null);
  const tabs = [["products", say("Products", "Prodotti")], ["reviews", say("Reviews", "Recensioni")], ["about", say("About", "Info")]];
  return (
    <div className="panel view shp mk-store">
      <div className="ps-bar pd-head">
        <button type="button" className="ps-icon" aria-label={say("Back", "Indietro")} onClick={onClose}><ChevronLeft strokeWidth={2.4} /></button>
        <span className="pd-head-title"><strong>{store.title}</strong><em>{say("Shop", "Bottega")}</em></span>
        <span className="mk-head-r">
          <button type="button" className="ps-icon mk-cart-btn" aria-label={say("Cart", "Carrello")} onClick={() => nav.cart?.()}><Bag strokeWidth={2} />{cartCount ? <b key={cartCount}>{cartCount}</b> : null}</button>
        </span>
      </div>
      <div className="panel-scroll">
        <div className={`mk-cover n${cover.length}`}>{cover.map((src, index) => <RemoteImage key={`${index}-${src.slice(-10)}`} src={src} alt="" />)}</div>
        <div className="mk-hero">
          <span className="mk-hero-av"><RemoteImage src={store.src} alt="" /></span>
          <h1>{store.title}{store.verified ? <Verified className="sx-verified" /> : null}</h1>
          <p className="mk-hero-sub">{[store.category, store.city].filter(Boolean).join(" · ")}</p>
          <button type="button" className="mk-hero-rating" onClick={() => setTab("reviews")}>
            <Stars value={rating.avg} size={13} /><b>{rating.avg.toFixed(1)}</b><em>{rating.count} {say("reviews", "recensioni")}</em>
          </button>
          <div className="mk-hero-stats">
            {store.sales ? <span><b>{store.sales.toLocaleString(it ? "it-IT" : "en-GB")}</b><em>{say("sales", "vendite")}</em></span> : null}
            <span><b>{store.products.length}</b><em>{say("products", "prodotti")}</em></span>
            {store.since ? <span><b>{store.since}</b><em>{say("on Space since", "su Space dal")}</em></span> : null}
          </div>
          <SellerBadges store={store} rating={rating} />
          <div className="ps-actions mk-hero-actions">
            {store.owner ? (
              <button type="button" className={following ? "ig-btn" : "ig-btn primary"} aria-pressed={following} onClick={() => space.toggleFollow(store.owner)}>{following ? say("Following", "Segui già") : say("Follow", "Segui")}</button>
            ) : null}
            <button type="button" className="ig-btn" onClick={() => (store.live ? nav.dm?.(store.handle) : nav.chat?.(store.owner))}>{say("Message", "Messaggio")}</button>
            {store.owner ? <button type="button" className="ig-btn" onClick={() => nav.person?.({ name: store.owner })}>{say("Profile", "Profilo")}</button> : null}
          </div>
        </div>
        <div className="ps-tabs or-tabs mk-tabs" role="tablist">
          {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>)}
          <i className="ps-tabs-bar" style={{ "--n": tabs.findIndex(([id]) => id === tab), width: `${100 / tabs.length}%` }} />
        </div>
        {tab === "products" ? (
          <>
            <div className="mk-tools">
              <div className="sx-topics mk-chips" role="group">
                {["all", ...cats].map((item) => <button key={item} type="button" className={cat === item ? "on" : ""} aria-pressed={cat === item} onClick={() => setCat(item)}>{item === "all" ? say("All", "Tutti") : item}</button>)}
              </div>
            </div>
            <div className="mk-all-head"><h3>{sorted.length} {sorted.length === 1 ? say("product", "prodotto") : say("products", "prodotti")}</h3><SortPill value={sort} onChange={setSort} /></div>
            <div className="mk-grid" key={`${cat}-${sort}`}>
              {sorted.map((ref, index) => <MarketCard key={ref.key} refValue={ref} index={index} showShop={false} onOpen={() => openRef(ref)} />)}
            </div>
          </>
        ) : null}
        {tab === "reviews" ? <SellerReviews store={store} onProduct={openRef} /> : null}
        {tab === "about" ? (
          <div className="mk-about">
            {store.about ? <p className="mk-about-text">{store.about}</p> : null}
            {store.address ? <BusinessCard shop={store} /> : null}
            <p className="pd-label">{say("Shop policies", "Condizioni della bottega")}</p>
            <div className="mk-trust">
              <div><Truck weight="fill" /><span><strong>{say("Shipping", "Spedizione")}</strong><em>{say(`Ships in ${store.shipsIn} working days. ${euro(SHIPPING_FEE, false)}, free over ${euro(FREE_SHIPPING, false)}.`, `Spedisce in ${store.shipsIn} giorni lavorativi. ${euro(SHIPPING_FEE, true)}, gratis sopra ${euro(FREE_SHIPPING, true)}.`)}</em></span></div>
              <div><ReturnIcon weight="bold" /><span><strong>{say("Returns", "Resi")}</strong><em>{store.returns ? say(`Accepted within ${store.returns} days of delivery. Made-to-order pieces can't be returned.`, `Accettati entro ${store.returns} giorni dalla consegna. I pezzi su ordinazione non si possono rendere.`) : say("Not accepted: fresh food made the same day.", "Non accettati: prodotti freschi fatti in giornata.")}</em></span></div>
              <div><ShieldCheck weight="fill" /><span><strong>{say("Payments", "Pagamenti")}</strong><em>{store.payments ? say("Direct purchase with Stripe: card, Apple Pay, Google Pay.", "Acquisto diretto con Stripe: carta, Apple Pay, Google Pay.") : say("Order in Direct, pay once the shop confirms.", "Ordini nel Direct e paghi dopo la conferma della bottega.")}</em></span></div>
              {store.responds ? <div><Bolt weight="fill" /><span><strong>{say("Replies", "Risposte")}</strong><em>{say(`Usually replies ${store.responds}.`, `Di solito risponde ${store.responds}.`)}</em></span></div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function sortRefs(list, sort) {
  const rated = (ref) => seededReviews(ref.key).avg;
  if (sort === "low") return [...list].sort((a, b) => a.product.price - b.product.price);
  if (sort === "high") return [...list].sort((a, b) => b.product.price - a.product.price);
  if (sort === "rating") return [...list].sort((a, b) => rated(b) - rated(a));
  if (sort === "new") return [...list].reverse();
  if (sort === "mix") {
    const lanes = [];
    for (const ref of list) {
      let lane = lanes.find((entry) => entry.seller === ref.seller);
      if (!lane) lanes.push((lane = { seller: ref.seller, items: [] }));
      lane.items.push(ref);
    }
    const out = [];
    for (let round = 0; out.length < list.length; round += 1) for (const lane of lanes) if (lane.items[round]) out.push(lane.items[round]);
    return out;
  }
  return list;
}

function SortPill({ value, onChange }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  return (
    <label className="mk-sort">
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={say("Sort", "Ordina")}>
        <option value="relevance">{say("Relevance", "Rilevanza")}</option>
        <option value="rating">{say("Top rated", "Più votati")}</option>
        <option value="new">{say("Newest", "Più recenti")}</option>
        <option value="low">{say("Price: low to high", "Prezzo crescente")}</option>
        <option value="high">{say("Price: high to low", "Prezzo decrescente")}</option>
      </select>
      <ChevronDown strokeWidth={2.4} />
    </label>
  );
}

const PRICE_BANDS = [["all", null, null], ["u25", 0, 25], ["25-50", 25, 50], ["50-100", 50, 100], ["o100", 100, null]];

function priceBandLabel(id, it) {
  return { all: it ? "Tutti" : "Any", u25: it ? "Sotto 25 €" : "Under €25", "25-50": "25–50 €", "50-100": "50–100 €", o100: it ? "Oltre 100 €" : "Over €100" }[id];
}

function applyFilters(list, filters) {
  const band = PRICE_BANDS.find(([id]) => id === filters.price);
  return list.filter((ref) => {
    const { product } = ref;
    if (band && band[1] != null && product.price < band[1]) return false;
    if (band && band[2] != null && product.price >= band[2]) return false;
    if (filters.rating && seededReviews(ref.key).avg < filters.rating) return false;
    if (filters.freeShip && (product.service || product.price < FREE_SHIPPING)) return false;
    if (filters.ready && (product.service || (product.madeToOrder && !product.stock) || product.stock === 0)) return false;
    if (filters.direct && !ref.live?.payments) return false;
    if (filters.noCourses && product.service) return false;
    return true;
  });
}

function filterCount(filters) {
  return (filters.price !== "all" ? 1 : 0) + (filters.rating ? 1 : 0) + ["freeShip", "ready", "direct", "noCourses"].filter((key) => filters[key]).length;
}

const NO_FILTERS = { price: "all", rating: 0, freeShip: false, ready: false, direct: false, noCourses: false };

function FilterSheet({ filters, onChange, onClose, count }) {
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const toggles = [
    ["freeShip", say("Free shipping", "Spedizione gratuita"), <Truck key="i" weight="fill" />],
    ["ready", say("Ready to ship", "Pronta consegna"), <Box key="i" weight="fill" />],
    ["direct", say("Direct purchase", "Acquisto diretto"), <ShieldCheck key="i" weight="fill" />],
    ["noCourses", say("Hide courses and services", "Nascondi corsi e servizi"), <Clock key="i" strokeWidth={2} />],
  ];
  return (
    <div className="mk-sheet-wrap" onClick={onClose}>
      <section className="mk-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={say("Filters", "Filtri")}>
        <i className="mk-sheet-grab" />
        <header><strong>{say("Filters", "Filtri")}</strong><button type="button" onClick={() => onChange(NO_FILTERS)}>{say("Reset", "Azzera")}</button></header>
        <p className="pd-label">{say("Price", "Prezzo")}</p>
        <div className="sx-topics mk-chips wrap">
          {PRICE_BANDS.map(([id]) => <button key={id} type="button" className={filters.price === id ? "on" : ""} onClick={() => onChange({ ...filters, price: id })}>{priceBandLabel(id, it)}</button>)}
        </div>
        <p className="pd-label">{say("Rating", "Valutazione")}</p>
        <div className="sx-topics mk-chips wrap">
          {[0, 4.5, 4.8].map((value) => <button key={value} type="button" className={filters.rating === value ? "on" : ""} onClick={() => onChange({ ...filters, rating: value })}>{value ? <>{value.toLocaleString(it ? "it-IT" : "en-GB")}<Star weight="fill" />{say(" and up", " e più")}</> : say("Any", "Tutte")}</button>)}
        </div>
        <div className="mk-toggles">
          {toggles.map(([key, label, icon]) => (
            <button key={key} type="button" className="mk-toggle" aria-pressed={filters[key]} onClick={() => onChange({ ...filters, [key]: !filters[key] })}>
              {icon}<span>{label}</span><i className={`mk-switch${filters[key] ? " on" : ""}`} />
            </button>
          ))}
        </div>
        <button type="button" className="ig-btn primary mk-pay" onClick={onClose}>{count ? say(`Show ${count} products`, `Mostra ${count} prodotti`) : say("No products", "Nessun prodotto")}</button>
      </section>
    </div>
  );
}

function StoreCard({ store, onOpen, index = 0 }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const rating = sellerRating(store, space);
  const pics = store.products.slice(0, 3).map((product) => product.images[0]).filter(Boolean);
  return (
    <button type="button" className="mk-storecard" style={{ "--i": index }} onClick={onOpen}>
      <span className={`mk-storecard-pics n${pics.length}`}>{pics.map((src, i) => <RemoteImage key={`${i}-${src.slice(-10)}`} src={src} alt="" />)}</span>
      <span className="mk-storecard-who">
        <RemoteImage src={store.src} alt="" />
        <span>
          <strong>{store.title}{store.verified ? <Verified className="sx-verified" /> : null}</strong>
          <span className="mk-rating"><Star weight="fill" />{rating.avg.toFixed(1)}<em>({rating.count}) · {store.city}</em></span>
        </span>
      </span>
      {rating.top ? <b className="mk-storecard-top"><Medal weight="fill" />{it ? "Venditore top" : "Top seller"}</b> : null}
    </button>
  );
}

function VoiceBubble({ message }) {
  const audio = useRef(null);
  const [on, setOn] = useState(false);
  const [at, setAt] = useState(0);
  const bars = message.wave?.length ? message.wave : VOICE_WAVE;
  const seconds = Math.max(1, Math.round(message.duration || 1));

  useEffect(() => {
    const el = audio.current;
    if (!el) return undefined;
    const tick = () => setAt(el.duration ? el.currentTime / el.duration : 0);
    const stop = () => {
      setOn(false);
      setAt(0);
    };
    el.addEventListener("timeupdate", tick);
    el.addEventListener("ended", stop);
    return () => {
      el.pause();
      el.removeEventListener("timeupdate", tick);
      el.removeEventListener("ended", stop);
    };
  }, [message.audio]);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (on) {
      el.pause();
      setOn(false);
      return;
    }
    el.play().then(() => setOn(true)).catch(() => setOn(false));
  }

  return (
    <button type="button" className="voice" onClick={toggle} aria-label={on ? "Pause voice message" : "Play voice message"}>
      <audio ref={audio} src={message.audio} preload="metadata" />
      <i>{on ? <Pause strokeWidth={2.4} /> : <Play strokeWidth={2.4} />}</i>
      <span className="voice-wave" aria-hidden="true">
        {bars.map((height, index) => (
          <b key={index} className={index / bars.length < at ? "on" : ""} style={{ height: `${Math.max(18, height)}%` }} />
        ))}
      </span>
      <em>{`0:${String(seconds).padStart(2, "0")}`}</em>
    </button>
  );
}

function callStamp(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

const AVATAR_TONES = [["#ff6a5c", "#7a1d3b"], ["#ffb347", "#8a3b12"], ["#5ad1c9", "#1d4f7a"], ["#9b8cff", "#3b1d7a"], ["#7ee08a", "#1d5a3b"], ["#ff8fc7", "#7a1d5a"]];

function avatarFor(name) {
  const text = String(name || "?").trim();
  const initials = text.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [a, b] = AVATAR_TONES[hash % AVATAR_TONES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><text x="48" y="61" font-family="-apple-system,Helvetica,Arial,sans-serif" font-size="38" font-weight="600" fill="#fff" text-anchor="middle">${initials.replace(/[<>&"]/g, "")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function clockOf(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayOf(ms, it) {
  const date = new Date(ms);
  const today = new Date();
  const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86_400_000);
  if (diff === 0) return it ? "Oggi" : "Today";
  if (diff === 1) return it ? "Ieri" : "Yesterday";
  return date.toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "short", year: diff > 300 ? "numeric" : undefined });
}

function listTime(ms, it) {
  if (!ms) return "";
  const diff = Math.round((Date.now() - ms) / 86_400_000);
  if (new Date(ms).toDateString() === new Date().toDateString()) return clockOf(ms);
  if (diff < 7) return new Date(ms).toLocaleDateString(it ? "it-IT" : "en-GB", { weekday: "short" });
  return new Date(ms).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "numeric", month: "numeric" });
}

function seenText(person, it) {
  if (!person) return "";
  if (person.online) return "online";
  if (!person.lastSeen) return it ? "offline" : "offline";
  const sameDay = new Date(person.lastSeen).toDateString() === new Date().toDateString();
  const when = sameDay ? clockOf(person.lastSeen) : `${dayOf(person.lastSeen, it).toLowerCase()} ${clockOf(person.lastSeen)}`;
  return it ? `ultimo accesso ${sameDay ? "alle " : ""}${when}` : `last seen ${sameDay ? "at " : ""}${when}`;
}

function nameIn(conv, handle, me, it) {
  if (handle === me) return it ? "Tu" : "You";
  return conv?.members.find((member) => member.handle === handle)?.name || handle;
}

function systemText(message, conv, me, it) {
  const mine = message.by === me;
  const by = nameIn(conv, message.by, me, it);
  const who = message.who === me ? (it ? "te" : "you") : nameIn(conv, message.who, me, it);
  switch (message.event) {
    case "created": return mine ? (it ? `Hai creato il gruppo «${message.title}».` : `You created the group “${message.title}”.`) : (it ? `${by} ha creato il gruppo «${message.title}».` : `${by} created the group “${message.title}”.`);
    case "renamed": return mine ? (it ? `Hai rinominato il gruppo in «${message.title}».` : `You renamed the group to “${message.title}”.`) : (it ? `${by} ha rinominato il gruppo in «${message.title}».` : `${by} renamed the group to “${message.title}”.`);
    case "added": return mine ? (it ? `Hai aggiunto ${who}.` : `You added ${who}.`) : (it ? `${by} ha aggiunto ${who}.` : `${by} added ${who}.`);
    case "removed": return mine ? (it ? `Hai rimosso ${who}.` : `You removed ${who}.`) : (it ? `${by} ha rimosso ${who}.` : `${by} removed ${who}.`);
    case "left": return message.who === me ? (it ? "Hai lasciato il gruppo." : "You left the group.") : (it ? `${who} ha lasciato il gruppo.` : `${who} left the group.`);
    case "pinned": return mine ? (it ? "Hai fissato un messaggio." : "You pinned a message.") : (it ? `${by} ha fissato un messaggio.` : `${by} pinned a message.`);
    default: return message.text || "";
  }
}

// Shape a live conversation like the local demo threads used by the UI.
function liveThread(conv, me, it, typing) {
  const others = conv.members.filter((member) => member.handle !== me);
  const group = conv.kind === "group";
  const other = others[0];
  const face = (member) => ({ handle: member.handle, name: member.name, meta: seenText(member, it), src: member.src || avatarFor(member.name), online: member.online });
  const members = group ? others.map(face) : undefined;
  const name = group ? conv.title : (other?.name || (it ? "Chat" : "Chat"));
  const typers = Object.keys(typing?.[conv.id] || {}).filter((handle) => handle !== me).map((handle) => nameIn(conv, handle, me, it).split(" ")[0]);
  const messages = conv.messages.map((message) => ({
    ...message,
    from: message.from === me ? "me" : message.from === "system" ? "system" : "them",
    sender: message.from,
    senderName: nameIn(conv, message.from, me, it),
    time: clockOf(message.created),
    text: message.kind === "system" ? systemText(message, conv, me, it) : message.text,
  }));
  const last = messages[messages.length - 1];
  return {
    id: conv.id,
    live: true,
    conv,
    name,
    kind: group ? (it ? "Gruppo" : "Group") : "Chat",
    src: group ? (members[0]?.src || avatarFor(name)) : (other?.src || avatarFor(name)),
    members: group && members.length > 1 ? members : undefined,
    people: group ? members : other ? [face(other)] : [],
    other,
    group,
    owner: conv.owner,
    photo: group ? (conv.photo || "") : "",
    about: conv.about || "",
    pinned: conv.pinned || null,
    online: !group && Boolean(other?.online),
    typing: typers,
    messages,
    unread: conv.unread || 0,
    time: listTime(conv.updatedAt, it),
    updatedAt: conv.updatedAt || 0,
    preview: last ? "" : (it ? "Nuova chat" : "New chat"),
  };
}

function tickFor(message, thread, receipts) {
  if (!thread.live) return receipts ? "read" : "sent";
  if (message.status === "failed") return "failed";
  if (!message.id) return "pending";
  if (!receipts) return "sent";
  const others = thread.conv.members.filter((member) => member.handle !== message.sender);
  const read = others.length > 0 && others.every((member) => member.readAt != null && member.readAt >= message.created);
  return read ? "read" : "sent";
}

function Tick({ tick }) {
  if (tick === "pending") return <Clock className="tick" strokeWidth={2.4} aria-label="Sending" />;
  if (tick === "failed") return null;
  if (tick === "read") return <CheckCheck className="tick read" strokeWidth={2.4} aria-label="Read" />;
  if (tick === "sent") return <Check className="tick" strokeWidth={2.4} aria-label="Sent" />;
  return null;
}

function ChatBubble({ message, fresh, mine, breakTop, last = true, tick, showName, onZoom, onCall, onRetry, onDiscard }) {
  const it = useContext(SpacePrefs).language === "it";
  if (message.from === "system") return <p className="bubble system">{message.text}</p>;
  const kind = message.kind || "text";
  if (kind === "call") {
    const video = message.call === "video";
    const missed = !message.duration;
    const label = video ? (it ? "Videochiamata" : "Video call") : (it ? "Chiamata" : "Voice call");
    const detail = missed
      ? (mine
        ? (message.reason === "declined" ? (it ? "Rifiutata" : "Declined") : message.reason === "busy" ? (it ? "Occupato" : "Busy") : message.reason === "cancelled" ? (it ? "Annullata" : "Cancelled") : (it ? "Nessuna risposta" : "No answer"))
        : (it ? "Persa" : "Missed"))
      : callStamp(message.duration);
    return (
      <button type="button" className={`call-log${mine ? " me" : ""}${missed ? " miss" : ""}`} onClick={() => onCall?.(video ? "video" : "voice")}>
        <i>{video ? <Video strokeWidth={2} /> : <Phone strokeWidth={2} />}</i>
        <span>
          <strong>{label}</strong>
          <em>{detail}{message.time ? ` · ${message.time}` : ""}</em>
        </span>
      </button>
    );
  }
  const bare = kind === "image" && !message.text;
  const failed = message.status === "failed";
  return (
    <div className={`bubble ${mine ? "me" : "them"}${kind === "image" ? " photo" : ""}${kind === "audio" ? " voice" : ""}${breakTop ? " break" : ""}${last ? " last" : ""}${fresh ? " fresh" : ""}${bare ? " bare" : ""}${failed ? " failed" : ""}${!message.id && message.status === "pending" ? " pending" : ""}`}>
      {showName && !mine && breakTop ? <span className="bubble-name">{message.senderName}</span> : null}
      {kind === "image" ? (
        <button type="button" className="bubble-pic" onClick={() => onZoom(message.image)} aria-label={it ? "Apri foto" : "Open photo"}>
          <img src={message.image} alt="" />
        </button>
      ) : null}
      {kind === "audio" ? <VoiceBubble message={message} /> : null}
      {kind !== "audio" && message.text ? <span className="bubble-text">{message.text}</span> : null}
      <span className="bubble-meta">
        {message.time ? <time>{message.time}</time> : null}
        {mine ? <Tick tick={tick} /> : null}
      </span>
      {failed ? (
        <span className="send-failed">
          {it ? "Non inviato" : "Not sent"}
          <button type="button" onClick={onRetry} aria-label={it ? "Riprova" : "Retry"}><RotateCcw strokeWidth={2.4} /></button>
          <button type="button" onClick={onDiscard} aria-label={it ? "Elimina" : "Discard"}><X strokeWidth={2.4} /></button>
        </span>
      ) : null}
    </div>
  );
}

const GROUP_TONES = [
  ["#5ec4ff", "#2a7bf2"], ["#ff8a65", "#e8505b"], ["#b388ff", "#6e3cf0"], ["#4dd0a7", "#13917a"],
  ["#ffd54f", "#f29a1d"], ["#f48fb1", "#d6336c"], ["#80deea", "#2e9bb5"], ["#a5d66f", "#4e9a2d"],
];

function GroupAvatar({ photo, title, size }) {
  const style = size ? { width: size, height: size } : undefined;
  if (photo && photo.startsWith("data:")) return <img className="g-avatar" style={style} src={photo} alt="" />;
  const index = photo && photo.startsWith("tone:") ? Number(photo.slice(5)) % GROUP_TONES.length : [...String(title || "")].reduce((sum, char) => sum + char.charCodeAt(0), 0) % GROUP_TONES.length;
  const [a, b] = GROUP_TONES[index];
  const initials = String(title || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
  return <span className="g-avatar" style={{ ...style, background: `linear-gradient(160deg, ${a}, ${b})` }}><b>{initials}</b></span>;
}

function ThreadFace({ thread }) {
  if (thread.photo || thread.group || (thread.members && thread.members.length > 1 && thread.name)) {
    return <span className="face-wrap group"><GroupAvatar photo={thread.photo} title={thread.name} /></span>;
  }
  if (thread.members && thread.members.length > 1) {
    return (
      <span className="face-stack">
        <RemoteImage src={thread.members[0].src} alt="" />
        <RemoteImage src={thread.members[1].src} alt="" />
      </span>
    );
  }
  return (
    <span className="face-wrap">
      <RemoteImage className="row-avatar" src={thread.src} alt="" />
      {thread.online ? <i className="online-dot" aria-label="online" /> : null}
    </span>
  );
}

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

function StreamVideo({ stream, className, muted = false, mirror = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream || null;
    el.play?.().catch(() => {});
  }, [stream]);
  return <video ref={ref} className={`${className || ""}${mirror ? " mirror" : ""}`} autoPlay playsInline muted={muted} />;
}

// Remote voices play in their own <audio>, never through <video>: a video with
// no frames may never start on iOS (Spinchat's RemoteAudio).
function RemoteAudio({ stream, volume }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const audio = stream ? new MediaStream(stream.getAudioTracks()) : null;
    el.srcObject = audio;
    const kick = () => { if (el.paused && el.srcObject) el.play().catch(() => {}); };
    kick();
    el.addEventListener("pause", kick);
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("pointerdown", kick);
    return () => {
      el.removeEventListener("pause", kick);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener("pointerdown", kick);
    };
  }, [stream]);
  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  return <audio ref={ref} autoPlay />;
}

function hasVideo(stream) {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === "live" && !track.muted));
}

const CALL_NOTICES = {
  denied: ["Allow microphone and camera to call", "Consenti microfono e fotocamera per chiamare"],
  "no-device": ["No microphone or camera found", "Nessun microfono o fotocamera"],
  "in-use": ["Camera or mic is busy in another app", "Fotocamera o microfono già in uso"],
  insecure: ["Calls need HTTPS", "Le chiamate richiedono HTTPS"],
  media: ["Can't open microphone", "Impossibile aprire il microfono"],
  offline: ["You're offline", "Sei offline"],
  "no-answer": ["No answer", "Nessuna risposta"],
  declined: ["Call declined", "Chiamata rifiutata"],
  busy: ["Busy on another call", "Occupato in un'altra chiamata"],
  full: ["This call is full (6 people)", "Chiamata piena (6 persone)"],
  ended: ["The call has ended", "La chiamata è terminata"],
  moved: ["Answered on another device", "Risposto su un altro dispositivo"],
  failed: ["Call failed", "Chiamata non riuscita"],
  "missed-while-busy": ["Missed call while you were busy", "Chiamata persa mentre eri occupato"],
};

function CallLayer() {
  const live = useLive();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const call = live?.call;
  const [speaker, setSpeaker] = useState(true);
  const elapsed = useElapsed(call?.startedAt);
  const me = live?.me?.handle;

  useEffect(() => {
    if (!call?.notice) return undefined;
    const id = window.setTimeout(() => live.calls.clearNotice(), 3600);
    return () => window.clearTimeout(id);
  }, [call?.notice, live]);

  useEffect(() => {
    if (call?.phase === "idle") setSpeaker(true);
  }, [call?.phase]);

  if (!live || !call) return null;
  const notice = call.notice ? (
    <div className="call-notice" role="status">{say(...(CALL_NOTICES[call.notice.code] || CALL_NOTICES.failed))}</div>
  ) : null;

  const convOf = (convId) => live.convs[convId];
  const titleOf = (convId) => {
    const conv = convOf(convId);
    if (!conv) return { name: call.demo?.name || "", src: call.demo?.src || avatarFor(call.demo?.name) };
    const thread = liveThread(conv, me, it, null);
    return { name: thread.name, src: thread.src, faces: thread.people };
  };

  if (call.phase === "idle" && call.incoming) {
    const incoming = call.incoming;
    const head = titleOf(incoming.convId);
    const caller = live.people[incoming.from] || convOf(incoming.convId)?.members.find((m) => m.handle === incoming.from);
    const group = convOf(incoming.convId)?.kind === "group";
    return (
      <div className="call-layer incoming" role="alertdialog" aria-label={say("Incoming call", "Chiamata in arrivo")}>
        <RemoteImage className="call-remote" src={caller?.src || head.src || avatarFor(caller?.name)} alt="" />
        <div className="incoming-card">
          <span className="call-rings" aria-hidden="true"><i /><i /><i /></span>
          <RemoteImage className="incoming-face" src={caller?.src || avatarFor(caller?.name)} alt="" />
          <strong>{group ? head.name : (caller?.name || head.name)}</strong>
          <span>
            {group ? `${caller?.name?.split(" ")[0] || ""} · ` : ""}
            {incoming.video ? say("Incoming video call", "Videochiamata in arrivo") : say("Incoming voice call", "Chiamata in arrivo")}
          </span>
        </div>
        <div className="incoming-actions">
          <button type="button" className="decline" onClick={() => live.calls.decline()}>
            <i><PhoneOff strokeWidth={2} /></i>
            <span>{say("Decline", "Rifiuta")}</span>
          </button>
          <button type="button" className="accept" onClick={() => live.calls.accept()}>
            <i>{incoming.video ? <Video strokeWidth={2} /> : <Phone strokeWidth={2} />}</i>
            <span>{say("Accept", "Rispondi")}</span>
          </button>
        </div>
      </div>
    );
  }

  if (call.phase === "idle") return notice;

  const head = titleOf(call.convId);
  const peers = Object.entries(call.peers).map(([handle, peer]) => {
    const person = live.people[handle] || convOf(call.convId)?.members.find((m) => m.handle === handle) || { name: handle };
    return { handle, ...peer, name: person.name, src: person.src || avatarFor(person.name), video: peer.cam !== false && hasVideo(peer.stream) };
  });
  const connected = Boolean(call.startedAt) && peers.length > 0;
  const status = call.phase === "joining"
    ? say("Connecting…", "Connessione…")
    : connected
      ? (peers.some((peer) => peer.state === "reconnecting" || peer.state === "disconnected") ? say("Reconnecting…", "Riconnessione…") : callStamp(elapsed))
      : call.demo || !peers.length ? say("Ringing…", "Squilla…") : say("Connecting…", "Connessione…");
  const anyVideo = call.cam || peers.some((peer) => peer.video);

  if (call.minimized) {
    return (
      <>
        <div className="call-pill">
          <button type="button" className="call-pill-main" onClick={() => live.calls.minimize(false)}>
            <i>{call.video ? <Video strokeWidth={2} /> : <Phone strokeWidth={2} />}</i>
            <span>{head.name}</span>
            <em>{status}</em>
          </button>
          <button type="button" className="call-pill-end" aria-label={say("End call", "Termina")} onClick={() => live.calls.hangup()}>
            <PhoneOff strokeWidth={2} />
          </button>
        </div>
        {peers.map((peer) => <RemoteAudio key={peer.handle} stream={peer.stream} volume={speaker ? 1 : 0} />)}
        {notice}
      </>
    );
  }

  const faces = peers.length ? peers : (head.faces?.length ? head.faces : [{ name: head.name, src: head.src }]);
  const solo = peers.length === 1 && peers[0].video;
  return (
    <div className={`call-layer call-stage ${anyVideo ? "video" : "voice"}`}>
      {!solo ? <RemoteImage className="call-backdrop" src={faces[0]?.src} alt="" /> : null}
      {peers.map((peer) => <RemoteAudio key={peer.handle} stream={peer.stream} volume={speaker ? 1 : 0} />)}
      {solo ? <StreamVideo className="call-remote on" stream={peers[0].stream} /> : null}
      {anyVideo && !solo && peers.length > 1 ? (
        <div className={`call-grid n${Math.min(peers.length, 6)}`}>
          {peers.map((peer) => (
            <div key={peer.handle} className="call-tile">
              {peer.video ? <StreamVideo stream={peer.stream} /> : <RemoteImage src={peer.src} alt="" />}
              <span>{peer.name.split(" ")[0]}{peer.mic === false ? <MicOff strokeWidth={2.4} /> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
      {!anyVideo || (!solo && peers.length <= 1) ? (
        <div className="call-voice">
          {!connected ? <span className="call-rings" aria-hidden="true"><i /><i /><i /></span> : null}
          {faces.length > 1 ? (
            <span className="call-faces">
              {faces.slice(0, 4).map((face) => <RemoteImage key={face.handle || face.name} src={face.src} alt="" />)}
            </span>
          ) : (
            <RemoteImage src={faces[0]?.src} alt="" />
          )}
          {peers.length === 1 && peers[0].mic === false ? <em><MicOff strokeWidth={2.4} /> {say("Muted", "Microfono spento")}</em> : null}
          {peers.length > 1 ? <em>{peers.map((peer) => peer.name.split(" ")[0]).join(", ")}</em> : null}
        </div>
      ) : null}
      <div className="call-top">
        <button type="button" className="call-min" aria-label={say("Minimise", "Riduci")} onClick={() => live.calls.minimize(true)}>
          <Minimize2 strokeWidth={2} />
        </button>
        <strong>{head.name}</strong>
        <span>{status}</span>
      </div>
      {call.cam ? (
        <div className={`call-self${call.facing === "user" ? " mirror" : ""}`}>
          <StreamVideo stream={call.local} muted />
          <button type="button" className="call-flip" aria-label={say("Flip camera", "Gira fotocamera")} onClick={() => live.calls.flip()}>
            <SwitchCamera strokeWidth={2} />
          </button>
        </div>
      ) : null}
      <div className="call-controls">
        <button type="button" onClick={() => live.calls.toggleMic()} aria-pressed={!call.mic}>
          <i className={!call.mic ? "on" : ""}>{call.mic ? <Mic strokeWidth={2} /> : <MicOff strokeWidth={2} />}</i>
          <span>{say("Mute", "Muto")}</span>
        </button>
        <button type="button" onClick={() => setSpeaker((value) => !value)} aria-pressed={speaker}>
          <i className={speaker ? "on" : ""}><Volume2 strokeWidth={2} /></i>
          <span>{say("Audio", "Audio")}</span>
        </button>
        <button type="button" onClick={() => live.calls.toggleCam()} aria-pressed={call.cam}>
          <i className={call.cam ? "on" : ""}>{call.cam ? <Video strokeWidth={2} /> : <VideoOff strokeWidth={2} />}</i>
          <span>{say("Camera", "Camera")}</span>
        </button>
        <button type="button" className="end" onClick={() => live.calls.hangup()} aria-label={say("End call", "Termina")}>
          <i><PhoneOff strokeWidth={2} /></i>
          <span>{say("End", "Fine")}</span>
        </button>
      </div>
      {notice}
    </div>
  );
}

function LiveToast({ onOpen }) {
  const live = useLive();
  const it = useContext(SpacePrefs).language === "it";
  const toast = live?.toast;
  if (!toast) return null;
  const message = toast.message;
  const group = toast.conv?.kind === "group";
  const text = message.kind === "image" ? (it ? "📷 Foto" : "📷 Photo") : message.kind === "audio" ? (it ? "🎤 Messaggio vocale" : "🎤 Voice message") : message.text;
  return (
    <button
      type="button"
      className="live-toast"
      onClick={() => {
        live.dismissToast();
        onOpen(toast.convId);
      }}
    >
      <RemoteImage className="row-avatar" src={toast.from?.src || avatarFor(toast.from?.name)} alt="" />
      <span className="feed-copy">
        <strong>{group ? `${toast.from?.name?.split(" ")[0]} · ${toast.conv.title}` : toast.from?.name}</strong>
        <span>{text}</span>
      </span>
    </button>
  );
}

function GroupInfo({ thread, onBack, onCall, onLeft, onSearch }) {
  const live = useLive();
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const me = live?.me?.handle;
  const owner = thread.live ? thread.owner === me : true;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.name);
  const [about, setAbout] = useState(thread.about || "");
  const [photo, setPhoto] = useState(thread.photo || "");
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState(() => new Set());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tab, setTab] = useState("members");
  const [note, setNote] = useState("");
  const fileRef = useRef(null);
  const flags = space.dmFlags[thread.id] || {};
  const muted = Boolean(flags.muted);
  const members = thread.live ? thread.conv.members : [{ name: space.profile?.name || say("You", "Tu"), src: AVATAR, me: true }, ...(thread.members || [])];
  const online = thread.live ? members.filter((member) => member.online).length : 0;
  const inGroup = new Set(members.map((member) => member.handle || member.name));
  const candidates = thread.live
    ? Object.values(live.people).filter((person) => person.handle !== me && !inGroup.has(person.handle) && !personHidden(prefs, person.name, true)).map((person) => ({ key: person.handle, name: person.name, src: person.src || avatarFor(person.name), meta: seenText(person, it) }))
    : CONTACTS.filter((person) => !inGroup.has(person.name)).map((person) => ({ key: person.name, name: person.name, src: person.src, meta: person.meta }));
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();
  const link = `space.app/+${String(thread.id).replace(/[^a-z0-9]/gi, "").slice(-10)}`;

  function toast(text) {
    setNote(text);
    window.setTimeout(() => setNote(""), 1600);
  }

  function save() {
    const patch = {};
    if (title.trim() && title.trim() !== thread.name) patch.title = title.trim();
    if (about.trim() !== (thread.about || "")) patch.about = about.trim();
    if (photo !== (thread.photo || "")) patch.photo = photo;
    if (Object.keys(patch).length) {
      if (thread.live) live.updateGroup(thread.id, patch);
      else space.updateThread(thread.id, { ...(patch.title ? { name: patch.title } : {}), ...(patch.about != null ? { about: patch.about } : {}), ...(patch.photo != null ? { photo: patch.photo } : {}) });
      toast(say("Saved", "Salvato"));
    }
    setEditing(false);
  }

  function addPicked() {
    const list = [...toAdd];
    if (!list.length) return;
    if (thread.live) live.updateGroup(thread.id, { add: list });
    else {
      const added = CONTACTS.filter((person) => list.includes(person.name));
      space.updateThread(thread.id, {
        members: [...(thread.members || []), ...added],
        messages: [...(thread.messages || []), { from: "system", text: say(`You added ${added.map((person) => person.name.split(" ")[0]).join(", ")}.`, `Hai aggiunto ${added.map((person) => person.name.split(" ")[0]).join(", ")}.`) }],
      });
    }
    setToAdd(new Set());
    setAdding(false);
    toast(say("Members added", "Membri aggiunti"));
  }

  function remove(member) {
    if (thread.live) live.updateGroup(thread.id, { remove: [member.handle] });
    else space.updateThread(thread.id, { members: (thread.members || []).filter((item) => item.name !== member.name) });
  }

  function onPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const side = 256;
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const scale = Math.max(side / img.width, side / img.height);
        canvas.getContext("2d").drawImage(img, (side - img.width * scale) / 2, (side - img.height * scale) / 2, img.width * scale, img.height * scale);
        setPhoto(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="panel dm dm-page gi">
      <div className="dm-top sub gi-top">
        <button type="button" className="dm-icon" aria-label={say("Back", "Indietro")} onClick={editing ? () => setEditing(false) : onBack}>
          {editing ? <X strokeWidth={2.4} /> : <ChevronLeft strokeWidth={2.4} />}
        </button>
        <div className="dm-who static"><span><strong>{editing ? say("Edit group", "Modifica gruppo") : say("Group info", "Info gruppo")}</strong></span></div>
        {owner ? (
          editing
            ? <button type="button" className="gi-edit" onClick={save} disabled={!title.trim()}>{say("Save", "Salva")}</button>
            : <button type="button" className="gi-edit" onClick={() => { setTitle(thread.name); setAbout(thread.about || ""); setPhoto(thread.photo || ""); setEditing(true); }}>{say("Edit", "Modifica")}</button>
        ) : null}
      </div>
      <div className="panel-scroll">
        {editing ? (
          <div className="gi-editor">
            <button type="button" className="dm-gphoto big" onClick={() => fileRef.current?.click()} aria-label={say("Change photo", "Cambia foto")}>
              <GroupAvatar photo={photo} title={title || thread.name} />
              <i><Camera weight="fill" /></i>
            </button>
            <div className="dm-tones">
              {GROUP_TONES.map((_, index) => (
                <button key={index} type="button" className={photo === `tone:${index}` ? "on" : ""} aria-label={`${say("Colour", "Colore")} ${index + 1}`} onClick={() => setPhoto(`tone:${index}`)}>
                  <GroupAvatar photo={`tone:${index}`} title={title || "?"} />
                </button>
              ))}
            </div>
            <label className="gi-field">
              <em>{say("Name", "Nome")}</em>
              <input value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} aria-label={say("Group name", "Nome del gruppo")} />
            </label>
            <label className="gi-field">
              <em>{say("Description", "Descrizione")}</em>
              <textarea value={about} maxLength={255} rows={3} onChange={(event) => setAbout(event.target.value)} placeholder={say("What is this group about?", "Di cosa parla questo gruppo?")} aria-label={say("Description", "Descrizione")} />
            </label>
            <input ref={fileRef} className="sr" type="file" accept="image/*" onChange={onPhoto} />
          </div>
        ) : (
          <>
            <div className="gi-hero">
              <span className="gi-face"><GroupAvatar photo={thread.photo} title={thread.name} /></span>
              <strong>{thread.name}</strong>
              <em>{members.length} {say("members", "membri")}{thread.live ? `, ${online} online` : ""}</em>
              <div className="gi-actions">
                <button type="button" onClick={() => onCall("voice")}><Phone weight="fill" /><span>{say("Call", "Chiama")}</span></button>
                <button type="button" onClick={() => onCall("video")}><Video weight="fill" /><span>Video</span></button>
                <button type="button" className={muted ? "on" : ""} onClick={() => space.setDmFlag(thread.id, "muted", !muted)}>{muted ? <BellOff weight="fill" /> : <Bell weight="fill" />}<span>{muted ? say("Unmute", "Riattiva") : say("Mute", "Silenzia")}</span></button>
                <button type="button" onClick={onSearch}><Search weight="bold" /><span>{say("Search", "Cerca")}</span></button>
              </div>
            </div>
            <div className="gi-card">
              {thread.about ? (
                <div className="gi-line">
                  <span className="gi-about">{thread.about}</span>
                  <em>{say("Description", "Descrizione")}</em>
                </div>
              ) : owner ? (
                <button type="button" className="gi-line action" onClick={() => setEditing(true)}><span>{say("Add a description", "Aggiungi una descrizione")}</span></button>
              ) : null}
              <button type="button" className="gi-line" onClick={() => { navigator.clipboard?.writeText(`https://${link}`).catch(() => {}); toast(say("Invite link copied", "Link di invito copiato")); }}>
                <span className="gi-link">{link}</span>
                <em>{say("Invite link · tap to copy", "Link di invito · tocca per copiare")}</em>
              </button>
            </div>
          </>
        )}
        {!editing ? (
          <>
            <ChatPrefs id={thread.id} />
            <div className="gi-tabs" role="tablist">
              {[["members", say("Members", "Membri")], ["media", "Media"], ["voice", say("Voice", "Vocali")]].map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>
              ))}
              <i className="gi-tabs-bar" style={{ "--n": ["members", "media", "voice"].indexOf(tab) }} />
            </div>
            {tab === "members" ? (
              <div className="gi-members">
                {owner ? (
                  <button type="button" className="gi-add" onClick={() => setAdding((value) => !value)}>
                    <i><UserPlus weight="bold" /></i>{say("Add members", "Aggiungi membri")}
                  </button>
                ) : null}
                {adding ? (
                  <div className="gi-adding">
                    {candidates.length ? candidates.map((person) => {
                      const on = toAdd.has(person.key);
                      return (
                        <button key={person.key} type="button" className={`dm-check-row${on ? " on" : ""}`} onClick={() => setToAdd((prev) => { const next = new Set(prev); if (next.has(person.key)) next.delete(person.key); else next.add(person.key); return next; })}>
                          <span className="dm-check-face"><RemoteImage src={person.src} alt="" /><i className="dm-check-mark">{on ? <Check weight="bold" /> : null}</i></span>
                          <span><strong>{person.name}</strong><em>{person.meta}</em></span>
                        </button>
                      );
                    }) : <p className="dm-note-hint">{say("Everyone is already here.", "Ci sono già tutti.")}</p>}
                    {toAdd.size ? <button type="button" className="ig-btn primary gi-add-go" onClick={addPicked}>{say(`Add ${toAdd.size}`, `Aggiungi ${toAdd.size}`)}</button> : null}
                  </div>
                ) : null}
                {[...members].sort((x, y) => Number(Boolean(y.online)) - Number(Boolean(x.online))).map((member) => {
                  const isMe = member.me || (member.handle && member.handle === me);
                  const isOwner = thread.live ? member.handle === thread.owner : member.me;
                  return (
                    <div key={member.handle || member.name} className="dm-check-row static gi-member">
                      <span className="dm-check-face">
                        <RemoteImage src={member.src || avatarFor(member.name)} alt="" />
                        {member.online ? <i className="online-dot" /> : null}
                      </span>
                      <span>
                        <strong>{isMe ? `${member.name} (${say("you", "tu")})` : member.name}</strong>
                        <em className={member.online ? "on" : ""}>{thread.live ? (member.online ? "online" : seenText(member, it)) : (member.meta || "")}</em>
                      </span>
                      {isOwner ? <b className="gi-role">{say("owner", "proprietario")}</b> : owner && !isMe ? (
                        <button type="button" className="dm-icon gi-remove" aria-label={`${say("Remove", "Rimuovi")} ${member.name}`} onClick={() => remove(member)}><UserMinus strokeWidth={2} /></button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {tab === "media" ? (
              media.length ? (
                <div className="gi-media">{media.map((src, index) => <img key={`${index}-${String(src).slice(-16)}`} src={src} alt="" />)}</div>
              ) : <p className="tcd-empty">{say("No photos shared yet.", "Ancora nessuna foto condivisa.")}</p>
            ) : null}
            {tab === "voice" ? (
              voices.length ? (
                <div className="gi-voices">{voices.map((message, index) => <div key={message.id || index} className="gi-voice"><VoiceBubble message={message} /><em>{message.senderName || ""} · {message.time}</em></div>)}</div>
              ) : <p className="tcd-empty">{say("No voice messages yet.", "Ancora nessun messaggio vocale.")}</p>
            ) : null}
            <div className="gi-card danger">
              {thread.live ? (
                <button type="button" className="gi-line danger" onClick={() => setConfirmLeave(true)}><span><LogOut strokeWidth={2} />{say("Leave group", "Esci dal gruppo")}</span></button>
              ) : (
                <p className="dm-note-hint">{say("Demo group: stored on this device only.", "Gruppo demo: salvato solo su questo dispositivo.")}</p>
              )}
            </div>
          </>
        ) : null}
      </div>
      {note ? <p className="gi-toast">{note}</p> : null}
      {confirmLeave ? (
        <div className="ps-sheet-wrap" onClick={() => setConfirmLeave(false)}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            <p className="dm-note-hint center">{say("Leave this group? You won't get its messages anymore.", "Uscire dal gruppo? Non riceverai più i suoi messaggi.")}</p>
            <button type="button" className="danger" onClick={() => { live.leaveGroup(thread.id); onLeft(); }}><LogOut strokeWidth={2} />{say("Leave group", "Esci dal gruppo")}</button>
            <button type="button" className="warn" onClick={() => setConfirmLeave(false)}>{say("Cancel", "Annulla")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const WALLPAPERS = [
  { id: "sky", en: "Sky", it: "Cielo" },
  { id: "night", en: "Night", it: "Notte" },
  { id: "peach", en: "Peach", it: "Pesca" },
  { id: "mint", en: "Mint", it: "Menta" },
  { id: "lavender", en: "Lavender", it: "Lavanda" },
  { id: "plain", en: "Plain", it: "Semplice" },
];

// Per-chat settings shared by chat info and group info: notifications, pin, wallpaper.
function ChatPrefs({ id }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const flags = space.dmFlags[id] || {};
  const [walls, setWalls] = useState(false);
  const wall = flags.wall || "sky";
  return (
    <div className="gi-card gi-prefs">
      <ToggleCell on={!flags.muted} icon={<Bell weight="fill" />} tone="red" label={say("Notifications", "Notifiche")} onClick={() => space.setDmFlag(id, "muted", !flags.muted)} />
      <ToggleCell on={Boolean(flags.pinned)} icon={<Pin weight="fill" />} tone="green" label={say("Pin chat", "Fissa la chat")} onClick={() => space.setDmFlag(id, "pinned", !flags.pinned)} />
      <button type="button" className="tg-cell" onClick={() => setWalls((value) => !value)}>
        <i className="tg-ico blue"><Image weight="fill" /></i>
        <span><strong>{say("Chat wallpaper", "Sfondo della chat")}</strong></span>
        <em className="tg-cell-value">{WALLPAPERS.find((item) => item.id === wall)?.[it ? "it" : "en"]}</em>
        <ChevronRight strokeWidth={2.4} className={`tg-cell-chev${walls ? " open" : ""}`} />
      </button>
      {walls ? (
        <div className="gi-walls">
          {WALLPAPERS.map((item) => (
            <button key={item.id} type="button" className={wall === item.id ? "on" : ""} onClick={() => space.setDmFlag(id, "wall", item.id)}>
              <span className={`dm-wall w-${item.id}`}><i className="mine" /><i className="theirs" /></span>
              <em>{item[it ? "it" : "en"]}</em>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChatInfo({ thread, person, onBack, onCall, onSearch, onProfile, onDelete }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const flags = space.dmFlags[thread.id] || {};
  const [tab, setTab] = useState("media");
  const [confirm, setConfirm] = useState(null);
  const [note, setNote] = useState("");
  const status = thread.live
    ? (prefs.activity === false ? "" : thread.online ? say("online", "online") : seenText(thread.other, it))
    : (prefs.activity === false ? "" : say("last seen recently", "visto di recente"));
  const handle = person?.handle ? `@${String(person.handle).replace(/^@/, "")}` : "";
  const media = (thread.messages || []).filter((message) => message.kind === "image" && !message.unsent).map((message) => message.image).reverse();
  const voices = (thread.messages || []).filter((message) => message.kind === "audio" && !message.unsent).reverse();

  function toast(text) {
    setNote(text);
    window.setTimeout(() => setNote(""), 1600);
  }

  return (
    <div className="panel dm dm-page gi ci">
      <div className="dm-top sub gi-top">
        <button type="button" className="dm-icon" aria-label={say("Back", "Indietro")} onClick={onBack}><ChevronLeft strokeWidth={2.4} /></button>
        <div className="dm-who static"><span><strong>{say("Info", "Info")}</strong></span></div>
      </div>
      <div className="panel-scroll">
        <div className="gi-hero">
          <span className="gi-face ci-face">
            <RemoteImage src={thread.src} alt="" />
            {thread.online && prefs.activity !== false ? <i className="online-dot" /> : null}
          </span>
          <strong>{thread.name}</strong>
          {status ? <em className={thread.online ? "on" : ""}>{status}</em> : null}
          <div className="gi-actions">
            <button type="button" onClick={() => onCall("voice")}><Phone weight="fill" /><span>{say("Call", "Chiama")}</span></button>
            <button type="button" onClick={() => onCall("video")}><Video weight="fill" /><span>Video</span></button>
            <button type="button" className={flags.muted ? "on" : ""} onClick={() => space.setDmFlag(thread.id, "muted", !flags.muted)}>{flags.muted ? <BellOff weight="fill" /> : <Bell weight="fill" />}<span>{flags.muted ? say("Unmute", "Riattiva") : say("Mute", "Silenzia")}</span></button>
            <button type="button" onClick={onSearch}><Search weight="bold" /><span>{say("Search", "Cerca")}</span></button>
          </div>
        </div>
        <div className="gi-card">
          {person?.bio ? (
            <div className="gi-line"><span className="gi-about">{person.bio}</span><em>Bio</em></div>
          ) : null}
          {handle ? (
            <button type="button" className="gi-line" onClick={() => { navigator.clipboard?.writeText(handle).catch(() => {}); toast(say("Username copied", "Nome utente copiato")); }}>
              <span className="gi-link">{handle}</span><em>{say("Username", "Nome utente")}</em>
            </button>
          ) : null}
          {person?.craft ? (
            <div className="gi-line"><span className="gi-about">{person.craft}{person.city ? ` · ${person.city}` : ""}</span><em>{say("Craft", "Mestiere")}</em></div>
          ) : null}
          {person && !person.live ? (
            <button type="button" className="gi-line action" onClick={() => onProfile(person)}><span>{say("View profile", "Visualizza profilo")}</span></button>
          ) : null}
        </div>
        <ChatPrefs id={thread.id} />
        <div className="gi-tabs two" role="tablist">
          {[["media", "Media"], ["voice", say("Voice", "Vocali")]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
          <i className="gi-tabs-bar" style={{ "--n": tab === "media" ? 0 : 1 }} />
        </div>
        {tab === "media" ? (
          media.length ? <div className="gi-media">{media.map((src, index) => <img key={`${index}-${String(src).slice(-16)}`} src={src} alt="" />)}</div> : <p className="tcd-empty">{say("No photos shared yet.", "Ancora nessuna foto condivisa.")}</p>
        ) : (
          voices.length ? <div className="gi-voices">{voices.map((message, index) => <div key={message.id || index} className="gi-voice"><VoiceBubble message={message} /><em>{message.from === "me" ? say("You", "Tu") : thread.name} · {message.time}</em></div>)}</div> : <p className="tcd-empty">{say("No voice messages yet.", "Ancora nessun messaggio vocale.")}</p>
        )}
        <div className="gi-card danger">
          <button type="button" className="gi-line" onClick={() => { space.setDmFlag(thread.id, "archivedAt", flags.archivedAt ? null : Date.now()); toast(flags.archivedAt ? say("Moved back to chats", "Riportata nelle chat") : say("Chat archived", "Chat archiviata")); }}>
            <span className="gi-plain"><Archive strokeWidth={2} />{flags.archivedAt ? say("Unarchive chat", "Ripristina chat") : say("Archive chat", "Archivia chat")}</span>
          </button>
          {!thread.live ? (
            <button type="button" className="gi-line danger" onClick={() => setConfirm("clear")}><span><Eraser strokeWidth={2} />{say("Clear history", "Svuota cronologia")}</span></button>
          ) : null}
          <button type="button" className="gi-line danger" onClick={() => setConfirm("delete")}><span><Trash strokeWidth={2} />{say("Delete chat", "Elimina chat")}</span></button>
        </div>
      </div>
      {note ? <p className="gi-toast">{note}</p> : null}
      {confirm ? (
        <div className="ps-sheet-wrap" onClick={() => setConfirm(null)}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            <p className="dm-note-hint center">
              {confirm === "clear"
                ? say(`Clear all messages with ${thread.name}? This can't be undone.`, `Svuotare tutti i messaggi con ${thread.name}? Non si può annullare.`)
                : say(`Delete the chat with ${thread.name}?`, `Eliminare la chat con ${thread.name}?`)}
            </p>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (confirm === "clear") {
                  space.updateThread(thread.id, { messages: [], preview: "", unread: false, cleared: true });
                  setConfirm(null);
                  toast(say("History cleared", "Cronologia svuotata"));
                } else onDelete();
              }}
            >
              {confirm === "clear" ? <Eraser strokeWidth={2} /> : <Trash strokeWidth={2} />}
              {confirm === "clear" ? say("Clear history", "Svuota cronologia") : say("Delete chat", "Elimina chat")}
            </button>
            <button type="button" className="warn" onClick={() => setConfirm(null)}>{say("Cancel", "Annulla")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DM_REACTIONS = ["❤️", "😂", "😮", "😢", "😡", "👍"];
const DM_NOTES = {
  "Marta Colle": "Forno acceso 🔥",
  "Leo Bassi": "Cremona fino a domenica",
  "Adele Romano": "🎶 Telaio",
  "Chiara Valli": "Chi viene al mercato?",
  "Nico Serra": "Smalti nuovi in arrivo",
};

function onlyEmoji(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 16) return false;
  return /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(value) && /\p{Extended_Pictographic}/u.test(value);
}

function reactionGroups(reactions) {
  const groups = new Map();
  for (const emoji of Object.values(reactions || {})) groups.set(emoji, (groups.get(emoji) || 0) + 1);
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

// One inbox row: tap to open, swipe left for actions, long-press for the menu.
function DmRow({ className, onOpen, onLongPress, actions, children, label }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState(false);
  const state = useRef({ x: 0, y: 0, drag: false, open: false, timer: 0, long: false, id: null });
  useEffect(() => {
    if (dx) {
      setShown(true);
      return undefined;
    }
    const id = window.setTimeout(() => setShown(false), 400);
    return () => window.clearTimeout(id);
  }, [dx]);
  const actionsRef = useRef(null);
  const width = () => actionsRef.current?.offsetWidth || 150;

  function close() {
    state.current.open = false;
    setDx(0);
  }

  return (
    <div className={`dm-row-wrap${dragging ? " dragging" : ""}${shown ? " shown" : ""}`}>
      <div className="dm-row-actions" ref={actionsRef}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={action.className}
            tabIndex={dx ? 0 : -1}
            onClick={() => {
              close();
              action.run();
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        className={`dm-row ${className || ""}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.button > 0) return;
          const s = state.current;
          s.x = event.clientX;
          s.y = event.clientY;
          s.drag = false;
          s.long = false;
          s.id = event.pointerId;
          window.clearTimeout(s.timer);
          s.timer = window.setTimeout(() => {
            s.long = true;
            navigator.vibrate?.(8);
            onLongPress();
          }, 480);
        }}
        onPointerMove={(event) => {
          const s = state.current;
          if (s.id !== event.pointerId) return;
          const mx = event.clientX - s.x;
          const my = event.clientY - s.y;
          if (!s.drag) {
            if (Math.abs(my) > 8) window.clearTimeout(s.timer);
            if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.4) {
              s.drag = true;
              window.clearTimeout(s.timer);
              event.currentTarget.setPointerCapture?.(event.pointerId);
              setDragging(true);
            } else return;
          }
          const base = s.open ? -width() : 0;
          const next = Math.min(0, base + mx);
          setDx(next < -width() ? -width() + (next + width()) * 0.3 : next);
        }}
        onPointerUp={(event) => {
          const s = state.current;
          if (s.id !== event.pointerId) return;
          s.id = null;
          window.clearTimeout(s.timer);
          if (s.drag) {
            setDragging(false);
            const open = dx < -width() / 2.4;
            s.open = open;
            setDx(open ? -width() : 0);
            return;
          }
          if (s.long) return;
          if (s.open) {
            close();
            return;
          }
          onOpen();
        }}
        onPointerCancel={() => {
          const s = state.current;
          s.id = null;
          window.clearTimeout(s.timer);
          setDragging(false);
          setDx(s.open ? -width() : 0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

// A chat bubble with Instagram gestures: double-tap to like, swipe right to reply, hold for the menu.
function highlight(text, query) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const out = [];
  let at = 0;
  let found = lower.indexOf(query, at);
  while (found >= 0) {
    if (found > at) out.push(text.slice(at, found));
    out.push(<mark key={found}>{text.slice(found, found + query.length)}</mark>);
    at = found + query.length;
    found = lower.indexOf(query, at);
  }
  out.push(text.slice(at));
  return out;
}

function BubbleMeta({ message, mine, tick, it }) {
  return (
    <span className="dm-meta">
      {message.edited ? <em>{it ? "modificato" : "edited"}</em> : null}
      <time>{message.time || ""}</time>
      {mine ? (
        tick === "pending" ? <Clock weight="bold" /> : tick === "read" ? <CheckCheck weight="bold" className="read" /> : tick === "failed" ? null : <Check weight="bold" />
      ) : null}
    </span>
  );
}

function DmBubble({ message, mine, first, last, showName, nameOf, onZoom, onCall, onRetry, onDiscard, onReact, onReply, onMenu, myKey, tick, query, flash }) {
  const it = useContext(SpacePrefs).language === "it";
  const [pull, setPull] = useState(0);
  const g = useRef({ x: 0, y: 0, id: null, drag: false, long: false, timer: 0, lastTap: 0, tapTimer: 0 });
  const kind = message.kind || "text";
  const ref = useRef(null);

  if (message.from === "system") return <p className="dm-system">{message.text}</p>;

  if (kind === "call") {
    const video = message.call === "video";
    const missed = !message.duration;
    const label = video ? (it ? "Videochiamata" : "Video call") : (it ? "Chiamata vocale" : "Voice call");
    const detail = missed
      ? (mine
        ? (message.reason === "declined" ? (it ? "Rifiutata" : "Declined") : message.reason === "busy" ? (it ? "Occupato" : "Busy") : message.reason === "cancelled" ? (it ? "Annullata" : "Cancelled") : (it ? "Nessuna risposta" : "No answer"))
        : (it ? "Persa · Tocca per richiamare" : "Missed · Tap to call back"))
      : callStamp(message.duration);
    return (
      <button type="button" className={`dm-call${mine ? " me" : ""}${missed ? " miss" : ""}`} onClick={() => onCall?.(video ? "video" : "voice")}>
        <i>{video ? <Video weight="fill" /> : <Phone weight="fill" />}</i>
        <span>
          <strong>{label}</strong>
          <em>{detail}</em>
        </span>
      </button>
    );
  }

  const jumbo = kind === "text" && onlyEmoji(message.text);
  const bare = kind === "image" && !message.text;
  const failed = message.status === "failed";
  const pending = !message.id && message.status === "pending";
  const groups = reactionGroups(message.reactions);
  const mineReacted = message.reactions?.[myKey];
  const quote = message.reply;

  function down(event) {
    if (event.button > 0) return;
    const s = g.current;
    s.x = event.clientX;
    s.y = event.clientY;
    s.id = event.pointerId;
    s.drag = false;
    s.long = false;
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      s.long = true;
      navigator.vibrate?.(10);
      onMenu(ref.current?.getBoundingClientRect());
    }, 420);
  }
  function move(event) {
    const s = g.current;
    if (s.id !== event.pointerId) return;
    const mx = event.clientX - s.x;
    const my = event.clientY - s.y;
    if (!s.drag) {
      if (Math.abs(mx) > 6 || Math.abs(my) > 6) window.clearTimeout(s.timer);
      if (mx > 10 && Math.abs(mx) > Math.abs(my) * 1.5) {
        s.drag = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else return;
    }
    const value = Math.max(0, Math.min(90, mx * 0.6));
    if (value >= 56 && pull < 56) navigator.vibrate?.(6);
    setPull(value);
  }
  function up(event) {
    const s = g.current;
    if (s.id !== event.pointerId) return;
    s.id = null;
    window.clearTimeout(s.timer);
    if (s.drag) {
      if (pull >= 56) onReply();
      setPull(0);
      return;
    }
    if (s.long) return;
    const now = Date.now();
    if (now - s.lastTap < 300) {
      s.lastTap = 0;
      window.clearTimeout(s.tapTimer);
      onReact(mineReacted === "❤️" ? null : "❤️", true);
      return;
    }
    s.lastTap = now;
    if (kind === "image") {
      window.clearTimeout(s.tapTimer);
      s.tapTimer = window.setTimeout(() => onZoom(message.image), 300);
    }
  }

  return (
    <div className={`dm-msg ${mine ? "me" : "them"}${first ? " first" : ""}${last ? " last" : ""}${groups.length ? " reacted" : ""}`}>
      {showName && !mine && first ? <span className="dm-name">{message.senderName}</span> : null}
      {quote ? (
        <div className="dm-quote">
          <span className="dm-quote-label"><Reply weight="bold" />{nameOf(quote, mine)}</span>
          <p>{quote.text || (quote.kind === "image" ? (it ? "Foto" : "Photo") : quote.kind === "audio" ? (it ? "Messaggio vocale" : "Voice message") : "…")}</p>
        </div>
      ) : null}
      <div className="dm-swipe" style={{ transform: pull ? `translateX(${pull}px)` : undefined, transition: pull ? "none" : undefined }}>
        <i className="dm-reply-hint" style={{ opacity: Math.min(1, pull / 56), transform: `scale(${0.6 + Math.min(1, pull / 56) * 0.4})` }}><Reply weight="bold" /></i>
        <div
          ref={ref}
          className={`dm-bubble ${kind}${jumbo ? " jumbo" : ""}${bare ? " bare" : ""}${failed ? " failed" : ""}${pending ? " pending" : ""}${flash ? " flash" : ""}${message.fwd ? " fwd" : ""}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { g.current.id = null; window.clearTimeout(g.current.timer); setPull(0); }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {message.fwd ? <span className="dm-fwd"><Forward weight="fill" />{it ? "Inoltrato da" : "Forwarded from"} <b>{message.fwd.name}</b></span> : null}
          {kind === "image" ? <img src={message.image} alt="" draggable="false" /> : null}
          {kind === "audio" ? <VoiceBubble message={message} /> : null}
          {kind !== "audio" && message.text ? <span className="dm-text">{query ? highlight(message.text, query) : <RichText text={message.text} />}{jumbo ? null : <i className={`dm-meta-space${message.edited ? " wide" : ""}`} />}</span> : null}
          {jumbo ? null : <BubbleMeta message={message} mine={mine} tick={tick} it={it} />}
        </div>
      </div>
      {groups.length ? (
        <button type="button" className="dm-reacts" onClick={() => (mineReacted ? onReact(null) : onMenu(ref.current?.getBoundingClientRect()))}>
          {groups.slice(0, 3).map(([emoji]) => <span key={emoji}>{emoji}</span>)}
          {Object.keys(message.reactions).length > 1 ? <b>{Object.keys(message.reactions).length}</b> : null}
        </button>
      ) : null}
      {failed ? (
        <span className="dm-failed">
          {it ? "Non inviato" : "Not sent"}
          <button type="button" onClick={onRetry}>{it ? "Riprova" : "Retry"}</button>
          <button type="button" onClick={onDiscard}>{it ? "Elimina" : "Delete"}</button>
        </span>
      ) : null}
    </div>
  );
}

function Messages({ request, onOpenPerson }) {
  const space = useSpace();
  const live = useLive();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const me = live?.me?.handle;
  const receipts = prefs.readReceipts !== false;
  const liveThreads = live
    ? Object.values(live.convs)
      .map((conv) => liveThread(conv, me, it, live.typing))
      .filter((item) => item.group || !personHidden(prefs, item.name, true))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];
  const [demoTyping, setDemoTyping] = useState({});
  const threads = [...liveThreads, ...space.threads.map((item) => (demoTyping[item.id] ? { ...item, typing: [item.name.split(" ")[0]] } : item))];
  const [mode, setMode] = useState("inbox");
  const [openId, setOpenId] = useState(null);
  const [info, setInfo] = useState(false);
  const [paneOut, setPaneOut] = useState(false);
  const [query, setQuery] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [tray, setTray] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [rec, setRec] = useState(null);
  const [hint, setHint] = useState("");
  const [now, setNow] = useState(0);
  const [box, setBox] = useState("chats");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [groupStep, setGroupStep] = useState("members");
  const [groupAbout, setGroupAbout] = useState("");
  const [groupPhoto, setGroupPhoto] = useState("");
  const [photoPick, setPhotoPick] = useState(false);
  const groupFileRef = useRef(null);
  const [folder, setFolder] = useState("all");
  const [selecting, setSelecting] = useState(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const [folderEdit, setFolderEdit] = useState(null);
  const [folderDir, setFolderDir] = useState(0);
  const [settled, setSettled] = useState(false);
  const inboxScroll = useRef(null);
  const tabsAnchor = useRef(null);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), 900);
    return () => window.clearTimeout(id);
  }, []);
  const [editing, setEditing] = useState(null);
  const [forwarding, setForwarding] = useState(null);
  const [forwardQuery, setForwardQuery] = useState("");
  const [finding, setFinding] = useState(null);
  const [flashKey, setFlashKey] = useState(null);
  const [focus, setFocus] = useState(null);
  const [pop, setPop] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [below, setBelow] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const nearEnd = useRef(true);
  const fileRef = useRef(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelRef = useRef(false);
  const originRef = useRef(0);
  const startedRef = useRef(0);
  const thread = threads.find((item) => item.id === openId);
  const needle = query.trim().toLowerCase();
  const peopleNeedle = peopleQuery.trim().toLowerCase();
  const visible = threads.filter((item) => {
    const kinds = (item.messages || []).map((message) => message.kind || "").join(" ");
    const blob = `${item.name} ${item.kind} ${item.preview} ${(item.messages || []).map((message) => message.text || "").join(" ")} ${kinds} ${kinds.includes("image") ? "photo foto" : ""} ${kinds.includes("audio") ? "voice vocale audio" : ""} ${kinds.includes("call") ? "call chiamata video" : ""} ${(item.members || []).map((member) => member.name).join(" ")}`.toLowerCase();
    return (!item.live && !item.members && personHidden(prefs, item.name, true)) ? false : (!needle || blob.includes(needle));
  });
  const livePeople = live
    ? Object.values(live.people)
      .filter((person) => person.handle !== me && !personHidden(prefs, person.name, true))
      .filter((person) => !peopleNeedle || `${person.name} ${person.handle}`.toLowerCase().includes(peopleNeedle))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name))
    : [];
  const people = CONTACTS.filter((person) => {
    const blob = `${person.name} ${person.meta}`.toLowerCase();
    return !personHidden(prefs, person.name, true) && (!peopleNeedle || blob.includes(peopleNeedle));
  });
  const lastKey = thread?.messages.length ? (thread.messages[thread.messages.length - 1].id || thread.messages[thread.messages.length - 1].clientId || thread.messages.length) : 0;

  function markRead(id) {
    const item = threads.find((entry) => entry.id === id);
    if (item && !item.live && item.unread) space.markThreadRead(id);
  }

  function openThread(id) {
    setEditing(null);
    setFinding(null);
    setForwarding(null);
    setReplyTo(null);
    setFocus(null);
    setEmojiOpen(false);
    setPaneOut(false);
    setOpenId(id);
    setInfo(false);
    setMode("inbox");
    setDraft("");
    setTray(false);
    setZoom(null);
    setRec(null);
    markRead(id);
  }

  useEffect(() => {
    if (request?.compose) {
      setPaneOut(false);
      setOpenId(null);
      setMode("new");
      setPeopleQuery("");
      return;
    }
    if (request?.convId) openThread(request.convId);
    if (request?.dm && live) {
      live.openDm(request.dm)
        .then((id) => {
          openThread(id);
          if (request.text) setDraft(request.text);
        })
        .catch(() => flash(say("Live chat is offline. Try again.", "Chat live non raggiungibile. Riprova.")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.n]);

  // Reads are sent only while a live chat is really on screen.
  useEffect(() => {
    if (!live || !thread?.live || info) return undefined;
    live.setViewing(thread.id);
    return () => live.setViewing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.live, info, live?.setViewing]);

  useEffect(() => {
    if (thread?.live && thread.unread) live.markRead(thread.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id, thread?.unread]);

  // Open at the latest message; follow new ones only when already at the bottom.
  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
    nearEnd.current = true;
    setBelow(false);
    setUnseen(0);
  }, [openId]);

  // Photos load after the first paint: keep the bottom pinned while they grow the transcript.
  const hasThread = Boolean(thread) && !info;
  useEffect(() => {
    const el = scrollRef.current;
    const inner = el?.firstElementChild;
    if (!el || !inner || !window.ResizeObserver) return undefined;
    const pin = () => {
      if (nearEnd.current) el.scrollTop = el.scrollHeight;
    };
    pin();
    const observer = new ResizeObserver(pin);
    observer.observe(inner);
    observer.observe(el);
    return () => observer.disconnect();
  }, [openId, hasThread]);

  const lastMineKey = thread?.messages.length && thread.messages[thread.messages.length - 1].from === "me";
  useEffect(() => {
    if (!thread) return;
    if (nearEnd.current || lastMineKey) {
      endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
      setUnseen(0);
    } else setUnseen((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastKey]);

  useEffect(() => {
    if (nearEnd.current) endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [tray, emojiOpen, replyTo, thread?.typing?.length]);

  function onChatScroll(event) {
    const el = event.currentTarget;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    nearEnd.current = near;
    setBelow(!near && el.scrollHeight - el.scrollTop - el.clientHeight > 320);
    if (near) setUnseen(0);
  }

  useEffect(() => {
    if (!rec) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [rec]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // A live chat that disappears (removed from the group) closes itself.
  useEffect(() => {
    if (openId && !thread && !paneOut) setPaneOut(true);
  }, [openId, thread, paneOut]);

  function closePane() {
    if (!openId && mode === "inbox") return;
    setPaneOut(true);
  }

  function finishPane() {
    setOpenId(null);
    setInfo(false);
    setMode("inbox");
    setPeopleQuery("");
    setPaneOut(false);
  }

  function flash(text) {
    setHint(text);
    window.setTimeout(() => setHint(""), 2200);
  }

  function startChat(person) {
    const id = space.ensureChat(person);
    setPeopleQuery("");
    setQuery("");
    openThread(id);
  }

  function startLiveChat(person) {
    if (busy) return;
    setBusy(true);
    live.openDm(person.handle)
      .then((id) => {
        setPeopleQuery("");
        setQuery("");
        openThread(id);
      })
      .catch(() => flash(say("Live chat is offline. Try again.", "Chat live non raggiungibile. Riprova.")))
      .finally(() => setBusy(false));
  }

  function togglePerson(key) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const pickedLive = [...picked].filter((key) => key.startsWith("live:")).map((key) => key.slice(5));
  const pickedDemo = [...picked].filter((key) => key.startsWith("demo:")).map((key) => key.slice(5));
  const mixed = pickedLive.length > 0 && pickedDemo.length > 0;

  function resetGroup() {
    setGroupStep("members");
    setGroupAbout("");
    setGroupPhoto("");
    setPhotoPick(false);
  }

  function onGroupPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const side = 256;
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const scale = Math.max(side / img.width, side / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        canvas.getContext("2d").drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
        setGroupPhoto(canvas.toDataURL("image/jpeg", 0.82));
        setPhotoPick(false);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function createGroup() {
    const name = groupName.trim();
    if (!name || mixed) return;
    if (pickedLive.length) {
      if (busy) return;
      setBusy(true);
      live.createGroup(name, pickedLive, { about: groupAbout.trim(), photo: groupPhoto })
        .then((id) => {
          resetGroup();
          setGroupName("");
          setPicked(new Set());
          setPeopleQuery("");
          setQuery("");
          openThread(id);
        })
        .catch(() => flash(say("Couldn't create the group. Try again.", "Impossibile creare il gruppo. Riprova.")))
        .finally(() => setBusy(false));
      return;
    }
    const members = CONTACTS.filter((person) => pickedDemo.includes(person.name));
    if (members.length < 2) return;
    const id = `g-${Date.now().toString(36)}`;
    space.createGroup({
      id,
      name,
      kind: "Gruppo",
      preview: members.map((member) => member.name.split(" ")[0]).join(", "),
      time: "Now",
      unread: false,
      src: members[0].src,
      members,
      photo: groupPhoto || `tone:${Math.floor(Math.random() * GROUP_TONES.length)}`,
      about: groupAbout.trim(),
      messages: [{ from: "system", text: say(`You created the group “${name}”.`, `Hai creato il gruppo «${name}».`) }],
    });
    resetGroup();
    setGroupName("");
    setPicked(new Set());
    setPeopleQuery("");
    setQuery("");
    openThread(id);
  }

  function previewOf(item) {
    if (item.typing?.length) return { icon: null, text: say("typing…", "sta scrivendo…"), typing: true };
    const last = item.messages?.[item.messages.length - 1];
    const mine = last?.from === "me" ? say("You: ", "Tu: ") : item.group && last?.from === "them" ? `${last.senderName.split(" ")[0]}: ` : "";
    if (!last) return { icon: null, text: item.preview };
    if (last.from === "system") return { icon: null, text: last.text || item.preview };
    if (last.kind === "image") return { icon: Image, text: `${mine}${last.text || say("Photo", "Foto")}` };
    if (last.kind === "audio") return { icon: Mic, text: `${mine}${say("Voice message", "Messaggio vocale")}` };
    if (last.kind === "call") {
      const label = last.call === "video" ? say("Video call", "Videochiamata") : say("Voice call", "Chiamata");
      const detail = last.duration ? callStamp(last.duration) : last.from === "me" ? say("No answer", "Nessuna risposta") : say("Missed", "Persa");
      return { icon: last.call === "video" ? Video : Phone, text: `${label} · ${detail}` };
    }
    return { icon: null, text: `${mine}${last.text || item.preview}` };
  }

  function sendTo(target, payload) {
    if (!target) return;
    if (target.live) live.send(target.id, payload);
    else space.sendMessage(target.id, payload);
  }

  function deliver(payload) {
    if (!thread) return;
    if (typeof payload !== "string" && payload.kind === "text" && textHidden(prefs, payload.text)) {
      flash(say("This message contains a hidden word.", "Il messaggio contiene una parola nascosta."));
      return;
    }
    sendTo(thread, payload);
    setDraft("");
    setTray(false);
    if (!thread.live && !thread.members) answerLater(thread, payload);
  }

  // Demo contacts write back, so the chat feels alive without a second account.
  const viewingRef = useRef(null);
  viewingRef.current = openId;
  const answered = useRef({});
  function answerLater(target, payload) {
    const id = target.id;
    if (answered.current[id]) return;
    answered.current[id] = true;
    const text = typeof payload === "string" ? payload : payload.text || "";
    const replies = payload.kind === "image"
      ? ["Che bello! 😍", "Wow, si vede benissimo il lavoro.", "Mandamene altre 📸"]
      : payload.kind === "audio"
        ? ["Ascoltato! Ti rispondo dal laboratorio 🎧", "Perfetto, ci sentiamo dopo."]
        : /\?\s*$/.test(text)
          ? ["Sì, certo! Passa quando vuoi.", "Domani mattina va benissimo.", "Credo di sì, ti confermo stasera."]
          : ["Perfetto 🙌", "Ahah sì!", "Grazie! ❤️", "Ci vediamo in laboratorio.", "Ottimo, allora siamo d'accordo."];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    window.setTimeout(() => setDemoTyping((prev) => ({ ...prev, [id]: true })), 900);
    window.setTimeout(() => {
      setDemoTyping((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      space.receiveMessage(id, reply, viewingRef.current === id);
      sounds.message?.();
      window.setTimeout(() => { answered.current[id] = false; }, 4000);
    }, 900 + 1400 + reply.length * 40);
  }

  function sendPhoto(src) {
    if (src) deliver({ kind: "image", image: src });
  }

  function onLibrary(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      flash(say("Choose a photo.", "Scegli una foto."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let quality = 0.82;
        let url = canvas.toDataURL("image/jpeg", quality);
        while (url.length > 850_000 && quality > 0.4) {
          quality -= 0.12;
          url = canvas.toDataURL("image/jpeg", quality);
        }
        sendPhoto(url);
      };
      img.onerror = () => flash(say("This photo can't be opened.", "Impossibile aprire la foto."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function beginRec(event) {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    originRef.current = event.clientX;
    cancelRef.current = false;
    startedRef.current = Date.now();
    chunksRef.current = [];
    setHint("");
    setRec({ cancel: false });
    navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
      if (cancelRef.current === "done") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!window.MediaRecorder) return;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : undefined);
      recorder.ondataavailable = (item) => {
        if (item.data?.size) chunksRef.current.push(item.data);
      };
      recorder.start();
      recRef.current = recorder;
    }).catch(() => {
      recRef.current = null;
    });
  }

  function moveRec(event) {
    if (!startedRef.current) return;
    const cancel = originRef.current - event.clientX > 72;
    cancelRef.current = cancel;
    setRec((prev) => (prev ? { cancel } : prev));
  }

  function endRec() {
    if (!startedRef.current || !thread) return;
    const held = Date.now() - startedRef.current;
    const cancel = cancelRef.current === true || held < 450;
    const target = thread;
    const duration = Math.max(1, Math.min(120, Math.round(held / 1000)));
    startedRef.current = 0;
    cancelRef.current = "done";
    setRec(null);
    if (held < 450) flash(say("Hold to record", "Tieni premuto"));
    const recorder = recRef.current;
    const finish = (audio) => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recRef.current = null;
      if (!cancel && audio) sendTo(target, { kind: "audio", audio, duration, wave: VOICE_WAVE });
    };
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        if (cancel || !chunksRef.current.length) {
          finish(null);
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => finish(reader.result);
        reader.readAsDataURL(blob);
      };
      recorder.stop();
      return;
    }
    finish(cancel ? null : VOICE_DEMO);
  }

  function placeCall(target, kind) {
    if (!live || !target) return;
    if (target.live) {
      if (live.call.rooms[target.id]) live.calls.join(target.id);
      else live.calls.start(target.id, kind === "video");
    } else {
      live.calls.startDemo(target, kind === "video");
    }
  }

  const callRows = [
    ...threads.flatMap((item) => (item.messages || []).flatMap((message, index) => (
      message.kind === "call"
        ? [{ key: `${item.id}-${message.id || index}-${message.time}`, thread: item, call: message.call === "video" ? "video" : "voice", from: message.from, duration: message.duration || 0, time: item.live ? `${listTime(message.created, it)}` : message.time, at: message.created || 0 }]
        : []
    ))).sort((a, b) => b.at - a.at),
    ...RECENT_CALLS.flatMap((item) => {
      const found = threads.find((entry) => entry.id === item.threadId);
      return found ? [{ ...item, key: item.id, thread: found }] : [];
    }),
  ].filter((item) => !needle || item.thread.name.toLowerCase().includes(needle));

  const flags = space.dmFlags || {};
  const myKey = (thread?.live ? me : "me");

  function personOf(item) {
    if (!item || item.group || item.members) return null;
    if (item.live) return { name: item.name, handle: item.other?.handle, src: item.src, live: true };
    const found = SEARCH_PEOPLE.find((person) => person.name === item.name);
    if (found) return found;
    const contact = CONTACTS.find((person) => person.name === item.name);
    return { name: item.name, src: item.src, handle: item.name.toLowerCase().replace(/\s+/g, "."), craft: contact?.meta?.split(" · ")[0], city: contact?.meta?.split(" · ")[1], followers: 0, bio: "" };
  }

  function quoteName(reply, mineMessage) {
    const fromMe = thread?.live ? reply.from === me : reply.from === "me";
    const other = thread?.live ? nameIn(thread.conv, reply.from, me, it).split(" ")[0] : (reply.name || thread?.name || "").split(" ")[0];
    if (mineMessage) return fromMe ? say("You replied to yourself", "Hai risposto a te stesso") : say(`You replied to ${other}`, `Hai risposto a ${other}`);
    return fromMe ? say("Replied to you", "Ha risposto a te") : say(`Replied to ${other}`, `Ha risposto a ${other}`);
  }

  function react(entry, emoji) {
    if (!thread) return;
    const current = entry.message.reactions?.[myKey];
    const next = emoji === current ? null : emoji;
    if (thread.live) live.react(thread.id, entry.message.id, next);
    else space.reactMessage(thread.id, entry.index, next);
    if (next) {
      setPop(entry.key);
      window.setTimeout(() => setPop(null), 700);
    }
  }

  function unsend(entry) {
    if (!thread) return;
    if (thread.live) live.unsend(thread.id, entry.message.id);
    else space.unsendMessage(thread.id, entry.index);
  }

  function startReply(entry) {
    const message = entry.message;
    setReplyTo({
      key: entry.key,
      id: message.id,
      from: thread?.live ? message.sender : message.from,
      name: message.from === "me" ? say("yourself", "te stesso") : (message.senderName || thread?.name || ""),
      kind: message.kind || "text",
      text: message.kind === "text" || !message.kind ? message.text : (message.text || ""),
    });
    window.setTimeout(() => composerRef.current?.focus({ preventScroll: true }), 30);
  }

  function hideThread(item) {
    if (item.live) space.setDmFlag(item.id, "hiddenAt", Date.now());
    else space.deleteThread(item.id);
    setSheet(null);
  }

  useEffect(() => {
    if (!finding?.q.trim()) return undefined;
    const id = window.setTimeout(() => {
      scrollRef.current?.querySelector(".dm-bubble.flash")?.scrollIntoView({ block: "center", behavior: "smooth" });
      nearEnd.current = false;
    }, 60);
    return () => window.clearTimeout(id);
  }, [finding]);

  function startEdit(entry) {
    setReplyTo(null);
    setEditing({ key: entry.key, index: entry.index, id: entry.message.id, text: entry.message.text || "" });
    setDraft(entry.message.text || "");
    window.setTimeout(() => composerRef.current?.focus({ preventScroll: true }), 30);
  }

  function jumpTo(key) {
    const node = scrollRef.current?.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!node) return;
    nearEnd.current = false;
    node.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlashKey(key);
    window.setTimeout(() => setFlashKey(null), 1400);
  }

  function togglePinned(entry) {
    if (!thread) return;
    if (thread.live) {
      const on = thread.pinned?.id === entry.message.id;
      live.pin(thread.id, on ? null : thread.conv.messages.find((message) => message.id === entry.message.id));
    } else {
      const on = flags[thread.id]?.pin === entry.index;
      space.setDmFlag(thread.id, "pin", on ? null : entry.index);
    }
  }

  function forwardTo(target) {
    const message = forwarding;
    if (!message || !target) return;
    const origin = message.fwd?.name || (message.from === "me" ? (live?.me?.name || space.profile?.name || say("You", "Tu")) : (message.senderName || thread?.name || ""));
    const base = message.kind === "image"
      ? { kind: "image", image: message.image, ...(message.text ? { text: message.text } : {}) }
      : message.kind === "audio"
        ? { kind: "audio", audio: message.audio, duration: message.duration, wave: message.wave }
        : { kind: "text", text: message.text };
    sendTo(target, { ...base, fwd: { name: origin } });
    setForwarding(null);
    setForwardQuery("");
    flash(say(`Forwarded to ${target.name}`, `Inoltrato a ${target.name}`));
  }

  let pane = null;
  if (thread && info) {
    const toSearch = () => { setInfo(false); setFinding({ q: "", at: 0 }); };
    pane = thread.group || thread.members
      ? <GroupInfo thread={thread} onBack={() => setInfo(false)} onCall={(kind) => placeCall(thread, kind)} onLeft={() => setPaneOut(true)} onSearch={toSearch} />
      : (
        <ChatInfo
          thread={thread}
          person={personOf(thread)}
          onBack={() => setInfo(false)}
          onCall={(kind) => placeCall(thread, kind)}
          onSearch={toSearch}
          onProfile={(who) => onOpenPerson?.(who)}
          onDelete={() => { hideThread(thread); setPaneOut(true); }}
        />
      );
  } else if (thread) {
    const room = thread.live ? live?.call.rooms[thread.id] : null;
    const inThisCall = live?.call.convId === thread.id && live?.call.phase !== "idle";
    const subtitle = thread.typing?.length
      ? (thread.group ? `${thread.typing.join(", ")} ${say("typing…", "sta scrivendo…")}` : say("typing…", "sta scrivendo…"))
      : thread.live
        ? (thread.group
          ? `${thread.conv.members.length} ${say("members", "membri")} · ${thread.people.filter((p) => p.online).length} online`
          : (prefs.activity === false ? "" : thread.online ? say("Active now", "Attivo/a ora") : seenText(thread.other, it)))
        : thread.members
          ? thread.members.map((member) => member.name.split(" ")[0]).join(", ")
          : (prefs.activity === false ? "" : say("Active 12m ago", "Attivo/a 12 min fa"));
    const elapsed = rec ? Math.max(0, Math.floor((now - startedRef.current) / 1000)) : 0;
    const stamp = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
    const isGroup = Boolean(thread.group || thread.members);
    const person = personOf(thread);
    const entries = thread.messages
      .map((message, index) => ({ message, index, key: message.id || message.clientId || `${thread.id}-${index}-${message.time || index}` }))
      .filter((entry) => !entry.message.unsent);
    const lastMine = entries.reduce((found, entry, at) => (entry.message.from === "me" ? at : found), -1);
    const showIntro = !(thread.live && thread.conv.hasMore);
    const focusEntry = focus ? entries.find((entry) => entry.key === focus.key) : null;
    const pinnedEntry = thread.live
      ? entries.find((entry) => entry.message.id && entry.message.id === thread.pinned?.id)
      : entries.find((entry) => entry.index === flags[thread.id]?.pin);
    const pinnedRaw = pinnedEntry?.message || (thread.live ? thread.pinned : null);
    const pinnedText = pinnedRaw ? (pinnedRaw.text || (pinnedRaw.kind === "image" ? say("📷 Photo", "📷 Foto") : pinnedRaw.kind === "audio" ? say("🎤 Voice message", "🎤 Messaggio vocale") : "…")) : "";
    const otherUnread = threads.filter((item) => item.id !== thread.id && !flags[item.id]?.muted).reduce((sum, item) => sum + (item.live ? item.unread || 0 : item.unread ? 1 : 0), 0);
    const findQ = finding?.q.trim().toLowerCase() || "";
    const matches = findQ ? entries.filter((entry) => entry.message.from !== "system" && (entry.message.text || "").toLowerCase().includes(findQ)) : [];
    const current = matches.length ? matches[matches.length - 1 - Math.min(finding.at, matches.length - 1)] : null;
    const isPinned = (entry) => (thread.live ? thread.pinned?.id && thread.pinned.id === entry.message.id : flags[thread.id]?.pin === entry.index);
    const mentionMatch = isGroup ? draft.match(/(^|\s)@([\p{L}\w.]*)$/u) : null;
    const mentionList = mentionMatch
      ? (thread.live ? thread.people.map((p) => ({ key: p.handle, label: p.handle, name: p.name, src: p.src })) : (thread.members || []).map((m) => ({ key: m.name, label: m.name.split(" ")[0], name: m.name, src: m.src })))
        .filter((item) => !mentionMatch[2] || `${item.label} ${item.name}`.toLowerCase().includes(mentionMatch[2].toLowerCase()))
        .slice(0, 5)
      : [];
    pane = (
      <div className="panel chat-panel dm dm-chat">
        <div className="dm-top tgc">
          <button type="button" className="tgc-back" aria-label={say("Back to chats", "Torna alle chat")} onClick={closePane}>
            <ChevronLeft strokeWidth={2.6} />
            {otherUnread ? <b>{otherUnread > 99 ? "99+" : otherUnread}</b> : null}
          </button>
          <button type="button" className="tgc-title" onClick={() => setInfo(true)} aria-label={say("Chat info", "Info chat")}>
            <strong>{thread.name}{flags[thread.id]?.muted ? <BellOff weight="fill" /> : null}</strong>
            {subtitle ? <em className={thread.typing?.length ? "typing" : thread.online && prefs.activity !== false ? "on" : ""}>{subtitle}</em> : null}
          </button>
          <button type="button" className="tgc-face" onClick={() => setInfo(true)} aria-label={say("Chat info", "Info chat")}>
            <ThreadFace thread={thread} />
          </button>
          {finding ? (
            <div className="dm-find">
              <label className="sx-field">
                <Search strokeWidth={2} aria-hidden="true" />
                <input
                  autoFocus
                  value={finding.q}
                  onChange={(event) => setFinding({ q: event.target.value, at: 0 })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") setFinding((prev) => ({ ...prev, at: Math.min(prev.at + 1, Math.max(0, matches.length - 1)) }));
                    if (event.key === "Escape") setFinding(null);
                  }}
                  placeholder={say("Search", "Cerca")}
                  aria-label={say("Search in chat", "Cerca nella chat")}
                />
              </label>
              <span className="dm-find-count">{finding.q.trim() ? (matches.length ? `${matches.length - finding.at} / ${matches.length}` : say("No results", "Nessun risultato")) : ""}</span>
              <button type="button" className="dm-icon" aria-label={say("Older", "Precedente")} disabled={finding.at >= matches.length - 1} onClick={() => setFinding((prev) => ({ ...prev, at: prev.at + 1 }))}><ChevronUp strokeWidth={2.4} /></button>
              <button type="button" className="dm-icon" aria-label={say("Newer", "Successivo")} disabled={finding.at <= 0} onClick={() => setFinding((prev) => ({ ...prev, at: prev.at - 1 }))}><ChevronDown strokeWidth={2.4} /></button>
              <button type="button" className="dm-find-done" onClick={() => setFinding(null)}>{say("Done", "Fine")}</button>
            </div>
          ) : null}
        </div>
        {pinnedText ? (
          <button type="button" className="dm-pinned" onClick={() => (pinnedEntry ? jumpTo(pinnedEntry.key) : null)}>
            <i />
            <span>
              <strong>{say("Pinned message", "Messaggio fissato")}</strong>
              <em>{pinnedText}</em>
            </span>
            <Pin weight="fill" className="dm-pinned-icon" />
          </button>
        ) : null}
        {room && !inThisCall ? (
          <button type="button" className="dm-join" onClick={() => live.calls.join(thread.id)}>
            <i>{room.video ? <Video weight="fill" /> : <Phone weight="fill" />}</i>
            <span>{say("Call in progress", "Chiamata in corso")} · {room.participants.length} {say("in call", "in chiamata")}</span>
            <b>{say("Join", "Entra")}</b>
          </button>
        ) : null}
        <div className={`panel-scroll dm-scroll dm-wall w-${flags[thread.id]?.wall || "sky"}`} ref={scrollRef} onScroll={onChatScroll}>
          <div className="dm-transcript">
            {thread.live && thread.conv.hasMore ? (
              <button type="button" className="dm-more" onClick={() => live.fetchOlder(thread.id)} disabled={thread.conv.loading}>
                {thread.conv.loading ? say("Loading…", "Caricamento…") : say("Earlier messages", "Messaggi precedenti")}
              </button>
            ) : null}
            {showIntro ? (
              <div className="dm-intro">
                {isGroup ? (
                  <span className="dm-intro-group"><GroupAvatar photo={thread.photo} title={thread.name} /></span>
                ) : (
                  <RemoteImage className="dm-intro-face" src={thread.src} alt="" />
                )}
                <strong>{thread.name}</strong>
                <em>
                  {isGroup
                    ? `${(thread.members || thread.people || []).length + 1} ${say("members", "membri")}`
                    : person?.live ? `@${person.handle} · Space` : `${person?.handle || ""} · ${person?.followers ? `${compact(person.followers, it)} follower` : "Space"}`}
                </em>
                {!isGroup && person?.craft ? <em>{person.craft}{person.city ? ` · ${person.city}` : ""}</em> : null}
                {isGroup && thread.about ? <p className="dm-intro-about">{thread.about}</p> : null}
                <button type="button" className="dm-intro-btn" onClick={() => setInfo(true)}>{isGroup ? say("Group info", "Info gruppo") : say("Chat info", "Info chat")}</button>
              </div>
            ) : null}
            {!thread.live && entries.length ? <span className="dm-stamp">{say("Today", "Oggi")}</span> : null}
            {thread.live && !entries.length ? (
              <p className="dm-system">{say("Say hi 👋 Messages are delivered live.", "Saluta 👋 I messaggi arrivano in tempo reale.")}</p>
            ) : null}
            {entries.map((entry, at) => {
              const { message } = entry;
              const prev = entries[at - 1]?.message;
              const next = entries[at + 1]?.message;
              const far = (a, b) => Boolean(a?.created && b?.created && b.created - a.created > 30 * 60 * 1000);
              const stampHere = thread.live && message.created && (!prev?.created || far(prev, message));
              const mine = message.from === "me";
              const solo = (item) => item && item.from !== "system" && item.kind !== "call";
              const sameAsPrev = solo(prev) && solo(message) && prev.from === message.from && prev.sender === message.sender && !stampHere && !message.reply;
              const sameAsNext = solo(next) && solo(message) && next.from === message.from && next.sender === message.sender && !far(message, next) && !next.reply;
              const face = message.from === "them"
                ? (thread.live ? (thread.people.find((p) => p.handle === message.sender)?.src || avatarFor(message.senderName)) : thread.src)
                : null;
              const tick = mine ? tickFor(message, thread, receipts) : null;
              return (
                <Fragment key={entry.key}>
                  {stampHere ? <span className="dm-stamp">{`${dayOf(message.created, it)} ${clockOf(message.created)}`}</span> : null}
                  <div data-key={entry.key} className={`dm-line ${message.from}${!sameAsPrev ? " gap" : ""}${(!message.id && message.created === 0) || (message.created && Date.now() - message.created < 4000) ? " fresh" : ""}${pop === entry.key ? " pop" : ""}${focus?.key === entry.key ? " focused" : ""}`}>
                    {message.from === "them" ? (
                      <span className="dm-face">{!sameAsNext ? <RemoteImage src={face} alt="" /> : null}</span>
                    ) : null}
                    <DmBubble
                      message={message}
                      mine={mine}
                      first={!sameAsPrev}
                      last={!sameAsNext}
                      showName={Boolean(thread.group)}
                      nameOf={quoteName}
                      myKey={myKey}
                      onZoom={setZoom}
                      onCall={(kind) => placeCall(thread, kind)}
                      onRetry={() => live.retry(thread.id, message)}
                      onDiscard={() => live.discard(thread.id, message)}
                      onReact={(emoji) => react(entry, emoji)}
                      onReply={() => startReply(entry)}
                      onMenu={(rect) => setFocus({ key: entry.key, rect })}
                      tick={tick}
                      query={findQ}
                      flash={flashKey === entry.key || current?.key === entry.key}
                    />
                  </div>
                </Fragment>
              );
            })}
            {thread.typing?.length ? (
              <div className="dm-line them gap">
                <span className="dm-face"><RemoteImage src={thread.src} alt="" /></span>
                <div className="dm-typing" aria-label={say("typing", "sta scrivendo")}><i /><i /><i /></div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
        </div>
        {below ? (
          <button type="button" className="dm-down" onClick={() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })} aria-label={say("Latest messages", "Ultimi messaggi")}>
            <ArrowDown />
            {unseen ? <b>{unseen}</b> : null}
          </button>
        ) : null}
        {tray ? (
          <div className="dm-tray">
            <div className="dm-tray-head">
              <strong>{say("Recent", "Recenti")}</strong>
              <button type="button" onClick={() => fileRef.current?.click()}>{say("Library", "Libreria")}</button>
            </div>
            <div className="dm-tray-grid">
              {DEMO_GALLERY.slice(0, 12).map((src) => (
                <button key={src} type="button" onClick={() => sendPhoto(src)}>
                  <img src={src} alt="" draggable="false" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {hint ? <p className="dm-hint">{hint}</p> : null}
        {thread.live && live.status !== "open" ? (
          <p className="dm-hint">{say("Reconnecting… messages will be sent when you're back online.", "Riconnessione… i messaggi partiranno appena torni online.")}</p>
        ) : null}
        <form
          className={`dm-composer${rec ? " recording" : ""}${replyTo ? " replying" : ""}`}
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            if (editing) {
              if (text !== editing.text) {
                if (thread.live) live.edit(thread.id, editing.id, text);
                else space.editMessage(thread.id, editing.index, text);
              }
              setEditing(null);
              setDraft("");
              return;
            }
            const payload = { kind: "text", text };
            if (replyTo) payload.reply = thread.live ? { id: replyTo.id, from: replyTo.from, kind: replyTo.kind, text: replyTo.text } : { from: replyTo.from, name: thread.name, kind: replyTo.kind, text: replyTo.text };
            deliver(payload);
            setReplyTo(null);
            setEmojiOpen(false);
          }}
        >
          {mentionList.length ? (
            <div className="dm-mentions">
              {mentionList.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setDraft((value) => value.replace(/@[\p{L}\w.]*$/u, `@${item.label} `));
                    composerRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <RemoteImage src={item.src || avatarFor(item.name)} alt="" />
                  <span><strong>{item.name}</strong><em>@{item.label}</em></span>
                </button>
              ))}
            </div>
          ) : null}
          {editing ? (
            <div className="dm-replybar edit">
              <PenLine weight="fill" className="dm-replybar-icon" />
              <span>
                <strong>{say("Edit message", "Modifica messaggio")}</strong>
                <em>{editing.text}</em>
              </span>
              <button type="button" aria-label={say("Cancel edit", "Annulla modifica")} onClick={() => { setEditing(null); setDraft(""); }}><X strokeWidth={2.4} /></button>
            </div>
          ) : null}
          {replyTo ? (
            <div className="dm-replybar">
              <Reply weight="bold" className="dm-replybar-icon" />
              <span>
                <strong>{say("Replying to", "Stai rispondendo a")} {replyTo.name.split(" ")[0]}</strong>
                <em>{replyTo.text || (replyTo.kind === "image" ? say("Photo", "Foto") : say("Voice message", "Messaggio vocale"))}</em>
              </span>
              <button type="button" aria-label={say("Cancel reply", "Annulla risposta")} onClick={() => setReplyTo(null)}><X strokeWidth={2.4} /></button>
            </div>
          ) : null}
          {emojiOpen ? (
            <div className="dm-emoji">
              {STORY_EMOJI.slice(0, 24).map((emoji) => (
                <button key={emoji} type="button" onClick={() => setDraft((value) => `${value}${emoji}`)}>{emoji}</button>
              ))}
            </div>
          ) : null}
          <div className="dm-pill">
            <button type="button" className="dm-cam" aria-label={say("Photos", "Foto")} aria-pressed={tray} onClick={() => { setTray((value) => !value); setEmojiOpen(false); }}>
              <Camera weight="fill" />
            </button>
            {rec ? (
              <div className={rec.cancel ? "dm-rec cancel" : "dm-rec"}>
                <i />
                <b>{stamp}</b>
                <em>{rec.cancel ? say("Release to cancel", "Lascia per annullare") : say("‹ Slide to cancel", "‹ Scorri per annullare")}</em>
              </div>
            ) : (
              <input
                ref={composerRef}
                value={draft}
                maxLength={2000}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (thread.live && event.target.value.trim()) live.typing(thread.id);
                }}
                onFocus={() => setTray(false)}
                placeholder={say("Message…", "Messaggio…")}
                aria-label={`${say("Message", "Messaggio")} ${thread.name}`}
              />
            )}
            {draft.trim() && !rec ? (
              <button type="submit" className={editing ? "dm-send edit" : "dm-send"} aria-label={editing ? say("Save", "Salva") : say("Send", "Invia")}>{editing ? <Check weight="bold" /> : say("Send", "Invia")}</button>
            ) : (
              <>
                <button
                  type="button"
                  className={rec ? "dm-tool rec on" : "dm-tool rec"}
                  aria-label={say("Hold to record", "Tieni premuto per registrare")}
                  onPointerDown={beginRec}
                  onPointerMove={moveRec}
                  onPointerUp={endRec}
                  onPointerCancel={endRec}
                >
                  <Mic strokeWidth={2} />
                </button>
                {!rec ? (
                  <>
                    <button type="button" className="dm-tool" aria-label={say("Library", "Libreria")} onClick={() => fileRef.current?.click()}>
                      <Image strokeWidth={2} />
                    </button>
                    <button type="button" className="dm-tool" aria-label={say("Emoji", "Emoji")} aria-pressed={emojiOpen} onClick={() => { setEmojiOpen((value) => !value); setTray(false); }}>
                      <Smile strokeWidth={2} />
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>
          <input ref={fileRef} className="sr" type="file" accept="image/*" onChange={onLibrary} />
        </form>
        {focusEntry ? (
          <div className="dm-focus" onClick={() => setFocus(null)}>
            <div className={`dm-focus-stack ${focusEntry.message.from === "me" ? "me" : "them"}`} onClick={(event) => event.stopPropagation()}>
              <div className="dm-focus-react">
                {DM_REACTIONS.map((emoji, index) => (
                  <button
                    key={emoji}
                    type="button"
                    style={{ "--i": index }}
                    className={focusEntry.message.reactions?.[myKey] === emoji ? "on" : ""}
                    onClick={() => { react(focusEntry, emoji); setFocus(null); }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className={`dm-focus-bubble ${focusEntry.message.kind || "text"}`}>
                {focusEntry.message.kind === "image" ? <img src={focusEntry.message.image} alt="" /> : null}
                {focusEntry.message.kind === "audio" ? <span className="dm-text">🎤 {say("Voice message", "Messaggio vocale")}</span> : null}
                {focusEntry.message.text && focusEntry.message.kind !== "audio" ? <span className="dm-text">{focusEntry.message.text}</span> : null}
              </div>
              <span className="dm-focus-time">{focusEntry.message.time || ""}</span>
              <div className="dm-focus-menu">
                <button type="button" onClick={() => { startReply(focusEntry); setFocus(null); }}><span>{say("Reply", "Rispondi")}</span><Reply strokeWidth={2} /></button>
                {focusEntry.message.from === "me" && (focusEntry.message.kind || "text") === "text" && (!thread.live || focusEntry.message.id) ? (
                  <button type="button" onClick={() => { startEdit(focusEntry); setFocus(null); }}><span>{say("Edit", "Modifica")}</span><PenLine strokeWidth={2} /></button>
                ) : null}
                {!thread.live || focusEntry.message.id ? (
                  <button type="button" onClick={() => { togglePinned(focusEntry); setFocus(null); }}><span>{isPinned(focusEntry) ? say("Unpin", "Togli dai fissati") : say("Pin", "Fissa")}</span><Pin strokeWidth={2} /></button>
                ) : null}
                <button type="button" onClick={() => { setForwarding(focusEntry.message); setFocus(null); }}><span>{say("Forward", "Inoltra")}</span><Forward strokeWidth={2} /></button>
                {focusEntry.message.text ? (
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(focusEntry.message.text).catch(() => {}); setFocus(null); flash(say("Copied", "Copiato")); }}><span>{say("Copy", "Copia")}</span><Copy strokeWidth={2} /></button>
                ) : null}
                {focusEntry.message.kind === "image" ? (
                  <button type="button" onClick={() => { setZoom(focusEntry.message.image); setFocus(null); }}><span>{say("View", "Visualizza")}</span><Eye strokeWidth={2} /></button>
                ) : null}
                {focusEntry.message.from === "me" && (!thread.live || focusEntry.message.id) ? (
                  <button type="button" className="warn" onClick={() => { unsend(focusEntry); setFocus(null); }}><span>{say("Unsend", "Annulla l'invio")}</span><RotateCcw strokeWidth={2} /></button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {forwarding ? (
          <div className="ps-sheet-wrap" onClick={() => setForwarding(null)}>
            <div className="ps-sheet dm-forward" onClick={(event) => event.stopPropagation()}>
              <i className="ps-grab" />
              <strong className="dm-forward-title">{say("Forward to…", "Inoltra a…")}</strong>
              <label className="sx-field">
                <Search strokeWidth={2} aria-hidden="true" />
                <input value={forwardQuery} onChange={(event) => setForwardQuery(event.target.value)} placeholder={say("Search", "Cerca")} aria-label={say("Search chats", "Cerca chat")} />
              </label>
              <div className="dm-forward-list">
                {threads.filter((item) => !forwardQuery.trim() || item.name.toLowerCase().includes(forwardQuery.trim().toLowerCase())).map((item) => (
                  <button key={item.id} type="button" onClick={() => forwardTo(item)}>
                    <ThreadFace thread={item} />
                    <span><strong>{item.name}</strong><em>{item.group || item.members ? say("Group", "Gruppo") : item.live ? say("On Space", "Su Space") : say("Chat", "Chat")}</em></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {zoom ? (
          <div className="pic-zoom dm-zoom" onClick={() => setZoom(null)}>
            <button type="button" className="dm-icon" aria-label={say("Close", "Chiudi")} onClick={() => setZoom(null)}>
              <X strokeWidth={2.4} />
            </button>
            <img src={zoom} alt="" />
          </div>
        ) : null}
      </div>
    );
  }

  const subHead = (title, meta, onBack = closePane) => (
    <div className="dm-top sub">
      <button type="button" className="dm-icon" aria-label={say("Back", "Indietro")} onClick={onBack}>
        <ChevronLeft strokeWidth={2.4} />
      </button>
      <div className="dm-who static">
        <span>
          <strong>{title}</strong>
          {meta ? <em>{meta}</em> : null}
        </span>
      </div>
    </div>
  );

  const pickRow = (key, face, title, meta, on, onClick, disabled) => (
    <button key={key} type="button" className="dm-pick-row" aria-pressed={on === null ? undefined : on} onClick={onClick} disabled={disabled}>
      {face}
      <span>
        <strong>{title}</strong>
        <em>{meta}</em>
      </span>
      {on === null ? null : <i className={on ? "dm-check on" : "dm-check"}>{on ? <Check weight="bold" /> : null}</i>}
    </button>
  );

  const liveSection = (onPick, pickedKey) => (
    live ? (
      <>
        <p className="dm-section">{say("On Space", "Su Space")}{live.status !== "open" ? ` · ${say("connecting…", "connessione…")}` : ""}</p>
        {livePeople.length ? livePeople.map((person) => {
          const key = `live:${person.handle}`;
          return pickRow(
            key,
            <ThreadFace thread={{ src: person.src || avatarFor(person.name), online: person.online }} />,
            person.name,
            `@${person.handle} · ${seenText(person, it)}`,
            pickedKey ? picked.has(key) : null,
            () => onPick(person, key),
            busy && !pickedKey,
          );
        }) : (
          <p className="dm-note-hint">{peopleNeedle ? say("Nobody with this name on Space.", "Nessuno con questo nome su Space.") : say("Nobody else has joined yet. Sign up a second account in another browser to try live chat and calls.", "Ancora nessun altro iscritto. Crea un secondo account in un altro browser per provare chat e chiamate dal vivo.")}</p>
        )}
        <p className="dm-section">{say("Suggested", "Suggeriti")}</p>
      </>
    ) : null
  );

  if (!pane && mode === "requests") {
    pane = (
      <div className="panel dm dm-page">
        {subHead(say("Message requests", "Richieste di messaggi"))}
        <div className="panel-scroll">
          <p className="dm-note-hint center">{say("Open a chat to see who sent it. They won't know you've seen it until you accept.", "Apri una chat per vedere chi l'ha inviata. Non sapranno che l'hai vista finché non accetti.")}</p>
          <div className="ig-empty">
            <i><Inbox strokeWidth={1.4} /></i>
            <strong>{say("No message requests", "Nessuna richiesta")}</strong>
            <span>{say("You don't have any message requests.", "Non hai richieste di messaggi.")}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!pane && mode === "new") {
    pane = (
      <div className="panel dm dm-page">
        {subHead(say("New message", "Nuovo messaggio"))}
        <label className="dm-to">
          <b>{say("To:", "A:")}</b>
          <input
            value={peopleQuery}
            onChange={(event) => setPeopleQuery(event.target.value)}
            placeholder={say("Search…", "Cerca…")}
            aria-label={say("Search people", "Cerca persone")}
            autoComplete="off"
          />
        </label>
        <div className="panel-scroll">
          <button type="button" className="dm-pick-row" onClick={() => { setMode("group"); setPeopleQuery(""); setPicked(new Set()); setGroupName(""); resetGroup(); }}>
            <i className="dm-round"><Users strokeWidth={2} /></i>
            <span>
              <strong>{say("Create a group chat", "Crea una chat di gruppo")}</strong>
              <em>{say("Chat and call together", "Chatta e chiama insieme")}</em>
            </span>
            <ChevronRight className="dm-chev" strokeWidth={2} />
          </button>
          {liveSection((person) => startLiveChat(person), false)}
          {people.map((person) => pickRow(
            person.name,
            <RemoteImage className="row-avatar" src={person.src} alt="" />,
            person.name,
            person.meta,
            null,
            () => startChat(person),
          ))}
          {people.length === 0 && livePeople.length === 0 ? (
            <div className="ig-empty"><i><Search strokeWidth={1.4} /></i><strong>{say("No account found", "Nessun account trovato")}</strong></div>
          ) : null}
        </div>
        {hint ? <p className="dm-hint">{hint}</p> : null}
      </div>
    );
  }

  if (!pane && mode === "group") {
    const enough = pickedLive.length ? pickedLive.length >= 1 : pickedDemo.length >= 2;
    const ready = groupName.trim().length > 0 && enough && !mixed && !busy;
    const chips = [
      ...pickedLive.map((handle) => {
        const person = live?.people[handle];
        return { key: `live:${handle}`, label: (person?.name || handle).split(" ")[0], name: person?.name || handle, src: person?.src || avatarFor(person?.name || handle), meta: person ? seenText(person, it) : `@${handle}` };
      }),
      ...pickedDemo.map((name) => {
        const person = CONTACTS.find((item) => item.name === name);
        return { key: `demo:${name}`, label: name.split(" ")[0], name, src: person?.src || avatarFor(name), meta: person?.meta || "" };
      }),
    ];
    const sorted = [...people].sort((x, y) => x.name.localeCompare(y.name));
    const letters = [];
    for (const person of sorted) {
      const letter = person.name[0].toUpperCase();
      if (!letters.length || letters[letters.length - 1][0] !== letter) letters.push([letter, []]);
      letters[letters.length - 1][1].push(person);
    }
    const checkRow = (key, src, online, title, meta) => {
      const on = picked.has(key);
      return (
        <button key={key} type="button" className={`dm-check-row${on ? " on" : ""}`} aria-pressed={on} onClick={() => togglePerson(key)}>
          <span className="dm-check-face">
            <RemoteImage src={src} alt="" />
            {online ? <i className="online-dot" /> : null}
            <i className="dm-check-mark">{on ? <Check weight="bold" /> : null}</i>
          </span>
          <span>
            <strong>{title}</strong>
            <em className={online ? "on" : ""}>{meta}</em>
          </span>
        </button>
      );
    };
    pane = groupStep === "members" ? (
      <div className="panel dm dm-page dm-group">
        {subHead(say("New group", "Nuovo gruppo"), picked.size ? say(`${picked.size} of ${200 - 1} selected`, `${picked.size} di ${200 - 1} selezionati`) : say("Add members", "Aggiungi membri"))}
        <div className="dm-chips-box">
          {chips.map((chip) => (
            <button key={chip.key} type="button" className="dm-pchip" onClick={() => togglePerson(chip.key)} aria-label={`${say("Remove", "Rimuovi")} ${chip.name}`}>
              <img src={chip.src} alt="" />
              <span>{chip.label}</span>
              <i><X weight="bold" /></i>
            </button>
          ))}
          <input
            value={peopleQuery}
            onChange={(event) => setPeopleQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !peopleQuery && chips.length) togglePerson(chips[chips.length - 1].key);
            }}
            placeholder={chips.length ? "" : say("Who would you like to add?", "Chi vuoi aggiungere?")}
            aria-label={say("Search people for the group", "Cerca persone per il gruppo")}
            autoComplete="off"
          />
        </div>
        <div className="panel-scroll">
          {live ? (
            <>
              <p className="dm-letter wide">{say("On Space", "Su Space")}{live.status !== "open" ? ` · ${say("connecting…", "connessione…")}` : ""}</p>
              {livePeople.length ? livePeople.map((person) => checkRow(`live:${person.handle}`, person.src || avatarFor(person.name), person.online, person.name, person.online ? "online" : seenText(person, it))) : (
                <p className="dm-note-hint">{peopleNeedle ? say("Nobody with this name on Space.", "Nessuno con questo nome su Space.") : say("Nobody else has joined yet.", "Ancora nessun altro iscritto.")}</p>
              )}
            </>
          ) : null}
          {letters.map(([letter, list]) => (
            <Fragment key={letter}>
              <p className="dm-letter">{letter}</p>
              {list.map((person) => checkRow(`demo:${person.name}`, person.src, false, person.name, person.meta))}
            </Fragment>
          ))}
        </div>
        {mixed || hint ? (
          <p className="dm-hint soft">{hint || say("Demo contacts can't join a live group. Pick only people on Space, or only demo contacts.", "I contatti demo non possono entrare in un gruppo live. Scegli solo persone su Space o solo contatti demo.")}</p>
        ) : null}
        <button type="button" className={`dm-fab${enough && !mixed ? " on" : ""}`} disabled={!enough || mixed} aria-label={say("Next", "Avanti")} onClick={() => { setGroupStep("details"); setPeopleQuery(""); }}>
          <ArrowRight />
        </button>
      </div>
    ) : (
      <div className="panel dm dm-page dm-group">
        {subHead(say("New group", "Nuovo gruppo"), say(`${chips.length + 1} members`, `${chips.length + 1} membri`), () => setGroupStep("members"))}
        <div className="panel-scroll">
          <div className="dm-gdetails">
            <button type="button" className="dm-gphoto" aria-label={say("Group photo", "Foto del gruppo")} onClick={() => setPhotoPick((value) => !value)}>
              {groupPhoto ? <GroupAvatar photo={groupPhoto} title={groupName || "?"} /> : <span className="dm-gphoto-empty"><Camera weight="fill" /></span>}
              <i><Plus weight="bold" /></i>
            </button>
            <input
              className="dm-gname"
              value={groupName}
              maxLength={40}
              autoFocus
              onChange={(event) => setGroupName(event.target.value)}
              placeholder={say("Group name", "Nome del gruppo")}
              aria-label={say("Group name", "Nome del gruppo")}
            />
          </div>
          {photoPick ? (
            <div className="dm-tones">
              {GROUP_TONES.map((_, index) => (
                <button key={index} type="button" className={groupPhoto === `tone:${index}` ? "on" : ""} aria-label={`${say("Colour", "Colore")} ${index + 1}`} onClick={() => { setGroupPhoto(`tone:${index}`); setPhotoPick(false); }}>
                  <GroupAvatar photo={`tone:${index}`} title={groupName || "?"} />
                </button>
              ))}
              <button type="button" className="dm-tones-upload" onClick={() => groupFileRef.current?.click()}><Image strokeWidth={2} /><span>{say("Photo", "Foto")}</span></button>
              {groupPhoto ? <button type="button" className="dm-tones-clear" onClick={() => { setGroupPhoto(""); setPhotoPick(false); }}><X strokeWidth={2.4} /></button> : null}
            </div>
          ) : null}
          <label className="dm-gabout">
            <textarea
              value={groupAbout}
              maxLength={255}
              rows={2}
              onChange={(event) => setGroupAbout(event.target.value)}
              placeholder={say("Description (optional)", "Descrizione (facoltativa)")}
              aria-label={say("Description", "Descrizione")}
            />
          </label>
          <p className="dm-note-hint">{say("You can change the name, photo and description later in group info.", "Puoi cambiare nome, foto e descrizione più tardi nelle info del gruppo.")}</p>
          <p className="dm-letter wide">{say(`${chips.length + 1} members`, `${chips.length + 1} membri`)}</p>
          <div className="dm-check-row static">
            <span className="dm-check-face"><RemoteImage src={live?.me?.src || AVATAR} alt="" /></span>
            <span><strong>{live?.me?.name || say("You", "Tu")}</strong><em>{say("owner", "proprietario")}</em></span>
          </div>
          {chips.map((chip) => (
            <div key={chip.key} className="dm-check-row static">
              <span className="dm-check-face"><RemoteImage src={chip.src} alt="" /></span>
              <span><strong>{chip.name}</strong><em>{chip.meta}</em></span>
            </div>
          ))}
        </div>
        {hint ? <p className="dm-hint soft">{hint}</p> : null}
        <button type="button" className={`dm-fab${ready ? " on" : ""}`} disabled={!ready} aria-label={say("Create group", "Crea gruppo")} onClick={createGroup}>
          {busy ? <i className="dm-spin" /> : <Check weight="bold" />}
        </button>
        <input ref={groupFileRef} className="sr" type="file" accept="image/*" onChange={onGroupPhoto} />
      </div>
    );
  }

  // Inbox
  const hiddenOut = (item) => {
    const at = flags[item.id]?.hiddenAt;
    return at && (item.updatedAt || 0) <= at;
  };
  const isGroupChat = (item) => Boolean(item.group || item.members);
  const isMuted = (item) => Boolean(flags[item.id]?.muted);
  const unreadOf = (item) => (item.live ? item.unread : (item.unread ? 1 : 0));
  // Archived chats come back when a new message arrives, unless they are muted (as in Telegram).
  const isArchived = (item) => {
    const at = flags[item.id]?.archivedAt;
    if (!at) return false;
    return !((item.updatedAt || 0) > at && !isMuted(item));
  };
  const folders = space.dmFolders || defaultFolders(it);
  const inFolder = (item, key) => {
    if (key === "all") return !isArchived(item);
    const def = folders.find((entry) => entry.id === key);
    if (!def) return !isArchived(item);
    const included = def.unreadOnly || (def.chats || []).includes(item.id) || (def.people && !isGroupChat(item)) || (def.groups && isGroupChat(item));
    if (!included || isArchived(item)) return false;
    if (def.noMuted && isMuted(item)) return false;
    if ((def.noRead || def.unreadOnly) && !unreadOf(item)) return false;
    return true;
  };
  const alive = visible.filter((item) => !hiddenOut(item));
  const archived = alive.filter(isArchived);
  const countIn = (key) => alive.filter((item) => inFolder(item, key) && unreadOf(item) > 0 && !isMuted(item)).length;
  const activeFolder = folder === "all" || folders.some((entry) => entry.id === folder) ? folder : "all";
  const listed = alive
    .filter((item) => inFolder(item, activeFolder))
    .map((item, order) => ({ item, order, pinned: Boolean(flags[item.id]?.pinned) }))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
  const sheetItem = sheet ? threads.find((item) => item.id === sheet) : null;
  const connecting = live && live.status !== "open" && live.status !== "idle";

  function rowTime(item) {
    if (item.live) {
      const label = listTime(item.updatedAt, it);
      return label ? label.charAt(0).toUpperCase() + label.slice(1).replace(".", "") : "";
    }
    return demoTime(item.time, it);
  }

  function rowTick(item) {
    const last = item.messages?.[item.messages.length - 1];
    if (!last || last.from !== "me" || last.kind === "call") return null;
    const tick = tickFor(last, item, receipts);
    if (tick === "pending") return <Clock weight="bold" className="tg-tick" />;
    if (tick === "failed") return <X weight="bold" className="tg-tick failed" />;
    return tick === "read" ? <CheckCheck weight="bold" className="tg-tick read" /> : <Check weight="bold" className="tg-tick" />;
  }

  function archiveIds(ids, on) {
    space.setDmFlags(ids, "archivedAt", on ? Date.now() : null);
    flash(on ? say(ids.length > 1 ? `${ids.length} chats archived` : "Chat archived", ids.length > 1 ? `${ids.length} chat archiviate` : "Chat archiviata") : say("Moved back to chats", "Riportata nelle chat"));
  }

  function readIds(ids) {
    for (const id of ids) {
      const item = threads.find((entry) => entry.id === id);
      if (!item) continue;
      if (item.live) live.markRead(id);
      else if (item.unread) space.markThreadRead(id);
    }
  }

  function toggleSelect(id) {
    setSelecting((prev) => {
      const next = new Set(prev || []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const renderRow = (item, pinned, index, archivedView = false) => {
    const preview = previewOf(item);
    const count = unreadOf(item);
    const room = item.live && live?.call.rooms[item.id];
    const muted = isMuted(item);
    const group = isGroupChat(item);
    const selected = selecting?.has(item.id);
    const last = item.messages?.[item.messages.length - 1];
    const solo = !group && last?.from === "me";
    const text = room
      ? say("Call in progress · Tap to join", "Chiamata in corso · Tocca per entrare")
      : solo ? String(preview.text || "").replace(/^(Tu|You): /, "") : preview.text;
    const sender = group && !preview.typing && !room ? String(preview.text || "").match(/^([^:]{1,24}): /) : null;
    return (
      <div key={item.id} className="dm-enter" style={{ "--i": Math.min(index, 12) }}>
        <DmRow
          className={`tg-row${count ? " unread" : ""}${selecting ? " selecting" : ""}${selected ? " selected" : ""}`}
          label={item.name}
          onOpen={() => (selecting ? toggleSelect(item.id) : openThread(item.id))}
          onLongPress={() => (selecting ? null : setSheet(item.id))}
          actions={[
            { key: "mute", className: "mute", icon: muted ? <Bell weight="fill" /> : <BellOff weight="fill" />, label: muted ? say("Unmute", "Riattiva") : say("Mute", "Silenzia"), run: () => space.setDmFlag(item.id, "muted", !muted) },
            { key: "delete", className: "delete", icon: <Trash weight="fill" />, label: say("Delete", "Elimina"), run: () => hideThread(item) },
            archivedView
              ? { key: "unarchive", className: "archive", icon: <Archive weight="fill" />, label: say("Unarchive", "Ripristina"), run: () => archiveIds([item.id], false) }
              : { key: "archive", className: "archive", icon: <Archive weight="fill" />, label: say("Archive", "Archivia"), run: () => archiveIds([item.id], true) },
          ]}
        >
          {selecting ? <i className={`tg-check${selected ? " on" : ""}`}>{selected ? <Check weight="bold" /> : null}</i> : null}
          <ThreadFace thread={item} />
          <span className="tg-body">
            <span className="tg-l1">
              <strong>{item.name}</strong>
              {SEARCH_PEOPLE.find((person) => person.name === item.name)?.verified ? <Verified className="tg-verified" /> : null}
              {muted ? <BellOff weight="fill" className="tg-muted" /> : null}
              <span className="tg-fill" />
              {rowTick(item)}
              <time className={count && !muted ? "fresh" : ""}>{rowTime(item)}</time>
            </span>
            <span className="tg-l2">
              <span className={`tg-prev${preview.typing ? " typing" : ""}${room ? " live" : ""}`}>
                {sender ? <b>{sender[1]}: </b> : null}
                {room ? <Video weight="fill" /> : preview.icon ? <preview.icon weight="fill" /> : null}
                {sender ? text.slice(sender[0].length) : text}
              </span>
              {count ? <b className={`tg-badge${muted ? " muted" : ""}`}>{count}</b> : pinned ? <Pin weight="fill" className="tg-pin" /> : null}
            </span>
          </span>
        </DmRow>
      </div>
    );
  };

  if (!pane && mode === "archive") {
    pane = (
      <div className="panel dm dm-page tg-page">
        {subHead(say("Archived chats", "Chat archiviate"), `${archived.length}`)}
        <div className="panel-scroll">
          <p className="dm-note-hint">{say("Archived chats stay here. Unmuted ones come back when a new message arrives.", "Le chat archiviate restano qui. Quelle non silenziate tornano quando arriva un nuovo messaggio.")}</p>
          {archived.length ? archived.map((item, index) => renderRow(item, false, index, true)) : (
            <div className="ig-empty"><i><Archive strokeWidth={1.4} /></i><strong>{say("No archived chats", "Nessuna chat archiviata")}</strong></div>
          )}
        </div>
      </div>
    );
  }

  if (!pane && mode === "folders") {
    const used = new Set(folders.map((entry) => entry.id));
    const suggested = defaultFolders(it).filter((entry) => !used.has(entry.id));
    pane = (
      <div className="panel dm dm-page tg-page">
        {subHead(say("Chat folders", "Cartelle chat"))}
        <div className="panel-scroll">
          <div className="tg-folders-hero">
            <i><Folder weight="fill" /></i>
            <p>{say("Create folders for different groups of chats and quickly switch between them.", "Crea cartelle per diversi gruppi di chat e passa rapidamente da una all'altra.")}</p>
          </div>
          <p className="tg-cap">{say("My folders", "Le mie cartelle")}</p>
          <div className="tg-card">
            <div className="tg-cell static"><Folder weight="fill" /><span><strong>{say("All chats", "Tutte le chat")}</strong></span></div>
            {folders.map((entry) => (
              <div key={entry.id} className="tg-cell">
                <button type="button" className="tg-cell-main" onClick={() => setFolderEdit({ ...entry, chats: [...(entry.chats || [])] })}>
                  <Folder weight="fill" />
                  <span>
                    <strong>{entry.name}</strong>
                    <em>{folderSummary(entry, say)}</em>
                  </span>
                </button>
                <button type="button" className="tg-cell-del" aria-label={`${say("Delete", "Elimina")} ${entry.name}`} onClick={() => { space.setDmFolders(folders.filter((item) => item.id !== entry.id)); if (folder === entry.id) setFolder("all"); }}><Trash strokeWidth={2} /></button>
              </div>
            ))}
            <button type="button" className="tg-cell add" onClick={() => setFolderEdit({ id: `f-${Date.now().toString(36)}`, name: "", people: false, groups: false, noMuted: false, noRead: false, chats: [], fresh: true })}>
              <AddCircle weight="fill" /><span><strong>{say("Create a new folder", "Crea una nuova cartella")}</strong></span>
            </button>
          </div>
          {suggested.length ? (
            <>
              <p className="tg-cap">{say("Suggested folders", "Cartelle suggerite")}</p>
              <div className="tg-card">
                {suggested.map((entry) => (
                  <div key={entry.id} className="tg-cell">
                    <span className="tg-cell-main static">
                      <span><strong>{entry.name}</strong><em>{folderSummary(entry, say)}</em></span>
                    </span>
                    <button type="button" className="tg-pill-btn" onClick={() => space.setDmFolders([...folders, entry])}>{say("Add", "Aggiungi")}</button>
                  </div>
                ))}
              </div>
            </>
          ) : null}
          <p className="dm-note-hint">{say("Tip: long-press a folder tab to edit it.", "Suggerimento: tieni premuta una cartella per modificarla.")}</p>
        </div>
      </div>
    );
  }

  if (folderEdit) {
    const draftFolder = folderEdit;
    const patch = (next) => setFolderEdit((prev) => ({ ...prev, ...next }));
    const toggleChat = (id) => patch({ chats: draftFolder.chats.includes(id) ? draftFolder.chats.filter((value) => value !== id) : [...draftFolder.chats, id] });
    const valid = draftFolder.name.trim() && (draftFolder.people || draftFolder.groups || draftFolder.chats.length || draftFolder.unreadOnly);
    const save = () => {
      if (!valid) return;
      const clean = { ...draftFolder, name: draftFolder.name.trim() };
      delete clean.fresh;
      delete clean.picking;
      const exists = folders.some((entry) => entry.id === clean.id);
      space.setDmFolders(exists ? folders.map((entry) => (entry.id === clean.id ? clean : entry)) : [...folders, clean]);
      setFolderEdit(null);
      setFolder(clean.id);
    };
    pane = (
      <div className="panel dm dm-page tg-page">
        <div className="dm-top sub">
          <button type="button" className="dm-icon" aria-label={say("Cancel", "Annulla")} onClick={() => setFolderEdit(null)}><X strokeWidth={2.4} /></button>
          <div className="dm-who static"><span><strong>{draftFolder.fresh ? say("New folder", "Nuova cartella") : say("Edit folder", "Modifica cartella")}</strong></span></div>
          <button type="button" className="gi-edit" disabled={!valid} onClick={save}>{say("Save", "Salva")}</button>
        </div>
        <div className="panel-scroll">
          <p className="tg-cap">{say("Folder name", "Nome della cartella")}</p>
          <div className="tg-card">
            <input className="tg-input" value={draftFolder.name} maxLength={16} autoFocus={draftFolder.fresh} onChange={(event) => patch({ name: event.target.value })} placeholder={say("Folder name", "Nome della cartella")} aria-label={say("Folder name", "Nome della cartella")} />
          </div>
          <p className="tg-cap">{say("Included chats", "Chat incluse")}</p>
          <div className="tg-card">
            <ToggleCell on={draftFolder.people} icon={<Users weight="fill" />} tone="blue" label={say("Personal chats", "Chat personali")} onClick={() => patch({ people: !draftFolder.people })} />
            <ToggleCell on={draftFolder.groups} icon={<Users weight="fill" />} tone="green" label={say("Groups", "Gruppi")} onClick={() => patch({ groups: !draftFolder.groups })} />
            <button type="button" className="tg-cell add" onClick={() => patch({ picking: !draftFolder.picking })}>
              <AddCircle weight="fill" /><span><strong>{say("Add chats", "Aggiungi chat")}</strong>{draftFolder.chats.length ? <em>{draftFolder.chats.length} {say("selected", "selezionate")}</em> : null}</span>
            </button>
            {draftFolder.picking ? alive.map((item) => {
              const on = draftFolder.chats.includes(item.id);
              return (
                <button key={item.id} type="button" className={`dm-check-row tg-pick${on ? " on" : ""}`} onClick={() => toggleChat(item.id)}>
                  <span className="dm-check-face"><ThreadFace thread={{ ...item, online: false }} /><i className="dm-check-mark">{on ? <Check weight="bold" /> : null}</i></span>
                  <span><strong>{item.name}</strong><em>{isGroupChat(item) ? say("Group", "Gruppo") : say("Personal", "Personale")}</em></span>
                </button>
              );
            }) : null}
          </div>
          <p className="tg-cap">{say("Excluded chats", "Chat escluse")}</p>
          <div className="tg-card">
            <ToggleCell on={draftFolder.noMuted} icon={<BellOff weight="fill" />} tone="red" label={say("Muted", "Silenziate")} onClick={() => patch({ noMuted: !draftFolder.noMuted })} />
            <ToggleCell on={draftFolder.noRead} icon={<CheckCheck weight="bold" />} tone="teal" label={say("Read", "Lette")} onClick={() => patch({ noRead: !draftFolder.noRead })} />
          </div>
          <p className="dm-note-hint">{say("The folder shows the included chats, minus the excluded ones.", "La cartella mostra le chat incluse, tolte quelle escluse.")}</p>
          {!draftFolder.fresh ? (
            <div className="tg-card">
              <button type="button" className="tg-cell danger" onClick={() => { space.setDmFolders(folders.filter((entry) => entry.id !== draftFolder.id)); if (folder === draftFolder.id) setFolder("all"); setFolderEdit(null); }}>
                <span><strong>{say("Delete folder", "Elimina cartella")}</strong></span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const tabs = [{ id: "all", name: say("All", "Tutte") }, ...folders, { id: "calls", name: say("Calls", "Chiamate") }];
  const selectedIds = [...(selecting || [])];

  return (
    <>
    <div className={`panel view inbox dm dm-inbox tg${selecting ? " editing" : ""}${settled ? " settled" : ""}`} inert={pane ? true : undefined}>
      <header className="tg-head">
        <button type="button" className="tg-pill" onClick={() => setSelecting((prev) => (prev ? null : new Set()))}>
          {selecting ? say("Done", "Fine") : say("Edit", "Modifica")}
        </button>
        <strong className="tg-title">
          {selecting ? (selectedIds.length ? say(`${selectedIds.length} selected`, `${selectedIds.length} selezionate`) : say("Select chats", "Seleziona chat")) : connecting ? <><i className="dm-spin" />{say("Connecting…", "Connessione…")}</> : say("Chats", "Chat")}
        </strong>
        <span className="tg-head-r">
        <button type="button" className="tg-round" aria-label={say("New group", "Nuovo gruppo")} onClick={() => { setPaneOut(false); setMode("group"); setPeopleQuery(""); setPicked(new Set()); setGroupName(""); resetGroup(); }}>
          <Users weight="bold" />
        </button>
        <button type="button" className="tg-round blue" aria-label={say("New message", "Nuovo messaggio")} onClick={() => { setPaneOut(false); setMode("new"); setPeopleQuery(""); }}>
          <SquarePen weight="bold" />
        </button>
        </span>
      </header>
      <div className="panel-scroll tg-scroll" ref={inboxScroll}>
        <div className={`tg-search${searchFocus || query ? " active" : ""}`}>
          <label>
            <Search strokeWidth={2.2} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder={say("Search", "Cerca")}
              aria-label={say("Search messages", "Cerca nei messaggi")}
              autoComplete="off"
            />
            {query ? <button type="button" className="sx-clear" aria-label={say("Clear", "Cancella")} onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery("")}><X strokeWidth={2.6} /></button> : null}
          </label>
        </div>
        <div ref={tabsAnchor} />
        <FolderTabs
          tabs={tabs}
          active={box === "calls" ? "calls" : activeFolder}
          counts={Object.fromEntries(tabs.map((entry) => [entry.id, entry.id === "calls" ? 0 : countIn(entry.id)]))}
          onPick={(id) => {
            const order = tabs.map((entry) => entry.id);
            const from = order.indexOf(box === "calls" ? "calls" : activeFolder);
            const to = order.indexOf(id);
            if (from === to) {
              inboxScroll.current?.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            setFolderDir(to > from ? 1 : -1);
            // Keep the folder bar where it is: never jump back to the top of the page.
            const scroller = inboxScroll.current;
            const anchor = tabsAnchor.current;
            if (scroller && anchor && scroller.scrollTop > anchor.offsetTop) scroller.scrollTop = anchor.offsetTop;
            if (id === "calls") setBox("calls");
            else {
              setBox("chats");
              setFolder(id);
            }
          }}
          onEdit={(id) => {
            const entry = folders.find((item) => item.id === id);
            if (entry) setFolderEdit({ ...entry, chats: [...(entry.chats || [])] });
          }}
          onManage={() => { setPaneOut(false); setMode("folders"); }}
          say={say}
        />
        <div className="dm-list tg-list" key={`${box}-${activeFolder}`} data-dir={folderDir > 0 ? "next" : folderDir < 0 ? "prev" : ""}>
          {box === "chats" && activeFolder === "all" && archived.length && !needle && !selecting ? (
            <div className="dm-enter">
              <div role="button" tabIndex={0} className="dm-row tg-row tg-archive" onClick={() => { setPaneOut(false); setMode("archive"); }} onKeyDown={(event) => { if (event.key === "Enter") { setPaneOut(false); setMode("archive"); } }}>
                <span className="tg-archive-face"><Archive weight="fill" /></span>
                <span className="tg-body">
                  <span className="tg-l1"><strong>{say("Archived chats", "Chat archiviate")}</strong><span className="tg-fill" /></span>
                  <span className="tg-l2"><span className="tg-prev">{archived.map((item) => item.name.split(" ")[0]).join(", ")}</span>{archived.some((item) => unreadOf(item)) ? <b className="tg-badge muted">{archived.filter((item) => unreadOf(item)).length}</b> : null}</span>
                </span>
              </div>
            </div>
          ) : null}
          {box === "calls" ? callRows.map((item, index) => {
            const missed = item.from === "them" && !item.duration;
            const label = item.call === "video" ? say("Video", "Video") : say("Voice", "Vocale");
            const way = item.from === "me" ? say("Outgoing", "In uscita") : (missed ? say("Missed", "Persa") : say("Incoming", "In entrata"));
            const WayIcon = item.from === "me" ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
            return (
              <div key={item.key} className="dm-call-row tg-call" style={{ "--i": Math.min(index, 12) }}>
                <ThreadFace thread={item.thread} />
                <span className="tg-body">
                  <span className="tg-l1"><strong className={missed ? "missed" : ""}>{item.thread.name}</strong><span className="tg-fill" /><time>{item.time}</time></span>
                  <span className="tg-l2"><span className="tg-prev"><WayIcon className={missed ? "missed" : ""} weight="bold" />{way} · {label}{item.duration ? ` · ${callStamp(item.duration)}` : ""}</span>
                    <button type="button" className="tg-call-btn" aria-label={item.call === "video" ? say("Video call", "Videochiamata") : say("Call", "Chiama")} onClick={() => placeCall(item.thread, item.call)}>
                      {item.call === "video" ? <Video weight="fill" /> : <Phone weight="fill" />}
                    </button>
                  </span>
                </span>
              </div>
            );
          }) : listed.map(({ item, pinned }, index) => renderRow(item, pinned, index))}
        </div>
        {box === "chats" && listed.length === 0 ? (
          <div className="ig-empty">
            <i><MessageCircle strokeWidth={1.4} /></i>
            <strong>{needle ? say("No results", "Nessun risultato") : activeFolder !== "all" ? say("This folder is empty", "Questa cartella è vuota") : say("No messages", "Nessun messaggio")}</strong>
            <span>{needle ? say("No chat with this name.", "Nessuna chat con questo nome.") : activeFolder !== "all" ? say("Chats that match the folder rules appear here.", "Qui compaiono le chat che rispettano le regole della cartella.") : say("Start a chat with someone you follow.", "Inizia una chat con chi segui.")}</span>
          </div>
        ) : null}
        {box === "calls" && callRows.length === 0 ? (
          <div className="ig-empty"><i><Phone strokeWidth={1.4} /></i><strong>{say("No calls yet", "Ancora nessuna chiamata")}</strong></div>
        ) : null}
      </div>
      {selecting ? (
        <div className="tg-actions">
          <button type="button" disabled={!selectedIds.length} onClick={() => { readIds(selectedIds); setSelecting(null); }}><MarkRead strokeWidth={2} />{say("Read", "Leggi")}</button>
          <button type="button" disabled={!selectedIds.length} onClick={() => { archiveIds(selectedIds, true); setSelecting(null); }}><Archive strokeWidth={2} />{say("Archive", "Archivia")}</button>
          <button type="button" disabled={!selectedIds.length} onClick={() => { space.setDmFlags(selectedIds, "muted", true); setSelecting(null); }}><BellOff strokeWidth={2} />{say("Mute", "Silenzia")}</button>
          <button type="button" className="danger" disabled={!selectedIds.length} onClick={() => { for (const id of selectedIds) { const item = threads.find((entry) => entry.id === id); if (item) hideThread(item); } setSelecting(null); }}><Trash strokeWidth={2} />{say("Delete", "Elimina")}</button>
        </div>
      ) : null}
      {hint && !pane ? <p className="gi-toast">{hint}</p> : null}
      {sheetItem ? (
        <div className="ps-sheet-wrap" onClick={() => setSheet(null)}>
          <div className="ps-sheet dm-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            <div className="dm-sheet-head"><ThreadFace thread={sheetItem} /><strong>{sheetItem.name}</strong></div>
            <button type="button" onClick={() => { space.setDmFlag(sheetItem.id, "pinned", !flags[sheetItem.id]?.pinned); setSheet(null); }}>
              <Pin strokeWidth={2} />{flags[sheetItem.id]?.pinned ? say("Unpin", "Rimuovi dai fissati") : say("Pin", "Fissa")}
            </button>
            {unreadOf(sheetItem) ? (
              <button type="button" onClick={() => { readIds([sheetItem.id]); setSheet(null); }}><MarkRead strokeWidth={2} />{say("Mark as read", "Segna come letta")}</button>
            ) : !sheetItem.live ? (
              <button type="button" onClick={() => { space.markThreadUnread(sheetItem.id); setSheet(null); }}><MessageCircle strokeWidth={2} />{say("Mark as unread", "Segna come da leggere")}</button>
            ) : null}
            <button type="button" onClick={() => { space.setDmFlag(sheetItem.id, "muted", !flags[sheetItem.id]?.muted); setSheet(null); }}>
              {flags[sheetItem.id]?.muted ? <Bell strokeWidth={2} /> : <BellOff strokeWidth={2} />}{flags[sheetItem.id]?.muted ? say("Unmute", "Riattiva notifiche") : say("Mute", "Silenzia")}
            </button>
            <button type="button" onClick={() => { archiveIds([sheetItem.id], !isArchived(sheetItem)); setSheet(null); }}>
              <Archive strokeWidth={2} />{isArchived(sheetItem) ? say("Unarchive", "Ripristina") : say("Archive", "Archivia")}
            </button>
            {folders.filter((entry) => !entry.people || !entry.groups).map((entry) => {
              const inside = (entry.chats || []).includes(sheetItem.id);
              return (
                <button key={entry.id} type="button" onClick={() => { space.setDmFolders(folders.map((item) => (item.id === entry.id ? { ...item, chats: inside ? item.chats.filter((value) => value !== sheetItem.id) : [...(item.chats || []), sheetItem.id] } : item))); setSheet(null); }}>
                  <Folder strokeWidth={2} />{inside ? say(`Remove from “${entry.name}”`, `Togli da «${entry.name}»`) : say(`Add to “${entry.name}”`, `Aggiungi a «${entry.name}»`)}
                </button>
              );
            })}
            <button type="button" className="danger" onClick={() => hideThread(sheetItem)}><Trash strokeWidth={2} />{say("Delete", "Elimina")}</button>
          </div>
        </div>
      ) : null}
    </div>
    {pane ? (
      <Layer
        key={thread ? thread.id : folderEdit ? `fe-${folderEdit.id}` : mode}
        kind="push"
        exiting={paneOut}
        onDone={finishPane}
        onClose={folderEdit ? () => setFolderEdit(null) : closePane}
      >
        {pane}
      </Layer>
    ) : null}
    </>
  );
}

function defaultFolders(it) {
  return [
    { id: "unread", name: it ? "Non lette" : "Unread", unreadOnly: true, chats: [] },
    { id: "people", name: it ? "Personali" : "Personal", people: true, chats: [] },
    { id: "groups", name: it ? "Gruppi" : "Groups", groups: true, chats: [] },
  ];
}

function folderSummary(entry, say) {
  const parts = [];
  if (entry.people) parts.push(say("personal chats", "chat personali"));
  if (entry.groups) parts.push(say("groups", "gruppi"));
  if (entry.chats?.length) parts.push(say(`${entry.chats.length} chats`, `${entry.chats.length} chat`));
  if (entry.unreadOnly) parts.push(say("new messages from all chats", "nuovi messaggi da tutte le chat"));
  let text = parts.join(", ") || say("empty", "vuota");
  if (entry.noMuted) text += say(", no muted", ", senza silenziate");
  if (entry.noRead && !entry.unreadOnly) text += say(", unread only", ", solo non lette");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function demoTime(label, it) {
  const value = String(label || "");
  if (!value || value === "Now") return clockNow();
  const hours = value.match(/^(\d+)h$/);
  if (hours) return clockOf(Date.now() - Number(hours[1]) * 3_600_000);
  const weeks = value.match(/^(\d+)\s*(sett|w)/);
  if (weeks) return new Date(Date.now() - Number(weeks[1]) * 7 * 86_400_000).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "2-digit", month: "2-digit" });
  const days = value.match(/^(\d+)[gd]$/);
  if (days) {
    const at = Date.now() - Number(days[1]) * 86_400_000;
    const text = Number(days[1]) < 7
      ? new Date(at).toLocaleDateString(it ? "it-IT" : "en-GB", { weekday: "short" })
      : new Date(at).toLocaleDateString(it ? "it-IT" : "en-GB", { day: "2-digit", month: "2-digit" });
    return text.charAt(0).toUpperCase() + text.slice(1).replace(".", "");
  }
  return value;
}

function ToggleCell({ on, icon, tone, label, onClick }) {
  return (
    <button type="button" className="tg-cell toggle" aria-pressed={on} onClick={onClick}>
      <i className={`tg-ico ${tone}`}>{icon}</i>
      <span><strong>{label}</strong></span>
      <i className={`tg-switch${on ? " on" : ""}`}><b /></i>
    </button>
  );
}

// Telegram-style folder bar: a pill with a sliding highlight under the active folder.
function FolderTabs({ tabs, active, counts, onPick, onEdit, onManage, say }) {
  const barRef = useRef(null);
  const [mark, setMark] = useState(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const press = useRef({ timer: 0, fired: false });
  const measure = () => {
    const bar = barRef.current;
    if (!bar) return;
    const left = bar.scrollLeft > 2;
    const right = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tabs.length]);
  useLayoutEffect(() => {
    const bar = barRef.current;
    const node = bar?.querySelector(`[data-id="${CSS.escape(active)}"]`);
    if (!bar || !node) return;
    setMark({ left: node.offsetLeft, width: node.offsetWidth });
    const target = node.offsetLeft - (bar.clientWidth - node.offsetWidth) / 2;
    if (Math.abs(bar.scrollLeft - target) > 2) bar.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active, tabs.length, counts[active]]);
  return (
    <div className="tg-tabs-wrap">
      <div className="tg-tabs-pill">
      <div className={`tg-tabs${edges.left ? " fade-l" : ""}${edges.right ? " fade-r" : ""}`} ref={barRef} onScroll={measure} role="tablist" aria-label={say("Folders", "Cartelle")}>
        {mark ? <i className="tg-tabs-mark" style={{ transform: `translateX(${mark.left}px)`, width: mark.width }} /> : null}
        {tabs.map((entry) => (
          <button
            key={entry.id}
            data-id={entry.id}
            type="button"
            role="tab"
            aria-selected={active === entry.id}
            className={active === entry.id ? "on" : ""}
            onPointerDown={() => {
              press.current.fired = false;
              window.clearTimeout(press.current.timer);
              press.current.timer = window.setTimeout(() => {
                press.current.fired = true;
                onEdit(entry.id);
              }, 520);
            }}
            onPointerUp={() => window.clearTimeout(press.current.timer)}
            onPointerLeave={() => window.clearTimeout(press.current.timer)}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => {
              if (press.current.fired) return;
              onPick(entry.id);
            }}
          >
            {entry.name}
            {counts[entry.id] ? <b>{counts[entry.id]}</b> : null}
          </button>
        ))}
      </div>
      </div>
      <button type="button" className="tg-tabs-edit" aria-label={say("Edit folders", "Modifica cartelle")} onClick={onManage}><Sliders weight="bold" /></button>
    </div>
  );
}

function ThemeScreen({ theme, mode, onChange, onMode, onClose }) {
  const it = useContext(SpacePrefs).language === "it";
  return (
    <div className="panel view st">
      <StHead title={it ? "Colori" : "Colors"} onClose={onClose} />
      <div className="panel-scroll">
        <StHero id="theme" title={it ? "Colori" : "Colors"} meta={it ? "Sfondo e colore dell'app" : "App background and color"} />
        <h2 className="set-kicker">{it ? "Aspetto" : "Appearance"}</h2>
        <div className="mode-row" role="group" aria-label={it ? "Sfondo" : "Background"}>
          <button type="button" className={mode === "light" ? "st-mode on" : "st-mode"} aria-pressed={mode === "light"} onClick={() => onMode("light")}>
            <span className="st-mode-pic light"><i /><i /><i /></span>{it ? "Chiaro" : "Light"}
          </button>
          <button type="button" className={mode === "dark" ? "st-mode on" : "st-mode"} aria-pressed={mode === "dark"} onClick={() => onMode("dark")}>
            <span className="st-mode-pic dark"><i /><i /><i /></span>{it ? "Scuro" : "Dark"}
          </button>
        </div>
        <h2 className="set-kicker">{it ? "Colore principale" : "Accent color"}</h2>
        <div className="theme-grid">
          {THEMES.map((item) => {
            const selected = theme.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={selected ? "theme-swatch on" : "theme-swatch"}
                style={{ "--swatch": item.accent }}
                aria-pressed={selected}
                onClick={() => onChange(item.id)}
              >
                <span />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function useCountUp(target, ms = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (calm || end === 0) {
      setValue(end);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (end - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function compact(value, it) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}${it ? " Mln" : "M"}`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString(it ? "it-IT" : "en-US");
}

// Bio text with tappable #hashtags, @mentions and links.
// A tagged person's name: opens their profile when they exist on Space.
function TagName({ name, className = "ig-tag-name", style }) {
  const nav = useContext(ThoughtNav);
  const person = SEARCH_PEOPLE.find((entry) => entry.name === name);
  return (
    <button type="button" className={className} style={style} onClick={(event) => { event.stopPropagation(); if (person) nav.person?.({ name: person.name }); }}>
      {person ? person.handle : name}
    </button>
  );
}

function RichText({ text, onTag }) {
  const nav = useContext(ThoughtNav);
  const handle = onTag || nav.tag;
  const parts = String(text || "").split(/(\s+)/);
  return parts.map((part, i) => {
    // Mentions and hashtags may sit inside quotes or brackets, and end with punctuation.
    const match = part.match(/^([“"(«']*)([@#][\p{L}\d_.]*[\p{L}\d_])(.*)$/u);
    if (match && (match[2][0] === "#" ? /^#[\p{L}\d_]+$/u.test(match[2]) : /^@[\w.]+$/.test(match[2]))) {
      return (
        <Fragment key={i}>
          {match[1]}
          <button type="button" className="rt-tag" onClick={(event) => { event.stopPropagation(); handle?.(match[2]); }}>{match[2]}</button>
          {match[3]}
        </Fragment>
      );
    }
    if (/^(https?:\/\/|www\.)\S+/.test(part)) return <a key={i} className="rt-link" href={part.startsWith("http") ? part : `https://${part}`} target="_blank" rel="noreferrer">{part.replace(/^https?:\/\//, "")}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function QrCard({ url, handle, it, onClose, onNote }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const dots = [];
    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) if (qr.isDark(r, c)) dots.push([c, r]);
    }
    return { count, dots };
  }, [url]);
  const [tone, setTone] = useState(0);
  const tones = [["#7c3aed", "#ff2d55"], ["#ff8a00", "#ff2d55"], ["#0095f6", "#34c759"], ["#111111", "#3a3a3c"]];
  const [a, b] = tones[tone];
  return (
    <div className="pf-qr-back" style={{ background: `linear-gradient(160deg, ${a}, ${b})` }} onClick={onClose}>
      <button type="button" className="pf-qr-tone" onClick={(event) => { event.stopPropagation(); setTone((value) => (value + 1) % tones.length); }}>
        {it ? "Colore" : "Colour"}
      </button>
      <div className="pf-qr-card" onClick={(event) => event.stopPropagation()}>
        <svg viewBox={`-1 -1 ${cells.count + 2} ${cells.count + 2}`} aria-label={`QR ${handle}`}>
          <defs>
            <linearGradient id="qr-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={a} />
              <stop offset="1" stopColor={b} />
            </linearGradient>
          </defs>
          {cells.dots.map(([x, y]) => <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width="0.84" height="0.84" rx="0.28" fill="url(#qr-fill)" />)}
        </svg>
        <strong style={{ background: `linear-gradient(90deg, ${a}, ${b})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>@{handle.toUpperCase()}</strong>
      </div>
      <div className="pf-qr-actions" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { navigator.share ? navigator.share({ title: `@${handle}`, url }).catch(() => {}) : navigator.clipboard?.writeText(url); }}>
          <i><ArrowUpRight /></i><span>{it ? "Condividi profilo" : "Share profile"}</span>
        </button>
        <button type="button" onClick={() => { navigator.clipboard?.writeText(url).catch(() => {}); onNote(it ? "Link copiato" : "Link copied"); }}>
          <i><Copy /></i><span>{it ? "Copia link" : "Copy link"}</span>
        </button>
      </div>
    </div>
  );
}

function Profile({
  profile,
  grid,
  reels,
  tagged,
  myDeck,
  storySeen,
  highlights,
  onOpenStory,
  onOpenCamera,
  onOpenFeed,
  onOpenPeople,
  onEdit,
  onSaved,
  onOpenHighlight,
  onNewHighlight,
}) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [board, setBoard] = useState(0);
  const thoughtNav = useContext(ThoughtNav);
  const [discover, setDiscover] = useState(false);
  const [dismissed, setDismissed] = useState(() => new Set());
  const [peek, setPeek] = useState(null);
  const [qr, setQr] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(profile.note || "");
  const [toast, setToast] = useState("");
  const pagerRef = useRef(null);
  const trackRef = useRef(null);
  const drag = useRef(null);
  const pressRef = useRef({ timer: 0, fired: false });
  const pinned = new Set(profile.pinned || []);
  const handle = String(profile.handle || "").replace(/^@/, "");
  const ordered = [...grid].sort((x, y) => Number(pinned.has(y.id)) - Number(pinned.has(x.id)));
  const shop = useShop(null);
  const boards = shop?.shop !== false && shop ? [ordered, reels, "shop", "thoughts", tagged] : [ordered, reels, "thoughts", tagged];
  const LAST = boards.length - 1;
  const posts = useCountUp(grid.length);
  const followers = useCountUp(CONTACTS.length * 137 + 4);
  const following = useCountUp(space.follows.size);
  const suggestions = MEET.filter((person) => !space.follows.has(person.name) && !dismissed.has(person.name) && !personHidden(prefs, person.name));
  const unseen = myDeck ? myDeck.frames.some((frame) => !storySeen.has(frame.id)) : false;
  const profileUrl = `${window.location.origin}/u/${handle}`;

  function note(text) {
    setToast(text);
    window.clearTimeout(note.t);
    note.t = window.setTimeout(() => setToast(""), 1400);
  }

  function setPane(next, animate = true) {
    const value = Math.max(0, Math.min(LAST, next));
    setBoard(value);
    const track = trackRef.current;
    if (track) {
      track.style.transition = animate ? "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)" : "none";
      track.style.transform = `translate3d(${-value * 100 / boards.length}%, 0, 0)`;
    }
  }

  function pagerDown(event) {
    if (event.target.closest("button") && event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, lock: "", t: performance.now() };
  }
  function pagerMove(event) {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.lock) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) d.lock = "x";
      else if (Math.abs(dy) > 10) { drag.current = null; return; }
      else return;
      window.clearTimeout(pressRef.current.timer);
    }
    const width = pagerRef.current?.clientWidth || 1;
    const edge = (board === 0 && dx > 0) || (board === LAST && dx < 0) ? 0.25 : 1;
    const track = trackRef.current;
    if (track) {
      track.style.transition = "none";
      track.style.transform = `translate3d(${(-board * width) + dx * edge}px, 0, 0)`;
    }
    d.dx = dx;
  }
  function pagerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.lock !== "x") return;
    const width = pagerRef.current?.clientWidth || 1;
    const fast = Math.abs(d.dx) / Math.max(1, performance.now() - d.t) > 0.45;
    const next = Math.abs(d.dx) > width * 0.25 || fast ? board + (d.dx < 0 ? 1 : -1) : board;
    const track = trackRef.current;
    if (track) {
      track.style.transition = "transform 380ms cubic-bezier(0.32, 0.72, 0, 1)";
      track.style.transform = `translate3d(${-Math.max(0, Math.min(LAST, next)) * width}px, 0, 0)`;
    }
    setBoard(Math.max(0, Math.min(LAST, next)));
    window.setTimeout(() => setPane(Math.max(0, Math.min(LAST, next)), false), 400);
  }

  function tileDown(post, event) {
    pressRef.current.fired = false;
    window.clearTimeout(pressRef.current.timer);
    pressRef.current.timer = window.setTimeout(() => {
      pressRef.current.fired = true;
      navigator.vibrate?.(10);
      setPeek(post);
    }, 380);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function tileUp(list, index) {
    window.clearTimeout(pressRef.current.timer);
    if (pressRef.current.fired) return;
    onOpenFeed(list, index);
  }

  const tabs = [
    { label: say("Posts", "Post"), icon: LayoutGrid },
    { label: "Reels", icon: SquarePlay },
    ...(boards.includes("shop") ? [{ label: "Shop", icon: Bag }] : []),
    { label: say("Thoughts", "Pensieri"), icon: Feather },
    { label: say("Tagged", "Tag"), icon: AtSign },
  ];

  return (
    <div className="panel view ig-profile pf2">
      <div className="panel-scroll">
        <div className="pf-head">
          <div className="pf-avatar-wrap">
            <button type="button" className="pf-note" onClick={() => { setNoteDraft(profile.note || ""); setNoteOpen(true); }}>
              {profile.note ? <span>{profile.note}</span> : <em>{say("Note…", "Nota…")}</em>}
            </button>
            <button
              type="button"
              className={`pf-avatar${myDeck ? (unseen ? " ring" : " ring seen") : ""}`}
              aria-label={myDeck ? say("Open your story", "Apri la tua storia") : say("Add to story", "Aggiungi alla storia")}
              onClick={(event) => (myDeck ? onOpenStory(myDeck.id, event.currentTarget) : onOpenCamera())}
            >
              <RemoteImage src={AVATAR} alt="" />
            </button>
            <button type="button" className="pf-add" aria-label={say("New story", "Nuova storia")} onClick={onOpenCamera}><Plus strokeWidth={3} /></button>
          </div>
          <div className="pf-name-stats">
            <strong className="pf-name">{profile.name}{profile.pronouns ? <em>{profile.pronouns}</em> : null}</strong>
            <div className="pf-stats">
              <button type="button" onClick={() => setPane(0)}><b>{compact(posts, it)}</b><span>{say("posts", "post")}</span></button>
              <button type="button" onClick={() => onOpenPeople("followers")}><b>{compact(followers, it)}</b><span>{say("followers", "follower")}</span></button>
              <button type="button" onClick={() => onOpenPeople("following")}><b>{compact(following, it)}</b><span>{say("following", "seguiti")}</span></button>
            </div>
          </div>
        </div>

        <div className="pf-bio">
          {profile.category ? <span className="pf-cat">{profile.category}</span> : null}
          {profile.bio ? <p><RichText text={profile.bio} onTag={(tag) => note(tag)} /></p> : null}
          {profile.link ? (
            <a className="pf-link" href={profile.link.startsWith("http") ? profile.link : `https://${profile.link}`} target="_blank" rel="noreferrer">
              <LinkIcon /> {profile.link.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>

        {shop ? (
          <>
            <BusinessCard shop={shop} />
            <BusinessInsights />
          </>
        ) : null}

        <div className="pf-buttons">
          <button type="button" className="ig-btn" onClick={onEdit}>{say("Edit profile", "Modifica profilo")}</button>
          <button type="button" className="ig-btn" onClick={() => setQr(true)}>{say("Share profile", "Condividi profilo")}</button>
          <button type="button" className={`ig-btn square${discover ? " on" : ""}`} aria-pressed={discover} aria-label={say("Discover people", "Scopri persone")} onClick={() => setDiscover((value) => !value)}>
            <UserPlus weight={discover ? "fill" : "regular"} />
          </button>
        </div>

        <div className={`pf-discover${discover ? " open" : ""}`} aria-hidden={!discover}>
          <div className="pf-discover-in">
            <header>
              <strong>{say("Discover people", "Scopri persone")}</strong>
              <button type="button" className="rt-tag" onClick={() => note(say("More suggestions soon", "Altri suggerimenti a breve"))}>{say("See all", "Vedi tutti")}</button>
            </header>
            <div className="h-rail">
              {suggestions.map((person) => (
                <article key={person.name} className="ig-suggest-card">
                  <button type="button" className="pf-x" aria-label={say("Dismiss", "Ignora")} onClick={() => setDismissed((prev) => new Set(prev).add(person.name))}><X /></button>
                  <RemoteImage className="ig-suggest-face" src={person.src} alt="" />
                  <strong>{person.name}</strong>
                  <span>{person.meta}</span>
                  <button type="button" className="ig-btn primary" onClick={() => space.toggleFollow(person.name)}>{say("Follow", "Segui")}</button>
                </article>
              ))}
              {suggestions.length === 0 ? <p className="msg-hint">{say("You're following everyone suggested.", "Segui già tutti i suggeriti.")}</p> : null}
            </div>
          </div>
        </div>

        <div className="highlights">
          <button type="button" className="highlight add" onClick={onNewHighlight}>
            <span className="highlight-ring"><Plus strokeWidth={1.6} aria-hidden="true" /></span>
            <b>{say("New", "Nuovo")}</b>
          </button>
          {highlights.map((item) => (
            <button key={item.id} type="button" className="highlight" onClick={(event) => onOpenHighlight(item.id, event.currentTarget)}>
              <span className="highlight-ring"><RemoteImage src={item.src} alt="" /></span>
              <b>{item.name}</b>
            </button>
          ))}
        </div>

        <div className="pf-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${boards.length}, 1fr)` }}>
          {tabs.map((tab, i) => (
            <button key={tab.label} type="button" role="tab" aria-selected={board === i} aria-label={tab.label} className={board === i ? "on" : ""} onClick={() => setPane(i)}>
              <tab.icon weight={board === i ? "fill" : "regular"} />
            </button>
          ))}
          <i className="pf-tabs-bar" style={{ width: `${100 / boards.length}%`, transform: `translateX(${board * 100}%)` }} />
        </div>

        <div className="pf-pager" ref={pagerRef} onPointerDown={pagerDown} onPointerMove={pagerMove} onPointerUp={pagerUp} onPointerCancel={pagerUp}>
          <div className="pf-track" ref={trackRef} style={{ width: `${boards.length * 100}%` }}>
            {boards.map((list, pane) => (
              <div key={pane} className={`pf-pane${board === pane ? " on" : ""}`} style={{ width: `${100 / boards.length}%` }}>
                {list === "shop" ? (
                  <ShopGrid shop={shop} onOpen={(product) => thoughtNav.product?.(product, null)} onAdd={() => thoughtNav.editProduct?.(null)} />
                ) : list === "thoughts" ? (
                  <ThoughtList mine emptyAction={<button type="button" className="ig-btn primary small" onClick={() => thoughtNav.compose?.({})}>{say("Write a thought", "Scrivi un pensiero")}</button>} />
                ) : list.length ? (
                  <div className={`pf-grid${pane === 1 ? " tall" : ""}`}>
                    {list.map((post, index) => (
                      <button
                        key={post.id}
                        type="button"
                        className="pf-tile"
                        style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                        aria-label={`${say("Open", "Apri")} ${post.kind || "post"}, ${post.name}`}
                        onPointerDown={(event) => tileDown(post, event)}
                        onPointerUp={() => tileUp(list, index)}
                        onPointerCancel={() => window.clearTimeout(pressRef.current.timer)}
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        <RemoteImage src={post.image || post.src} alt="" />
                        {pinned.has(post.id) && pane === 0 ? <span className="pf-pin"><Pin weight="fill" /></span> : null}
                        {pane === 0 && post.kind === "reel" ? <span className="pf-kind"><SquarePlay weight="fill" /></span> : null}
                        {pane === 1 ? <span className="pf-tile-mark"><Play weight="fill" />{post.likes || "0"}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ig-empty">
                    <i>{pane === 1 ? <SquarePlay strokeWidth={1.4} /> : list === tagged ? <AtSign strokeWidth={1.4} /> : <Camera strokeWidth={1.4} />}</i>
                    <strong>{list === tagged ? say("Photos and videos of you", "Foto e video in cui sei taggato") : pane === 1 ? say("Share your first reel", "Condividi il tuo primo reel") : say("Share your first post", "Condividi il tuo primo post")}</strong>
                    <span>{list === tagged ? say("When people tag you, they'll appear here.", "Quando qualcuno ti tagga, appariranno qui.") : say("It will appear on your profile.", "Apparirà sul tuo profilo.")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {peek ? (
        <div className="pf-peek-back" onClick={() => setPeek(null)}>
          <div className="pf-peek" onClick={(event) => event.stopPropagation()}>
            <header>
              <RemoteImage className="row-avatar" src={peek.avatar || peek.src || AVATAR} alt="" />
              <strong>{String(peek.handle || peek.name).replace(/^@/, "")}</strong>
            </header>
            <RemoteImage className="pf-peek-img" src={peek.image || peek.src} alt="" />
            <div className="pf-peek-actions">
              <button type="button" className={space.likes.has(peek.id) ? "on" : ""} onClick={() => space.toggleLike(peek.id)}>
                <Heart weight={space.likes.has(peek.id) ? "fill" : "regular"} /><span>{say("Like", "Mi piace")}</span>
              </button>
              <button type="button" onClick={() => { const list = boards[board]; setPeek(null); onOpenFeed(list, Math.max(0, list.findIndex((p) => p.id === peek.id))); }}>
                <MessageCircle /><span>{say("Open", "Apri")}</span>
              </button>
              {board === 0 ? (
                <button type="button" onClick={() => { space.togglePin(peek.id); note(pinned.has(peek.id) ? say("Unpinned", "Rimosso dai fissati") : say("Pinned to profile", "Fissato sul profilo")); setPeek(null); }}>
                  <Pin weight={pinned.has(peek.id) ? "fill" : "regular"} /><span>{pinned.has(peek.id) ? say("Unpin", "Togli") : say("Pin", "Fissa")}</span>
                </button>
              ) : null}
              <button type="button" onClick={() => { space.toggleArchive(peek.id); setPeek(null); note(say("Archived", "Archiviato")); }}>
                <Archive /><span>{say("Archive", "Archivia")}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {qr ? <QrCard url={profileUrl} handle={handle} it={it} onClose={() => setQr(false)} onNote={note} /> : null}

      {noteOpen ? (
        <div className="rs-sheet-back pf-note-back" onClick={() => setNoteOpen(false)}>
          <div className="rs-sheet pf-note-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <div className="pf-note-preview">
              <span className="pf-note-bubble">{noteDraft || say("Share a thought…", "Condividi un pensiero…")}</span>
              <RemoteImage src={AVATAR} alt="" />
            </div>
            <input
              value={noteDraft}
              maxLength={60}
              autoFocus
              placeholder={say("Share a thought…", "Condividi un pensiero…")}
              aria-label={say("Note", "Nota")}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
            <p className="pf-note-help">{say("Your note is visible for 24 hours to people you follow back.", "La nota è visibile per 24 ore a chi ti segue e segui.")} · {60 - noteDraft.length}</p>
            <div className="pf-note-actions">
              {profile.note ? <button type="button" className="warn" onClick={() => { space.saveProfile({ ...profile, note: "" }); setNoteOpen(false); }}>{say("Delete", "Elimina")}</button> : null}
              <button type="button" className="ig-btn primary" disabled={!noteDraft.trim()} onClick={() => { space.saveProfile({ ...profile, note: noteDraft.trim() }); setNoteOpen(false); note(say("Note shared", "Nota condivisa")); }}>{say("Share", "Condividi")}</button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <span key={toast} className="sv-toast pf-toast">{toast}</span> : null}
    </div>
  );
}

function PostsFeed({ posts, start = 0, title, onClose, onComment, onShare, onOpen }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const scroller = useRef(null);
  const [burst, setBurst] = useState(null);
  useLayoutEffect(() => {
    const node = scroller.current?.querySelectorAll(".ig-post")[start];
    const box = scroller.current;
    if (node && box) box.scrollTop = node.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
  }, [start]);
  return (
    <div className="panel view pf-feed">
      <ScreenHead title={title || (it ? "Post" : "Posts")} meta={space.profile.handle} onClose={onClose} />
      <div className="panel-scroll" ref={scroller}>
        {posts.map((item) => {
          const kind = item.kind === "reel" ? "reel" : item.image || item.src ? "post" : "tweet";
          const post = asPost({ ...item, type: kind });
          const liked = space.likes.has(item.id);
          return (
            <FeedPost
              key={item.id}
              item={{ ...item, src: item.avatar || AVATAR, image: item.image || item.src, time: item.time === "Now" ? (it ? "Adesso" : "Just now") : item.time }}
              kind={kind}
              liked={liked}
              saved={space.saves.has(item.id)}
              extraComments={space.comments[item.id]}
              onLike={() => space.toggleLike(item.id)}
              onSave={() => space.toggleSave(post)}
              onComment={() => onComment(post)}
              onShare={() => onShare(post)}
              onOpen={() => onOpen(post)}
              onDoubleLike={() => {
                navigator.vibrate?.(12);
                if (!liked) space.toggleLike(item.id);
                setBurst({ id: item.id, at: Date.now() });
              }}
              burst={burst?.id === item.id ? burst.at : 0}
              mine
              onArchive={() => space.toggleArchive(item.id)}
              onDelete={item.id.startsWith("made-") ? () => space.drop(item.id) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function HighlightNew({ stories, onClose, onSave }) {
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const [picked, setPicked] = useState([]);
  const [step, setStep] = useState("pick");
  const [name, setName] = useState(it ? "In evidenza" : "Highlights");
  const [cover, setCover] = useState(null);
  const chosen = stories.filter((item) => picked.includes(item.id));
  return (
    <div className="panel view hl-new">
      <div className="thread-head ig-head-bar">
        <button type="button" className="bell" aria-label={it ? "Indietro" : "Back"} onClick={step === "name" ? () => setStep("pick") : onClose}><ChevronLeft strokeWidth={2.2} /></button>
        <div className="feed-copy"><strong>{step === "pick" ? (it ? "Seleziona storie" : "Select stories") : (it ? "Nome" : "Title")}</strong></div>
        <button
          type="button"
          className="hl-next"
          disabled={!picked.length || (step === "name" && !name.trim())}
          onClick={() => {
            if (step === "pick") {
              setStep("name");
              return;
            }
            const cov = stories.find((item) => item.id === (cover || picked[0]));
            onSave({
              id: `hl-${Date.now()}`,
              name: name.trim().slice(0, 16),
              full: "Giulia Neri",
              src: cov?.image || chosen[0]?.image,
              mine: true,
              frames: chosen.map((item) => ({ id: `${item.id}-hl`, image: item.image, video: item.video, filter: item.filter, stickers: item.stickers || [], text: item.text || "", time: item.time || "" })),
            });
          }}
        >
          {step === "pick" ? (it ? "Avanti" : "Next") : (it ? "Fine" : "Done")}
        </button>
      </div>
      <div className="panel-scroll">
        {step === "pick" ? (
          stories.length ? (
            <div className="pf-grid hl-grid">
              {stories.map((item) => {
                const n = picked.indexOf(item.id);
                return (
                  <button key={item.id} type="button" className={`pf-tile${n >= 0 ? " picked" : ""}`} onClick={() => setPicked((prev) => (n >= 0 ? prev.filter((id) => id !== item.id) : [...prev, item.id]))}>
                    <img src={item.image} alt="" draggable="false" style={{ filter: filterCss(item.filter) }} />
                    <span className="hl-check">{n >= 0 ? n + 1 : ""}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ig-empty">
              <i><Camera strokeWidth={1.4} /></i>
              <strong>{it ? "Nessuna storia ancora" : "No stories yet"}</strong>
              <span>{it ? "Pubblica una storia e potrai metterla in evidenza." : "Share a story and you can add it to a highlight."}</span>
            </div>
          )
        ) : (
          <div className="hl-name">
            <span className="highlight-ring big"><img src={stories.find((item) => item.id === (cover || picked[0]))?.image} alt="" /></span>
            <input value={name} maxLength={16} autoFocus aria-label={it ? "Nome highlight" : "Highlight name"} onChange={(event) => setName(event.target.value)} />
            <p className="msg-hint">{it ? "Scegli la copertina" : "Pick a cover"}</p>
            <div className="hl-covers">
              {chosen.map((item) => (
                <button key={item.id} type="button" className={(cover || picked[0]) === item.id ? "on" : ""} onClick={() => setCover(item.id)}>
                  <img src={item.image} alt="" draggable="false" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditScreen({ profile, onClose, onSave }) {
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    name: profile.name || "",
    handle: String(profile.handle || "").replace(/^@/, ""),
    pronouns: profile.pronouns || "",
    bio: profile.bio || "",
    link: profile.link || "",
    category: profile.category || "",
    avatar: profile.avatar || "",
  });
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const valid = form.name.trim() && /^[a-z0-9._]{2,30}$/i.test(form.handle.trim());

  function pickPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await loadImage(reader.result).catch(() => null);
      if (!img) return;
      const size = 480;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      drawCover(canvas.getContext("2d"), img, 0, 0, size, size);
      setForm((prev) => ({ ...prev, avatar: canvas.toDataURL("image/jpeg", 0.86) }));
    };
    reader.readAsDataURL(file);
  }

  function save() {
    if (!valid) return;
    onSave({
      ...profile,
      name: form.name.trim(),
      handle: `@${form.handle.trim().toLowerCase()}`,
      pronouns: form.pronouns.trim(),
      bio: form.bio.trim(),
      link: form.link.trim(),
      category: form.category.trim(),
      avatar: form.avatar,
    });
  }

  const [sheet, setSheet] = useState(null);
  const handleOk = /^[a-z0-9._]{2,30}$/i.test(form.handle.trim());
  const original = {
    name: profile.name || "",
    handle: String(profile.handle || "").replace(/^@/, ""),
    pronouns: profile.pronouns || "",
    bio: profile.bio || "",
    link: profile.link || "",
    category: profile.category || "",
    avatar: profile.avatar || "",
  };
  const dirty = Object.keys(original).some((key) => original[key] !== form[key]);
  const categories = it
    ? ["Ceramista", "Cuoca", "Liutaio", "Sarta", "Designer", "Artista", "Fotografo"]
    : ["Ceramicist", "Cook", "Luthier", "Tailor", "Designer", "Artist", "Photographer"];
  const pronouns = it ? ["lei/la", "lui/lo", "loro"] : ["she/her", "he/him", "they/them"];
  const linkShown = form.link.trim().replace(/^https?:\/\//, "");

  const field = (key, label, options = {}) => (
    <label className="ep-row">
      <span className="ep-label">{label}</span>
      <span className="ep-input">
        {options.prefix ? <b>{options.prefix}</b> : null}
        <input
          value={form[key]}
          maxLength={options.max}
          placeholder={options.placeholder || label}
          onChange={set(key)}
          aria-label={label}
          autoCapitalize={options.lower ? "none" : "sentences"}
          spellCheck={!options.lower}
        />
        {options.state ? <i className={`ep-state ${options.state}`}>{options.state === "ok" ? <Checked weight="fill" /> : <Warn />}</i> : null}
      </span>
    </label>
  );

  return (
    <div className="panel view st ep">
      <div className="st-head ep-head">
        <button type="button" className="ep-cancel" onClick={() => (dirty ? setSheet("discard") : onClose())}>{say("Cancel", "Annulla")}</button>
        <strong>{say("Edit profile", "Modifica profilo")}</strong>
        <button type="button" className="ep-done" disabled={!valid || !dirty} onClick={save}>{say("Done", "Fine")}</button>
      </div>
      <div className="panel-scroll">
        <div className="ep-photo">
          <button type="button" className="ep-face" onClick={() => setSheet("photo")} aria-label={say("Change photo", "Cambia foto")}>
            <RemoteImage src={form.avatar || DEFAULT_AVATAR} alt="" />
            <i><Camera weight="fill" /></i>
          </button>
          <button type="button" className="ep-photo-link" onClick={() => setSheet("photo")}>{say("Edit picture", "Modifica immagine")}</button>
        </div>

        <h2 className="st-cap">{say("Preview", "Anteprima")}</h2>
        <div className="st-card ep-preview">
          <strong>{form.name.trim() || say("Your name", "Il tuo nome")}{form.pronouns.trim() ? <em> {form.pronouns.trim()}</em> : null}</strong>
          {form.category.trim() ? <span className="ep-pv-cat">{form.category.trim()}</span> : null}
          {form.bio.trim() ? <p>{form.bio.trim()}</p> : <p className="ep-pv-empty">{say("Your bio will appear here.", "Qui comparirà la tua bio.")}</p>}
          {linkShown ? <span className="ep-pv-link"><LinkIcon strokeWidth={2.2} />{linkShown}</span> : null}
        </div>

        <h2 className="st-cap">{say("Public profile", "Profilo pubblico")}</h2>
        <div className="st-card">
          {field("name", say("Name", "Nome"), { max: 30 })}
          {field("handle", say("Username", "Nome utente"), { max: 30, prefix: "@", lower: true, state: form.handle.trim() !== original.handle ? (handleOk ? "ok" : "err") : "" })}
          {field("pronouns", say("Pronouns", "Pronomi"), { max: 12, placeholder: pronouns[0] })}
          {field("category", say("Category", "Categoria"), { max: 30, placeholder: categories[0] })}
        </div>
        {!handleOk ? <p className="ep-note err"><Warn />{say("Username: 2–30 letters, numbers, dots or underscores.", "Nome utente: 2–30 lettere, numeri, punti o trattini bassi.")}</p> : null}
        <div className="ep-chips" aria-label={say("Suggested categories", "Categorie suggerite")}>
          {categories.map((item) => (
            <button key={item} type="button" className={form.category === item ? "on" : ""} onClick={() => setForm((prev) => ({ ...prev, category: prev.category === item ? "" : item }))}>{item}</button>
          ))}
        </div>
        <div className="ep-chips small" aria-label={say("Pronouns", "Pronomi")}>
          {pronouns.map((item) => (
            <button key={item} type="button" className={form.pronouns === item ? "on" : ""} onClick={() => setForm((prev) => ({ ...prev, pronouns: prev.pronouns === item ? "" : item }))}>{item}</button>
          ))}
        </div>

        <h2 className="st-cap">Bio</h2>
        <div className="st-card ep-bio">
          <textarea value={form.bio} maxLength={150} rows={4} onChange={set("bio")} placeholder={say("Tell people about your work…", "Racconta il tuo lavoro…")} aria-label="Bio" />
          <span className={`ep-count${form.bio.length > 135 ? " warn" : ""}`}>{150 - form.bio.length}</span>
        </div>

        <h2 className="st-cap">Link</h2>
        <div className="st-card">
          <label className="ep-row">
            <i className="st-ico blue ep-link-ico"><LinkIcon weight="bold" /></i>
            <span className="ep-input">
              <input value={form.link} maxLength={120} placeholder="space.app/tuo-nome" onChange={set("link")} aria-label="Link" autoCapitalize="none" spellCheck="false" />
              {form.link ? <button type="button" className="sx-clear" aria-label={say("Clear", "Cancella")} onClick={() => setForm((prev) => ({ ...prev, link: "" }))}><X strokeWidth={2.6} /></button> : null}
            </span>
          </label>
        </div>
        <p className="ep-note">{say("Your name, username, bio and link are visible to everyone on Space.", "Nome, nome utente, bio e link sono visibili a tutti su Space.")}</p>
      </div>
      <input ref={fileRef} className="sr" type="file" accept="image/*" onChange={pickPhoto} />
      {sheet ? (
        <div className="ps-sheet-wrap" onClick={() => setSheet(null)}>
          <div className="ps-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="ps-grab" />
            {sheet === "photo" ? (
              <>
                <button type="button" onClick={() => { setSheet(null); fileRef.current?.click(); }}><Image strokeWidth={2} />{say("Choose from library", "Scegli dalla libreria")}</button>
                {form.avatar ? <button type="button" className="danger" onClick={() => { setForm((prev) => ({ ...prev, avatar: "" })); setSheet(null); }}><Trash strokeWidth={2} />{say("Remove current picture", "Rimuovi foto attuale")}</button> : null}
              </>
            ) : (
              <>
                <p className="dm-note-hint center">{say("Discard the changes to your profile?", "Scartare le modifiche al profilo?")}</p>
                <button type="button" className="danger" onClick={onClose}><Trash strokeWidth={2} />{say("Discard changes", "Scarta modifiche")}</button>
                <button type="button" onClick={() => { setSheet(null); save(); }} disabled={!valid}><Check strokeWidth={2} />{say("Save", "Salva")}</button>
              </>
            )}
            <button type="button" className="warn" onClick={() => setSheet(null)}>{say("Cancel", "Annulla")}</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PeopleScreen({ kind, onClose }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const [tab, setTab] = useState(kind === "following" ? 1 : 0);
  const [query, setQuery] = useState("");
  const people = [
    ...CONTACTS,
    ...[...space.follows]
      .filter((name) => !CONTACTS.some((person) => person.name === name))
      .map((name) => {
        const known = DIRECTORY.find((person) => person.name === name) || MEET.find((person) => person.name === name);
        return { name, meta: known ? (known.meta || `${known.craft} · ${known.city}`) : "", src: known?.src || avatarFor(name) };
      }),
  ];
  const needle = query.trim().toLowerCase();
  const list = (tab === 0 ? people : people.filter((person) => space.follows.has(person.name)))
    .filter((person) => !personHidden(prefs, person.name, true))
    .filter((person) => !needle || `${person.name} ${person.meta}`.toLowerCase().includes(needle));
  return (
    <div className="panel view pf-people">
      <ScreenHead title={space.profile.handle.replace(/^@/, "")} onClose={onClose} />
      <div className="pf-people-tabs" role="tablist">
        {[it ? "Follower" : "Followers", it ? "Seguiti" : "Following"].map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{label}</button>
        ))}
        <i style={{ transform: `translateX(${tab * 100}%)` }} />
      </div>
      <label className="search-field pf-people-search">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={it ? "Cerca" : "Search"} aria-label={it ? "Cerca persone" : "Search people"} />
      </label>
      <div className="panel-scroll">
        {list.length === 0 ? <p className="rs-none">{it ? "Nessuno qui." : "Nobody here."}</p> : null}
        {list.map((person) => {
          const on = space.follows.has(person.name);
          return (
            <article key={person.name} className="ig-row">
              <RemoteImage className="row-avatar" src={person.src} alt="" />
              <div className="ig-row-copy">
                <strong>{person.name}</strong>
                <span>{person.meta}</span>
              </div>
              <button type="button" className={on ? "ig-btn small" : "ig-btn small primary"} aria-pressed={on} onClick={() => space.toggleFollow(person.name)}>
                {on ? (it ? "Segui già" : "Following") : (tab === 0 ? (it ? "Ricambia" : "Follow back") : (it ? "Segui" : "Follow"))}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const DEMO_GALLERY = [...new Set([
  ...WORKS.map((work) => work.src),
  PORTRAIT,
  ...PEOPLE.map((person) => person.src),
  ...POSTS.map((post) => post.image).filter(Boolean),
])];

function CreateScreen({ onClose, onPublish, onStory, onReel, onThought }) {
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const fileRef = useRef(null);
  const [gallery, setGallery] = useState(DEMO_GALLERY);
  const [step, setStep] = useState("pick");
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState([DEMO_GALLERY[1]]);
  const [focus, setFocus] = useState(DEMO_GALLERY[1]);
  const [aspect, setAspect] = useState("4:5");
  const [filter, setFilter] = useState("normal");
  const [slide, setSlide] = useState(0);
  const [caption, setCaption] = useState("");
  const [place, setPlace] = useState("");
  const [tags, setTags] = useState([]);
  const [panel, setPanel] = useState(null);
  const [hideLikes, setHideLikes] = useState(false);
  const [noComments, setNoComments] = useState(false);
  const trackRef = useRef(null);

  function toggle(src) {
    setFocus(src);
    if (!multi) {
      setPicked([src]);
      return;
    }
    setPicked((prev) => {
      if (prev.includes(src)) return prev.length > 1 ? prev.filter((item) => item !== src) : prev;
      return prev.length >= 10 ? prev : [...prev, src];
    });
  }

  function fromDevice(event) {
    const files = [...(event.target.files || [])].filter((file) => file.type.startsWith("image/")).slice(0, 10);
    event.target.value = "";
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const img = await loadImage(reader.result).catch(() => null);
        if (!img) return;
        const scale = Math.min(1, 1440 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const src = canvas.toDataURL("image/jpeg", 0.85);
        setGallery((prev) => [src, ...prev]);
        setFocus(src);
        setPicked((prev) => (multi ? [...prev, src].slice(0, 10) : [src]));
      };
      reader.readAsDataURL(file);
    });
  }

  function publish() {
    onPublish({
      id: `made-${Date.now()}`,
      kind: "post",
      image: picked[0],
      images: picked,
      aspect,
      filter,
      text: caption.trim(),
      location: place,
      tags,
      hideLikes,
      noComments,
      name: "Giulia Neri",
      handle: place || "@forno.neri",
      avatar: AVATAR,
      src: AVATAR,
      likes: "0",
      comments: "0",
      saves: "0",
      time: "Now",
      mine: true,
      thread: [],
    });
  }

  const filterNow = filterCss(filter);
  const title = step === "pick" ? say("New post", "Nuovo post") : step === "edit" ? say("Edit", "Modifica") : say("New post", "Nuovo post");

  return (
    <div className={`panel view np np-step-${step}`}>
      <div className="thread-head ig-head-bar">
        <button type="button" className="bell" aria-label={step === "pick" ? say("Close", "Chiudi") : say("Back", "Indietro")} onClick={() => (step === "pick" ? onClose() : setStep(step === "details" ? "edit" : "pick"))}>
          {step === "pick" ? <X /> : <ChevronLeft strokeWidth={2.2} />}
        </button>
        <div className="feed-copy"><strong>{title}</strong></div>
        {step === "details" ? (
          <button type="button" className="hl-next" onClick={publish}>{say("Share", "Condividi")}</button>
        ) : (
          <button type="button" className="hl-next" disabled={!picked.length} onClick={() => setStep(step === "pick" ? "edit" : "details")}>{say("Next", "Avanti")}</button>
        )}
      </div>

      {step === "pick" ? (
        <>
          <div className={`np-preview a-${aspect.replace(":", "-")}`}>
            <img key={focus} src={focus} alt="" draggable="false" />
            <button type="button" className="np-chip left" aria-label={say("Aspect ratio", "Formato")} onClick={() => setAspect((value) => (value === "4:5" ? "1:1" : "4:5"))}>
              {aspect}
            </button>
            <button type="button" className={`np-chip right${multi ? " on" : ""}`} aria-pressed={multi} onClick={() => { setMulti((value) => !value); if (multi) setPicked([focus]); }}>
              <Copy weight={multi ? "fill" : "regular"} /> {say("Select multiple", "Seleziona più")}
            </button>
          </div>
          <div className="np-bar">
            <strong>{say("Recents", "Recenti")}</strong>
            <button type="button" className="np-device" onClick={() => fileRef.current?.click()}><Image /> {say("Library", "Libreria")}</button>
          </div>
          <div className="panel-scroll np-scroll">
            <div className="np-grid">
              <button type="button" className="np-cam" onClick={onStory} aria-label={say("Camera", "Fotocamera")}><Camera /></button>
              {gallery.map((src, i) => {
                const n = picked.indexOf(src);
                return (
                  <button key={`${i}-${src.slice(-24)}`} type="button" className={`np-cell${focus === src ? " focus" : ""}`} onClick={() => toggle(src)}>
                    <img src={src} alt="" draggable="false" loading="lazy" />
                    {multi ? <span className={n >= 0 ? "np-n on" : "np-n"}>{n >= 0 ? n + 1 : ""}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="np-modes" role="tablist">
            <button type="button" role="tab" aria-selected="true" className="on">POST</button>
            <button type="button" role="tab" onClick={onStory}>{say("STORY", "STORIA")}</button>
            <button type="button" role="tab" onClick={onReel}>REEL</button>
            <button type="button" role="tab" onClick={onThought}>{say("THOUGHT", "PENSIERO")}</button>
          </div>
          <input ref={fileRef} className="sr" type="file" accept="image/*" multiple onChange={fromDevice} />
        </>
      ) : null}

      {step === "edit" ? (
        <>
          <div className={`np-stage a-${aspect.replace(":", "-")}`}>
            <div
              className="np-track"
              ref={trackRef}
              onScroll={(event) => setSlide(Math.round(event.currentTarget.scrollLeft / Math.max(1, event.currentTarget.clientWidth)))}
            >
              {picked.map((src) => <img key={src.slice(-40)} src={src} alt="" draggable="false" style={{ filter: filterNow }} />)}
            </div>
            {picked.length > 1 ? (
              <div className="np-dots">{picked.map((src, i) => <i key={src.slice(-30)} className={i === slide ? "on" : ""} />)}</div>
            ) : null}
          </div>
          <div className="np-filters">
            {STORY_FILTERS.map((item) => (
              <button key={item.id} type="button" className={filter === item.id ? "on" : ""} onClick={() => setFilter(item.id)}>
                <b>{item.label}</b>
                <span style={{ backgroundImage: `url(${picked[slide] || picked[0]})`, filter: item.css }} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {step === "details" ? (
        <div className="panel-scroll np-details">
          <div className="np-cap">
            <span className="np-thumb">
              <img src={picked[0]} alt="" style={{ filter: filterNow }} />
              {picked.length > 1 ? <i><Copy weight="fill" /></i> : null}
            </span>
            <textarea
              value={caption}
              maxLength={2200}
              rows={4}
              autoFocus
              placeholder={say("Write a caption… use @ to mention and # for tags", "Scrivi una didascalia… usa @ per menzionare e # per i tag")}
              aria-label={say("Caption", "Didascalia")}
              onChange={(event) => setCaption(event.target.value)}
            />
          </div>
          <MentionSuggest value={caption} onPick={setCaption} className="np-mentions" />
          <button type="button" className="np-row" onClick={() => setPanel(panel === "tag" ? null : "tag")}>
            <AtSign /><span>{say("Tag people", "Tagga persone")}</span><em>{tags.length ? tags.map((name) => name.split(" ")[0]).join(", ") : ""}</em><ChevronRight />
          </button>
          {panel === "tag" ? (
            <div className="np-pick">
              {CONTACTS.map((person) => {
                const on = tags.includes(person.name);
                return (
                  <button key={person.name} type="button" className={on ? "on" : ""} onClick={() => setTags((prev) => (on ? prev.filter((n) => n !== person.name) : [...prev, person.name]))}>
                    <RemoteImage src={person.src} alt="" />
                    <span>{person.name.split(" ")[0]}</span>
                    {on ? <i><Check weight="bold" /></i> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <button type="button" className="np-row" onClick={() => setPanel(panel === "place" ? null : "place")}>
            <MapPin /><span>{say("Add location", "Aggiungi luogo")}</span><em>{place}</em><ChevronRight />
          </button>
          {panel === "place" ? (
            <div className="ig-chips np-places">
              {STORY_PLACES.map((name) => (
                <button key={name} type="button" className={place === name ? "chip on" : "chip"} onClick={() => { setPlace(place === name ? "" : name); setPanel(null); }}>{name}</button>
              ))}
            </div>
          ) : null}
          <p className="np-sub">{say("Advanced settings", "Impostazioni avanzate")}</p>
          <button type="button" className="np-row toggle" aria-pressed={hideLikes} onClick={() => setHideLikes((value) => !value)}>
            <Heart /><span>{say("Hide like count", "Nascondi il numero di Mi piace")}</span><i className={hideLikes ? "switch on" : "switch"}><b /></i>
          </button>
          <button type="button" className="np-row toggle" aria-pressed={noComments} onClick={() => setNoComments((value) => !value)}>
            <MessageCircle /><span>{say("Turn off commenting", "Disattiva i commenti")}</span><i className={noComments ? "switch on" : "switch"}><b /></i>
          </button>
          <button type="button" className="msg-create np-share" onClick={publish}>{say("Share", "Condividi")}</button>
        </div>
      ) : null}
    </div>
  );
}

// Shared comment list for the post page and the comments sheet.
function CommentThread({ post, comments, locked, onAdd, sheet }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [draft, setDraft] = useState("");
  const [liked, setLiked] = useState(() => new Set());
  const inputRef = useRef(null);
  const endRef = useRef(null);
  const me = space.profile.name;
  const lines = [
    ...(post.text && !sheet ? [] : []),
    ...(post.thread || []).map((note, i) => ({ ...note, id: `t-${i}`, time: `${i + 2} h` })),
    ...comments.map((text, i) => ({ id: `m-${i}`, name: me, text, mine: true, time: say("now", "ora") })),
  ].filter((note) => !textHidden(prefs, note.text));
  const face = (name) => (name === me ? AVATAR : (PEOPLE.find((p) => p.name === name)?.src || CONTACTS.find((p) => p.name === name)?.src || avatarFor(name)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [comments.length]);

  return (
    <>
      <div className="ct-list">
        {post.text && !sheet ? (
          <div className="ct-row caption">
            <RemoteImage className="row-avatar" src={post.avatar || post.src || face(post.name)} alt="" />
            <span><strong>{post.name}</strong> <RichText text={post.text} /><em>{post.time || ""}</em></span>
          </div>
        ) : null}
        {lines.length === 0 ? <p className="rs-none">{say("No comments yet. Start the conversation.", "Ancora nessun commento. Inizia tu.")}</p> : null}
        {lines.map((note) => {
          const on = liked.has(note.id);
          return (
            <div key={note.id} className={`ct-row${note.mine ? " mine" : ""}`}>
              <RemoteImage className="row-avatar" src={face(note.name)} alt="" />
              <span>
                <strong>{note.name}<em>{note.time}</em></strong>
                <p><RichText text={note.text} />{(prefs.restricted || []).includes(note.name) ? <small> · {say("Only you", "Solo tu")}</small> : null}</p>
                <span className="ct-tools">
                  {on ? <b>1 {say("like", "Mi piace")}</b> : null}
                  <button type="button" onClick={() => { const who = SEARCH_PEOPLE.find((entry) => entry.name === note.name); setDraft(`@${who ? who.handle : note.name.split(" ")[0].toLowerCase()} `); inputRef.current?.focus({ preventScroll: true }); }}>{say("Reply", "Rispondi")}</button>
                </span>
              </span>
              <button type="button" className={on ? "ct-like on" : "ct-like"} aria-label={say("Like comment", "Mi piace al commento")} onClick={() => setLiked((prev) => { const next = new Set(prev); if (on) next.delete(note.id); else next.add(note.id); return next; })}>
                <Heart weight={on ? "fill" : "regular"} />
              </button>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {locked || post.noComments ? (
        <p className="msg-hint ct-locked">{say("Comments are turned off.", "I commenti sono disattivati.")}</p>
      ) : (
        <div className="ct-foot">
          <MentionSuggest value={draft} onPick={(next) => { setDraft(next); inputRef.current?.focus({ preventScroll: true }); }} className="up" />
          <div className="rs-emoji">
            {["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"].map((char) => (
              <button key={char} type="button" onClick={() => setDraft((value) => `${value}${char}`)}>{char}</button>
            ))}
          </div>
          <form
            className="rs-compose"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text || textHidden(prefs, text)) return;
              onAdd(text);
              setDraft("");
            }}
          >
            <RemoteImage className="row-avatar" src={AVATAR} alt="" />
            <input ref={inputRef} value={draft} placeholder={say(`Add a comment for ${post.name.split(" ")[0]}…`, `Commenta per ${post.name.split(" ")[0]}…`)} aria-label={say("Add a comment", "Aggiungi un commento")} onChange={(event) => setDraft(event.target.value)} />
            {draft.trim() ? <button type="submit">{say("Post", "Pubblica")}</button> : null}
          </form>
        </div>
      )}
    </>
  );
}

function CommentsScreen({ post, comments, onClose, onAdd, locked }) {
  const it = useContext(SpacePrefs).language === "it";
  return (
    <div className="panel view ct-sheet">
      <strong className="rs-sheet-title ct-title">{it ? "Commenti" : "Comments"}</strong>
      <CommentThread post={post} comments={comments} locked={locked} onAdd={onAdd} sheet />
      <button type="button" className="sr" onClick={onClose}>{it ? "Chiudi" : "Close"}</button>
    </div>
  );
}

function PostScreen({ post, comments, onClose, onComment, onShare, onAdd, locked }) {
  const space = useSpace();
  const it = useContext(SpacePrefs).language === "it";
  const [burst, setBurst] = useState(0);
  const liked = space.likes.has(post.id);
  const kind = post.kind === "reel" ? "reel" : post.image ? "post" : "tweet";
  return (
    <div className="panel view post-page">
      <ScreenHead title={it ? "Post" : "Post"} meta={String(post.handle || "").replace(/^@/, "")} onClose={onClose} />
      <div className="panel-scroll">
        <FeedPost
          item={{ ...post, src: post.avatar || post.src || AVATAR, image: post.image, time: post.time === "Now" ? (it ? "Adesso" : "Just now") : post.time }}
          kind={kind}
          liked={liked}
          saved={space.saves.has(post.id)}
          extraComments={comments}
          onLike={() => space.toggleLike(post.id)}
          onSave={() => space.toggleSave(post)}
          onComment={onComment}
          onShare={onShare}
          onOpen={() => {}}
          onDoubleLike={() => {
            navigator.vibrate?.(12);
            if (!liked) space.toggleLike(post.id);
            setBurst(Date.now());
          }}
          burst={burst}
          mine={Boolean(post.mine)}
          onArchive={post.mine ? () => space.toggleArchive(post.id) : undefined}
          following={space.follows.has(post.name)}
          onFollow={post.name !== space.profile.name ? () => space.toggleFollow(post.name) : undefined}
        />
        <CommentThread post={post} comments={comments} locked={locked} onAdd={onAdd} />
      </div>
    </div>
  );
}

function ShareScreen({ post, onClose }) {
  const space = useSpace();
  const live = useLive();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const livePeople = live ? Object.values(live.people).filter((person) => person.handle !== live.me?.handle).map((person) => ({ key: `live:${person.handle}`, name: person.name, src: person.src || avatarFor(person.name), live: person })) : [];
  const demo = CONTACTS.map((person) => ({ key: `demo:${person.name}`, name: person.name, src: person.src, demo: person }));
  const needle = query.trim().toLowerCase();
  const people = [...livePeople, ...demo].filter((person) => !personHidden(prefs, person.name, true) && (!needle || person.name.toLowerCase().includes(needle)));
  const image = post.image && !String(post.image).startsWith("blob:") ? post.image : "";
  const link = `${window.location.origin}/p/${post.id}`;

  function note(text) {
    setToast(text);
    window.setTimeout(() => setToast(""), 1300);
  }

  async function send() {
    const chosen = people.filter((person) => picked.includes(person.key));
    const text = message.trim();
    for (const person of chosen) {
      const payload = image ? { kind: "image", image, text: text || `${post.name}: ${post.text || ""}`.trim() } : `${text ? `${text} · ` : ""}${post.name}: ${post.text || link}`;
      if (person.live && live) {
        try {
          const convId = await live.openDm(person.live.handle);
          live.send(convId, payload);
        } catch { /* offline */ }
      } else if (person.demo) {
        const id = space.ensureChat(person.demo);
        window.setTimeout(() => space.sendMessage(id, payload), 0);
      }
    }
    note(say("Sent", "Inviato"));
    window.setTimeout(onClose, 650);
  }

  return (
    <div className="panel view sh-sheet">
      <label className="search-field sh-search">
        <Search />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={say("Search", "Cerca")} aria-label={say("Search people", "Cerca persone")} />
      </label>
      <div className="panel-scroll">
        <div className="sh-grid">
          {people.map((person) => {
            const on = picked.includes(person.key);
            return (
              <button key={person.key} type="button" className={on ? "on" : ""} onClick={() => setPicked((prev) => (on ? prev.filter((k) => k !== person.key) : [...prev, person.key]))}>
                <span className="rs-face">
                  <RemoteImage src={person.src} alt="" />
                  {on ? <i><Check weight="bold" /></i> : null}
                  {person.live?.online ? <b className="online-dot" /> : null}
                </span>
                <em>{person.name}</em>
              </button>
            );
          })}
        </div>
      </div>
      {picked.length ? (
        <div className="sh-send">
          <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={say("Write a message…", "Scrivi un messaggio…")} aria-label={say("Message", "Messaggio")} />
          <button type="button" className="msg-create" onClick={send}>{picked.length > 1 ? say(`Send separately (${picked.length})`, `Invia separatamente (${picked.length})`) : say("Send", "Invia")}</button>
        </div>
      ) : (
        <div className="rs-share-row sh-actions">
          <button type="button" onClick={() => {
            space.publish({ id: `made-${Date.now()}`, kind: "story", image: image || AVATAR, text: "", stickers: [{ type: "tag", name: post.name, x: 50, y: 82, s: 1, r: 0 }], time: "Now", mine: true, src: AVATAR, avatar: AVATAR, name: "Tu" });
            note(say("Added to your story", "Aggiunto alla tua storia"));
          }}>
            <i><SquarePlus /></i><span>{say("Add to story", "Aggiungi alla storia")}</span>
          </button>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(link).catch(() => {}); note(say("Link copied", "Link copiato")); }}>
            <i><LinkIcon /></i><span>{say("Copy link", "Copia link")}</span>
          </button>
          <button type="button" onClick={() => (navigator.share ? navigator.share({ title: post.name, text: post.text, url: link }).catch(() => {}) : note(say("Not available here", "Non disponibile qui")))}>
            <i><ArrowUpRight /></i><span>{say("Share to…", "Condividi su…")}</span>
          </button>
        </div>
      )}
      {toast ? <span key={toast} className="sv-toast">{toast}</span> : null}
    </div>
  );
}

function bucketOf(time) {
  const value = String(time || "").toLowerCase();
  if (!value || value === "now" || /\d+\s*(m|min|h|s)\b/.test(value) || /^\d+[mh]$/.test(value)) return "today";
  const days = Number((value.match(/(\d+)\s*(g|d)/) || [])[1]);
  if (days && days <= 7) return "week";
  return "month";
}

function ScreenHead({ title, meta, onClose }) {
  return (
    <div className="thread-head ig-head-bar">
      <button type="button" className="bell" aria-label="Back" onClick={onClose}>
        <ChevronLeft strokeWidth={2.2} aria-hidden="true" />
      </button>
      <div className="feed-copy">
        <strong>{title}</strong>
        {meta ? <span>{meta}</span> : null}
      </div>
      <span className="ig-head-spacer" aria-hidden="true" />
    </div>
  );
}

function placeOf(node) {
  const screen = node?.closest?.(".screen") || document.querySelector(".screen");
  if (!node || !screen) return null;
  const frame = screen.getBoundingClientRect();
  const ring = node.getBoundingClientRect();
  return {
    x: ring.left + ring.width / 2 - (frame.left + frame.width / 2),
    y: ring.top + ring.height / 2 - (frame.top + frame.height / 2),
    s: Math.max(ring.width / Math.min(frame.width, frame.height), 0.12),
  };
}

// Screens that take the whole phone; every other pushed screen keeps the tab bar.
const FULL_SCREENS = new Set(["story", "create", "product-edit", "edit", "highlight-new", "post-edit"]);

function Layer({ kind, docked, exiting, onDone, onClose, children }) {
  const start = useRef(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [entered, setEntered] = useState(kind === "story");
  const finished = useRef(false);

  useEffect(() => {
    if (kind === "story") return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [kind]);

  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!exiting) return undefined;
    const timer = window.setTimeout(() => {
      if (finished.current) return;
      finished.current = true;
      doneRef.current();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [exiting]);

  function down(event) {
    if (exiting || kind === "story") return;
    const head = event.target.closest(".thread-head");
    const scroller = event.target.closest(".panel-scroll");
    const atTop = !scroller || scroller.scrollTop <= 0;
    const localX = event.clientX - event.currentTarget.getBoundingClientRect().left;
    if (kind === "sheet" && !head && !atTop) return;
    if (kind === "push" && !head && localX > 28) return;
    start.current = { x: event.clientX, y: event.clientY, armed: false };
  }

  function move(event) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (!start.current.armed) {
      if (Math.hypot(dx, dy) < 8) return;
      const vertical = Math.abs(dy) > Math.abs(dx);
      if (kind === "sheet" && (!vertical || dy < 0)) {
        start.current = null;
        return;
      }
      if (kind === "push" && (vertical || dx < 0)) {
        start.current = null;
        return;
      }
      start.current.armed = true;
    }
    const next = kind === "sheet" ? Math.max(0, dy) : Math.max(0, dx);
    offsetRef.current = next;
    setOffset(next);
  }

  function up() {
    if (!start.current) return;
    const armed = start.current.armed;
    const dragged = offsetRef.current;
    start.current = null;
    if (armed && dragged > 72) onClose();
    else {
      offsetRef.current = 0;
      setOffset(0);
    }
  }

  const axis = kind === "push" ? "X" : "Y";
  const shift = kind === "story" ? null : exiting ? "108%" : entered ? `${offset}px` : "108%";

  return (
    <div
      className={`layer layer-${kind}${docked ? " docked" : ""}${exiting ? " out" : ""}`}
      style={shift == null ? undefined : {
        transform: `translate${axis}(${shift})`,
        transition: start.current?.armed ? "none" : "transform 340ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {children}
    </div>
  );
}

function openFrame(deck, seen) {
  if (!deck) return 0;
  const index = deck.frames.findIndex((frame) => !seen.has(frame.id));
  return index < 0 ? 0 : index;
}

const STORY_KIT = [
  { id: "music", label: "Musica", icon: Music },
  { id: "place", label: "Luogo", icon: MapPin },
  { id: "tag", label: "Tag", icon: AtSign },
  { id: "product", label: "Prodotto", icon: Bag },
  { id: "hash", label: "Hashtag", icon: Hash },
  { id: "emoji", label: "Emoji", icon: Smile },
  { id: "gif", label: "GIF", icon: Smile },
  { id: "poll", label: "Sondaggio", icon: BarChart2 },
  { id: "ask", label: "Domanda", icon: MessageCircle },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
  { id: "slider", label: "Slider", icon: Heart },
  { id: "link", label: "Link", icon: LinkIcon },
  { id: "count", label: "Countdown", icon: Timer },
  { id: "yours", label: "Aggiungi", icon: Plus },
  { id: "notify", label: "Notifiche", icon: Bell },
];

const STORY_MUSIC = [
  { title: "Forno lento", artist: "Giulia Neri" },
  { title: "Rosso di Prato", artist: "Adele Romano" },
  { title: "Impasto", artist: "Marta Colle" },
  { title: "Secondo fuoco", artist: "Leo Bassi" },
];
const STORY_PLACES = ["Milano", "Torino", "Prato", "Cremona", "Bologna", "Firenze", "Roma", "Napoli", "Venezia", "Faenza", "Padova", "Genova"];
const STORY_EMOJI = ["😀", "😂", "🥰", "😍", "😘", "😊", "😉", "😎", "🤔", "😴", "🔥", "❤️", "✨", "⭐", "💯", "👏", "🙌", "👍", "👎", "💪", "🎉", "🥂", "🍷", "☕️", "🍕", "🍝", "🎶", "🎵", "📸", "💫", "🌹", "💎", "🖤", "🤍", "💛", "💚", "💙", "💜", "🌙", "☀️"];
const STORY_HASH = ["forno", "rosso", "ceramica", "milano", "prato", "secondoFuoco", "lino", "impasto"];
const STORY_GIFS = [
  { label: "FORNO", tone: "hot" },
  { label: "LENTO", tone: "slow" },
  { label: "ROSSO", tone: "red" },
];
const TEXT_INKS = ["#ffffff", "#ffe14a", "#ff4d4d", "#7dffb2", "#111111"];

function StickerFace({ item, vote, quizPick, playing, notified, onAct }) {
  if (item.type === "text") {
    return (
      <span
        className={`sticker text font-${item.font || "classic"}${item.bg ? ` bg-${item.bg}` : ""}`}
        style={{ "--tc": item.color || "#fff", textAlign: item.align || "center" }}
        onClick={() => onAct(item)}
      >
        {item.text}
      </span>
    );
  }
  if (item.type === "music") {
    return (
      <button type="button" className={playing ? "sticker music on" : "sticker music"} onClick={() => onAct(item)}>
        <Music strokeWidth={2.2} />
        <span>
          <strong>{item.title}</strong>
          <em>{item.artist}</em>
        </span>
        <i className="eq" aria-hidden="true"><b /><b /><b /></i>
      </button>
    );
  }
  if (item.type === "place") {
    return (
      <button type="button" className="sticker pill" onClick={() => onAct(item)}>
        <MapPin strokeWidth={2.2} />
        {item.name}
      </button>
    );
  }
  if (item.type === "tag") {
    return (
      <button type="button" className="sticker pill" onClick={() => onAct(item)}>
        <AtSign strokeWidth={2.2} />
        {item.name}
      </button>
    );
  }
  if (item.type === "product") {
    return (
      <button type="button" className="sticker product" onClick={() => onAct(item)}>
        {item.image ? <img src={item.image} alt="" draggable="false" /> : <i><Bag weight="fill" /></i>}
        <span><strong>{item.name}</strong><em>{euro(item.price, true)}</em></span>
        <b><Bag weight="bold" /></b>
      </button>
    );
  }
  if (item.type === "link") {
    return (
      <button type="button" className="sticker pill" onClick={() => onAct(item)}>
        <LinkIcon strokeWidth={2.2} />
        {item.label}
      </button>
    );
  }
  if (item.type === "notify") {
    return (
      <button type="button" className={notified ? "sticker pill on" : "sticker pill"} onClick={() => onAct(item)}>
        <Bell strokeWidth={2.2} />
        {notified ? "Notifiche attive" : "Attiva notifiche"}
      </button>
    );
  }
  if (item.type === "emoji") {
    return (
      <button type="button" className="sticker emoji" onClick={() => onAct(item)}>{item.char}</button>
    );
  }
  if (item.type === "hash") {
    return (
      <button type="button" className="sticker pill" onClick={() => onAct(item)}>
        <Hash strokeWidth={2.4} />
        {item.tag}
      </button>
    );
  }
  if (item.type === "gif") {
    return <span className={`sticker gif ${item.tone || ""}`}>{item.label}</span>;
  }
  if (item.type === "slider") {
    return (
      <div className="sticker card">
        <strong>{item.prompt}</strong>
        <span className="slider-face">{item.char || "❤️"}</span>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue={item.value || 60}
          aria-label={item.prompt}
          onChange={(event) => onAct(item, Number(event.target.value))}
        />
      </div>
    );
  }
  if (item.type === "yours") {
    return (
      <button type="button" className="sticker card ask" onClick={() => onAct(item)}>
        <span className="sticker-kicker">Aggiungi il tuo</span>
        <strong>{item.prompt}</strong>
        <em>Tocca e rispondi</em>
      </button>
    );
  }
  if (item.type === "draw") {
    return <img className="sticker-draw" src={item.image} alt="" />;
  }
  if (item.type === "count") {
    return (
      <div className="sticker card">
        <span className="sticker-kicker"><Timer strokeWidth={2.2} /> Countdown</span>
        <strong>{item.label}</strong>
        <em>{item.when}</em>
      </div>
    );
  }
  if (item.type === "poll") {
    const left = (item.av || 0) + (vote === "a" ? 1 : 0);
    const right = (item.bv || 0) + (vote === "b" ? 1 : 0);
    const total = left + right || 1;
    return (
      <div className="sticker card">
        <strong>{item.question}</strong>
        {[["a", item.a, left], ["b", item.b, right]].map(([key, label, count]) => (
          <button key={key} type="button" className={vote === key ? "poll-opt on" : "poll-opt"} onClick={() => onAct(item, key)}>
            <b style={{ width: vote ? `${Math.round((count / total) * 100)}%` : "0%" }} />
            <span>{label}</span>
            {vote ? <em>{Math.round((count / total) * 100)}%</em> : null}
          </button>
        ))}
      </div>
    );
  }
  if (item.type === "ask") {
    return (
      <button type="button" className="sticker card ask" onClick={() => onAct(item)}>
        <span className="sticker-kicker"><MessageCircle strokeWidth={2.2} /> Domanda</span>
        <strong>{item.prompt}</strong>
        <em>Rispondi</em>
      </button>
    );
  }
  if (item.type === "quiz") {
    return (
      <div className="sticker card">
        <span className="sticker-kicker"><HelpCircle strokeWidth={2.2} /> Quiz</span>
        <strong>{item.question}</strong>
        {item.options.map((label, index) => {
          const picked = quizPick === index;
          const right = quizPick != null && index === item.answer;
          const wrong = picked && index !== item.answer;
          return (
            <button key={label} type="button" className={right ? "poll-opt on" : wrong ? "poll-opt bad" : "poll-opt"} onClick={() => onAct(item, index)}>
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return null;
}

function productFromSticker(item, space) {
  if (item.owner && SHOPS[item.owner]) {
    const product = SHOPS[item.owner].products.find((entry) => entry.id === item.productId);
    if (product) return { product, owner: item.owner };
  }
  if (!item.owner) {
    const product = (space.products || MY_PRODUCTS_SEED).find((entry) => entry.id === item.productId);
    if (product) return { product, owner: null };
  }
  return { product: { id: item.productId, name: item.name, price: item.price, images: [item.image].filter(Boolean), description: "" }, owner: item.owner || null };
}

// The sheet a viewer opens from a product sticker: see it, save it, add it to the cart.
function StoryProducts({ items, onClose, onLeave }) {
  const space = useSpace();
  const nav = useContext(ThoughtNav);
  const it = useContext(SpacePrefs).language === "it";
  const say = (en, italian) => (it ? italian : en);
  const [added, setAdded] = useState("");
  const list = items.map((item) => productFromSticker(item, space));
  return (
    <div className="svp-back" onClick={(event) => { event.stopPropagation(); onClose(); }} onPointerDown={(event) => event.stopPropagation()}>
      <section className="svp" onClick={(event) => event.stopPropagation()}>
        <i className="mk-sheet-grab" />
        <header>{list.length > 1 ? say(`${list.length} products`, `${list.length} prodotti`) : say("Product in this story", "Prodotto in questa storia")}</header>
        {list.map(({ product, owner }) => {
          const ref = productRef(product, owner, null);
          const store = owner ? storeOf(owner) : null;
          const stock = stockLabel(product, it);
          const wished = (space.wishlist || []).some((entry) => entry.key === ref.key);
          return (
            <div key={ref.key} className="svp-item">
              <button type="button" className="svp-row" onClick={() => onLeave(() => nav.product?.(product, owner, null))}>
                {product.images?.[0] ? <img src={product.images[0]} alt="" /> : <i className="or-ph"><Bag weight="fill" /></i>}
                <span>
                  <strong>{product.name}</strong>
                  <b>{euro(product.price, it)}</b>
                  {owner ? <RatingLine refKey={ref.key} /> : null}
                  <em>{store ? store.title : say("Your shop", "Il tuo shop")} · <span className={`svp-stock ${stock.tone}`}>{stock.text}</span></em>
                </span>
                <ChevronRight strokeWidth={2.4} />
              </button>
              {owner ? (
                <div className="svp-actions">
                  <button type="button" className={`ig-btn square${wished ? " mk-on" : ""}`} aria-label={say("Favourite", "Preferito")} aria-pressed={wished} onClick={() => space.toggleWish(ref)}><Heart weight={wished ? "fill" : "regular"} /></button>
                  <button type="button" className={`ig-btn${added === ref.key ? " pd-add done" : ""}`} onClick={() => { space.addToCart({ ...ref, variant: product.variants?.[0] || "", qty: 1 }); setAdded(ref.key); window.setTimeout(() => setAdded(""), 1400); }}>
                    {added === ref.key ? <><Check weight="bold" />{say("Added", "Aggiunto")}</> : say("Add to cart", "Aggiungi al carrello")}
                  </button>
                  <button type="button" className="ig-btn primary" onClick={() => onLeave(() => nav.product?.(product, owner, null))}>{say("View", "Vedi")}</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function StoryStickers({ items, quiet, onNote, onPause, onLeave }) {
  const [shopping, setShopping] = useState(null);
  const [vote, setVote] = useState(null);
  const [quizPick, setQuizPick] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [ask, setAsk] = useState(false);
  const [answer, setAnswer] = useState("");
  const audio = useRef(null);
  if (!items?.length) return null;
  const products = items.filter((item) => item.type === "product");

  function act(item, value) {
    if (quiet || !item) return;
    const type = item.type;
    if (type === "music") {
      const el = audio.current;
      if (!el) return;
      if (playing) {
        el.pause();
        setPlaying(false);
        onPause?.(false);
        return;
      }
      el.currentTime = 0;
      el.play().then(() => {
        setPlaying(true);
        onPause?.(true);
      }).catch(() => onNote?.(item.title));
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
        onNote?.(on ? "Notifiche spente" : "Notifiche attive");
        return !on;
      });
    }
    if (type === "poll" && !vote) setVote(value);
    if (type === "quiz" && quizPick == null) {
      setQuizPick(value);
      onNote?.(value === item.answer ? "Giusto" : "Quasi");
    }
    if (type === "ask" || type === "yours") {
      setAsk(true);
      onPause?.(true);
    }
  }

  return (
    <div className="stickers">
      <audio
        ref={audio}
        src={VOICE_DEMO}
        onEnded={() => {
          setPlaying(false);
          onPause?.(false);
        }}
      />
      {items.map((item, index) => (
        <div key={`${item.type}-${index}`} className={item.type === "draw" ? "sticker-pos draw" : "sticker-pos"} style={stickerStyle(item)}>
          <StickerFace item={item} vote={vote} quizPick={quizPick} playing={playing} notified={notified} onAct={act} />
        </div>
      ))}
      {ask ? (
        <form
          className="sticker-ask"
          onSubmit={(event) => {
            event.preventDefault();
            const text = answer.trim();
            if (!text) return;
            setAnswer("");
            setAsk(false);
            onPause?.(false);
            onNote?.("Risposta inviata");
          }}
        >
          <input
            value={answer}
            placeholder="La tua risposta"
            aria-label="Risposta alla domanda"
            onChange={(event) => setAnswer(event.target.value)}
          />
          <button type="submit" aria-label="Invia"><Send strokeWidth={2} /></button>
        </form>
      ) : null}
      {!quiet && products.length ? (
        <button type="button" className="svp-pill" onClick={() => { setShopping(products); onPause?.(true); }}>
          <Bag weight="fill" />{products.length === 1 ? "Vedi prodotto" : `Vedi ${products.length} prodotti`}
        </button>
      ) : null}
      {shopping && document.querySelector(".sv") ? createPortal(<StoryProducts items={shopping} onClose={() => { setShopping(null); onPause?.(false); }} onLeave={(go) => { setShopping(null); (onLeave || ((fn) => fn()))(go); }} />, document.querySelector(".sv")) : null}
    </div>
  );
}

const STORY_MS = 5200;
const STORY_REACTIONS = ["😂", "😮", "😍", "😢", "👏", "🔥", "🎉", "💯"];

function preloadImage(src) {
  if (!src || typeof window === "undefined") return;
  const img = new window.Image();
  img.decoding = "async";
  img.src = src;
}

function stickerStyle(item) {
  const scale = Number(item.s) || 1;
  const turn = Number(item.r) || 0;
  return {
    left: `${item.x ?? 50}%`,
    top: `${item.y ?? 40}%`,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${turn}deg)`,
  };
}

// One side of the story cube: photo, caption, stickers, progress and header.
function StoryFace({ deck, index, live, barRef, videoRef, onLoaded, onNote, onPause, onLeave, it, children }) {
  const story = deck.frames[index];
  const imgRef = useRef(null);
  const look = { filter: filterCss(story.filter) };
  const music = (story.stickers || []).find((item) => item.type === "music");
  useLayoutEffect(() => {
    if (live && imgRef.current?.complete && imgRef.current.naturalWidth) onLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id, live]);
  return (
    <>
      {story.video ? (
        <video
          ref={live ? videoRef : null}
          key={`vid-${story.id}`}
          className={`sv-photo${story.mirror ? " mirror" : ""}`}
          src={story.video}
          style={look}
          playsInline
          muted={!live || story.muted}
          preload="auto"
          onLoadedData={live ? onLoaded : undefined}
          onError={live ? onLoaded : undefined}
        />
      ) : (
        <img
          ref={imgRef}
          key={`img-${story.id}`}
          className="sv-photo"
          src={story.image}
          style={look}
          alt=""
          draggable="false"
          decoding="async"
          onLoad={live ? onLoaded : undefined}
          onError={live ? onLoaded : undefined}
        />
      )}
      <div className="sv-scrim" />
      {story.text ? <p className="sv-caption" style={story.textColor ? { color: story.textColor } : undefined}>{story.text}</p> : null}
      <StoryStickers key={`st-${story.id}`} items={story.stickers} quiet={!live} onNote={onNote} onPause={onPause} onLeave={onLeave} />
      <div className="sv-bars" aria-hidden="true">
        {deck.frames.map((item, i) => (
          <i key={item.id}>
            <b ref={live && i === index ? barRef : null} style={i < index ? { transform: "scaleX(1)" } : undefined} />
          </i>
        ))}
      </div>
      <header className="sv-head">
        <RemoteImage className="sv-avatar" src={deck.src} alt="" />
        <span className="sv-id">
          <strong>{deck.mine ? (it ? "La tua storia" : "Your story") : deck.name}</strong>
          <em>{story.time === "Now" ? (it ? "Adesso" : "Now") : (story.time || "2 h")}</em>
          {music ? <span className="sv-music"><Music strokeWidth={2.2} /> {music.title} · {music.artist}</span> : null}
        </span>
        {children}
      </header>
      <div className="sv-shade" />
    </>
  );
}

function StoryViewer({ decks, start = 0, deckId, seen, origin, onSeen, onClose, onDelete, onReply, onLike, canReply }) {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const initial = deckId ? Math.max(0, decks.findIndex((deck) => deck.id === deckId)) : start;
  const [who, setWho] = useState(initial);
  const [frame, setFrame] = useState(() => openFrame(decks[initial], seen));
  const [loaded, setLoaded] = useState(false);
  const [holding, setHolding] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [viewers, setViewers] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reply, setReply] = useState("");
  const [toast, setToast] = useState("");
  const [reacts, setReacts] = useState([]);
  const [likePop, setLikePop] = useState(0);
  const [stickerBusy, setStickerBusy] = useState(false);
  const rootRef = useRef(null);
  const cardRef = useRef(null);
  const cubeRef = useRef(null);
  const barRef = useRef(null);
  const clipRef = useRef(null);
  const inputRef = useRef(null);
  const gesture = useRef(null);
  const holdTimer = useRef(0);
  const progress = useRef(0);
  const spinning = useRef(false);
  const closing = useRef(false);
  const pausedRef = useRef(true);
  const state = useRef({});
  const deck = decks[who];
  const story = deck?.frames[frame];
  const prevDeck = decks[who - 1];
  const nextDeck = decks[who + 1];
  const prevIndex = prevDeck ? prevDeck.frames.length - 1 : 0;
  const nextIndex = nextDeck ? openFrame(nextDeck, seen) : 0;
  state.current = { who, frame, deck, prevDeck, nextDeck, prevIndex, nextIndex };
  pausedRef.current = !open || !loaded || holding || menu || viewers || focused || stickerBusy;

  const width = () => rootRef.current?.clientWidth || 390;
  const height = () => rootRef.current?.clientHeight || 844;
  const fromRing = origin ? `translate3d(${origin.x}px, ${origin.y}px, 0) scale(${origin.s})` : "translate3d(0, 12%, 0) scale(0.86)";

  function setCube(p, animate) {
    const cube = cubeRef.current;
    if (!cube) return;
    cube.style.transition = animate ? "transform 440ms cubic-bezier(0.32, 0.72, 0, 1)" : "none";
    cube.style.transform = `translateZ(calc(var(--half) * -1)) rotateY(${p * 90}deg)`;
    cube.style.setProperty("--pl", String(Math.max(0, p)));
    cube.style.setProperty("--pr", String(Math.max(0, -p)));
  }

  function setCard(transform, radius, dim, animate) {
    const card = cardRef.current;
    const root = rootRef.current;
    if (!card || !root) return;
    const ease = animate === "out" ? "cubic-bezier(0.4, 0, 0.6, 1)" : "cubic-bezier(0.32, 0.72, 0, 1)";
    const ms = animate === "out" ? 300 : 420;
    card.style.transition = animate ? `transform ${ms}ms ${ease}, border-radius ${ms}ms ${ease}, opacity ${ms}ms ease` : "none";
    root.style.transition = animate ? `background-color ${ms}ms ease` : "none";
    card.style.transform = transform;
    card.style.borderRadius = radius;
    root.style.backgroundColor = `rgba(0, 0, 0, ${dim})`;
  }

  // Open: grow out of the story ring.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root) root.style.setProperty("--half", `${width() / 2}px`);
    setCube(0, false);
    setCard(fromRing, "50%", 0, false);
    const a = requestAnimationFrame(() => requestAnimationFrame(() => {
      setCard("translate3d(0, 0, 0) scale(1)", "0px", 1, true);
      window.setTimeout(() => setOpen(true), 380);
    }));
    const onResize = () => root?.style.setProperty("--half", `${width() / 2}px`);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(a);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close(direction = "ring") {
    if (closing.current) return;
    closing.current = true;
    pausedRef.current = true;
    setHolding(false);
    const target = direction === "down"
      ? `translate3d(0, ${height() * 0.9}px, 0) scale(0.7)`
      : state.current.who === initial ? fromRing : "translate3d(0, 10%, 0) scale(0.82)";
    setCard(target, direction === "down" ? "28px" : "50%", 0, "out");
    if (direction !== "down" && state.current.who !== initial && cardRef.current) cardRef.current.style.opacity = "0";
    window.setTimeout(onClose, 290);
  }

  // A new face became the front: reset the cube without animation before paint.
  useLayoutEffect(() => {
    setCube(0, false);
    spinning.current = false;
  }, [who]);

  // New frame: restart the bar and wait for the photo.
  useLayoutEffect(() => {
    progress.current = 0;
    if (barRef.current) barRef.current.style.transform = "scaleX(0)";
    setLoaded(false);
    setStickerBusy(false);
  }, [who, frame]);

  useEffect(() => {
    if (story) onSeen(story.id);
    // Warm the cache so the next taps are instant.
    preloadImage(deck?.frames[frame + 1]?.image);
    preloadImage(nextDeck?.frames[nextIndex]?.image);
    preloadImage(prevDeck?.frames[prevIndex]?.image);
    const safety = window.setTimeout(() => setLoaded(true), 4000);
    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, frame]);

  // Deleted frames or decks.
  useEffect(() => {
    const current = decks[state.current.who];
    if (!current) {
      if (decks.length === 0) onClose();
      else setWho(Math.max(0, state.current.who - 1));
      return;
    }
    if (state.current.frame >= current.frames.length) setFrame(Math.max(0, current.frames.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decks]);

  // Progress clock: drives the bar directly, no React render per frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const hidden = document.visibilityState === "hidden";
      const clip = clipRef.current;
      const run = !pausedRef.current && !hidden && !spinning.current && !gesture.current?.mode;
      if (clip) {
        if (run && clip.paused) clip.play().catch(() => { clip.muted = true; clip.play().catch(() => {}); });
        if (!run && !clip.paused) clip.pause();
      }
      if (run && clip && clip.duration && Number.isFinite(clip.duration)) {
        progress.current = clip.ended ? 1 : clip.currentTime / clip.duration;
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, progress.current)})`;
        if (progress.current >= 0.999) {
          progress.current = 0;
          step(1);
        }
      } else if (run) {
        progress.current += dt / STORY_MS;
        if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, progress.current)})`;
        if (progress.current >= 1) {
          progress.current = 0;
          step(1);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function spin(direction) {
    const { who: current, nextDeck: next, prevDeck: prev, nextIndex: ni, prevIndex: pi } = state.current;
    const target = direction > 0 ? next : prev;
    if (!target) {
      if (direction > 0) close();
      else setCube(0, true);
      return;
    }
    spinning.current = true;
    setCube(direction > 0 ? -1 : 1, true);
    window.setTimeout(() => {
      flushSync(() => {
        setWho(current + direction);
        setFrame(direction > 0 ? ni : pi);
      });
    }, 430);
  }

  function step(direction) {
    if (spinning.current || closing.current) return;
    const { deck: current, frame: index } = state.current;
    if (!current) return;
    const next = index + direction;
    if (next >= 0 && next < current.frames.length) {
      setFrame(next);
      return;
    }
    if (direction < 0 && !state.current.prevDeck) {
      progress.current = 0;
      if (barRef.current) barRef.current.style.transform = "scaleX(0)";
      return;
    }
    spin(direction);
  }

  const toastTimer = useRef(0);
  function note(text) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1100);
  }

  function down(event) {
    if (closing.current || spinning.current || menu || viewers) return;
    if (event.target.closest("button, input, form, .sticker-pos")) return;
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* gone */ }
    gesture.current = { x: event.clientX, y: event.clientY, t: performance.now(), mode: "", dx: 0, dy: 0 };
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setHolding(true), 200);
  }

  function move(event) {
    const g = gesture.current;
    if (!g) return;
    g.dx = event.clientX - g.x;
    g.dy = event.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy)) g.mode = "x";
      else if (g.dy > 10 && g.dy > Math.abs(g.dx)) g.mode = "down";
      else if (g.dy < -12 && -g.dy > Math.abs(g.dx)) g.mode = "up";
      if (g.mode) {
        window.clearTimeout(holdTimer.current);
        setHolding(false);
      }
    }
    if (g.mode === "x") {
      let p = g.dx / width();
      const blocked = p < 0 ? !state.current.nextDeck : !state.current.prevDeck;
      if (blocked) p *= 0.22;
      setCube(Math.max(-1, Math.min(1, p)), false);
    } else if (g.mode === "down") {
      const dy = Math.max(0, g.dy);
      const scale = Math.max(0.72, 1 - dy / 1400);
      setCard(`translate3d(${g.dx * 0.5}px, ${dy}px, 0) scale(${scale})`, `${Math.min(28, dy / 6)}px`, Math.max(0.15, 1 - dy / 520), false);
    }
  }

  function up(event) {
    const g = gesture.current;
    gesture.current = null;
    window.clearTimeout(holdTimer.current);
    if (!g) return;
    const dt = Math.max(1, performance.now() - g.t);
    if (g.mode === "x") {
      const p = g.dx / width();
      const fast = Math.abs(g.dx / dt) > 0.5;
      const direction = g.dx < 0 ? 1 : -1;
      const target = direction > 0 ? state.current.nextDeck : state.current.prevDeck;
      if (target && (Math.abs(p) > 0.28 || fast)) spin(direction);
      else setCube(0, true);
      return;
    }
    if (g.mode === "down") {
      if (g.dy > 120 || g.dy / dt > 0.6) close("down");
      else setCard("translate3d(0, 0, 0) scale(1)", "0px", 1, true);
      return;
    }
    if (g.mode === "up") {
      if (deck?.mine) setViewers(true);
      else inputRef.current?.focus();
      return;
    }
    if (holding) {
      setHolding(false);
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    step(event.clientX < box.left + box.width * 0.3 ? -1 : 1);
  }

  // Keyboard on desktop.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.("input, textarea")) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function react(char) {
    const now = Date.now();
    setReacts((prev) => [...prev, ...Array.from({ length: 6 }, (_, i) => ({ id: `${now}-${i}`, char, x: 18 + Math.random() * 64, d: i * 70, r: Math.random() * 40 - 20 }))]);
    window.setTimeout(() => setReacts((prev) => prev.filter((item) => !item.id.startsWith(`${now}-`))), 1800);
    onReply?.(deck, char);
    setReply("");
    inputRef.current?.blur();
    note(it ? "Reazione inviata" : "Reaction sent");
  }

  if (!deck || !story) return null;
  const mine = Boolean(deck.mine);
  const heartOn = space.storyLikes.has(story.id);
  const views = Math.max(deck.frames.length + 2, 3);
  const quiet = holding ? " sv-hold" : "";

  return (
    <div ref={rootRef} className={`sv${quiet}${focused ? " sv-typing" : ""}`}>
      <div ref={cardRef} className="sv-card">
        <div ref={cubeRef} className="sv-cube">
          {prevDeck ? (
            <div className="sv-face prev" aria-hidden="true">
              <StoryFace deck={prevDeck} index={prevIndex} it={it} />
            </div>
          ) : null}
          {nextDeck ? (
            <div className="sv-face next" aria-hidden="true">
              <StoryFace deck={nextDeck} index={nextIndex} it={it} />
            </div>
          ) : null}
          <div className="sv-face front">
            <StoryFace
              deck={deck}
              index={frame}
              live
              it={it}
              barRef={barRef}
              videoRef={clipRef}
              onLoaded={() => setLoaded(true)}
              onNote={note}
              onPause={setStickerBusy}
              onLeave={(go) => { close("down"); window.setTimeout(go, 360); }}
            >
              <button type="button" className="sv-icon" aria-label={it ? "Altro" : "More"} onClick={() => setMenu(true)}>
                <MoreHorizontal />
              </button>
              <button type="button" className="sv-icon" aria-label={it ? "Chiudi" : "Close"} onClick={() => close()}>
                <X />
              </button>
            </StoryFace>
            {!loaded ? <span className="sv-spin" aria-hidden="true" /> : null}
            <div
              className="sv-surface"
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
            {reacts.map((item) => (
              <span key={item.id} className="sv-react" style={{ left: `${item.x}%`, animationDelay: `${item.d}ms`, "--r": `${item.r}deg` }}>{item.char}</span>
            ))}
            {likePop ? <span key={likePop} className="sv-like-burst" aria-hidden="true"><Heart weight="fill" /></span> : null}
            {mine ? (
              <div className="sv-foot mine">
                <button type="button" className="sv-activity" onClick={() => setViewers(true)}>
                  <span className="sv-faces">
                    {PEOPLE.slice(0, 3).map((person) => <RemoteImage key={person.name} src={person.src} alt="" />)}
                  </span>
                  <span>{it ? `Attività · ${views}` : `Activity · ${views}`}</span>
                </button>
                <button type="button" className="sv-icon" aria-label={it ? "Elimina" : "Delete"} onClick={() => setMenu(true)}>
                  <MoreHorizontal />
                </button>
              </div>
            ) : canReply?.(deck) === false ? (
              <p className="sv-closed">{it ? "Risposte disattivate" : "Replies are off"}</p>
            ) : (
              <form
                className="sv-foot"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = reply.trim();
                  if (!text) return;
                  setReply("");
                  onReply?.(deck, text);
                  inputRef.current?.blur();
                  note(it ? "Messaggio inviato" : "Message sent");
                }}
              >
                <label className="sv-reply">
                  <input
                    ref={inputRef}
                    value={reply}
                    placeholder={it ? `Rispondi a ${deck.name}…` : `Reply to ${deck.name}…`}
                    aria-label={it ? "Rispondi alla storia" : "Reply to story"}
                    onChange={(event) => setReply(event.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => window.setTimeout(() => setFocused(false), 120)}
                  />
                </label>
                {reply.trim() ? (
                  <button type="submit" className="sv-send">{it ? "Invia" : "Send"}</button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={heartOn ? "sv-icon sv-like on" : "sv-icon sv-like"}
                      aria-label={it ? "Mi piace" : "Like"}
                      aria-pressed={heartOn}
                      onClick={() => {
                        const on = space.storyLikes.has(story.id);
                        space.toggleStoryLike(story.id);
                        if (!on) {
                          setLikePop(Date.now());
                          navigator.vibrate?.(10);
                          onLike?.(deck);
                        }
                      }}
                    >
                      <Heart weight={heartOn ? "fill" : "regular"} />
                    </button>
                    <button type="button" className="sv-icon" aria-label={it ? "Condividi" : "Share"} onClick={() => note(it ? "Inviata" : "Sent")}>
                      <Send />
                    </button>
                  </>
                )}
              </form>
            )}
            {focused && !reply.trim() ? (
              <div className="sv-reactions" onPointerDown={(event) => event.preventDefault()}>
                <strong>{it ? "Reazioni rapide" : "Quick reactions"}</strong>
                <div>
                  {STORY_REACTIONS.map((char, i) => (
                    <button key={char} type="button" style={{ animationDelay: `${i * 25}ms` }} onClick={() => react(char)}>{char}</button>
                  ))}
                </div>
              </div>
            ) : null}
            {toast ? <span className="sv-toast" key={toast}>{toast}</span> : null}
          </div>
        </div>
      </div>
      {menu ? (
        <div className="sv-sheet-back" onClick={() => setMenu(false)}>
          <div className="sv-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            {mine ? (
              <button type="button" className="warn" onClick={() => { setMenu(false); onDelete(story.id); }}>
                {it ? "Elimina" : "Delete"}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => { setMenu(false); deck.frames.forEach((item) => onSeen(item.id)); spin(1); }}>
                  {it ? `Silenzia ${deck.name}` : `Mute ${deck.name}`}
                </button>
                <button type="button" className="warn" onClick={() => { setMenu(false); note(it ? "Segnalata" : "Reported"); }}>{it ? "Segnala" : "Report"}</button>
              </>
            )}
            <button type="button" onClick={() => setMenu(false)}>{it ? "Annulla" : "Cancel"}</button>
          </div>
        </div>
      ) : null}
      {viewers ? (
        <div className="sv-sheet-back" onClick={() => setViewers(false)}>
          <div className="sv-sheet viewers" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <strong className="sv-sheet-title"><Eye /> {views}</strong>
            {PEOPLE.slice(0, 5).map((person, index) => (
              <div key={person.name} className="sv-viewer">
                <RemoteImage className="row-avatar" src={person.src} alt="" />
                <span>{person.name}</span>
                {index === 0 ? <Heart weight="fill" className="sv-viewer-like" /> : null}
                <em>{index === 0 ? (it ? "Ora" : "Now") : `${index + 1} h`}</em>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TEXT_FONTS = [
  { id: "classic", label: "Classic" },
  { id: "modern", label: "Modern" },
  { id: "neon", label: "Neon" },
  { id: "type", label: "Typewriter" },
  { id: "strong", label: "Strong" },
];
const TEXT_SWATCHES = ["#ffffff", "#111111", "#ff3040", "#ff8a00", "#ffd60a", "#34c759", "#0095f6", "#7c3aed", "#ff5ac8"];
const STORY_FILTERS = [
  { id: "normal", label: "Normale", css: "none" },
  { id: "alba", label: "Alba", css: "brightness(1.08) contrast(0.92) saturate(1.12) sepia(0.08)" },
  { id: "nord", label: "Nord", css: "contrast(1.1) saturate(0.72) brightness(1.05) hue-rotate(-10deg)" },
  { id: "terra", label: "Terracotta", css: "sepia(0.28) saturate(1.35) contrast(1.05)" },
  { id: "pastello", label: "Pastello", css: "brightness(1.12) contrast(0.85) saturate(0.85)" },
  { id: "vivido", label: "Vivido", css: "contrast(1.18) saturate(1.45) brightness(1.02)" },
  { id: "miele", label: "Miele", css: "sepia(0.35) saturate(1.2) brightness(1.06) hue-rotate(-8deg)" },
  { id: "cinema", label: "Cinema", css: "contrast(1.22) brightness(0.92) saturate(0.7) sepia(0.12)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.25) brightness(0.95)" },
  { id: "polvere", label: "Polvere", css: "sepia(0.45) contrast(0.9) brightness(1.05) saturate(0.8)" },
];
const CREATE_GRADIENTS = [
  ["#7c3aed", "#ff2d55"],
  ["#ff8a00", "#ff2d55"],
  ["#0095f6", "#34c759"],
  ["#111111", "#3a3a3c"],
  ["#ff5ac8", "#ffd60a"],
  ["#1d2b64", "#f8cdda"],
];
const BRUSHES = [
  { id: "pen", label: "Penna", icon: Pencil, width: 7, alpha: 1 },
  { id: "marker", label: "Evidenziatore", icon: Highlighter, width: 22, alpha: 0.5 },
  { id: "neon", label: "Neon", icon: Sparkle, width: 9, alpha: 1, glow: true },
  { id: "eraser", label: "Gomma", icon: Eraser, width: 28, alpha: 1, erase: true },
];
const MAX_CLIP = 15;

function filterCss(id) {
  return STORY_FILTERS.find((item) => item.id === id)?.css || "none";
}

function gradientImage([a, b], width = 1080, height = 1920) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const fill = ctx.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, a);
  fill.addColorStop(1, b);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function collageImage(sources, layout) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1080, 1920);
  const cells = layout === 2
    ? [[0, 0, 1080, 958], [0, 962, 1080, 958]]
    : [[0, 0, 538, 958], [542, 0, 538, 958], [0, 962, 538, 958], [542, 962, 538, 958]];
  for (let i = 0; i < cells.length; i += 1) {
    if (!sources[i]) continue;
    try {
      const img = await loadImage(sources[i]);
      drawCover(ctx, img, ...cells[i]);
    } catch { /* skip a cell that cannot load */ }
  }
  try {
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return sources[0];
  }
}

function StoryCamera({ onClose, onPublish }) {
  const live = useLive();
  const prefs = useContext(SpacePrefs);
  const shopSpace = useSpace();
  const it = prefs.language === "it";
  const say = (en, italian) => (it ? italian : en);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const holdRef = useRef({ timer: 0, at: 0, y: 0, recording: false });
  const stageRef = useRef(null);
  const drawRef = useRef(null);
  const strokesRef = useRef([]);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const trashRef = useRef(null);
  const swipeRef = useRef(null);
  const [camOn, setCamOn] = useState(false);
  const [facing, setFacing] = useState("user");
  const [flipping, setFlipping] = useState(false);
  const [mode, setMode] = useState("story");
  const [flash, setFlash] = useState(false);
  const [timer, setTimer] = useState(0);
  const [handsFree, setHandsFree] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [recording, setRecording] = useState(0);
  const [recSeconds, setRecSeconds] = useState(0);
  const [blink, setBlink] = useState(0);
  const [layout, setLayout] = useState(2);
  const [cells, setCells] = useState([]);
  const [gradient, setGradient] = useState(0);
  const [media, setMedia] = useState(null);
  const [filter, setFilter] = useState("normal");
  const [filterHint, setFilterHint] = useState(0);
  const [muted, setMuted] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [tool, setTool] = useState(null);
  const [find, setFind] = useState("");
  const [brush, setBrush] = useState("pen");
  const [pen, setPen] = useState("#ffffff");
  const [size, setSize] = useState(1);
  const [strokes, setStrokes] = useState(0);
  const [editor, setEditor] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [targets, setTargets] = useState({ story: true, close: false, people: [] });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const pick = WORKS[cells.length % WORKS.length];

  function note(text) {
    setToast(text);
    window.clearTimeout(note.t);
    note.t = window.setTimeout(() => setToast(""), 1400);
  }

  // Camera stream (video + audio for clips).
  useEffect(() => {
    if (media) return undefined;
    let gone = false;
    const devices = navigator.mediaDevices;
    if (!devices?.getUserMedia) return undefined;
    const video = { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } };
    devices.getUserMedia({ video, audio: true })
      .catch(() => devices.getUserMedia({ video, audio: false }))
      .then((stream) => {
        if (gone) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOn(true);
        setFlipping(false);
      })
      .catch(() => {
        setCamOn(false);
        setFlipping(false);
      });
    return () => {
      gone = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing, Boolean(media)]);

  // Back-camera torch where the device supports it.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = track?.getCapabilities?.();
    if (caps?.torch && facing === "environment") track.applyConstraints({ advanced: [{ torch: flash }] }).catch(() => {});
  }, [flash, facing, camOn]);

  useEffect(() => {
    if (editor) window.setTimeout(() => textRef.current?.focus({ preventScroll: true }), 60);
  }, [editor?.open]);

  useEffect(() => {
    if (!recording) return undefined;
    const id = window.setInterval(() => {
      const secs = (Date.now() - recording) / 1000;
      setRecSeconds(secs);
      if (secs >= MAX_CLIP) stopClip();
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  function frameFromVideo() {
    const video = videoRef.current;
    if (!camOn || !video?.videoWidth) return pick.src;
    const canvas = document.createElement("canvas");
    const sw = video.videoWidth / zoom;
    const sh = video.videoHeight / zoom;
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.88);
  }

  function withFlash(run) {
    if (flash && facing === "user") {
      setBlink(Date.now());
      window.setTimeout(run, 220);
    } else {
      run();
    }
  }

  async function takePhoto() {
    navigator.vibrate?.(8);
    setBlink((value) => (flash && facing === "user" ? value : Date.now()));
    withFlash(async () => {
      const src = frameFromVideo();
      if (mode === "layout") {
        const next = [...cells, src];
        setCells(next);
        if (next.length >= layout) {
          const merged = await collageImage(next, layout);
          setCells([]);
          openEditor({ type: "image", src: merged });
        }
        return;
      }
      openEditor({ type: "image", src });
    });
  }

  function shoot() {
    if (mode === "create") {
      openEditor({ type: "image", src: gradientImage(CREATE_GRADIENTS[gradient]), create: true });
      setEditor({ open: Date.now(), text: "", color: "#ffffff", font: "classic", bg: "" });
      return;
    }
    if (handsFree && mode === "story") {
      if (holdRef.current.recording) stopClip();
      else startClip();
      return;
    }
    if (timer) {
      let left = timer;
      setCountdown(left);
      const id = window.setInterval(() => {
        left -= 1;
        if (left <= 0) {
          window.clearInterval(id);
          setCountdown(0);
          takePhoto();
        } else {
          setCountdown(left);
          navigator.vibrate?.(5);
        }
      }, 1000);
      return;
    }
    takePhoto();
  }

  function startClip() {
    const stream = streamRef.current;
    if (!stream || !window.MediaRecorder) {
      note(say("Video isn't available here", "Video non disponibile qui"));
      return;
    }
    const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((item) => MediaRecorder.isTypeSupported?.(item)) || "";
    let recorder;
    try {
      recorder = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : undefined);
    } catch {
      note(say("Video isn't available here", "Video non disponibile qui"));
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      if (blob.size < 2000) return;
      openEditor({ type: "video", src: URL.createObjectURL(blob), mirror: facing === "user" });
    };
    recorder.start(250);
    recorderRef.current = recorder;
    holdRef.current.recording = true;
    setRecording(Date.now());
    setRecSeconds(0);
    navigator.vibrate?.(14);
  }

  function stopClip() {
    holdRef.current.recording = false;
    setRecording(0);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  // Shutter: tap = photo, hold = video, slide up while holding = zoom.
  function shutterDown(event) {
    if (mode !== "story" || handsFree || countdown) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    holdRef.current.at = Date.now();
    holdRef.current.y = event.clientY;
    holdRef.current.zoom = zoom;
    holdRef.current.clip = false;
    holdRef.current.timer = window.setTimeout(() => {
      holdRef.current.clip = true;
      startClip();
    }, 320);
  }
  function shutterMove(event) {
    if (!holdRef.current.recording) return;
    const lift = Math.max(0, holdRef.current.y - event.clientY);
    setZoom(Math.min(4, Math.max(1, holdRef.current.zoom + lift / 90)));
  }
  function shutterUp() {
    if (mode !== "story" || handsFree || countdown) return;
    window.clearTimeout(holdRef.current.timer);
    if (holdRef.current.recording) stopClip();
  }

  function openEditor(next) {
    setMedia(next);
    setFilter("normal");
    setStickers([]);
    setTool(null);
    setZoom(1);
    strokesRef.current = [];
    setStrokes(0);
  }

  function fromLibrary(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type.startsWith("video/")) {
      openEditor({ type: "video", src: URL.createObjectURL(file) });
      return;
    }
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await loadImage(reader.result).catch(() => null);
      if (!img) return;
      const scale = Math.min(1, 1440 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/jpeg", 0.88);
      if (mode === "layout") {
        const next = [...cells, src];
        setCells(next);
        if (next.length >= layout) {
          const merged = await collageImage(next, layout);
          setCells([]);
          openEditor({ type: "image", src: merged });
        }
        return;
      }
      openEditor({ type: "image", src });
    };
    reader.readAsDataURL(file);
  }

  function leaveEditor() {
    if (media?.type === "video") URL.revokeObjectURL(media.src);
    setMedia(null);
    setStickers([]);
    setTool(null);
    setEditor(null);
    setSheet(null);
  }

  function addSticker(sticker) {
    setStickers((prev) => {
      const many = ["emoji", "tag", "hash", "gif", "text", "draw", "product"].includes(sticker.type);
      const rest = many ? prev : prev.filter((item) => item.type !== sticker.type);
      return [...rest, { s: 1, r: 0, x: 50, y: 40 + ((rest.length % 4) * 6), ...sticker, fresh: Date.now() }];
    });
    setTool(null);
    setFind("");
  }

  function saveText() {
    const draft = editor;
    setEditor(null);
    if (!draft) return;
    const text = draft.text.trim();
    if (draft.index != null) {
      setStickers((prev) => (text
        ? prev.map((item, i) => (i === draft.index ? { ...item, text, color: draft.color, font: draft.font, bg: draft.bg } : item))
        : prev.filter((_, i) => i !== draft.index)));
      return;
    }
    if (text) addSticker({ type: "text", text, color: draft.color, font: draft.font, bg: draft.bg, y: 46 });
  }

  // Sticker gestures: drag, pinch to scale, twist to rotate, drop on the bin.
  function grab(index, event) {
    const node = event.currentTarget;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    event.preventDefault();
    event.stopPropagation();
    const start = stickers[index];
    const points = new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]);
    const now = { x: start.x, y: start.y, s: start.s || 1, r: start.r || 0 };
    let base = null;
    let moved = false;
    let doomed = false;
    const origin = { x: event.clientX, y: event.clientY, sx: start.x, sy: start.y };
    const paint = () => {
      node.style.left = `${now.x}%`;
      node.style.top = `${now.y}%`;
      node.style.transform = `translate(-50%, -50%) scale(${doomed ? 0.3 : now.s}) rotate(${now.r}deg)`;
      node.style.opacity = doomed ? "0.6" : "";
    };
    const pinch = () => {
      const [a, b] = [...points.values()];
      return { d: Math.hypot(b.x - a.x, b.y - a.y), a: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI };
    };
    function onMove(ev) {
      if (!points.has(ev.pointerId)) return;
      points.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (points.size >= 2) {
        const p = pinch();
        if (!base) base = { ...p, s: now.s, r: now.r };
        now.s = Math.max(0.35, Math.min(5, base.s * (p.d / Math.max(1, base.d))));
        now.r = base.r + (p.a - base.a);
        moved = true;
      } else {
        const dx = ev.clientX - origin.x;
        const dy = ev.clientY - origin.y;
        if (!moved && Math.hypot(dx, dy) > 4) {
          moved = true;
          setDragging(index);
        }
        now.x = Math.min(96, Math.max(4, origin.sx + (dx / stage.width) * 100));
        now.y = Math.min(94, Math.max(6, origin.sy + (dy / stage.height) * 100));
        const bin = trashRef.current?.getBoundingClientRect();
        const near = Boolean(bin) && Math.hypot(ev.clientX - (bin.left + bin.width / 2), ev.clientY - (bin.top + bin.height / 2)) < 60;
        if (near !== doomed) {
          doomed = near;
          trashRef.current?.classList.toggle("hot", doomed);
          if (doomed) navigator.vibrate?.(10);
        }
      }
      paint();
    }
    function onDown(ev) {
      if (points.size === 1 && !points.has(ev.pointerId)) {
        points.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        base = null;
      }
    }
    function onUp(ev) {
      points.delete(ev.pointerId);
      base = null;
      if (points.size === 1) {
        const [only] = points.values();
        Object.assign(origin, { x: only.x, y: only.y, sx: now.x, sy: now.y });
        return;
      }
      if (points.size) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointerdown", onDown, true);
      setDragging(null);
      if (doomed) {
        setStickers((prev) => prev.filter((_, i) => i !== index));
        return;
      }
      if (!moved && start.type === "text") {
        setEditor({ open: Date.now(), index, text: start.text, color: start.color, font: start.font || "classic", bg: start.bg || "" });
        return;
      }
      setStickers((prev) => prev.map((item, i) => (i === index ? { ...item, ...now, fresh: 0 } : item)));
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("pointerdown", onDown, true);
  }

  function wheel(index, event) {
    setStickers((prev) => prev.map((item, i) => (i === index
      ? { ...item, s: Math.max(0.35, Math.min(5, (item.s || 1) * (event.deltaY < 0 ? 1.06 : 0.94))), r: (item.r || 0) + (event.shiftKey ? (event.deltaY < 0 ? 5 : -5) : 0) }
      : item)));
  }

  // Swipe sideways on the photo to change filter, like every camera app.
  function mediaDown(event) {
    if (tool || editor || sheet) return;
    swipeRef.current = { x: event.clientX, y: event.clientY };
  }
  function mediaUp(event) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
    const index = STORY_FILTERS.findIndex((item) => item.id === filter);
    const next = STORY_FILTERS[(index + (dx < 0 ? 1 : -1) + STORY_FILTERS.length) % STORY_FILTERS.length];
    setFilter(next.id);
    setFilterHint(Date.now());
  }

  // Drawing with pen, highlighter, neon and eraser, with undo.
  function paintDraw(event) {
    const canvas = drawRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width / box.width;
    const kind = BRUSHES.find((item) => item.id === brush) || BRUSHES[0];
    const ctx = canvas.getContext("2d");
    strokesRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    setStrokes(strokesRef.current.length);
    ctx.save();
    ctx.globalCompositeOperation = kind.erase ? "destination-out" : "source-over";
    ctx.globalAlpha = kind.alpha;
    ctx.strokeStyle = pen;
    ctx.lineWidth = kind.width * size * scale;
    ctx.lineCap = kind.id === "marker" ? "square" : "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = kind.glow ? pen : "transparent";
    ctx.shadowBlur = kind.glow ? 18 * scale : 0;
    let last = { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
    const pointsList = [last];
    function move(ev) {
      const next = { x: (ev.clientX - box.left) * scale, y: (ev.clientY - box.top) * scale };
      pointsList.push(next);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      const mid = { x: (last.x + next.x) / 2, y: (last.y + next.y) / 2 };
      ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      last = next;
    }
    function up() {
      if (pointsList.length === 1) {
        ctx.beginPath();
        ctx.arc(last.x, last.y, (kind.width * size * scale) / 2, 0, Math.PI * 2);
        ctx.fillStyle = pen;
        ctx.fill();
      }
      ctx.restore();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function undoDraw() {
    const canvas = drawRef.current;
    const snap = strokesRef.current.pop();
    if (canvas && snap) canvas.getContext("2d").putImageData(snap, 0, 0);
    setStrokes(strokesRef.current.length);
  }

  function finishDraw() {
    const canvas = drawRef.current;
    if (canvas && strokesRef.current.length) {
      setStickers((prev) => [...prev, { type: "draw", image: canvas.toDataURL("image/png"), x: 50, y: 50, s: 1, r: 0 }]);
    }
    strokesRef.current = [];
    setStrokes(0);
    setTool(null);
  }

  async function saveToDevice() {
    if (!media) return;
    const link = document.createElement("a");
    link.download = `space-story-${Date.now()}.${media.type === "video" ? "webm" : "jpg"}`;
    link.href = media.src;
    document.body.appendChild(link);
    link.click();
    link.remove();
    note(say("Saved", "Salvata"));
  }

  function storyItem(close) {
    return {
      id: `made-${Date.now()}-${close ? "c" : "s"}`,
      kind: "story",
      image: media.type === "image" ? media.src : (media.poster || ""),
      video: media.type === "video" ? media.src : "",
      mirror: Boolean(media.mirror),
      muted,
      filter,
      text: "",
      close,
      stickers,
      name: "Tu",
      handle: "@forno.neri",
      avatar: AVATAR,
      src: AVATAR,
      time: "Now",
      likes: "0",
      saves: "0",
      mine: true,
      thread: [],
    };
  }

  function flyAndPublish(item) {
    const stage = stageRef.current;
    const ring = document.querySelector(".story.yours .story-ring");
    const root = document.querySelector(".screen-root");
    setSheet(null);
    if (!stage || !ring) {
      onPublish(item);
      return;
    }
    const box = stage.getBoundingClientRect();
    const target = ring.getBoundingClientRect();
    const shift = Number((root?.style.transform.match(/translate3d\(([-\d.]+)px/) || [])[1]) || 0;
    const dx = target.left - shift + target.width / 2 - (box.left + box.width / 2);
    const dy = target.top + target.height / 2 - (box.top + box.height / 2);
    setSending(true);
    stage.style.transition = "transform 540ms cubic-bezier(0.5, 0, 0.2, 1), border-radius 540ms ease, opacity 300ms ease 300ms";
    stage.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${target.width / box.width})`;
    stage.style.borderRadius = "50%";
    stage.style.opacity = "0";
    window.setTimeout(() => onPublish(item), 440);
  }

  async function shareSelected() {
    if (!media || sending) return;
    const picked = targets.people;
    if (picked.length && live) {
      if (media.type === "video") {
        note(say("Clips can't be sent in chat yet", "I video non si possono ancora inviare in chat"));
      } else {
        for (const handle of picked) {
          try {
            const convId = await live.openDm(handle);
            live.send(convId, { kind: "image", image: media.src, text: say("Sent you a story", "Ti ha inviato una storia") });
          } catch { /* offline: skip */ }
        }
      }
    }
    if (targets.story || targets.close) {
      flyAndPublish(storyItem(!targets.story && targets.close));
      return;
    }
    note(say("Sent", "Inviata"));
    window.setTimeout(onClose, 600);
  }

  const q = find.trim().toLowerCase();
  const places = STORY_PLACES.filter((name) => name.toLowerCase().includes(q));
  const people = CONTACTS.filter((person) => !personHidden(prefs, person.name, true) && `${person.name} ${person.meta}`.toLowerCase().includes(q));
  const hashes = STORY_HASH.filter((tag) => tag.toLowerCase().includes(q));
  const songs = STORY_MUSIC.filter((song) => `${song.title} ${song.artist}`.toLowerCase().includes(q));
  const kit = STORY_KIT.filter((item) => !q || item.label.toLowerCase().includes(q));
  const livePeople = live ? Object.values(live.people).filter((person) => person.handle !== live.me?.handle) : [];
  const filterNow = STORY_FILTERS.find((item) => item.id === filter) || STORY_FILTERS[0];
  const ringTotal = 2 * Math.PI * 46;
  const busyUi = Boolean(tool || editor || dragging != null || sheet);

  let trayBody = null;
  if (tool === "emoji") {
    trayBody = (
      <div className="emoji-grid">
        {STORY_EMOJI.filter((char) => !q || char.includes(q)).map((char) => (
          <button key={char} type="button" onClick={() => addSticker({ type: "emoji", char })}>{char}</button>
        ))}
      </div>
    );
  } else if (tool === "place") {
    trayBody = places.map((name) => (
      <button key={name} type="button" onClick={() => addSticker({ type: "place", name })}>
        <MapPin strokeWidth={2.2} />
        <strong>{name}</strong>
      </button>
    ));
  } else if (tool === "tag") {
    trayBody = people.map((person) => (
      <button key={person.name} type="button" onClick={() => addSticker({ type: "tag", name: person.name })}>
        <strong>{person.name}</strong>
        <span>{person.meta}</span>
      </button>
    ));
  } else if (tool === "hash") {
    trayBody = hashes.map((tag) => (
      <button key={tag} type="button" onClick={() => addSticker({ type: "hash", tag })}>
        <Hash strokeWidth={2.2} />
        <strong>{tag}</strong>
      </button>
    ));
  } else if (tool === "music") {
    trayBody = songs.map((song) => (
      <button key={song.title} type="button" onClick={() => addSticker({ type: "music", ...song })}>
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
      </button>
    ));
  } else if (tool === "gif") {
    trayBody = (
      <div className="gif-row">
        {STORY_GIFS.map((item) => (
          <button key={item.label} type="button" className={`gif ${item.tone}`} onClick={() => addSticker({ type: "gif", ...item })}>{item.label}</button>
        ))}
      </div>
    );
  } else if (tool === "poll") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "poll", question: "Il rosso regge?", a: "Sì", b: "Ancora no", av: 12, bv: 4 })}>
        <strong>Il rosso regge?</strong>
        <span>Sì · Ancora no</span>
      </button>
    );
  } else if (tool === "ask") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "ask", prompt: "Che ne pensi?" })}>
        <strong>Che ne pensi?</strong>
        <span>Chi guarda può rispondere</span>
      </button>
    );
  } else if (tool === "quiz") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "quiz", question: "Il secondo fuoco?", options: ["1200", "1400", "1600"], answer: 1 })}>
        <strong>Il secondo fuoco?</strong>
        <span>1200 · 1400 · 1600</span>
      </button>
    );
  } else if (tool === "slider") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "slider", prompt: "Quanto ti piace?", char: "❤️", value: 62 })}>
        <strong>Quanto ti piace?</strong>
        <span>Slider con il cuore</span>
      </button>
    );
  } else if (tool === "product") {
    const mine = prefs.accountType === "business" ? (shopSpace.products || MY_PRODUCTS_SEED).map((product) => ({ product, owner: null, shop: say("Your shop", "Il tuo shop") })) : [];
    const others = Object.entries(SHOPS).flatMap(([owner, shop]) => shop.products.map((product) => ({ product, owner, shop: shop.title })));
    const pickList = [...mine, ...others].filter(({ product, shop }) => !q || `${product.name} ${shop}`.toLowerCase().includes(q));
    trayBody = (
      <>
        {mine.length ? <p className="sc-tray-label">{say("Your shop", "Il tuo shop")}</p> : null}
        {pickList.map(({ product, owner, shop }, index) => (
          <Fragment key={`${owner || "me"}-${product.id}`}>
            {mine.length && index === mine.filter((entry) => !q || `${entry.product.name} ${entry.shop}`.toLowerCase().includes(q)).length ? <p className="sc-tray-label">{say("From the shops", "Dalle botteghe")}</p> : null}
            <button type="button" className="sc-prod" onClick={() => addSticker({ type: "product", owner, productId: product.id, name: product.name, price: product.price, image: product.images?.[0] || "", y: 72 })}>
              {product.images?.[0] ? <img src={product.images[0]} alt="" /> : <i><Bag weight="fill" /></i>}
              <span><strong>{product.name}</strong><span>{euro(product.price, it)} · {shop}</span></span>
            </button>
          </Fragment>
        ))}
      </>
    );
  } else if (tool === "link") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "link", label: "space.app/forno" })}>space.app/forno</button>
    );
  } else if (tool === "count") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "count", label: "Apertura", when: "Sabato" })}>
        <strong>Apertura</strong>
        <span>Sabato</span>
      </button>
    );
  } else if (tool === "yours") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "yours", prompt: "Il tuo rosso" })}>
        <strong>Il tuo rosso</strong>
        <span>Chi guarda aggiunge il suo</span>
      </button>
    );
  } else if (tool === "notify") {
    trayBody = (
      <button type="button" onClick={() => addSticker({ type: "notify" })}>
        <strong>Avvisa chi ti segue</strong>
        <span>Finisce nella campanella</span>
      </button>
    );
  }

  if (!media) {
    return (
      <div className={`sc sc-capture mode-${mode}${recording ? " recording" : ""}`} ref={stageRef}>
        {mode === "create" ? (
          <button
            type="button"
            className="sc-create"
            style={{ background: `linear-gradient(160deg, ${CREATE_GRADIENTS[gradient][0]}, ${CREATE_GRADIENTS[gradient][1]})` }}
            onClick={shoot}
          >
            <span>{say("Tap to type", "Tocca per scrivere")}</span>
          </button>
        ) : camOn ? (
          <video
            ref={videoRef}
            className={`sc-live${facing === "user" ? " mirror" : ""}${flipping ? " flipping" : ""}`}
            style={{ transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${zoom})` }}
            autoPlay
            playsInline
            muted
            onWheel={(event) => setZoom((value) => Math.min(4, Math.max(1, value + (event.deltaY < 0 ? 0.15 : -0.15))))}
          />
        ) : (
          <RemoteImage key={pick.src} className="sc-live sc-demo" src={pick.src} alt="" />
        )}
        {mode === "layout" ? (
          <div className={`sc-grid g${layout}`}>
            {Array.from({ length: layout }, (_, i) => (
              <span key={i} className={i === cells.length ? "next" : ""}>
                {cells[i] ? <img src={cells[i]} alt="" /> : null}
              </span>
            ))}
          </div>
        ) : null}
        <div className="sc-scrim" />
        {blink ? <span key={blink} className={flash && facing === "user" ? "sc-flash front" : "sc-flash"} aria-hidden="true" /> : null}
        {countdown ? <span key={countdown} className="sc-count">{countdown}</span> : null}
        {zoom > 1.01 ? <span className="sc-zoom">{zoom.toFixed(1)}×</span> : null}
        {recording ? <span className="sc-rec"><i />{`0:${String(Math.floor(recSeconds)).padStart(2, "0")}`}</span> : null}

        <div className="sc-top">
          <button type="button" className="sc-btn" aria-label={say("Close", "Chiudi")} onClick={onClose}><X /></button>
          <button type="button" className={`sc-btn${flash ? " on" : ""}`} aria-label="Flash" aria-pressed={flash} onClick={() => setFlash((value) => !value)}>
            {flash ? <Flash weight="fill" /> : <FlashOff />}
          </button>
        </div>

        <div className="sc-rail">
          <button type="button" className={mode === "create" ? "on" : ""} onClick={() => setMode(mode === "create" ? "story" : "create")}>
            <i><TextIcon /></i><span>{say("Create", "Crea")}</span>
          </button>
          <button type="button" className={mode === "layout" ? "on" : ""} onClick={() => { setMode(mode === "layout" ? "story" : "layout"); setCells([]); }}>
            <i>{layout === 2 ? <Rows /> : <Grid4 />}</i><span>Layout</span>
          </button>
          {mode === "create" ? (
            <button type="button" className="sub" onClick={() => setGradient((value) => (value + 1) % CREATE_GRADIENTS.length)}>
              <i style={{ background: `linear-gradient(135deg, ${CREATE_GRADIENTS[(gradient + 1) % CREATE_GRADIENTS.length][0]}, ${CREATE_GRADIENTS[(gradient + 1) % CREATE_GRADIENTS.length][1]})`, border: "2px solid #fff" }} /><span>{say("Colour", "Colore")}</span>
            </button>
          ) : null}
          {mode === "layout" ? (
            <button type="button" className="sub" onClick={() => { setLayout((value) => (value === 2 ? 4 : 2)); setCells([]); }}>
              <i>{layout === 2 ? <Grid4 /> : <Rows />}</i><span>{layout === 2 ? "4" : "2"}</span>
            </button>
          ) : null}
          <button type="button" className={handsFree ? "on" : ""} onClick={() => setHandsFree((value) => !value)}>
            <i><Hand /></i><span>{say("Hands-free", "Mani libere")}</span>
          </button>
          <button type="button" className={timer ? "on" : ""} onClick={() => setTimer((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))}>
            <i><Timer />{timer ? <b>{timer}</b> : null}</i><span>Timer</span>
          </button>
        </div>

        <div className="sc-bottom">
          <button type="button" className="sc-roll" aria-label={say("Gallery", "Galleria")} onClick={() => fileRef.current?.click()}>
            <RemoteImage src={WORKS[(cells.length + 1) % WORKS.length].src} alt="" />
          </button>
          <button
            type="button"
            className={`sc-shutter${recording ? " rec" : ""}${handsFree ? " free" : ""}`}
            aria-label={say("Capture, hold for video", "Scatta, tieni premuto per il video")}
            onPointerDown={shutterDown}
            onPointerMove={shutterMove}
            onPointerUp={shutterUp}
            onPointerCancel={shutterUp}
            onClick={(event) => {
              event.preventDefault();
              if (holdRef.current.clip) {
                holdRef.current.clip = false;
                return;
              }
              window.clearTimeout(holdRef.current.timer);
              shoot();
            }}
          >
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle className="track" cx="50" cy="50" r="46" />
              <circle className="bar" cx="50" cy="50" r="46" style={{ strokeDasharray: ringTotal, strokeDashoffset: ringTotal * (1 - Math.min(1, recSeconds / MAX_CLIP)) }} />
            </svg>
            <i />
          </button>
          <button
            type="button"
            className={`sc-btn sc-flip${flipping ? " spin" : ""}`}
            aria-label={say("Flip camera", "Gira fotocamera")}
            onClick={() => {
              if (!camOn) return;
              setFlipping(true);
              setFacing((value) => (value === "environment" ? "user" : "environment"));
            }}
          >
            <SwitchCamera />
          </button>
        </div>
        <div className="sc-modes" role="tablist">
          {[["create", say("CREATE", "CREA")], ["story", say("STORY", "STORIA")], ["layout", "LAYOUT"]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} className={mode === id ? "on" : ""} onClick={() => { setMode(id); setCells([]); }}>{label}</button>
          ))}
        </div>
        <p className="sc-tip">{mode === "story" ? (handsFree ? say("Tap to start and stop", "Tocca per iniziare e fermare") : say("Tap for photo, hold for video", "Tocca per la foto, tieni premuto per il video")) : mode === "layout" ? say(`Take ${layout - cells.length} more`, `Ancora ${layout - cells.length}`) : say("Tap anywhere to type", "Tocca ovunque per scrivere")}</p>
        <input ref={fileRef} className="sr" type="file" accept="image/*,video/*" onChange={fromLibrary} />
        {toast ? <span className="sv-toast" key={toast}>{toast}</span> : null}
      </div>
    );
  }

  return (
    <div className={`sc sc-edit${sending ? " sending" : ""}${busyUi ? " busy" : ""}`} ref={stageRef}>
      <div className="sc-media" onPointerDown={mediaDown} onPointerUp={mediaUp} onPointerCancel={() => { swipeRef.current = null; }}>
        {media.type === "video" ? (
          <video
            className={media.mirror ? "mirror" : ""}
            src={media.src}
            style={{ filter: filterNow.css }}
            autoPlay
            loop
            playsInline
            muted={muted}
          />
        ) : (
          <img src={media.src} alt="" draggable="false" style={{ filter: filterNow.css }} />
        )}
      </div>
      <div className="sc-scrim" />
      {filterHint ? <span key={filterHint} className="sc-filter-name">{filterNow.label}</span> : null}

      {stickers.map((item, index) => (
        <div
          key={`${item.type}-${index}-${item.fresh || 0}`}
          className={`sticker-pos edit${item.type === "draw" ? " draw" : ""}${item.fresh ? " fresh" : ""}${dragging === index ? " grabbing" : ""}`}
          style={stickerStyle(item)}
          onPointerDown={(event) => grab(index, event)}
          onWheel={(event) => wheel(index, event)}
        >
          <StickerFace item={item} onAct={() => {}} />
        </div>
      ))}
      {dragging != null ? <span ref={trashRef} className="sc-trash" aria-hidden="true"><X strokeWidth={2.4} /></span> : null}

      {!busyUi ? (
        <div className="sc-top edit">
          <button type="button" className="sc-btn" aria-label={say("Back", "Indietro")} onClick={() => (stickers.length ? setSheet("discard") : leaveEditor())}>
            <ChevronLeft />
          </button>
          <div className="sc-tools">
            <button type="button" className="sc-btn" aria-label={say("Text", "Testo")} onClick={() => setEditor({ open: Date.now(), text: "", color: "#ffffff", font: "classic", bg: "" })}><TextIcon /></button>
            <button type="button" className="sc-btn" aria-label="Sticker" onClick={() => setTool("tray")}><StickerIcon /></button>
            <button type="button" className="sc-btn" aria-label={say("Music", "Musica")} onClick={() => setTool("music")}><Music /></button>
            <button type="button" className="sc-btn" aria-label={say("Filters", "Filtri")} onClick={() => setTool("filters")}><Sparkle /></button>
            <button type="button" className="sc-btn" aria-label={say("Draw", "Disegna")} onClick={() => setTool("draw")}><Scribble /></button>
            <button type="button" className="sc-btn" aria-label={say("More", "Altro")} onClick={() => setSheet("more")}><MoreHorizontal /></button>
          </div>
        </div>
      ) : null}

      {media.type === "video" && !busyUi ? (
        <button type="button" className="sc-btn sc-mute" aria-label={muted ? say("Sound on", "Attiva audio") : say("Mute", "Silenzia")} onClick={() => setMuted((value) => !value)}>
          {muted ? <SoundOff /> : <SoundOn />}
        </button>
      ) : null}

      {tool === "filters" ? (
        <div className="sc-filters" onClick={(event) => event.stopPropagation()}>
          <div className="sc-filter-row">
            {STORY_FILTERS.map((item) => (
              <button key={item.id} type="button" className={filter === item.id ? "on" : ""} onClick={() => { setFilter(item.id); setFilterHint(Date.now()); }}>
                <span style={{ backgroundImage: `url(${media.type === "image" ? media.src : AVATAR})`, filter: item.css }} />
                <b>{item.label}</b>
              </button>
            ))}
          </div>
          <button type="button" className="sc-done" onClick={() => setTool(null)}>{say("Done", "Fine")}</button>
        </div>
      ) : null}

      {tool === "draw" ? (
        <div className="sc-draw">
          <canvas
            ref={(node) => {
              drawRef.current = node;
              if (node && stageRef.current && !node.dataset.sized) {
                node.dataset.sized = "1";
                const box = stageRef.current.getBoundingClientRect();
                const ratio = Math.min(2, window.devicePixelRatio || 1);
                node.width = Math.max(1, Math.round(box.width * ratio));
                node.height = Math.max(1, Math.round(box.height * ratio));
              }
            }}
            onPointerDown={paintDraw}
          />
          <div className="sc-draw-top">
            <button type="button" className="sc-btn" aria-label={say("Undo", "Annulla")} disabled={!strokes} onClick={undoDraw}><Undo /></button>
            <div className="sc-brushes">
              {BRUSHES.map((item) => (
                <button key={item.id} type="button" className={brush === item.id ? "on" : ""} aria-label={item.label} onClick={() => setBrush(item.id)}>
                  <item.icon weight={brush === item.id ? "fill" : "regular"} />
                </button>
              ))}
            </div>
            <button type="button" className="sc-done" onClick={finishDraw}>{say("Done", "Fine")}</button>
          </div>
          <input
            className="sc-size"
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={size}
            aria-label={say("Brush size", "Dimensione pennello")}
            onChange={(event) => setSize(Number(event.target.value))}
          />
          <div className="sc-swatches">
            {TEXT_SWATCHES.map((color) => (
              <button key={color} type="button" className={pen === color ? "on" : ""} style={{ background: color }} aria-label={color} onClick={() => setPen(color)} />
            ))}
          </div>
        </div>
      ) : null}

      {tool && tool !== "draw" && tool !== "filters" ? (
        <div className="sc-sheet-back" onClick={() => { setTool(null); setFind(""); }}>
          <div className="sc-tray" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <label className="sc-search">
              <Search />
              <input value={find} placeholder={say("Search", "Cerca")} aria-label={say("Search stickers", "Cerca sticker")} onChange={(event) => setFind(event.target.value)} />
            </label>
            {tool !== "tray" ? (
              <div className="sc-tray-head">
                <button type="button" aria-label={say("Back", "Indietro")} onClick={() => setTool("tray")}><ChevronLeft /></button>
                <strong>{STORY_KIT.find((item) => item.id === tool)?.label}</strong>
              </div>
            ) : null}
            <div className="sc-tray-body tray-body">
              {tool === "tray" ? (
                <>
                  {q && places.length ? places.slice(0, 3).map((name) => (
                    <button key={name} type="button" onClick={() => addSticker({ type: "place", name })}><MapPin /><strong>{name}</strong></button>
                  )) : null}
                  {q && people.length ? people.slice(0, 3).map((person) => (
                    <button key={person.name} type="button" onClick={() => addSticker({ type: "tag", name: person.name })}><AtSign /><strong>{person.name}</strong></button>
                  )) : null}
                  <div className="sc-kit">
                    {kit.map((item, i) => (
                      <button key={item.id} type="button" style={{ animationDelay: `${i * 18}ms` }} onClick={() => setTool(item.id)}>
                        <i><item.icon /></i>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="sc-emoji-quick">
                    {STORY_EMOJI.slice(0, 16).map((char) => (
                      <button key={char} type="button" onClick={() => addSticker({ type: "emoji", char })}>{char}</button>
                    ))}
                  </div>
                </>
              ) : trayBody}
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <div className="text-editor" onPointerDown={(event) => { if (event.target === event.currentTarget) saveText(); }}>
          <div className="te-top">
            <button
              type="button"
              className={`te-bg${editor.bg ? " on" : ""}`}
              aria-label={say("Text background", "Sfondo testo")}
              onClick={() => setEditor((prev) => ({ ...prev, bg: prev.bg === "" ? "solid" : prev.bg === "solid" ? "soft" : "" }))}
            >
              A
            </button>
            <button type="button" className="sc-done" onClick={saveText}>{say("Done", "Fine")}</button>
          </div>
          <textarea
            ref={textRef}
            className={`te-input sticker text font-${editor.font}${editor.bg ? ` bg-${editor.bg}` : ""}`}
            style={{ "--tc": editor.color }}
            value={editor.text}
            rows={Math.min(6, Math.max(1, editor.text.split("\n").length))}
            placeholder={say("Type…", "Scrivi…")}
            aria-label={say("Story text", "Testo della storia")}
            onChange={(event) => setEditor((prev) => ({ ...prev, text: event.target.value }))}
          />
          <div className="te-fonts">
            {TEXT_FONTS.map((font) => (
              <button key={font.id} type="button" className={`font-${font.id}${editor.font === font.id ? " on" : ""}`} onClick={() => setEditor((prev) => ({ ...prev, font: font.id }))}>
                {font.label}
              </button>
            ))}
          </div>
          <div className="te-colors">
            {TEXT_SWATCHES.map((color) => (
              <button key={color} type="button" className={editor.color === color ? "on" : ""} style={{ background: color }} aria-label={color} onClick={() => setEditor((prev) => ({ ...prev, color }))} />
            ))}
          </div>
        </div>
      ) : null}

      {!busyUi ? (
        <div className="sc-share">
          <button type="button" className="sc-pill" onClick={() => flyAndPublish(storyItem(false))} disabled={sending}>
            <RemoteImage src={AVATAR} alt="" />
            <span>{say("Your story", "La tua storia")}</span>
          </button>
          <button type="button" className="sc-pill close" onClick={() => flyAndPublish(storyItem(true))} disabled={sending}>
            <i><Star weight="fill" /></i>
            <span>{say("Close friends", "Amici stretti")}</span>
          </button>
          <button type="button" className="sc-go" aria-label={say("Share to", "Condividi con")} onClick={() => setSheet("share")} disabled={sending}>
            <ChevronRight strokeWidth={2.6} />
          </button>
        </div>
      ) : null}

      {sheet === "more" ? (
        <div className="sv-sheet-back" onClick={() => setSheet(null)}>
          <div className="sv-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <button type="button" onClick={() => { setSheet(null); saveToDevice(); }}><Download /> {say("Save to device", "Salva sul dispositivo")}</button>
            <button type="button" onClick={() => { setSheet(null); setTool("tag"); }}><AtSign /> {say("Mention someone", "Menziona qualcuno")}</button>
            <button type="button" onClick={() => { setSheet(null); setTool("place"); }}><MapPin /> {say("Add location", "Aggiungi luogo")}</button>
            {media.type === "video" ? (
              <button type="button" onClick={() => { setSheet(null); setMuted((value) => !value); }}>{muted ? <SoundOn /> : <SoundOff />} {muted ? say("Turn sound on", "Attiva audio") : say("Mute", "Silenzia")}</button>
            ) : null}
            <button type="button" className="warn" onClick={() => setSheet("discard")}><X /> {say("Discard", "Scarta")}</button>
          </div>
        </div>
      ) : null}

      {sheet === "discard" ? (
        <div className="sv-sheet-back" onClick={() => setSheet(null)}>
          <div className="sv-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <p className="cam-ask">{say("Discard this story? Your edits will be lost.", "Scartare questa storia? Le modifiche andranno perse.")}</p>
            <button type="button" className="warn" onClick={leaveEditor}>{say("Discard", "Scarta")}</button>
            <button type="button" onClick={() => setSheet(null)}>{say("Keep editing", "Continua a modificare")}</button>
          </div>
        </div>
      ) : null}

      {sheet === "share" ? (
        <div className="sv-sheet-back" onClick={() => setSheet(null)}>
          <div className="sv-sheet sc-share-sheet" onClick={(event) => event.stopPropagation()}>
            <i className="sv-grab" />
            <strong className="sv-sheet-title">{say("Share", "Condividi")}</strong>
            <button type="button" className="sc-target" onClick={() => setTargets((prev) => ({ ...prev, story: !prev.story }))}>
              <RemoteImage className="row-avatar" src={AVATAR} alt="" />
              <span>{say("Your story", "La tua storia")}</span>
              {targets.story ? <Checked weight="fill" className="tick-on" /> : <Ring className="tick-off" />}
            </button>
            <button type="button" className="sc-target" onClick={() => setTargets((prev) => ({ ...prev, close: !prev.close }))}>
              <i className="sc-star"><Star weight="fill" /></i>
              <span>{say("Close friends", "Amici stretti")}</span>
              {targets.close ? <Checked weight="fill" className="tick-on" /> : <Ring className="tick-off" />}
            </button>
            {livePeople.length ? <p className="sc-sub">{say("Send to", "Invia a")}</p> : null}
            <div className="sc-people">
              {livePeople.map((person) => {
                const on = targets.people.includes(person.handle);
                return (
                  <button
                    key={person.handle}
                    type="button"
                    className="sc-target"
                    onClick={() => setTargets((prev) => ({ ...prev, people: on ? prev.people.filter((h) => h !== person.handle) : [...prev.people, person.handle] }))}
                  >
                    <RemoteImage className="row-avatar" src={person.src || avatarFor(person.name)} alt="" />
                    <span>{person.name}<em>@{person.handle}</em></span>
                    {on ? <Checked weight="fill" className="tick-on" /> : <Ring className="tick-off" />}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="msg-create sc-share-go"
              disabled={!targets.story && !targets.close && !targets.people.length}
              onClick={shareSelected}
            >
              {say("Share", "Condividi")}
            </button>
          </div>
        </div>
      ) : null}
      {toast ? <span className="sv-toast" key={toast}>{toast}</span> : null}
    </div>
  );
}

function SavedScreen({ posts, onClose, onOpenPost }) {
  return (
    <div className="panel view">
      <ScreenHead title="Saved" meta={posts.length ? `${posts.length}` : "Vuoto"} onClose={onClose} />
      <div className="panel-scroll">
        {posts.length === 0 ? (
          <section className="sheet empty-sheet">
            <h2>Nothing here</h2>
            <p>Salva un post dal feed.</p>
          </section>
        ) : (
          <div className="explore-grid">
            {posts.map((post) => (
              <button key={post.id} type="button" className="explore-tile" aria-label={`Open post, ${post.name}`} onClick={() => onOpenPost(post)}>
                <RemoteImage src={post.image || post.avatar} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const PREF_LANGS = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "zh", label: "中文" },
  { id: "ar", label: "العربية" },
];

const DEFAULT_PREFS = {
  language: "en",
  private: false,
  activity: true,
  readReceipts: true,
  messages: "everyone",
  storyReplies: "everyone",
  comments: "everyone",
  tags: "everyone",
  mentions: "everyone",
  sensitive: "standard",
  likeCounts: true,
  suggested: true,
  dataSaver: false,
  captions: false,
  altText: true,
  accountType: "personal",
  timeLimit: "off",
  searchesCleared: false,
  hiddenWords: ["spam"],
  blocked: [],
  muted: [],
  closeFriends: ["Marta Colle", "Leo Bassi"],
  restricted: [],
  notes: { likes: true, comments: true, follows: true, messages: true, mentions: true },
  accounts: ["Giulia Neri"],
  activeAccount: "Giulia Neri",
};

function loadPrefs() {
  try {
    const raw = JSON.parse(window.localStorage.getItem("space-prefs") || "null");
    if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
    return {
      ...DEFAULT_PREFS,
      ...raw,
      notes: { ...DEFAULT_PREFS.notes, ...(raw.notes || {}) },
      hiddenWords: Array.isArray(raw.hiddenWords) ? raw.hiddenWords : DEFAULT_PREFS.hiddenWords,
      blocked: Array.isArray(raw.blocked) ? raw.blocked : [],
      muted: Array.isArray(raw.muted) ? raw.muted : [],
      closeFriends: Array.isArray(raw.closeFriends) ? raw.closeFriends : DEFAULT_PREFS.closeFriends,
      restricted: Array.isArray(raw.restricted) ? raw.restricted : [],
      accounts: Array.isArray(raw.accounts) && raw.accounts.length ? raw.accounts : DEFAULT_PREFS.accounts,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function say(lang, en, it) {
  return lang === "it" ? it : en;
}

const LEGAL = {
  "privacy-policy": {
    en: {
      title: "Privacy Policy",
      sections: [
        { h: "What Space keeps", p: "Your name, handle, bio, the posts you publish in this preview, and the preferences on this phone. Nothing is sent to a server." },
        { h: "Who can see you", p: "A private account hides posts, reels and stories from people you have not approved. Your name, photo and bio stay visible." },
        { h: "Messages", p: "Activity status and read receipts follow the switches in Settings. Turning them off hides them both ways." },
        { h: "Your choices", p: "Language, colors, muted accounts, blocked accounts and hidden words stay in local storage until you clear them." },
      ],
    },
    it: {
      title: "Privacy Policy",
      sections: [
        { h: "Cosa conserva Space", p: "Nome, handle, bio, i post che pubblichi in questa anteprima e le preferenze su questo telefono. Non parte nulla verso un server." },
        { h: "Chi ti vede", p: "Un account privato nasconde post, reel e storie a chi non hai approvato. Nome, foto e bio restano visibili." },
        { h: "Messaggi", p: "Stato attività e conferme di lettura seguono gli interruttori in Impostazioni. Se li spegni, si nascondono da entrambe le parti." },
        { h: "Le tue scelte", p: "Lingua, colori, account silenziati, bloccati e parole nascoste restano nella memoria locale finché non li cancelli." },
      ],
    },
  },
  terms: {
    en: {
      title: "Terms of Use",
      sections: [
        { h: "The preview", p: "Space is a private demo. Posts, chats and accounts you add live only in this browser." },
        { h: "Your content", p: "Captions you write stay yours. Do not post anything you do not have the right to share." },
        { h: "Other people", p: "Blocking, restricting and muting change what this preview shows you. They do not reach a real network." },
        { h: "Changes", p: "These terms describe the preview as it is today. The app can change as the demo grows." },
      ],
    },
    it: {
      title: "Termini di utilizzo",
      sections: [
        { h: "L'anteprima", p: "Space è una demo privata. Post, chat e account che aggiungi vivono solo in questo browser." },
        { h: "I tuoi contenuti", p: "Le didascalie che scrivi restano tue. Non pubblicare ciò che non hai diritto di condividere." },
        { h: "Le altre persone", p: "Bloccare, limitare e silenziare cambia ciò che vedi in questa anteprima. Non raggiungono una rete vera." },
        { h: "Modifiche", p: "Questi termini descrivono l'anteprima di oggi. L'app può cambiare mentre la demo cresce." },
      ],
    },
  },
  about: {
    en: {
      title: "About",
      sections: [
        { h: "Space", p: "A phone for the workshop. Posts, stories, reels and messages, in liquid glass." },
        { h: "Version", p: "Preview 0.1.0 · on this device." },
      ],
    },
    it: {
      title: "Informazioni",
      sections: [
        { h: "Space", p: "Un telefono per il laboratorio. Post, storie, reel e messaggi, in vetro liquido." },
        { h: "Versione", p: "Anteprima 0.1.0 · su questo dispositivo." },
      ],
    },
  },
};

function settingGroups(lang) {
  const s = (en, it) => say(lang, en, it);
  return [
    {
      title: s("Your account", "Il tuo account"),
      rows: [
        { id: "edit", label: s("Edit profile", "Modifica profilo"), meta: s("Name, handle, bio", "Nome, handle, bio") },
        { id: "login", label: s("Accounts", "Account"), meta: s("Add or switch", "Aggiungi o cambia") },
      ],
    },
    {
      title: s("How you use Space", "Come usi Space"),
      rows: [
        { id: "saved", label: s("Saved", "Salvati"), meta: s("Posts and reels", "Post e reel") },
        { id: "archive", label: s("Archive", "Archivio"), meta: s("Stories and posts you hid", "Storie e post nascosti") },
        { id: "activity", label: s("Your activity", "La tua attività"), meta: s("Time, likes, searches", "Tempo, like, ricerche") },
        { id: "notifications", label: s("Notifications", "Notifiche"), meta: s("Likes, comments, follows", "Like, commenti, follow") },
        { id: "time", label: s("Time spent", "Tempo di utilizzo"), meta: s("Daily limit", "Limite giornaliero") },
      ],
    },
    {
      title: s("Who can see your content", "Chi può vedere i tuoi contenuti"),
      rows: [
        { id: "privacy", label: s("Account privacy", "Privacy dell'account"), meta: s("Public or private", "Pubblico o privato") },
        { id: "close", label: s("Close friends", "Amici più stretti"), meta: s("Stories just for them", "Storie solo per loro") },
        { id: "blocked", label: s("Blocked", "Bloccati"), meta: s("People who cannot find you", "Chi non può trovarti") },
      ],
    },
    {
      title: s("How others can interact with you", "Come gli altri interagiscono con te"),
      rows: [
        { id: "messages", label: s("Messages and story replies", "Messaggi e risposte alle storie"), meta: s("Who can reach you", "Chi può scriverti") },
        { id: "tags", label: s("Tags and mentions", "Tag e menzioni"), meta: s("Who can tag you", "Chi può taggarti") },
        { id: "comments", label: s("Comments", "Commenti"), meta: s("Who can comment", "Chi può commentare") },
        { id: "words", label: s("Hidden words", "Parole nascoste"), meta: s("Filter comments and requests", "Filtra commenti e richieste") },
        { id: "restricted", label: s("Restricted", "Limitati"), meta: s("Comments only you see", "Commenti che vedi solo tu") },
      ],
    },
    {
      title: s("What you see", "Cosa vedi"),
      rows: [
        { id: "muted", label: s("Muted accounts", "Account silenziati"), meta: s("Hide their posts", "Nascondi i loro post") },
        { id: "content", label: s("Content preferences", "Preferenze sui contenuti"), meta: s("Sensitive content, suggestions", "Contenuti sensibili, suggerimenti") },
      ],
    },
    {
      title: s("Your app and media", "App e media"),
      rows: [
        { id: "theme", label: s("Colors", "Colori"), meta: s("The color of Space", "Il colore di Space") },
        { id: "language", label: s("Language", "Lingua"), meta: s("App language", "Lingua dell'app") },
        { id: "accessibility", label: s("Accessibility", "Accessibilità"), meta: s("Captions and alt text", "Sottotitoli e testo alternativo") },
        { id: "data", label: s("Data usage", "Uso dei dati"), meta: s("Data saver", "Risparmio dati") },
      ],
    },
    {
      title: s("For professionals", "Per i professionisti"),
      rows: [
        { id: "account-type", label: s("Account type and shop", "Tipo di account e shop"), meta: s("Personal, creator or business", "Personale, creator o azienda") },
        { id: "payments", label: s("Payments", "Pagamenti"), meta: s("Sell with Stripe, payouts", "Vendi con Stripe, versamenti") },
        { id: "orders", label: s("Orders", "Ordini"), meta: s("Purchases and sales", "Acquisti e vendite") },
      ],
    },
    {
      title: s("More info and support", "Info e assistenza"),
      rows: [
        { id: "help", label: s("Help", "Assistenza"), meta: s("Answers", "Risposte") },
        { id: "privacy-policy", label: s("Privacy Policy", "Privacy Policy"), meta: s("How Space handles this preview", "Come Space tratta questa anteprima") },
        { id: "terms", label: s("Terms of Use", "Termini di utilizzo"), meta: s("The rules of the preview", "Le regole dell'anteprima") },
        { id: "about", label: s("About", "Informazioni"), meta: "Space 0.1.0" },
      ],
    },
  ];
}

const SETTING_ICONS = {
  edit: [UserIcon, "blue"],
  login: [Users, "indigo"],
  saved: [Bookmark, "purple"],
  archive: [Archive, "brown"],
  activity: [BarChart2, "teal"],
  notifications: [Bell, "red"],
  time: [Timer, "indigo"],
  privacy: [Lock, "gray"],
  close: [Star, "green"],
  blocked: [EyeOff, "red"],
  messages: [MessageCircle, "blue"],
  tags: [AtSign, "orange"],
  comments: [MessageSquareText, "teal"],
  words: [TextIcon, "gray"],
  restricted: [Hand, "orange"],
  muted: [BellOff, "gray"],
  content: [Sparkle, "pink"],
  theme: [Brush, "purple"],
  language: [Globe, "cyan"],
  accessibility: [Eye, "blue"],
  data: [Download, "green"],
  "account-type": [Star, "yellow"],
  payments: [PriceTag, "green"],
  orders: [Box, "brown"],
  help: [HelpCircle, "blue"],
  "privacy-policy": [Lock, "gray"],
  terms: [TextIcon, "gray"],
  about: [Info, "gray"],
};

function SettingIcon({ id }) {
  const [Icon, tone] = SETTING_ICONS[id] || [Settings, "gray"];
  return <i className={`st-ico ${tone}`}><Icon weight="fill" /></i>;
}

function StHead({ title, onClose, right }) {
  const it = useContext(SpacePrefs).language === "it";
  return (
    <div className="st-head">
      <button type="button" className="st-back" aria-label={it ? "Indietro" : "Back"} onClick={onClose}><ChevronLeft strokeWidth={2.6} /></button>
      <strong>{title}</strong>
      <span className="st-head-r">{right}</span>
    </div>
  );
}

function StHero({ id, title, meta }) {
  return (
    <div className="st-hero">
      <SettingIcon id={id} />
      <strong>{title}</strong>
      {meta ? <p>{meta}</p> : null}
    </div>
  );
}

function settingValue(id, prefs, lang) {
  const s = (en, it) => say(lang, en, it);
  const count = (list) => (list?.length ? String(list.length) : "");
  switch (id) {
    case "privacy": return prefs.private ? s("Private", "Privato") : s("Public", "Pubblico");
    case "language": return PREF_LANGS.find((item) => item.id === prefs.language)?.label || "";
    case "notifications": {
      const on = Object.values(prefs.notes || {}).filter(Boolean).length;
      return on ? s(`${on} on`, `${on} attive`) : s("Off", "Spente");
    }
    case "time": return prefs.timeLimit === "off" ? s("Off", "Spento") : prefs.timeLimit === "60" ? "1 h" : `${prefs.timeLimit} min`;
    case "close": return count(prefs.closeFriends);
    case "blocked": return count(prefs.blocked);
    case "muted": return count(prefs.muted);
    case "restricted": return count(prefs.restricted);
    case "words": return count(prefs.hiddenWords);
    case "data": return prefs.dataSaver ? s("On", "Attivo") : s("Off", "Spento");
    case "account-type": return prefs.accountType === "creator" ? "Creator" : prefs.accountType === "business" ? s("Business", "Azienda") : s("Personal", "Personale");
    case "about": return "0.1.0";
    default: return "";
  }
}

function SettingsScreen({ profile, prefs, onClose, onOpen }) {
  const lang = prefs.language === "it" ? "it" : "en";
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = settingGroups(lang).map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !needle || `${row.label} ${row.meta}`.toLowerCase().includes(needle)),
  })).filter((group) => group.rows.length);
  return (
    <div className="panel view st">
      <StHead title={say(lang, "Settings and privacy", "Impostazioni e privacy")} onClose={onClose} />
      <div className="panel-scroll">
        <label className="st-search">
          <Search strokeWidth={2.2} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={say(lang, "Search settings", "Cerca nelle impostazioni")} aria-label={say(lang, "Search settings", "Cerca nelle impostazioni")} />
          {query ? <button type="button" className="sx-clear" aria-label={say(lang, "Clear", "Cancella")} onClick={() => setQuery("")}><X strokeWidth={2.6} /></button> : null}
        </label>
        {!needle ? (
          <button type="button" className="st-me" onClick={() => onOpen("edit")}>
            <RemoteImage src={AVATAR} alt="" />
            <span>
              <strong>{profile.name}</strong>
              <em>{profile.handle}</em>
            </span>
            <ChevronRight strokeWidth={2.4} className="st-chev" />
          </button>
        ) : null}
        {groups.map((group, index) => (
          <section key={group.title} className="st-group" style={{ "--i": index }}>
            <h2 className="st-cap">{group.title}</h2>
            <div className="st-card">
              {group.rows.map((row) => {
                const value = settingValue(row.id, prefs, lang);
                return (
                  <button key={`${group.title}-${row.id}`} type="button" className="st-row" onClick={() => onOpen(row.id)}>
                    <SettingIcon id={row.id} />
                    <span className="st-row-text">
                      <strong>{row.label}</strong>
                      <em>{row.meta}</em>
                    </span>
                    {value ? <span className="st-value">{value}</span> : null}
                    <ChevronRight strokeWidth={2.4} className="st-chev" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 ? (
          <div className="ig-empty">
            <i><Search strokeWidth={1.4} /></i>
            <strong>{say(lang, "No results", "Nessun risultato")}</strong>
            <span>{say(lang, "No setting with that name.", "Nessuna impostazione con questo nome.")}</span>
          </div>
        ) : null}
        {!needle ? (
          <>
            <div className="st-card st-out">
              <button type="button" className="st-row center" onClick={() => onOpen("login")}>
                <strong>{say(lang, "Log out", "Esci")}</strong>
              </button>
            </div>
            <p className="st-foot"><b>Space</b> · {say(lang, "version", "versione")} 0.1.0</p>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Switch({ on, label }) {
  return (
    <i className={on ? "switch on" : "switch"} aria-hidden="true">
      <i />
      <span className="sr">{label}</span>
    </i>
  );
}

function ToggleRow({ on, label, meta, onClick }) {
  return (
    <button type="button" className="feed-row st-toggle" role="switch" aria-checked={on} onClick={onClick}>
      <span className="feed-copy">
        <strong>{label}</strong>
        {meta ? <span>{meta}</span> : null}
      </span>
      <Switch on={on} label={label} />
    </button>
  );
}

function ChoiceList({ value, options, onPick }) {
  return (
    <div className="set-card">
      {options.map((option) => (
        <button key={option.id} type="button" className="feed-row" aria-pressed={value === option.id} onClick={() => onPick(option.id)}>
          <span className="feed-copy"><strong>{option.label}</strong></span>
          <i className={value === option.id ? "pick on st-check" : "pick st-check"}>{value === option.id ? <Check weight="bold" /> : null}</i>
        </button>
      ))}
    </div>
  );
}

function PeopleToggles({ list, onChange }) {
  return (
    <div className="set-card">
      {CONTACTS.slice(0, 8).map((person) => {
        const on = list.includes(person.name);
        return (
          <button key={person.name} type="button" className="feed-row" aria-pressed={on} onClick={() => onChange(on ? list.filter((name) => name !== person.name) : [...list, person.name])}>
            <RemoteImage className="row-avatar" src={person.src} alt="" />
            <span className="feed-copy">
              <strong>{person.name}</strong>
              <span>{person.meta}</span>
            </span>
            <i className={on ? "pick on" : "pick"} />
          </button>
        );
      })}
    </div>
  );
}

function ArchiveList() {
  const space = useSpace();
  const prefs = useContext(SpacePrefs);
  const it = prefs.language === "it";
  const posts = [...space.library, ...POSTS].filter((post, index, all) => (
    space.archived.has(post.id) && all.findIndex((item) => item.id === post.id) === index
  ));
  if (!posts.length) {
    return (
      <section className="sheet empty-sheet">
        <h2>{it ? "Niente qui" : "Nothing here"}</h2>
        <p>{it ? "I post che archivi aspettano qui." : "Posts you archive wait here."}</p>
      </section>
    );
  }
  return (
    <div className="set-card">
      {posts.map((post) => (
        <button key={post.id} type="button" className="feed-row" onClick={() => space.toggleArchive(post.id)}>
          {post.image ? <RemoteImage className="row-thumb" src={post.image} alt="" /> : null}
          <span className="feed-copy">
            <strong>{post.name || "Tu"}</strong>
            <span>{post.text || post.caption || (it ? "Ripristina" : "Restore")}</span>
          </span>
          <span className="row-meta">{it ? "Ripristina" : "Restore"}</span>
        </button>
      ))}
    </div>
  );
}

function PrefsScreen({ page, prefs, profile, onChange, onClose, onLogout, used = 0, accounts = [], current, onSwitch, onAddAccount }) {
  const lang = prefs.language === "it" ? "it" : "en";
  const s = (en, it) => say(lang, en, it);
  const [word, setWord] = useState("");
  const [accountName, setAccountName] = useState("");
  const [confirmOut, setConfirmOut] = useState(false);
  const [openHelp, setOpenHelp] = useState(null);
  const audience = [
    { id: "everyone", label: s("Everyone", "Tutti") },
    { id: "following", label: s("People you follow", "Persone che segui") },
    { id: "off", label: s("Off", "Nessuno") },
  ];
  const titles = {
    privacy: [s("Account privacy", "Privacy dell'account"), s("Who can see your posts", "Chi vede i tuoi post")],
    archive: [s("Archive", "Archivio"), s("Hidden from the profile", "Nascosti dal profilo")],
    activity: [s("Your activity", "La tua attività"), s("On this phone", "Su questo telefono")],
    notifications: [s("Notifications", "Notifiche"), s("What can reach you", "Cosa può raggiungerti")],
    time: [s("Time spent", "Tempo di utilizzo"), s("A daily reminder", "Un promemoria al giorno")],
    close: [s("Close friends", "Amici più stretti"), s("A green ring on stories", "Anello verde sulle storie")],
    blocked: [s("Blocked", "Bloccati"), s("They cannot find you", "Non possono trovarti")],
    messages: [s("Messages", "Messaggi"), s("Replies and activity", "Risposte e attività")],
    tags: [s("Tags and mentions", "Tag e menzioni"), s("Before it lands on you", "Prima che finisca su di te")],
    comments: [s("Comments", "Commenti"), s("Who can reply", "Chi può rispondere")],
    words: [s("Hidden words", "Parole nascoste"), s("Comments and requests", "Commenti e richieste")],
    restricted: [s("Restricted", "Limitati"), s("Their comments stay with you", "I loro commenti restano da te")],
    muted: [s("Muted", "Silenziate"), s("Their posts leave your feed", "I loro post escono dal feed")],
    content: [s("Content preferences", "Preferenze sui contenuti"), s("What the feed shows", "Cosa mostra il feed")],
    accessibility: [s("Accessibility", "Accessibilità"), s("Reading the app", "Leggere l'app")],
    data: [s("Data usage", "Uso dei dati"), s("On a small connection", "Con poca rete")],
    "account-type": [s("Account type", "Tipo di account"), s("Tools for the workshop", "Strumenti per il laboratorio")],
    payments: [s("Payments", "Pagamenti"), s("Sell directly with Stripe", "Vendi direttamente con Stripe")],
    help: [s("Help", "Assistenza"), s("Short answers", "Risposte brevi")],
    login: [s("Accounts", "Account"), s("On this phone", "Su questo telefono")],
  };
  const title = titles[page] || [page, ""];
  const limits = [
    { id: "off", label: s("Off", "Spento") },
    { id: "30", label: s("30 minutes", "30 minuti") },
    { id: "45", label: s("45 minutes", "45 minuti") },
    { id: "60", label: s("1 hour", "1 ora") },
  ];
  const week = [40, 62, 28, 74, 55, 36, 48];

  return (
    <div className="panel view st">
      <StHead title={title[0]} onClose={onClose} />
      <div className="panel-scroll">
        <StHero id={page} title={title[0]} meta={title[1]} />
        {page === "privacy" ? (
          <div className="set-card">
            <ToggleRow on={prefs.private} label={s("Private account", "Account privato")} meta={s("Only people you approve see posts, stories and reels.", "Solo chi approvi vede post, storie e reel.")} onClick={() => onChange({ private: !prefs.private })} />
          </div>
        ) : null}
        {page === "archive" ? (
          <ArchiveList />
        ) : null}
        {page === "activity" ? (
          <>
            <div className="set-card set-meter">
              <p className="set-stat"><b>{Math.floor(used / 60000)}</b> {s("minutes today", "minuti oggi")}</p>
              <div className="week" aria-hidden="true">
                {week.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
            </div>
            <div className="set-card">
              <button type="button" className="feed-row" onClick={() => onChange({ searchesCleared: true })}>
                <span className="feed-copy">
                  <strong>{s("Search history", "Cronologia di ricerca")}</strong>
                  <span>{prefs.searchesCleared ? s("Cleared", "Cancellata") : s("forno, smalto, Adele", "forno, smalto, Adele")}</span>
                </span>
              </button>
            </div>
          </>
        ) : null}
        {page === "notifications" ? (
          <div className="set-card">
            {[
              ["likes", s("Likes", "Like")],
              ["comments", s("Comments", "Commenti")],
              ["follows", s("New followers", "Nuovi follower")],
              ["messages", s("Messages", "Messaggi")],
              ["mentions", s("Mentions", "Menzioni")],
            ].map(([key, label]) => (
              <ToggleRow key={key} on={prefs.notes[key]} label={label} onClick={() => onChange({ notes: { [key]: !prefs.notes[key] } })} />
            ))}
          </div>
        ) : null}
        {page === "time" ? (
          <>
            <div className="set-card set-meter">
              <div className="week" aria-hidden="true">
                {week.map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
              </div>
            </div>
            <ChoiceList value={prefs.timeLimit} options={limits} onPick={(id) => onChange({ timeLimit: id })} />
          </>
        ) : null}
        {page === "close" ? <PeopleToggles list={prefs.closeFriends} onChange={(closeFriends) => onChange({ closeFriends })} /> : null}
        {page === "blocked" ? <PeopleToggles list={prefs.blocked} onChange={(blocked) => onChange({ blocked })} /> : null}
        {page === "muted" ? <PeopleToggles list={prefs.muted} onChange={(muted) => onChange({ muted })} /> : null}
        {page === "restricted" ? <PeopleToggles list={prefs.restricted} onChange={(restricted) => onChange({ restricted })} /> : null}
        {page === "messages" ? (
          <div className="set-flow">
            <h2 className="set-kicker">{s("Message requests", "Richieste di messaggio")}</h2>
            <ChoiceList value={prefs.messages} options={audience} onPick={(messages) => onChange({ messages })} />
            <h2 className="set-kicker">{s("Story replies", "Risposte alle storie")}</h2>
            <ChoiceList value={prefs.storyReplies} options={audience} onPick={(storyReplies) => onChange({ storyReplies })} />
            <div className="set-card">
              <ToggleRow on={prefs.activity} label={s("Activity status", "Stato attività")} meta={s("The active dot, both ways.", "Il pallino attivo, da entrambe le parti.")} onClick={() => onChange({ activity: !prefs.activity })} />
              <ToggleRow on={prefs.readReceipts} label={s("Read receipts", "Conferme di lettura")} meta={s("Seen, both ways.", "Visto, da entrambe le parti.")} onClick={() => onChange({ readReceipts: !prefs.readReceipts })} />
            </div>
          </div>
        ) : null}
        {page === "tags" ? (
          <div className="set-flow">
            <h2 className="set-kicker">{s("Tags", "Tag")}</h2>
            <ChoiceList value={prefs.tags} options={audience} onPick={(tags) => onChange({ tags })} />
            <h2 className="set-kicker">{s("Mentions", "Menzioni")}</h2>
            <ChoiceList value={prefs.mentions} options={audience} onPick={(mentions) => onChange({ mentions })} />
          </div>
        ) : null}
        {page === "comments" ? (
          <ChoiceList value={prefs.comments} options={audience} onPick={(comments) => onChange({ comments })} />
        ) : null}
        {page === "words" ? (
          <>
            <form className="composer" onSubmit={(event) => {
              event.preventDefault();
              const next = word.trim().toLowerCase();
              if (!next || prefs.hiddenWords.includes(next)) return;
              onChange({ hiddenWords: [...prefs.hiddenWords, next] });
              setWord("");
            }}>
              <input value={word} onChange={(event) => setWord(event.target.value)} placeholder={s("Add a word", "Aggiungi una parola")} aria-label={s("Hidden word", "Parola nascosta")} />
              <button type="submit" className="bell" aria-label={s("Add", "Aggiungi")}><Glyph icon={Plus} /></button>
            </form>
            <div className="set-card word-pad">
            <div className="word-row">
              {prefs.hiddenWords.map((item) => (
                <button key={item} type="button" className="chip on" onClick={() => onChange({ hiddenWords: prefs.hiddenWords.filter((word) => word !== item) })}>{item}</button>
              ))}
            </div>
            </div>
          </>
        ) : null}
        {page === "content" ? (
          <div className="set-flow">
            <h2 className="set-kicker">{s("Sensitive content", "Contenuti sensibili")}</h2>
            <ChoiceList value={prefs.sensitive} options={[
              { id: "less", label: s("Less", "Meno") },
              { id: "standard", label: s("Standard", "Standard") },
              { id: "more", label: s("More", "Più") },
            ]} onPick={(sensitive) => onChange({ sensitive })} />
            <div className="set-card">
              <ToggleRow on={prefs.likeCounts} label={s("Like and share counts", "Conteggi di like e condivisioni")} meta={s("Numbers on posts and reels.", "I numeri su post e reel.")} onClick={() => onChange({ likeCounts: !prefs.likeCounts })} />
              <ToggleRow on={prefs.suggested} label={s("Suggested content", "Contenuti suggeriti")} meta={s("New people on Home.", "Nuove persone in Home.")} onClick={() => onChange({ suggested: !prefs.suggested })} />
            </div>
          </div>
        ) : null}
        {page === "accessibility" ? (
          <div className="set-card">
            <ToggleRow on={prefs.captions} label={s("Captions", "Sottotitoli")} meta={s("Show them on reels.", "Mostrali sui reel.")} onClick={() => onChange({ captions: !prefs.captions })} />
            <ToggleRow on={prefs.altText} label={s("Alt text", "Testo alternativo")} meta={s("Write it when you post a photo.", "Scrivilo quando pubblichi una foto.")} onClick={() => onChange({ altText: !prefs.altText })} />
          </div>
        ) : null}
        {page === "data" ? (
          <div className="set-card">
            <ToggleRow on={prefs.dataSaver} label={s("Data saver", "Risparmio dati")} meta={s("Load smaller photos.", "Carica foto più leggere.")} onClick={() => onChange({ dataSaver: !prefs.dataSaver })} />
          </div>
        ) : null}
        {page === "account-type" ? (
          <BusinessSetup prefs={prefs} onChange={onChange} lang={lang} />
        ) : null}
        {page === "payments" ? <PaymentsSetup handle={current} lang={lang} /> : null}
        {page === "help" ? (
          <div className="set-card">
            {[
              [s("Private account", "Account privato"), s("People you have not approved stop seeing posts, stories and reels. Your name stays visible.", "Chi non hai approvato smette di vedere post, storie e reel. Il nome resta visibile.")],
              [s("Language", "Lingua"), s("English and Italian change the settings and the tab bar. Other languages stay listed.", "Inglese e italiano cambiano impostazioni e barra. Le altre lingue restano in lista.")],
              [s("Colors", "Colori"), s("The accent tints the glass, the buttons and the stage.", "L'accento tinge il vetro, i pulsanti e il palco.")],
            ].map(([label, text]) => (
              <button key={label} type="button" className="feed-row" aria-expanded={openHelp === label} onClick={() => setOpenHelp(openHelp === label ? null : label)}>
                <span className="feed-copy">
                  <strong>{label}</strong>
                  {openHelp === label ? <span>{text}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {page === "login" ? (
          <div className="set-flow">
            <h2 className="set-kicker">{s("Accounts on this phone", "Account su questo telefono")}</h2>
            <div className="set-card">
              {accounts.map((user) => {
                const on = user.handle === current;
                return (
                  <button key={user.handle} type="button" className="feed-row" aria-pressed={on} onClick={() => { if (!on) onSwitch?.(user.handle); }}>
                    <RemoteImage className="row-avatar" src={user.handle === DEMO_USER.handle ? AVATAR : avatarFor(user.name || user.handle)} alt="" />
                    <span className="feed-copy">
                      <strong>{user.handle === DEMO_USER.handle ? profile.name : (user.name || user.handle)}</strong>
                      <span>@{user.handle}{on ? ` · ${s("in use", "in uso")}` : ""}</span>
                    </span>
                    <i className={on ? "pick on st-check" : "pick st-check"}>{on ? <Check weight="bold" /> : null}</i>
                  </button>
                );
              })}
              <button type="button" className="feed-row st-add" onClick={() => onAddAccount?.()}>
                <i className="st-add-ico"><Plus weight="bold" /></i>
                <span className="feed-copy"><strong>{s("Add account", "Aggiungi account")}</strong></span>
              </button>
            </div>
            <p className="msg-hint">{s("Switching keeps you signed in to every account on this phone.", "Cambiando account resti connesso a tutti gli account di questo telefono.")}</p>
            {confirmOut ? (
              <section className="sheet">
                <h2>{s("Log out?", "Uscire?")}</h2>
                <p>{s("You can sign back in any time.", "Puoi rientrare quando vuoi.")}</p>
                <button type="button" className="set-leave" onClick={() => { setConfirmOut(false); onLogout(); }}>{s("Log out", "Esci")}</button>
                <button type="button" className="msg-create" onClick={() => setConfirmOut(false)}>{s("Cancel", "Annulla")}</button>
              </section>
            ) : (
              <button type="button" className="set-leave" onClick={() => setConfirmOut(true)}>{s(`Log out of @${current || ""}`, `Esci da @${current || ""}`)}</button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BusinessSetup({ prefs, onChange, lang }) {
  const s = (en, it) => say(lang, en, it);
  const it = lang === "it";
  const biz = { ...DEFAULT_BUSINESS, ...(prefs.business || {}) };
  const patch = (next) => onChange({ business: { ...biz, ...next } });
  const types = [
    { id: "personal", icon: UserIcon, tone: "gray", label: s("Personal", "Personale"), meta: s("For sharing with friends and followers.", "Per condividere con amici e follower.") },
    { id: "creator", icon: Star, tone: "purple", label: "Creator", meta: s("For makers building an audience.", "Per chi crea e vuole farsi conoscere.") },
    { id: "business", icon: Shop, tone: "blue", label: s("Business / Shop", "Azienda / Bottega"), meta: s("Shop, opening hours, contacts and insights.", "Shop, orari, contatti e statistiche.") },
  ];
  const days = it ? ["L", "M", "M", "G", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="set-flow">
      <h2 className="set-kicker">{s("Account type", "Tipo di account")}</h2>
      <div className="set-card">
        {types.map((type) => {
          const on = (prefs.accountType || "personal") === type.id;
          return (
            <button key={type.id} type="button" className="feed-row bz-type" aria-pressed={on} onClick={() => onChange({ accountType: type.id })}>
              <i className={`st-ico ${type.tone}`}><type.icon weight="fill" /></i>
              <span className="feed-copy"><strong>{type.label}</strong><span>{type.meta}</span></span>
              <i className={on ? "pick on st-check" : "pick st-check"}>{on ? <Check weight="bold" /> : null}</i>
            </button>
          );
        })}
      </div>
      {prefs.accountType === "business" ? (
        <>
          <h2 className="set-kicker">{s("Your business", "La tua attività")}</h2>
          <div className="set-card">
            <label className="ep-row"><span className="ep-label">{s("Name", "Nome")}</span><span className="ep-input"><input value={biz.title} maxLength={40} onChange={(event) => patch({ title: event.target.value })} /></span></label>
            <label className="ep-row"><span className="ep-label">{s("Address", "Indirizzo")}</span><span className="ep-input"><input value={biz.address} maxLength={60} onChange={(event) => patch({ address: event.target.value })} /></span></label>
            <label className="ep-row"><span className="ep-label">{s("City", "Città")}</span><span className="ep-input"><input value={biz.city} maxLength={40} onChange={(event) => patch({ city: event.target.value })} /></span></label>
            <label className="ep-row"><span className="ep-label">{s("Phone", "Telefono")}</span><span className="ep-input"><input value={biz.phone} inputMode="tel" maxLength={24} onChange={(event) => patch({ phone: event.target.value })} /></span></label>
            <label className="ep-row"><span className="ep-label">Email</span><span className="ep-input"><input value={biz.email} inputMode="email" maxLength={60} onChange={(event) => patch({ email: event.target.value })} /></span></label>
          </div>
          <h2 className="set-kicker">{s("Category", "Categoria")}</h2>
          <div className="ep-chips bz-kinds">
            {BUSINESS_KINDS.map((kind) => <button key={kind} type="button" className={biz.category === kind ? "on" : ""} onClick={() => patch({ category: kind })}>{kind}</button>)}
          </div>
          <h2 className="set-kicker">{s("Opening hours", "Orari di apertura")}</h2>
          <div className="set-card bz-hours">
            <div className="bz-days">
              {order.map((day, index) => {
                const on = biz.hours.days.includes(day);
                return (
                  <button key={day} type="button" className={on ? "on" : ""} aria-pressed={on} onClick={() => patch({ hours: { ...biz.hours, days: on ? biz.hours.days.filter((value) => value !== day) : [...biz.hours.days, day] } })}>{days[index]}</button>
                );
              })}
            </div>
            <label className="ep-row"><span className="ep-label">{s("Opens", "Apre")}</span><span className="ep-input"><input type="time" value={biz.hours.open} onChange={(event) => patch({ hours: { ...biz.hours, open: event.target.value } })} /></span></label>
            <label className="ep-row"><span className="ep-label">{s("Closes", "Chiude")}</span><span className="ep-input"><input type="time" value={biz.hours.close} onChange={(event) => patch({ hours: { ...biz.hours, close: event.target.value } })} /></span></label>
          </div>
          <div className="set-card">
            <ToggleRow on={biz.shop !== false} label={s("Show shop on profile", "Mostra lo shop sul profilo")} meta={s("A Shop tab with your products and courses.", "Una scheda Shop con i tuoi prodotti e corsi.")} onClick={() => patch({ shop: biz.shop === false })} />
          </div>
          <p className="msg-hint">{s("Your profile now shows contacts, opening hours and a professional dashboard. To sell directly, turn on Payments.", "Il profilo ora mostra contatti, orari e una dashboard professionale. Per vendere direttamente, attiva Pagamenti.")}</p>
        </>
      ) : null}
    </div>
  );
}

function LanguageScreen({ prefs, onChange, onClose }) {
  const lang = prefs.language === "it" ? "it" : "en";
  return (
    <div className="panel view st">
      <StHead title={say(lang, "Language", "Lingua")} onClose={onClose} />
      <div className="panel-scroll">
        <StHero id="language" title={say(lang, "Language", "Lingua")} meta={say(lang, "App language", "Lingua dell'app")} />
        <div className="set-card">
          {PREF_LANGS.map((item) => (
            <button key={item.id} type="button" className="feed-row" aria-pressed={prefs.language === item.id} onClick={() => onChange({ language: item.id })}>
              <span className="feed-copy">
                <strong>{item.label}</strong>
                {item.id !== "en" && item.id !== "it" ? <span>{say(lang, "Listed · interface stays English", "In lista · l'interfaccia resta in inglese")}</span> : null}
              </span>
              <i className={prefs.language === item.id ? "pick on st-check" : "pick st-check"}>{prefs.language === item.id ? <Check weight="bold" /> : null}</i>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegalScreen({ doc, prefs, onClose }) {
  const lang = prefs.language === "it" ? "it" : "en";
  const body = (LEGAL[doc] || LEGAL.about)[lang];
  return (
    <div className="panel view st">
      <StHead title={body.title} onClose={onClose} />
      <div className="panel-scroll">
        <StHero id={doc} title={body.title} meta="Space" />
        <article className="set-card legal">
        {body.sections.map((section) => (
          <section key={section.h}>
            <h2>{section.h}</h2>
            <p>{section.p}</p>
          </section>
        ))}
        </article>
      </div>
    </div>
  );
}

function MessagesTab({ tab, localUnread, onChange }) {
  const live = useLive();
  return <TabBar tab={tab} onChange={onChange} unread={(live?.unread || 0) + localUnread} />;
}

// Demo-contact calls never reach the hub: log them in the local thread.
function LiveBridge({ onLog }) {
  const live = useLive();
  const ref = useRef(onLog);
  ref.current = onLog;
  useEffect(() => {
    if (!live?.calls) return undefined;
    live.calls.onLog = (entry) => ref.current(entry);
    return () => { live.calls.onLog = null; };
  }, [live?.calls]);
  return null;
}

function TabBar({ tab, onChange, unread = 0 }) {
  const it = useContext(SpacePrefs).language === "it";
  const labels = it
    ? { home: "Home", reel: "Reel", search: "Cerca", messages: "Messaggi", profile: "Profilo" }
    : { home: "Home", reel: "Reels", search: "Search", messages: "Messages", profile: "Profile" };
  const icons = { home: House, search: Search, reel: SquarePlay, messages: Send };
  const order = ["home", "search", "reel", "messages", "profile"];
  return (
    <nav className="tabbar ig-tabbar" data-tab={tab} aria-label={it ? "Principale" : "Main"}>
      {order.map((id) => {
        const selected = tab === id;
        const Icon = icons[id];
        return (
          <button
            key={id}
            type="button"
            className={`ig-tab${selected ? " on" : ""}${id === "profile" ? " face" : ""}`}
            aria-label={labels[id]}
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            {id === "profile" ? (
              <span className="ig-tab-face"><RemoteImage src={AVATAR} alt="" /></span>
            ) : (
              <Icon weight={selected ? "fill" : "regular"} aria-hidden="true" />
            )}
            {id === "messages" && unread > 0 ? <b className="ig-badge">{unread > 9 ? "9+" : unread}</b> : null}
          </button>
        );
      })}
    </nav>
  );
}

const SpaceData = createContext(null);

export function useSpace() {
  const value = useContext(SpaceData);
  if (!value) throw new Error("Space data missing");
  return value;
}

const PROFILE_SEED = {
  name: "Giulia Neri",
  handle: "@forno.neri",
  bio: "Milano · Ceramica. Un forno, un cantiere aperto. Il rosso regge.",
};

function sameMessage(a, b) {
  if (!a || !b || a.from !== b.from) return false;
  const kind = a.kind || "text";
  if (kind !== (b.kind || "text")) return false;
  if (kind === "image") return a.image === b.image;
  if (kind === "audio") return a.audio === b.audio;
  if (a.time && b.time && a.time !== b.time) return false;
  return (a.orig ?? a.text) === (b.orig ?? b.text);
}

function mergeThreads(saved) {
  if (!Array.isArray(saved) || !saved.length) return THREADS;
  return saved.map((thread) => {
    const seed = THREADS.find((item) => item.id === thread.id);
    if (!seed || thread.cleared) return thread;
    const saved = thread.messages || [];
    const extras = saved.filter((item) => {
      if (seed.messages.some((seedMsg) => sameMessage(seedMsg, item))) return false;
      return Boolean(item.time) || item.kind === "image" || item.kind === "audio" || item.kind === "call";
    });
    // Reactions and unsends on the seeded messages survive a reload.
    const base = seed.messages.map((seedMsg) => {
      const match = saved.find((item) => sameMessage(seedMsg, item));
      return match && (match.reactions || match.unsent || match.edited) ? { ...seedMsg, reactions: match.reactions, unsent: match.unsent, ...(match.edited ? { text: match.text, orig: match.orig, edited: match.edited } : {}) } : seedMsg;
    });
    return { ...thread, messages: [...base, ...extras] };
  });
}

function loadSpace() {
  const blank = {
    likes: [],
    saves: [],
    savedPosts: {},
    follows: [],
    comments: {},
    library: [],
    threads: THREADS,
    activity: [],
    profile: PROFILE_SEED,
    storyLikes: [],
    archived: [],
    highlights: [],
    dmFlags: {},
    thoughts: [],
    thoughtReplies: {},
    thoughtLikes: [],
    thoughtReposts: [],
    thoughtVotes: {},
  };
  try {
    const raw = JSON.parse(window.localStorage.getItem("space-data") || "null");
    if (!raw || typeof raw !== "object") return blank;
    return {
      likes: Array.isArray(raw.likes) ? raw.likes : [],
      saves: Array.isArray(raw.saves) ? raw.saves : [],
      savedPosts: raw.savedPosts && typeof raw.savedPosts === "object" ? raw.savedPosts : {},
      follows: Array.isArray(raw.follows) ? raw.follows : [],
      comments: raw.comments && typeof raw.comments === "object" ? raw.comments : {},
      // Recorded clips live in memory (blob: URLs) and do not survive a reload.
      library: Array.isArray(raw.library)
        ? raw.library.filter((item) => !String(item?.video || "").startsWith("blob:") && !(item?.clips || []).some((clip) => String(clip?.src || "").startsWith("blob:")))
        : [],
      threads: mergeThreads(raw.threads),
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      storyLikes: Array.isArray(raw.storyLikes) ? raw.storyLikes : [],
      archived: Array.isArray(raw.archived) ? raw.archived : [],
      highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
      dmFlags: raw.dmFlags && typeof raw.dmFlags === "object" ? raw.dmFlags : {},
      dmFolders: Array.isArray(raw.dmFolders) ? raw.dmFolders : null,
      recentSearches: Array.isArray(raw.recentSearches) ? raw.recentSearches.slice(0, 12) : [],
      thoughts: Array.isArray(raw.thoughts) ? raw.thoughts : [],
      thoughtReplies: raw.thoughtReplies && typeof raw.thoughtReplies === "object" ? raw.thoughtReplies : {},
      thoughtLikes: Array.isArray(raw.thoughtLikes) ? raw.thoughtLikes : [],
      thoughtReposts: Array.isArray(raw.thoughtReposts) ? raw.thoughtReposts : [],
      thoughtVotes: raw.thoughtVotes && typeof raw.thoughtVotes === "object" ? raw.thoughtVotes : {},
      notifications: Array.isArray(raw.notifications) ? raw.notifications.slice(0, 80) : [],
      products: Array.isArray(raw.products) ? raw.products : null,
      cart: Array.isArray(raw.cart) ? raw.cart : [],
      wishlist: Array.isArray(raw.wishlist) ? raw.wishlist : [],
      recentProducts: Array.isArray(raw.recentProducts) ? raw.recentProducts : [],
      reviews: raw.reviews && typeof raw.reviews === "object" ? raw.reviews : {},
      profile: raw.profile && raw.profile.name ? { ...PROFILE_SEED, ...raw.profile } : PROFILE_SEED,
    };
  } catch {
    return blank;
  }
}

// Demo people react to what you publish, so notifications fill up like a real network.
function echoLater(delay, run) {
  window.setTimeout(run, delay);
}
function somePerson(skip = []) {
  const list = SEARCH_PEOPLE.filter((person) => !skip.includes(person.name));
  return list[Math.floor(Math.random() * list.length)] || SEARCH_PEOPLE[0];
}
function mentionedPeople(text) {
  return [...new Set((String(text || "").match(/@([\w.]+)/g) || []).map((tag) => tag.slice(1).replace(/\.$/, "").toLowerCase()))]
    .map((handle) => SEARCH_PEOPLE.find((person) => person.handle === handle))
    .filter(Boolean);
}
const ECHO_LINES = ["Bellissimo 🔥", "Che lavoro pulito!", "Lo voglio vedere dal vivo 😍", "Bravissima, come sempre.", "Questo colore è incredibile."];

export function SpaceStore({ children }) {
  const [data, setData] = useState(loadSpace);
  AVATAR = data.profile?.avatar || DEFAULT_AVATAR;
  useEffect(() => {
    try {
      window.localStorage.setItem("space-data", JSON.stringify(data));
    } catch {
      // Quota full (photos and voice notes are data URLs): keep running in memory.
    }
  }, [data]);

  const pushNote = (entry) => setData((prev) => ({
    ...prev,
    notifications: [{ id: `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), read: false, ...entry }, ...(prev.notifications || [])].slice(0, 80),
  }));

  const api = {
    likes: new Set(data.likes),
    saves: new Set(data.saves),
    follows: new Set(data.follows),
    comments: data.comments,
    library: data.library,
    threads: data.threads,
    dmFlags: data.dmFlags || {},
    dmFolders: data.dmFolders || null,
    setDmFolders(list) {
      setData((prev) => ({ ...prev, dmFolders: list }));
    },
    setDmFlags(ids, key, value) {
      setData((prev) => {
        const flags = { ...(prev.dmFlags || {}) };
        for (const id of ids) flags[id] = { ...(flags[id] || {}), [key]: value };
        return { ...prev, dmFlags: flags };
      });
    },
    recentSearches: data.recentSearches || [],
    thoughts: data.thoughts || [],
    thoughtReplies: data.thoughtReplies || {},
    thoughtLikes: new Set(data.thoughtLikes || []),
    thoughtReposts: data.thoughtReposts || [],
    thoughtVotes: data.thoughtVotes || {},
    notifications: data.notifications || [],
    products: data.products || null,
    cart: data.cart || [],
    wishlist: data.wishlist || [],
    recentProducts: data.recentProducts || [],
    reviews: data.reviews || {},
    addToCart(entry) {
      setData((prev) => {
        const cart = prev.cart || [];
        const same = cart.find((item) => item.key === entry.key && item.variant === entry.variant);
        return {
          ...prev,
          cart: same
            ? cart.map((item) => (item === same ? { ...item, qty: Math.min(20, item.qty + entry.qty) } : item))
            : [...cart, { ...entry, addedAt: Date.now() }],
        };
      });
    },
    setCartQty(key, variant, qty) {
      setData((prev) => ({
        ...prev,
        cart: (prev.cart || []).flatMap((item) => (item.key === key && item.variant === variant ? (qty > 0 ? [{ ...item, qty: Math.min(20, qty) }] : []) : [item])),
      }));
    },
    clearCartFor(seller) {
      setData((prev) => ({ ...prev, cart: (prev.cart || []).filter((item) => item.seller !== seller) }));
    },
    toggleWish(ref) {
      setData((prev) => {
        const list = prev.wishlist || [];
        return { ...prev, wishlist: list.some((item) => item.key === ref.key) ? list.filter((item) => item.key !== ref.key) : [{ ...ref, at: Date.now() }, ...list] };
      });
    },
    viewProduct(ref) {
      setData((prev) => {
        const list = (prev.recentProducts || []).filter((item) => item.key !== ref.key);
        if (prev.recentProducts?.[0]?.key === ref.key) return prev;
        return { ...prev, recentProducts: [ref, ...list].slice(0, 12) };
      });
    },
    addReview(key, review) {
      setData((prev) => ({ ...prev, reviews: { ...(prev.reviews || {}), [key]: [{ ...review, at: Date.now() }, ...((prev.reviews || {})[key] || [])] } }));
    },
    saveProduct(product) {
      setData((prev) => {
        const list = prev.products || MY_PRODUCTS_SEED;
        return { ...prev, products: list.some((item) => item.id === product.id) ? list.map((item) => (item.id === product.id ? product : item)) : [product, ...list] };
      });
    },
    deleteProduct(id) {
      setData((prev) => ({ ...prev, products: (prev.products || MY_PRODUCTS_SEED).filter((item) => item.id !== id) }));
    },
    notify(entry) {
      setData((prev) => ({
        ...prev,
        notifications: [{ id: `nt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), read: false, ...entry }, ...(prev.notifications || [])].slice(0, 80),
      }));
    },
    markNotificationsRead() {
      setData((prev) => ((prev.notifications || []).some((note) => !note.read)
        ? { ...prev, notifications: prev.notifications.map((note) => (note.read ? note : { ...note, read: true })) }
        : prev));
    },
    addThought(thought, chain = []) {
      setData((prev) => ({
        ...prev,
        thoughts: [thought, ...(prev.thoughts || [])],
        thoughtReplies: chain.length ? { ...(prev.thoughtReplies || {}), [thought.id]: chain } : prev.thoughtReplies,
      }));
      const fan = somePerson();
      echoLater(5000, () => pushNote({ type: "like", name: fan.name, src: fan.src, text: "ha messo mi piace al tuo pensiero.", target: { kind: "thought", id: thought.id } }));
      for (const person of mentionedPeople(thought.text)) {
        const reply = { id: `echo-${Date.now().toString(36)}-${person.handle}`, name: person.name, handle: person.handle, src: person.src, verified: Boolean(person.verified), created: 0, likes: 0, text: "Ci sono! Grazie per la menzione 🙌" };
        echoLater(8000, () => {
          setData((prev) => ({
            ...prev,
            thoughtReplies: { ...(prev.thoughtReplies || {}), [thought.id]: [...((prev.thoughtReplies || {})[thought.id] || []), { ...reply, created: Date.now() }] },
          }));
          pushNote({ type: "reply", name: person.name, src: person.src, text: `ha risposto al tuo pensiero: “${reply.text}”`, target: { kind: "thought", id: thought.id } });
        });
      }
    },
    deleteThought(id) {
      setData((prev) => {
        const replies = { ...(prev.thoughtReplies || {}) };
        delete replies[id];
        for (const key of Object.keys(replies)) replies[key] = replies[key].filter((item) => item.id !== id);
        return {
          ...prev,
          thoughts: (prev.thoughts || []).filter((item) => item.id !== id),
          thoughtReplies: replies,
          thoughtReposts: (prev.thoughtReposts || []).filter((item) => item.id !== id),
        };
      });
    },
    addThoughtReply(parentId, reply) {
      setData((prev) => ({
        ...prev,
        thoughtReplies: { ...(prev.thoughtReplies || {}), [parentId]: [...((prev.thoughtReplies || {})[parentId] || []), reply] },
      }));
    },
    toggleThoughtLike(id) {
      setData((prev) => {
        const list = prev.thoughtLikes || [];
        return { ...prev, thoughtLikes: list.includes(id) ? list.filter((item) => item !== id) : [...list, id] };
      });
    },
    toggleThoughtRepost(id) {
      setData((prev) => {
        const list = prev.thoughtReposts || [];
        return { ...prev, thoughtReposts: list.some((item) => item.id === id) ? list.filter((item) => item.id !== id) : [{ id, at: Date.now() }, ...list] };
      });
    },
    voteThought(id, index) {
      setData((prev) => ((prev.thoughtVotes || {})[id] != null ? prev : { ...prev, thoughtVotes: { ...(prev.thoughtVotes || {}), [id]: index } }));
    },
    activity: data.activity || [],
    storyLikes: new Set(data.storyLikes || []),
    archived: new Set(data.archived || []),
    profile: data.profile,
    savedPosts: data.savedPosts,
    toggleLike(id) {
      setData((prev) => ({
        ...prev,
        likes: prev.likes.includes(id) ? prev.likes.filter((item) => item !== id) : [...prev.likes, id],
      }));
    },
    toggleSave(post) {
      if (!post || !post.id) return;
      setData((prev) => {
        const on = prev.saves.includes(post.id);
        return {
          ...prev,
          saves: on ? prev.saves.filter((item) => item !== post.id) : [...prev.saves, post.id],
          savedPosts: { ...prev.savedPosts, [post.id]: post },
        };
      });
    },
    toggleFollow(name) {
      if (!name) return;
      const person = SEARCH_PEOPLE.find((entry) => entry.name === name);
      if (person && !data.follows.includes(name)) {
        echoLater(5000, () => pushNote({ type: "follow", name: person.name, src: person.src, text: "ha iniziato a seguirti.", target: { kind: "person", name: person.name } }));
      }
      setData((prev) => {
        const on = prev.follows.includes(name);
        return {
          ...prev,
          follows: on ? prev.follows.filter((item) => item !== name) : [...prev.follows, name],
          activity: on ? prev.activity : [{ id: `a-${Date.now()}`, time: "Now", name, text: `Hai iniziato a seguire ${name}.` }, ...(prev.activity || [])].slice(0, 40),
        };
      });
    },
    toggleStoryLike(id) {
      if (!id) return;
      setData((prev) => ({
        ...prev,
        storyLikes: (prev.storyLikes || []).includes(id)
          ? prev.storyLikes.filter((item) => item !== id)
          : [...(prev.storyLikes || []), id],
      }));
    },
    addComment(id, text) {
      const clean = String(text || "").trim();
      if (!id || !clean) return;
      setData((prev) => ({
        ...prev,
        comments: { ...prev.comments, [id]: [...(prev.comments[id] || []), clean] },
      }));
      const fan = somePerson();
      echoLater(4500, () => pushNote({ type: "like", name: fan.name, src: fan.src, text: `ha messo mi piace al tuo commento: “${clean.slice(0, 60)}”`, target: { kind: "post", id } }));
      for (const person of mentionedPeople(clean)) {
        echoLater(7500, () => pushNote({ type: "reply", name: person.name, src: person.src, text: `ha risposto al tuo commento: “@${String(data.profile?.handle || "").replace(/^@/, "")} assolutamente sì!”`, target: { kind: "post", id } }));
      }
    },
    publish(item) {
      setData((prev) => ({ ...prev, library: [item, ...prev.library] }));
      if (item?.kind === "post" || item?.kind === "reel") {
        const fan = somePerson();
        const critic = somePerson([fan.name]);
        const what = item.kind === "reel" ? "reel" : "post";
        echoLater(4000, () => pushNote({ type: "like", name: fan.name, src: fan.src, text: `ha messo mi piace al tuo ${what}.`, target: { kind: "post", id: item.id } }));
        echoLater(10000, () => pushNote({ type: "comment", name: critic.name, src: critic.src, text: `ha commentato: “${ECHO_LINES[Math.floor(Math.random() * ECHO_LINES.length)]}”`, target: { kind: "post", id: item.id } }));
        for (const name of item.tags || []) {
          const person = SEARCH_PEOPLE.find((entry) => entry.name === name);
          if (person) echoLater(7000, () => pushNote({ type: "like", name: person.name, src: person.src, text: "ha visto che l'hai taggato e ha messo mi piace.", target: { kind: "post", id: item.id } }));
        }
        for (const person of mentionedPeople(item.text)) {
          echoLater(8000, () => pushNote({ type: "reply", name: person.name, src: person.src, text: `ha risposto alla tua menzione: “@${String(data.profile?.handle || "").replace(/^@/, "")} grazie! ❤️”`, target: { kind: "post", id: item.id } }));
        }
      }
    },
    drop(id) {
      setData((prev) => ({ ...prev, library: prev.library.filter((item) => item.id !== id) }));
    },
    toggleArchive(id) {
      if (!id) return;
      setData((prev) => ({
        ...prev,
        archived: (prev.archived || []).includes(id)
          ? prev.archived.filter((item) => item !== id)
          : [...(prev.archived || []), id],
      }));
    },
    saveProfile(next) {
      setData((prev) => ({ ...prev, profile: next }));
    },
    highlights: data.highlights || [],
    addHighlight(item) {
      setData((prev) => ({ ...prev, highlights: [item, ...(prev.highlights || [])] }));
    },
    removeHighlight(id) {
      setData((prev) => ({ ...prev, highlights: (prev.highlights || []).filter((item) => item.id !== id) }));
    },
    togglePin(id) {
      setData((prev) => {
        const pinned = prev.profile.pinned || [];
        const next = pinned.includes(id) ? pinned.filter((item) => item !== id) : [id, ...pinned].slice(0, 3);
        return { ...prev, profile: { ...prev.profile, pinned: next } };
      });
    },
    remember(entry) {
      if (!entry?.text) return;
      setData((prev) => ({
        ...prev,
        activity: [{ id: `a-${Date.now()}`, time: "Now", ...entry }, ...(prev.activity || [])].slice(0, 40),
      }));
    },
    sendMessage(id, payload) {
      const message = typeof payload === "string" ? { kind: "text", text: payload } : { kind: "text", ...payload };
      message.from = "me";
      message.time = clockNow();
      if (message.kind === "image") {
        if (!message.image) return;
      } else if (message.kind === "audio") {
        if (!message.audio) return;
        message.duration = Math.max(1, Math.round(message.duration || 1));
        message.wave = message.wave || VOICE_WAVE;
      } else if (message.kind === "call") {
        message.call = message.call === "video" ? "video" : "voice";
        message.duration = Math.max(0, Math.round(Number(message.duration) || 0));
      } else {
        message.kind = "text";
        message.text = String(message.text || "").trim();
        if (!message.text) return;
      }
      const preview = message.kind === "image" ? (message.text || "Photo") : message.kind === "audio" ? "Voice message" : message.kind === "call" ? (message.call === "video" ? "Video call" : "Voice call") : message.text;
      if (!id) return;
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (
          item.id === id
            ? { ...item, preview, time: "Now", unread: false, messages: [...(item.messages || []), message] }
            : item
        )),
      }));
    },
    ensureChat(person) {
      const found = data.threads.find((item) => !item.members && item.name === person.name);
      if (found) return found.id;
      const id = `c-${person.name}`;
      setData((prev) => {
        if (prev.threads.some((item) => item.id === id || (!item.members && item.name === person.name))) return prev;
        return {
          ...prev,
          threads: [{
            id,
            name: person.name,
            kind: "Chat",
            preview: "New chat",
            time: "Now",
            unread: false,
            src: person.src,
            messages: [],
          }, ...prev.threads],
        };
      });
      return id;
    },
    markThreadRead(id) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (item.id === id && item.unread ? { ...item, unread: false } : item)),
      }));
    },
    createGroup(thread) {
      setData((prev) => ({
        ...prev,
        threads: [thread, ...prev.threads.filter((item) => item.id !== thread.id)],
      }));
    },
    receiveMessage(id, text, read) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (
          item.id === id
            ? { ...item, preview: text, time: "Now", unread: !read, messages: [...(item.messages || []), { from: "them", kind: "text", text, time: clockNow() }] }
            : item
        )),
      }));
    },
    // Demo-thread messages have no id: they are addressed by position.
    reactMessage(id, index, emoji) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => {
          if (item.id !== id) return item;
          const messages = item.messages.map((message, at) => {
            if (at !== index) return message;
            const reactions = { ...(message.reactions || {}) };
            if (emoji) reactions.me = emoji;
            else delete reactions.me;
            return { ...message, reactions: Object.keys(reactions).length ? reactions : undefined };
          });
          return { ...item, messages };
        }),
      }));
    },
    editMessage(id, index, text) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (
          item.id === id
            ? { ...item, messages: item.messages.map((message, at) => (at === index ? { ...message, orig: message.orig ?? message.text, text, edited: Date.now() } : message)) }
            : item
        )),
      }));
    },
    updateThread(id, patch) {
      setData((prev) => ({ ...prev, threads: prev.threads.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
    },
    unsendMessage(id, index) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (
          item.id === id
            ? { ...item, messages: item.messages.map((message, at) => (at === index ? { ...message, unsent: true, reactions: undefined } : message)) }
            : item
        )),
      }));
    },
    setDmFlag(id, key, value) {
      setData((prev) => {
        const flags = { ...(prev.dmFlags || {}) };
        flags[id] = { ...(flags[id] || {}), [key]: value };
        return { ...prev, dmFlags: flags };
      });
    },
    markThreadUnread(id) {
      setData((prev) => ({
        ...prev,
        threads: prev.threads.map((item) => (item.id === id ? { ...item, unread: true } : item)),
      }));
    },
    deleteThread(id) {
      setData((prev) => ({ ...prev, threads: prev.threads.filter((item) => item.id !== id) }));
    },
    rememberSearch(entry) {
      setData((prev) => {
        const list = (prev.recentSearches || []).filter((item) => item.key !== entry.key);
        return { ...prev, recentSearches: [entry, ...list].slice(0, 12) };
      });
    },
    forgetSearch(key) {
      setData((prev) => ({ ...prev, recentSearches: key ? (prev.recentSearches || []).filter((item) => item.key !== key) : [] }));
    },
  };

  return <SpaceData.Provider value={api}>{children}</SpaceData.Provider>;
}

const DEMO_USER = { name: "Giulia Neri", handle: "forno.neri", password: "forno" };

function loadAuth() {
  try {
    const raw = JSON.parse(window.localStorage.getItem("space-auth") || "null");
    const saved = Array.isArray(raw?.users) ? raw.users : [];
    const demo = saved.find((user) => user?.handle === DEMO_USER.handle);
    const extra = saved.filter((user) => user?.handle && user.handle !== DEMO_USER.handle);
    return {
      users: [{ ...DEMO_USER, password: demo?.password || DEMO_USER.password }, ...extra],
      handle: typeof raw?.handle === "string" ? raw.handle : null,
      previous: typeof raw?.previous === "string" ? raw.previous : null,
    };
  } catch {
    return { users: [DEMO_USER], handle: null };
  }
}

const AUTH_COLLAGE = [
  "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=300&h=400&q=70",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=300&h=400&q=70",
  "https://images.unsplash.com/photo-1465821185615-20b3c2fbf41b?auto=format&fit=crop&w=300&h=400&q=70",
  "https://images.unsplash.com/photo-1590422749897-47036da0b0ff?auto=format&fit=crop&w=300&h=400&q=70",
  "https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=300&h=400&q=70",
  "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=300&h=400&q=70",
];

function strengthOf(value) {
  let score = 0;
  if (value.length >= 4) score += 1;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^\w]/.test(value)) score += 1;
  return Math.min(4, score);
}

function AuthField({ icon, label, value, onChange, type = "text", autoComplete, inputRef, trailing, state, hint }) {
  const id = useId();
  return (
    <div className={`au-field${value ? " filled" : ""}${state ? ` ${state}` : ""}${icon ? "" : " bare"}`}>
      {icon ? <i className="au-field-icon">{icon}</i> : null}
      <input id={id} ref={inputRef} value={value} type={type} autoComplete={autoComplete} placeholder=" " onChange={(event) => onChange(event.target.value)} autoCapitalize="none" spellCheck="false" />
      <label htmlFor={id}>{label}</label>
      {trailing}
      {hint ? <span className="au-hint">{hint}</span> : null}
    </div>
  );
}

function AuthScreen({ users, lang, onEnter, onJoin, onReset, back }) {
  const s = (en, it) => say(lang === "it" ? "it" : "en", en, it);
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [bad, setBad] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const passRef = useRef(null);
  const backUser = back ? users.find((user) => user.handle === back) : null;

  function fail(text) {
    setError(text);
    setBad(true);
    setBusy(false);
    navigator.vibrate?.(30);
    window.setTimeout(() => setBad(false), 460);
  }

  function go(next) {
    setMode(next);
    setError("");
    setNote("");
    setPassword("");
    setAgain("");
    setShow(false);
  }

  function findUser(value) {
    const key = value.trim().replace(/^@/, "").toLowerCase();
    return users.find((user) => user.handle === key || user.name.toLowerCase() === value.trim().toLowerCase());
  }

  const joinKey = handle.trim().replace(/^@/, "").toLowerCase();
  const handleOk = /^[a-z0-9._]{3,30}$/.test(joinKey);
  const taken = mode === "join" && users.some((user) => user.handle === joinKey);
  const strength = strengthOf(password);

  const ready = mode === "login"
    ? handle.trim().length > 1 && password.length > 0
    : mode === "join"
      ? name.trim().length > 1 && handleOk && !taken && password.length >= 4 && again.length > 0
      : mode === "forgot"
        ? handle.trim().length > 1
        : password.length >= 4 && again.length > 0;

  function submit(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setError("");
    setBusy(true);
    // A short beat so the button can show it is working, like a real sign-in.
    window.setTimeout(() => {
      if (mode === "login") {
        const user = findUser(handle);
        if (!user) return fail(s("No account with that username.", "Nessun account con questo nome utente."));
        if (user.password !== password) return fail(s("Wrong password. Try again.", "Password errata. Riprova."));
        setBusy(false);
        onEnter(user.handle);
        return;
      }
      if (mode === "forgot") {
        const user = findUser(handle);
        if (!user) return fail(s("No account with that username.", "Nessun account con questo nome utente."));
        setBusy(false);
        setHandle(user.handle);
        setMode("reset");
        setPassword("");
        setAgain("");
        return;
      }
      if (password !== again) return fail(s("The two passwords don't match.", "Le due password non coincidono."));
      if (mode === "reset") {
        onReset(handle, password);
        setBusy(false);
        go("login");
        setNote(s("Password updated. Log in with the new one.", "Password aggiornata. Accedi con quella nuova."));
        return;
      }
      if (taken) return fail(s("That username is taken.", "Questo nome utente è già in uso."));
      setBusy(false);
      onJoin({ name: name.trim(), handle: joinKey, password });
    }, 520);
  }

  const cta = mode === "join"
    ? s("Create account", "Crea account")
    : mode === "forgot"
      ? s("Continue", "Continua")
      : mode === "reset"
        ? s("Save password", "Salva password")
        : s("Log in", "Accedi");

  const heading = {
    login: backUser ? s("Add an account", "Aggiungi un account") : s("Welcome back", "Bentornato"),
    join: s("Create your account", "Crea il tuo account"),
    forgot: s("Find your account", "Trova il tuo account"),
    reset: s("Choose a new password", "Scegli una nuova password"),
  }[mode];
  const sub = {
    login: s("Log in to see what the makers around you are working on.", "Accedi per vedere a cosa lavorano gli artigiani intorno a te."),
    join: s("Share your work, follow makers and chat in real time.", "Condividi il tuo lavoro, segui gli artigiani e chatta in tempo reale."),
    forgot: s("Enter your username and we'll help you set a new password.", "Scrivi il tuo nome utente e ti aiutiamo a impostare una nuova password."),
    reset: s(`For @${handle}. Use at least 4 characters.`, `Per @${handle}. Usa almeno 4 caratteri.`),
  }[mode];
  const saved = users.filter((user) => user.handle !== back).slice(0, 3);

  return (
    <div className="au2">
      <div className="au2-top">
        {mode !== "login" ? (
          <button type="button" className="au2-back" aria-label={s("Back", "Indietro")} onClick={() => go("login")}><ChevronLeft strokeWidth={2.4} /></button>
        ) : backUser ? (
          <button type="button" className="au2-back wide" onClick={() => onEnter(backUser.handle)}>
            <ChevronLeft strokeWidth={2.4} />
            <span>{s(`Back to @${backUser.handle}`, `Torna a @${backUser.handle}`)}</span>
          </button>
        ) : <span />}
        <span className="au2-lang">{lang === "it" ? "Italiano" : "English"}</span>
      </div>
      <div className={`au2-body${bad ? " bad" : ""}`} key={mode}>
        <div className="au2-mark" aria-hidden="true"><i /><b>S</b></div>
        {mode === "login" ? <h1 className="au2-word">Space</h1> : <h1 className="au2-title">{heading}</h1>}
        {mode !== "login" ? <p className="au2-sub">{sub}</p> : null}
        {note ? <p className="au2-note"><Checked weight="fill" />{note}</p> : null}
        <form className="au2-form" onSubmit={submit} noValidate>
          {mode === "join" ? (
            <AuthField icon={null} label={s("Full name", "Nome e cognome")} value={name} onChange={setName} autoComplete="name" />
          ) : null}
          {mode !== "reset" ? (
            <AuthField
              icon={null}
              label={mode === "login" ? s("Username", "Nome utente") : s("Username", "Nome utente")}
              value={handle}
              onChange={(value) => setHandle(mode === "join" ? value.toLowerCase().replace(/\s+/g, "") : value)}
              autoComplete="username"
              state={mode === "join" && handle ? (taken || !handleOk ? "err" : "ok") : ""}
              trailing={mode === "join" && handle ? <i className="au-state">{taken || !handleOk ? <Warn /> : <Checked weight="fill" />}</i> : null}
              hint={mode === "join" && handle ? (taken ? s("Already taken", "Già in uso") : !handleOk ? s("3–30 letters, numbers, . or _", "3–30 lettere, numeri, . o _") : s("Available", "Disponibile")) : ""}
            />
          ) : null}
          {mode !== "forgot" ? (
            <AuthField
              icon={null}
              label={mode === "reset" ? s("New password", "Nuova password") : s("Password", "Password")}
              value={password}
              onChange={setPassword}
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              inputRef={passRef}
              trailing={password ? (
                <button type="button" className="au-eye" aria-label={show ? s("Hide password", "Nascondi password") : s("Show password", "Mostra password")} onClick={() => setShow((value) => !value)}>
                  {show ? <EyeOff strokeWidth={1.9} /> : <Eye strokeWidth={1.9} />}
                </button>
              ) : null}
            />
          ) : null}
          {(mode === "join" || mode === "reset") && password ? (
            <div className={`au-strength s${strength}`} aria-label={s("Password strength", "Robustezza password")}>
              <span><i /><i /><i /><i /></span>
              <em>{[s("Too short", "Troppo corta"), s("Weak", "Debole"), s("Fair", "Discreta"), s("Good", "Buona"), s("Strong", "Forte")][strength]}</em>
            </div>
          ) : null}
          {mode === "join" || mode === "reset" ? (
            <AuthField
              icon={null}
              label={s("Repeat password", "Ripeti password")}
              value={again}
              onChange={setAgain}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              state={again ? (again === password ? "ok" : "err") : ""}
              trailing={again ? <i className="au-state">{again === password ? <Checked weight="fill" /> : <Warn />}</i> : null}
            />
          ) : null}
          {error ? <p className="au2-error" role="alert"><Warn />{error}</p> : null}
          <button type="submit" className={`au2-go${busy ? " busy" : ""}`} disabled={!ready}>
            {busy ? <i className="au-spin" /> : cta}
          </button>
          {mode === "login" ? (
            <button type="button" className="au2-link" onClick={() => go("forgot")}>{s("Forgot password?", "Password dimenticata?")}</button>
          ) : null}
          {mode === "join" ? (
            <p className="au2-terms">{s("By signing up you accept the Terms and the Privacy policy.", "Iscrivendoti accetti i Termini e l'Informativa sulla privacy.")}</p>
          ) : null}
        </form>
        {mode === "login" && saved.length && !handle ? (
          <div className="au2-saved">
            <p className="au2-or"><span>{s("Accounts on this device", "Account su questo dispositivo")}</span></p>
            <div className="au2-saved-row">
              {saved.map((user) => (
                <button
                  key={user.handle}
                  type="button"
                  onClick={() => {
                    setHandle(user.handle);
                    window.setTimeout(() => passRef.current?.focus(), 40);
                  }}
                >
                  <RemoteImage src={user.handle === DEMO_USER.handle ? AVATAR : avatarFor(user.name || user.handle)} alt="" />
                  <span>{user.handle}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="au2-foot">
        {mode === "login" ? (
          <button type="button" className="au2-outline" onClick={() => go("join")}>{s("Create new account", "Crea nuovo account")}</button>
        ) : (
          <button type="button" className="au2-outline" onClick={() => go("login")}>{s("I already have an account", "Ho già un account")}</button>
        )}
        <span className="au2-brand"><i /> Space</span>
      </div>
    </div>
  );
}

export default function App() {
  const [tabDir, setTabDir] = useState(1);
  const [tab, setTab] = useState(() => {
    const query = new URLSearchParams(window.location.search).get("tab");
    const name = query === "activity" ? "reel" : query;
    return ["home", "reel", "search", "messages", "profile"].includes(name) ? name : "home";
  });
  const space = useSpace();
  const library = space.library;
  const profile = space.profile;
  const [seenStories, setSeenStories] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("space-seen") || "[]");
      return new Set(Array.isArray(saved) ? saved : []);
    } catch {
      return new Set();
    }
  });
  const [hiddenFrames, setHiddenFrames] = useState(() => new Set());
  const [camHold, setCamHold] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const screenRoot = useRef(null);
  const camTimer = useRef(0);
  const [notesSeen, setNotesSeen] = useState(-1);
  const [banner, setBanner] = useState(null);

  const lastNote = useRef(space.notifications?.[0]?.id || null);
  useEffect(() => {
    const newest = space.notifications?.[0];
    if (!newest || newest.id === lastNote.current) return;
    lastNote.current = newest.id;
    if (!newest.read) setBanner(newest);
  }, [space.notifications]);
  const [stack, setStack] = useState([]);
  const [exitKey, setExitKey] = useState(null);
  const layerKey = useRef(1);
  const [themeId, setThemeId] = useState(() => {
    const saved = window.localStorage.getItem("space-theme-v2");
    return THEMES.some((item) => item.id === saved) ? saved : "space";
  });
  const theme = THEMES.find((item) => item.id === themeId) || THEMES[0];
  const [mode, setMode] = useState(() => (window.localStorage.getItem("space-mode") === "light" ? "light" : "dark"));
  const [auth, setAuth] = useState(loadAuth);
  const [chatRequest, setChatRequest] = useState(null);
  const [topHidden, setTopHidden] = useState(false);
  const [postedAt, setPostedAt] = useState(0);
  const [reelCam, setReelCam] = useState(false);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [appToast, setAppToast] = useState(null);
  useEffect(() => {
    if (!appToast) return undefined;
    const id = window.setTimeout(() => setAppToast(null), 2600);
    return () => window.clearTimeout(id);
  }, [appToast]);

  useEffect(() => {
    window.localStorage.setItem("space-theme-v2", themeId);
  }, [themeId]);
  useEffect(() => {
    window.localStorage.setItem("space-mode", mode);
  }, [mode]);
  useEffect(() => {
    window.localStorage.setItem("space-auth", JSON.stringify(auth));
  }, [auth]);
  useEffect(() => {
    window.localStorage.setItem("space-seen", JSON.stringify([...seenStories]));
  }, [seenStories]);

  const [prefs, setPrefs] = useState(loadPrefs);
  const [limitOn, setLimitOn] = useState(false);
  const [usedMs, setUsedMs] = useState(0);
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    let used = 0;
    try {
      const raw = JSON.parse(window.localStorage.getItem("space-time") || "null");
      if (raw?.day === day) used = Number(raw.used) || 0;
    } catch { used = 0; }
    setUsedMs(used);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      used += 15000;
      window.localStorage.setItem("space-time", JSON.stringify({ day, used }));
      setUsedMs(used);
      const cap = Number(prefs.timeLimit);
      if (cap && used >= cap * 60 * 1000) setLimitOn(true);
    }, 15000);
    const cap = Number(prefs.timeLimit);
    if (cap && used >= cap * 60 * 1000) setLimitOn(true);
    return () => window.clearInterval(timer);
  }, [prefs.timeLimit]);
  useEffect(() => {
    window.localStorage.setItem("space-prefs", JSON.stringify(prefs));
  }, [prefs]);
  function updatePrefs(patch) {
    setPrefs((prev) => ({
      ...prev,
      ...patch,
      notes: patch.notes ? { ...prev.notes, ...patch.notes } : prev.notes,
    }));
  }
  function openSetting(id) {
    if (id === "edit") push({ id: "edit" });
    else if (id === "saved") push({ id: "saved" });
    else if (id === "theme") push({ id: "theme" });
    else if (id === "language") push({ id: "language" });
    else if (id === "privacy-policy" || id === "terms" || id === "about") push({ id: "legal", doc: id });
    else if (id === "orders") push({ id: "orders" });
    else push({ id: "prefs", page: id });
  }

  const mineFrames = library
    .filter((item) => item.kind === "story" && (item.image || item.video) && !hiddenFrames.has(item.id))
    .map((item) => ({
      id: item.id,
      image: item.image,
      video: item.video || "",
      mirror: Boolean(item.mirror),
      muted: Boolean(item.muted),
      filter: item.filter || "normal",
      text: item.text || "",
      textColor: item.textColor,
      close: Boolean(item.close),
      time: item.time || "Now",
      stickers: item.stickers || [],
    }))
    .reverse();
  const decks = [
    ...(mineFrames.length ? [{ id: "you", name: "La tua", full: profile.name, src: AVATAR, mine: true, frames: mineFrames }] : []),
    ...STORY_DECKS
      .map((deck) => ({ ...deck, frames: deck.frames.filter((frame) => !hiddenFrames.has(frame.id)) }))
      .filter((deck) => deck.frames.length && (deck.id === "you" || !personHidden(prefs, deck.full || deck.name))),
  ];
  function paintCam(px, animate) {
    const root = screenRoot.current;
    if (!root) return;
    root.style.transition = animate ? "transform 340ms cubic-bezier(0.22, 1, 0.32, 1), border-radius 340ms ease" : "none";
    // A few extra pixels so no sliver of the feed peeks past the camera.
    root.style.transform = px ? `translate3d(${px >= root.clientWidth ? px + 6 : px}px, 0, 0)` : "";
    root.style.borderRadius = px > 8 ? "calc(42 * var(--u))" : "";
    root.style.overflow = px > 8 ? "hidden" : "";
  }
  function cameraMove(px) {
    paintCam(px, false);
    if (!camHold) setCamHold(true);
  }
  function cameraRelease(open, width) {
    if (open) {
      paintCam(width, true);
      setCamHold(true);
      setCamOn(true);
    } else {
      paintCam(0, true);
      setCamOn(false);
      window.clearTimeout(camTimer.current);
      camTimer.current = window.setTimeout(() => setCamHold(false), 380);
    }
  }
  function openCamera() {
    const width = screenRoot.current?.clientWidth || 390;
    setCamHold(true);
    setCamOn(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => paintCam(width, true));
    });
  }
  function closeCamera() {
    paintCam(0, true);
    setCamOn(false);
    window.clearTimeout(camTimer.current);
    camTimer.current = window.setTimeout(() => setCamHold(false), 380);
  }
  function logout() {
    closeCamera();
    setExitKey(null);
    setStack([]);
    setAuth((prev) => ({ ...prev, handle: null, previous: null }));
  }
  // Adding an account keeps the current one one tap away.
  function addAccount() {
    closeCamera();
    setExitKey(null);
    setStack([]);
    setAuth((prev) => ({ ...prev, handle: null, previous: prev.handle }));
  }
  const explore = [...library.filter((item) => item.image), ...POSTS.filter((item) => item.image)].filter((item) => shown(prefs, item) && !space.archived.has(item.id));
  const grid = [...library.filter((item) => item.kind === "post"), ...POSTS.filter((item) => item.mine && item.image)].filter((item) => !space.archived.has(item.id));
  const profileReels = [
    ...library.filter((item) => item.kind === "reel"),
    ...REELS.filter((item) => item.name === "Giulia Neri").map((item) => ({ ...item, image: item.image || item.src })),
  ].filter((item) => !space.archived.has(item.id));
  const tagged = POSTS.filter((item) => item.tagged);

  // Back from Stripe: confirm the order or refresh the seller's payment status.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const order = params.get("order");
    const stripeBack = params.get("stripe");
    if (!checkout && !stripeBack) return;
    window.history.replaceState(null, "", backUrl());
    const it = prefs.language === "it";
    if (stripeBack) {
      push({ id: "prefs", page: "payments" });
      return;
    }
    if (checkout === "cancel") {
      setAppToast({ id: Date.now(), text: it ? "Pagamento annullato" : "Payment cancelled" });
      return;
    }
    if (checkout === "success" && order && auth.handle) {
      payApi("/orders/confirm", { handle: auth.handle, orderId: order })
        .then(({ order: done }) => {
          setAppToast({ id: Date.now(), text: done?.status === "paid" ? (it ? "Ordine confermato 🎉" : "Order confirmed 🎉") : (it ? "Pagamento in elaborazione" : "Payment processing"), src: done?.image || undefined });
          push({ id: "orders" });
        })
        .catch(() => setAppToast({ id: Date.now(), text: it ? "Controlla i tuoi ordini" : "Check your orders" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sellers publish their catalogue to the server so buyers on other devices can pay.
  useEffect(() => {
    if (prefs.accountType !== "business" || !auth.handle) return undefined;
    const business = { ...DEFAULT_BUSINESS, ...(prefs.business || {}) };
    if (business.shop === false) return undefined;
    const products = (space.products || MY_PRODUCTS_SEED).map((item) => ({
      id: item.id, name: item.name, price: item.price, image: item.images?.[0], stock: item.madeToOrder && !item.stock ? null : item.stock, madeToOrder: item.madeToOrder || null, service: Boolean(item.service),
    }));
    const id = window.setTimeout(() => {
      payApi("/products/sync", { handle: auth.handle, shop: { title: business.title, city: business.city, category: business.category }, products }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(id);
  }, [prefs.accountType, prefs.business, space.products, auth.handle]);

  // Live order events from the hub become notifications.
  useEffect(() => {
    const onOrder = (event) => {
      const { order, event: kind } = event.detail || {};
      if (!order) return;
      const it = prefs.language === "it";
      if (kind === "sold") space.notify({ type: "order", name: `@${order.buyer}`, src: avatarFor(order.buyer), text: it ? `ha acquistato ${order.qty > 1 ? `${order.qty} × ` : ""}${order.name} · ${euro(order.total, true)}` : `bought ${order.name} · ${euro(order.total, false)}`, target: { kind: "orders" } });
      if (kind === "shipped" && order.buyer === auth.handle) space.notify({ type: "order", name: `@${order.seller}`, src: avatarFor(order.seller), text: it ? `ha spedito il tuo ordine: ${order.name}` : `shipped your order: ${order.name}`, target: { kind: "orders" } });
    };
    window.addEventListener("space-order", onOrder);
    return () => window.removeEventListener("space-order", onOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.handle, prefs.language]);

  function push(screen) {
    setExitKey(null);
    const key = layerKey.current;
    layerKey.current += 1;
    setStack((prev) => [...prev, { ...screen, key }]);
  }
  function pop() {
    const last = stack[stack.length - 1];
    if (!last || exitKey === last.key) return;
    if (last.id === "story") {
      setStack((prev) => prev.slice(0, -1));
      return;
    }
    setExitKey(last.key);
  }
  function finishExit() {
    setStack((prev) => prev.slice(0, -1));
    setExitKey(null);
  }
  function openPost(post) {
    push({ id: "post", post });
  }

  const thoughtNav = {
    open: (thought) => thought && push({ id: "thought", thoughtId: thought.id }),
    compose: (opts = {}) => push({ id: "compose-thought", replyTo: opts.replyTo, quote: opts.quote }),
    list: () => push({ id: "thoughts" }),
    person: (thought) => {
      if (thought.mine) {
        goTo("profile");
        return;
      }
      const person = SEARCH_PEOPLE.find((item) => item.name === thought.name || item.handle === thought.handle);
      if (person) push({ id: "person", person });
    },
    tag: (tag) => {
      const clean = String(tag || "").replace(/[.,!?;:”"»)]+$/, "");
      if (clean.startsWith("#")) {
        push({ id: "hashtag", tag: clean.slice(1).toLowerCase() });
        return;
      }
      const handle = clean.slice(1).toLowerCase();
      if (handle === String(profile.handle || "").replace(/^@/, "").toLowerCase() || handle === auth.handle) {
        goTo("profile");
        return;
      }
      const person = SEARCH_PEOPLE.find((item) => item.handle === handle);
      if (person) push({ id: "person", person });
    },
    share: (thought) => push({ id: "share", post: { id: thought.id, name: thought.name, handle: `@${thought.handle}`, avatar: thought.src, image: thought.images?.[0] || null, text: thought.text, kind: "tweet" } }),
    toast: (text) => setAppToast({ id: Date.now(), text }),
    product: (product, owner, liveShop) => product && push({ id: "product", product, owner, liveShop }),
    liveShop: (shop) => push({ id: "store", owner: null, live: shop }),
    store: (owner, live) => push({ id: "store", owner: owner || null, live: live || null }),
    chat: (name) => {
      const person = SEARCH_PEOPLE.find((item) => item.name === name);
      const id = space.ensureChat({ name, src: person?.src || avatarFor(name) });
      goTo("messages");
      setChatRequest((prev) => ({ convId: id, n: (prev?.n || 0) + 1 }));
    },
    cart: () => push({ id: "cart" }),
    wishlist: () => push({ id: "wishlist" }),
    orders: () => push({ id: "orders" }),
    saved: () => push({ id: "saved" }),
    dm: (handle, text) => {
      goTo("messages");
      setChatRequest((prev) => ({ dm: handle, text, n: (prev?.n || 0) + 1 }));
    },
    editProduct: (product) => push({ id: "product-edit", product }),
    deleted: (id) => {
      const top = stack[stack.length - 1];
      if (top?.id === "thought" && top.thoughtId === id) pop();
    },
  };

  const savedList = [...space.saves].map((id) => space.savedPosts[id]).filter(Boolean);
  const highlightDecks = [...(space.highlights || []), ...HIGHLIGHTS];
  const authUser = auth.handle ? auth.users.find((user) => user.handle === auth.handle) : null;
  const liveUser = authUser
    ? {
      handle: authUser.handle,
      name: authUser.handle === DEMO_USER.handle ? profile.name : (authUser.name || authUser.handle),
      src: authUser.handle === DEMO_USER.handle ? AVATAR : avatarFor(authUser.name || authUser.handle),
    }
    : null;
  const localUnread = space.threads.filter((item) => item.unread).length;

  function goTo(next) {
    if (next === tab && !stack.length) {
      // Tapping the active tab scrolls back to the top, like Instagram.
      screenRoot.current?.querySelector(".tab-slot .home-scroll, .tab-slot .panel-scroll, .tab-slot .reel-stage")?.scrollTo({ top: 0, behavior: "smooth" });
      setTopHidden(false);
      return;
    }
    const dir = TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1;
    const apply = () => {
      setTabDir(dir);
      closeCamera();
      setTab(next);
      setExitKey(null);
      setStack([]);
      setTopHidden(false);
    };
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (next !== tab && document.startViewTransition && !calm && document.visibilityState === "visible") {
      document.documentElement.dataset.nav = dir > 0 ? "forward" : "back";
      document.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  }

  // Horizontal swipe between tabs (left = next tab, right = previous).
  // On Home a right swipe still opens the story camera.
  const swipeRef = useRef({ tab, stack: 0, camOn: false, goTo });
  swipeRef.current = { tab, stack: stack.length, camOn, goTo };
  useEffect(() => {
    const root = screenRoot.current;
    if (!root) return undefined;
    const skip = ".story-rail, .h-rail, .ig-active, .highlights, .ig-chips, .photo-tray, .layer, .call-layer, .live-toast, .dock, .rs-bar-hit, .rs-sheet-back, .rs-head, .rc-layer, .pf-pager, .pf-discover, .pf-qr-back, .pf-peek-back, .sv-sheet-back, .dm-row-wrap, .dm-notes, .dm-msg, .dm-focus, .ps-sheet-wrap, .sx-topics, .sx-peek, input, textarea, [data-no-swipe]";
    let drag = null;
    const slot = () => root.querySelector(":scope > .tab-slot");
    function down(event) {
      const now = swipeRef.current;
      if (event.button > 0 || now.stack || now.camOn) return;
      if (!event.target.closest(".tab-slot") || event.target.closest(skip)) return;
      drag = { x: event.clientX, y: event.clientY, t: performance.now(), lock: "", dx: 0 };
    }
    function move(event) {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.lock) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) drag.lock = "x";
        else if (Math.abs(dy) > 12) { drag = null; return; }
        else return;
      }
      const index = TAB_ORDER.indexOf(swipeRef.current.tab);
      if (swipeRef.current.tab === "home" && dx > 0) { drag = null; return; }
      const target = TAB_ORDER[index + (dx < 0 ? 1 : -1)];
      drag.dx = dx;
      drag.target = target;
      const el = slot();
      if (el) {
        const pull = target ? dx * 0.42 : dx * 0.12;
        el.style.transition = "none";
        el.style.transform = `translate3d(${pull}px, 0, 0)`;
        el.style.opacity = String(1 - Math.min(0.35, Math.abs(pull) / 900));
      }
    }
    function up() {
      if (!drag) return;
      const { dx, t, target, lock } = drag;
      drag = null;
      const el = slot();
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t);
      const go = lock === "x" && target && (Math.abs(dx) > 70 || speed > 0.45);
      if (el) {
        el.style.transition = go ? "none" : "transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms ease";
        if (!go) {
          el.style.transform = "";
          el.style.opacity = "";
        }
      }
      if (go) {
        swipeRef.current.goTo(target);
        window.requestAnimationFrame(() => {
          const fresh = slot();
          if (fresh) { fresh.style.transform = ""; fresh.style.opacity = ""; fresh.style.transition = ""; }
        });
      }
    }
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <SpacePrefs.Provider value={prefs}>
    <LiveProvider user={liveUser} prefs={prefs}>
    <LiveBridge onLog={(entry) => space.sendMessage(entry.convId, { kind: "call", call: entry.call, duration: entry.duration })} />
    <div className="stage" data-mode={mode} style={{ "--accent": theme.accent, "--ink": theme.ink }}>
          <Frame>
            {camHold ? (
              <StoryCamera
                onClose={closeCamera}
                onPublish={(item) => {
                  space.publish(item);
                  setPostedAt(Date.now());
                  closeCamera();
                }}
              />
            ) : null}
            <ThoughtNav.Provider value={thoughtNav}>
            <div className={camOn ? "screen-root cam-open" : "screen-root"} data-screen={tab} ref={screenRoot} inert={auth.handle ? undefined : true}>
              <StatusBar />
              <header className={`topbar ig-top bar-${tab}${topHidden && tab === "home" ? " hidden" : ""}`}>
                {tab === "home" ? <h1 className="ig-logo">Space</h1> : null}
                {tab === "reel" ? <h1 className="ig-title on-media">Reels</h1> : null}
                {tab === "messages" ? (
                  <h1 className="ig-title">
                    {liveUser?.handle || profile.handle.replace(/^@/, "")}
                    <ChevronDown strokeWidth={2.4} aria-hidden="true" />
                  </h1>
                ) : null}
                {tab === "profile" ? (
                  <h1 className="ig-title">
                    <button type="button" className="ig-title-btn" onClick={() => setAccountsOpen(true)}>
                      {profile.handle.replace(/^@/, "")}
                      <ChevronDown strokeWidth={2.4} aria-hidden="true" />
                    </button>
                  </h1>
                ) : null}
                <div className="top-actions">
                  {tab === "home" ? (
                    <>
                      <button type="button" className="ig-icon" aria-label="Shop" onClick={() => push({ id: "shop" })}>
                        <Bag strokeWidth={1.9} />
                      </button>
                      <button type="button" className="ig-icon" aria-label={prefs.language === "it" ? "Pensieri" : "Thoughts"} onClick={() => push({ id: "thoughts" })}>
                        <Feather strokeWidth={1.9} />
                      </button>
                    </>
                  ) : null}
                  {tab === "home" || tab === "profile" ? (
                    <button type="button" className="ig-icon" aria-label={prefs.language === "it" ? "Crea" : "Create"} onClick={() => push({ id: "create" })}>
                      <SquarePlus strokeWidth={1.9} />
                    </button>
                  ) : null}
                  {tab === "home" ? (
                    <button
                      type="button"
                      className="ig-icon"
                      aria-label={prefs.language === "it" ? "Notifiche" : "Notifications"}
                      onClick={() => {
                        setNotesSeen((space.activity || []).length);
                        push({ id: "notes" });
                      }}
                    >
                      <Heart strokeWidth={1.9} />
                      {(space.notifications || []).some((note) => !note.read) || notesSeen < 0 ? <span className="bell-dot" /> : null}
                    </button>
                  ) : null}
                  {tab === "messages" ? (
                    <button
                      type="button"
                      className="ig-icon"
                      aria-label={prefs.language === "it" ? "Nuovo messaggio" : "New message"}
                      onClick={() => setChatRequest((prev) => ({ compose: true, n: (prev?.n || 0) + 1 }))}
                    >
                      <SquarePen strokeWidth={1.9} />
                    </button>
                  ) : null}
                  {tab === "profile" ? (
                    <button type="button" className="ig-icon" aria-label={prefs.language === "it" ? "Impostazioni" : "Settings"} onClick={() => push({ id: "settings" })}>
                      <Menu strokeWidth={1.9} />
                    </button>
                  ) : null}
                </div>
              </header>
              {stack.map((screen) => {
                const sheet = screen.id === "comments" || screen.id === "share" || screen.id === "compose-thought";
                return (
                  <Layer
                    key={screen.key}
                    kind={screen.id === "story" ? "story" : sheet ? "sheet" : "push"}
                    docked={!sheet && !FULL_SCREENS.has(screen.id)}
                    exiting={exitKey === screen.key}
                    onDone={finishExit}
                    onClose={pop}
                  >
                    {screen.id === "story" ? (
                      <StoryViewer
                        decks={screen.highlight ? highlightDecks : decks}
                        deckId={screen.deckId}
                        seen={seenStories}
                        origin={screen.origin}
                        onSeen={(id) => setSeenStories((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))}
                        onDelete={(id) => {
                          setHiddenFrames((prev) => new Set(prev).add(id));
                          space.drop(id);
                        }}
                        onClose={pop}
                        canReply={(deck) => canReach(prefs, space.follows, deck.full || deck.name, "storyReplies")}
                        onLike={(deck) => space.remember({ name: deck.full || deck.name, text: "Hai messo mi piace alla sua storia.", src: deck.src, storyId: deck.id })}
                        onReply={(deck, text) => {
                          const name = deck.full || deck.name;
                          if (personHidden(prefs, name, true) || !canReach(prefs, space.follows, name, "storyReplies") || textHidden(prefs, text)) return;
                          const known = CONTACTS.find((person) => person.name === name) || DIRECTORY.find((person) => person.name === name);
                          const person = { name, src: known?.src || deck.src };
                          const id = space.ensureChat(person);
                          space.sendMessage(id, text);
                          space.remember({ name, text: "Hai risposto alla sua storia.", src: person.src, storyId: deck.id });
                        }}
                      />
                    ) : null}
                    {screen.id === "create" ? (
                      <CreateScreen
                        onClose={pop}
                        onStory={() => { pop(); window.setTimeout(openCamera, 360); }}
                        onReel={() => { pop(); window.setTimeout(() => setReelCam(true), 360); }}
                        onThought={() => { pop(); window.setTimeout(() => push({ id: "compose-thought" }), 360); }}
                        onPublish={(item) => {
                          space.publish(item);
                          pop();
                          if (tab !== "home") goTo("home");
                          setAppToast({ id: Date.now(), text: prefs.language === "it" ? "Post condiviso" : "Post shared", src: item.image });
                        }}
                      />
                    ) : null}
                    {screen.id === "notes" ? (
                      <NotesScreen
                        onClose={pop}
                        onOpenPost={openPost}
                        onOpenStory={(deckId) => push({ id: "story", deckId })}
                      />
                    ) : null}
                    {screen.id === "post" ? (
                      <PostScreen
                        post={screen.post}
                        comments={space.comments[screen.post.id] || []}
                        onClose={pop}
                        onComment={() => push({ id: "comments", post: screen.post })}
                        onShare={() => push({ id: "share", post: screen.post })}
                        locked={screen.post.name !== profile.name && !canReach(prefs, space.follows, screen.post.name, "comments")}
                        onAdd={(text) => {
                          if (textHidden(prefs, text)) return;
                          space.addComment(screen.post.id, text);
                        }}
                      />
                    ) : null}
                    {screen.id === "comments" ? (
                      <CommentsScreen
                        post={screen.post}
                        comments={space.comments[screen.post.id] || []}
                        locked={screen.post.name !== profile.name && !canReach(prefs, space.follows, screen.post.name, "comments")}
                        onClose={pop}
                        onAdd={(text) => {
                          if (textHidden(prefs, text)) return;
                          if (screen.post.name !== profile.name && !canReach(prefs, space.follows, screen.post.name, "comments")) return;
                          space.addComment(screen.post.id, text);
                          space.remember({ name: profile.name, text: `Hai commentato ${screen.post.name}.`, src: AVATAR });
                        }}
                      />
                    ) : null}
                    {screen.id === "share" ? <ShareScreen post={screen.post} onClose={pop} /> : null}
                    {screen.id === "thoughts" ? <ThoughtsScreen onClose={pop} /> : null}
                    {screen.id === "hashtag" ? <HashtagScreen tag={screen.tag} onClose={pop} onOpenPost={openPost} /> : null}
                    {screen.id === "shop" ? <ShopHome onClose={pop} onOrders={() => push({ id: "orders" })} me={auth.handle} /> : null}
                    {screen.id === "orders" ? <OrdersScreen handle={auth.handle} onClose={pop} /> : null}
                    {screen.id === "wishlist" ? <WishlistScreen onClose={pop} onOpenProduct={(item) => thoughtNav.product(item.product, item.owner, item.live ? { ...item.live, products: [item.product] } : null)} /> : null}
                    {screen.id === "cart" ? (
                      <CartScreen
                        onClose={pop}
                        onOpenProduct={(item) => thoughtNav.product(item.product, item.owner, item.live ? { ...item.live, products: [item.product] } : null)}
                        onCheckout={async (group) => {
                          const it = prefs.language === "it";
                          try {
                            const { url } = await payApi("/checkout", {
                              buyer: auth.handle,
                              seller: group.items[0].live.seller,
                              items: group.items.map((item) => ({ productId: item.product.id, qty: item.qty, variant: item.variant })),
                              returnUrl: backUrl(),
                            });
                            space.clearCartFor(group.seller);
                            window.location.href = url;
                          } catch (error) {
                            setAppToast({ id: Date.now(), text: error.code === "stripe-not-configured" ? (it ? "Pagamenti non ancora attivi sul server" : "Payments are not set up on the server yet") : error.code === "stock" ? (it ? "Un prodotto non ha abbastanza pezzi" : "A product doesn't have enough pieces") : (it ? "Pagamento non avviato. Riprova." : "Couldn't start the payment. Try again.") });
                          }
                        }}
                        onRequest={async (group) => {
                          const it = prefs.language === "it";
                          const ship = shippingFor(group.items);
                          const lines = group.items.map((item) => `• ${item.qty} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""} · ${euro(item.product.price * item.qty, it)}`).join("\n");
                          const text = it
                            ? `Ciao! Vorrei ordinare:\n${lines}\nTotale ${euro(ship.total, true)}${ship.fee ? ` (spedizione inclusa)` : ""}. Come posso pagare?`
                            : `Hi! I'd like to order:\n${lines}\nTotal ${euro(ship.total, false)}. How can I pay?`;
                          const first = group.items[0];
                          if (first.live) {
                            space.clearCartFor(group.seller);
                            thoughtNav.dm(first.live.seller, text);
                            return;
                          }
                          const owner = first.owner;
                          const person = SEARCH_PEOPLE.find((item) => item.name === owner);
                          const id = space.ensureChat({ name: owner, src: person?.src || avatarFor(owner) });
                          if (first.product.images[0]) space.sendMessage(id, { kind: "image", image: first.product.images[0], text });
                          else space.sendMessage(id, text);
                          window.setTimeout(() => space.receiveMessage(id, it ? "Grazie per l'ordine! Ti mando subito i dati per il pagamento e i tempi di spedizione 🙂" : "Thanks for your order! I'll send payment details and shipping times 🙂", false), 4500);
                          space.clearCartFor(group.seller);
                          setAppToast({ id: Date.now(), text: it ? "Richiesta d'ordine inviata" : "Order request sent", src: first.product.images[0] });
                          goTo("messages");
                          setChatRequest((prev) => ({ convId: id, n: (prev?.n || 0) + 1 }));
                        }}
                      />
                    ) : null}
                    {screen.id === "live-shop" ? <LiveShopScreen shop={screen.shop} onClose={pop} /> : null}
                    {screen.id === "store" ? <StoreScreen owner={screen.owner} live={screen.live} onClose={pop} /> : null}
                    {screen.id === "product" ? (
                      <ProductScreen
                        product={screen.product}
                        ownerName={screen.owner}
                        liveShop={screen.liveShop}
                        onBuy={async (product, { variant, qty }) => {
                          const it = prefs.language === "it";
                          try {
                            const { url } = await payApi("/checkout", { buyer: auth.handle, seller: screen.liveShop.seller, productId: product.id, qty, variant, returnUrl: backUrl() });
                            window.location.href = url;
                          } catch (error) {
                            const text = {
                              "stripe-not-configured": it ? "Pagamenti non ancora attivi sul server" : "Payments are not set up on the server yet",
                              "seller-not-ready": it ? "Questa bottega non accetta ancora pagamenti" : "This shop can't take payments yet",
                              stock: it ? "Non ci sono abbastanza pezzi" : "Not enough pieces left",
                              "own-product": it ? "Non puoi comprare un tuo prodotto" : "You can't buy your own product",
                            }[error.code] || (it ? "Pagamento non avviato. Riprova." : "Couldn't start the payment. Try again.");
                            setAppToast({ id: Date.now(), text });
                          }
                        }}
                        onClose={pop}
                        onEdit={(product) => push({ id: "product-edit", product })}
                        onProduct={(product) => push({ id: "product", product, owner: screen.owner, liveShop: screen.liveShop })}
                        onOwner={() => {
                          if (screen.liveShop) {
                            push({ id: "store", owner: null, live: screen.liveShop });
                            return;
                          }
                          if (screen.owner && SHOPS[screen.owner]) {
                            push({ id: "store", owner: screen.owner, live: null });
                            return;
                          }
                          if (!screen.owner) {
                            goTo("profile");
                            return;
                          }
                          const person = SEARCH_PEOPLE.find((item) => item.name === screen.owner);
                          if (person) push({ id: "person", person });
                        }}
                        onAsk={(product, { variant, qty }) => {
                          if (screen.liveShop) {
                            const it = prefs.language === "it";
                            const what = `${qty > 1 ? `${qty} × ` : ""}${product.name}${variant ? ` (${variant})` : ""}`;
                            thoughtNav.dm(screen.liveShop.seller, it ? `Ciao! Mi interessa: ${what} · ${euro(product.price * qty, true)}` : `Hi! I'm interested in: ${what} · ${euro(product.price * qty, false)}`);
                            return;
                          }
                          const person = SEARCH_PEOPLE.find((item) => item.name === screen.owner);
                          const it = prefs.language === "it";
                          const id = space.ensureChat({ name: screen.owner, src: person?.src || avatarFor(screen.owner) });
                          const what = `${qty > 1 ? `${qty} × ` : ""}${product.name}${variant ? ` (${variant})` : ""}`;
                          space.sendMessage(id, {
                            kind: "image",
                            image: product.images[0],
                            text: it ? `Ciao! Mi interessa: ${what} · ${euro(product.price * qty, true)}. È disponibile?` : `Hi! I'm interested in: ${what} · ${euro(product.price * qty, false)}. Is it available?`,
                          });
                          window.setTimeout(() => space.receiveMessage(id, product.service
                            ? (it ? "Certo! Ti tengo il posto, ci vediamo in bottega 🙂" : "Sure! I'll save you a spot, see you at the shop 🙂")
                            : (it ? "Certo, è disponibile! Ti mando i dettagli per pagamento e spedizione 🙂" : "Yes, it's available! I'll send you payment and shipping details 🙂"), false), 4500);
                          goTo("messages");
                          setChatRequest((prev) => ({ convId: id, n: (prev?.n || 0) + 1 }));
                        }}
                      />
                    ) : null}
                    {screen.id === "product-edit" ? (
                      <ProductEditor
                        product={screen.product}
                        onClose={pop}
                        onSave={(product) => {
                          space.saveProduct(product);
                          pop();
                          setAppToast({ id: Date.now(), text: prefs.language === "it" ? (screen.product ? "Prodotto aggiornato" : "Prodotto aggiunto allo shop") : (screen.product ? "Product updated" : "Product added to the shop"), src: product.images[0] });
                        }}
                        onDelete={(id) => {
                          space.deleteProduct(id);
                          setExitKey(null);
                          setStack((prev) => prev.filter((item) => item.id !== "product-edit" && !(item.id === "product" && item.product.id === id)));
                          setAppToast({ id: Date.now(), text: prefs.language === "it" ? "Prodotto eliminato" : "Product deleted" });
                        }}
                      />
                    ) : null}
                    {screen.id === "thought" ? <ThoughtScreen id={screen.thoughtId} onClose={pop} /> : null}
                    {screen.id === "compose-thought" ? (
                      <ThoughtComposer
                        replyTo={screen.replyTo}
                        quote={screen.quote}
                        onClose={pop}
                        onPublish={(thought, chain) => {
                          if (screen.replyTo) space.addThoughtReply(screen.replyTo.id, thought);
                          else space.addThought(thought, chain);
                          pop();
                          setAppToast({ id: Date.now(), text: screen.replyTo ? (prefs.language === "it" ? "Risposta pubblicata" : "Reply posted") : (prefs.language === "it" ? "Pensiero pubblicato" : "Thought posted"), src: thought.images?.[0] });
                        }}
                      />
                    ) : null}
                    {screen.id === "person" ? (
                      <PersonScreen
                        person={screen.person}
                        onClose={pop}
                        onOpenPost={openPost}
                        onMessage={(person) => {
                          const id = space.ensureChat({ name: person.name, src: person.src });
                          goTo("messages");
                          setChatRequest((prev) => ({ convId: id, n: (prev?.n || 0) + 1 }));
                        }}
                      />
                    ) : null}
                    {screen.id === "people" ? <PeopleScreen kind={screen.kind} onClose={pop} /> : null}
                    {screen.id === "feed" ? (
                      <PostsFeed
                        posts={screen.posts}
                        start={screen.index}
                        onClose={pop}
                        onComment={(post) => push({ id: "comments", post })}
                        onShare={(post) => push({ id: "share", post })}
                        onOpen={openPost}
                      />
                    ) : null}
                    {screen.id === "highlight-new" ? (
                      <HighlightNew
                        stories={library.filter((item) => item.kind === "story" && item.image).slice().reverse()}
                        onClose={pop}
                        onSave={(item) => {
                          space.addHighlight(item);
                          pop();
                        }}
                      />
                    ) : null}
                    {screen.id === "edit" ? (
                      <EditScreen
                        profile={profile}
                        onClose={pop}
                        onSave={(next) => {
                          space.saveProfile(next);
                          pop();
                        }}
                      />
                    ) : null}
                    {screen.id === "saved" ? <SavedScreen posts={savedList} onClose={pop} onOpenPost={openPost} /> : null}
                    {screen.id === "settings" ? (
                      <SettingsScreen profile={profile} prefs={prefs} onClose={pop} onOpen={openSetting} />
                    ) : null}
                    {screen.id === "prefs" ? (
                      <PrefsScreen page={screen.page} prefs={prefs} profile={profile} used={usedMs} onChange={updatePrefs} onClose={pop} onLogout={logout} accounts={auth.users} current={auth.handle} onSwitch={(handle) => { setStack([]); setAuth((prev) => ({ ...prev, handle })); }} onAddAccount={addAccount} />
                    ) : null}
                    {screen.id === "language" ? (
                      <LanguageScreen prefs={prefs} onChange={updatePrefs} onClose={pop} />
                    ) : null}
                    {screen.id === "legal" ? (
                      <LegalScreen doc={screen.doc} prefs={prefs} onClose={pop} />
                    ) : null}
                    {screen.id === "theme" ? (
                      <ThemeScreen theme={theme} mode={mode} onChange={setThemeId} onMode={setMode} onClose={pop} />
                    ) : null}
                  </Layer>
                );
              })}
              {tab === "home" ? (
                <div className="tab-slot" data-tab={tab} style={{ "--dir": tabDir }} inert={stack.length > 0 ? true : undefined}>
                <Home
                  decks={decks}
                  seenStories={seenStories}
                  onOpenStory={(deckId, node) => push({ id: "story", deckId, origin: placeOf(node) })}
                  onOpenCamera={openCamera}
                  onCameraMove={cameraMove}
                  onCameraRelease={cameraRelease}
                  onOpenPost={openPost}
                  profile={profile}
                  drops={library.filter((item) => (item.kind === "tweet" || item.kind === "post" || item.kind === "reel") && shown(prefs, item))}
                  onComment={(post) => push({ id: "comments", post })}
                  onShare={(post) => push({ id: "share", post })}
                  onDrop={(id) => space.drop(id)}
                  onChrome={setTopHidden}
                  postedAt={postedAt}
                />
                </div>
              ) : null}
              {tab === "reel" ? <div className="tab-slot" data-tab={tab} style={{ "--dir": tabDir }} inert={stack.length > 0 ? true : undefined}><ReelScreen onCreate={() => setReelCam(true)} /></div> : null}
              {tab === "search" ? <div className="tab-slot" data-tab={tab} style={{ "--dir": tabDir }} inert={stack.length > 0 ? true : undefined}><SearchScreen explore={explore} onOpenPost={openPost} onOpenPerson={(person) => push({ id: "person", person })} /></div> : null}
              {tab === "messages" ? <div className="tab-slot" data-tab={tab} style={{ "--dir": tabDir }} inert={stack.length > 0 ? true : undefined}><Messages request={chatRequest} onOpenPerson={(person) => push({ id: "person", person })} /></div> : null}
              {tab === "profile" ? (
                <div className="tab-slot" data-tab={tab} style={{ "--dir": tabDir }} inert={stack.length > 0 ? true : undefined}>
                <Profile
                  profile={profile}
                  grid={grid}
                  reels={profileReels}
                  tagged={tagged}
                  myDeck={decks.find((deck) => deck.mine)}
                  storySeen={seenStories}
                  highlights={highlightDecks}
                  onOpenStory={(deckId, node) => push({ id: "story", deckId, origin: placeOf(node) })}
                  onOpenCamera={openCamera}
                  onOpenFeed={(posts, index) => push({ id: "feed", posts, index })}
                  onOpenPeople={(kind) => push({ id: "people", kind })}
                  onEdit={() => push({ id: "edit" })}
                  onSaved={() => push({ id: "saved" })}
                  onOpenHighlight={(id, node) => push({ id: "story", deckId: id, highlight: true, origin: placeOf(node) })}
                  onNewHighlight={() => push({ id: "highlight-new" })}
                />
                </div>
              ) : null}
              <footer className="dock">
                <MessagesTab tab={tab} localUnread={localUnread} onChange={goTo} />
                <div className="home-indicator" aria-hidden="true" />
              </footer>
              <LiveToast
                onOpen={(convId) => {
                  goTo("messages");
                  setChatRequest((prev) => ({ convId, n: (prev?.n || 0) + 1 }));
                }}
              />
              {reelCam ? (
                <div className="rc-layer">
                  <ReelCamera
                    onClose={() => setReelCam(false)}
                    onPublish={(item, alsoStory) => {
                      space.publish(item);
                      if (alsoStory) {
                        space.publish({ id: `made-${Date.now()}-s`, kind: "story", image: item.image, text: "", stickers: [], time: "Now", mine: true, src: AVATAR, avatar: AVATAR, name: "Tu", filter: item.filter });
                      }
                      setReelCam(false);
                      if (tab !== "reel") goTo("reel");
                    }}
                  />
                </div>
              ) : null}
              {accountsOpen ? (
                <div className="sv-sheet-back pf-accounts" onClick={() => setAccountsOpen(false)}>
                  <div className="sv-sheet" onClick={(event) => event.stopPropagation()}>
                    <i className="sv-grab" />
                    {auth.users.map((user) => {
                      const current = user.handle === auth.handle;
                      return (
                        <button
                          key={user.handle}
                          type="button"
                          className="sc-target"
                          onClick={() => {
                            setAccountsOpen(false);
                            if (!current) setAuth((prev) => ({ ...prev, handle: user.handle }));
                          }}
                        >
                          <RemoteImage className="row-avatar" src={user.handle === DEMO_USER.handle ? AVATAR : avatarFor(user.name || user.handle)} alt="" />
                          <span>{user.handle}<em>{user.name}</em></span>
                          {current ? <Checked weight="fill" className="tick-on" /> : <Ring className="tick-off" />}
                        </button>
                      );
                    })}
                    <button type="button" className="sc-target" onClick={() => { setAccountsOpen(false); addAccount(); }}>
                      <i className="pf-add-acc"><Plus /></i>
                      <span>{prefs.language === "it" ? "Aggiungi account" : "Add account"}</span>
                    </button>
                  </div>
                </div>
              ) : null}
              {banner ? (
                <NotifyBanner
                  key={banner.id}
                  note={banner}
                  onDone={() => setBanner(null)}
                  onOpen={() => {
                    setBanner(null);
                    setNotesSeen(0);
                    push({ id: "notes" });
                  }}
                />
              ) : null}
              {appToast ? (
                <div key={appToast.id} className="app-toast" role="status">
                  {appToast.src ? <img src={appToast.src} alt="" /> : null}
                  <span>{appToast.text}</span>
                  <i className="app-toast-bar" />
                </div>
              ) : null}
              <CallLayer />
              {limitOn ? (
                <div className="time-wall">
                  <section className="sheet">
                    <h2>{prefs.language === "it" ? "Tempo" : "Time"}</h2>
                    <p>{prefs.language === "it" ? "Hai raggiunto il limite di oggi." : "You reached today's limit."}</p>
                    <button type="button" className="msg-create" onClick={() => setLimitOn(false)}>{prefs.language === "it" ? "Continua" : "Continue"}</button>
                  </section>
                </div>
              ) : null}
            </div>
            </ThoughtNav.Provider>
            {auth.handle ? null : (
              <AuthScreen
                users={auth.users}
                lang={prefs.language}
                back={auth.previous}
                onEnter={(handle) => setAuth((prev) => ({ ...prev, handle, previous: null }))}
                onJoin={(user) => setAuth((prev) => ({ users: [...prev.users, user], handle: user.handle, previous: null }))}
                onReset={(handle, password) => setAuth((prev) => ({
                  ...prev,
                  users: prev.users.map((user) => (user.handle === handle ? { ...user, password } : user)),
                }))}
              />
            )}
          </Frame>
    </div>
    </LiveProvider>
    </SpacePrefs.Provider>
  );
}
