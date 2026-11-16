// Icon set: Phosphor Icons, exposed under the names the app already uses.
// `strokeWidth` (old API) maps to a Phosphor weight; pass `weight` to pick one
// explicitly ("regular", "bold", "fill", "light", "duotone").
import {
  ArrowUpRight as PArrowUpRight,
  Archive as PArchive,
  ArrowCounterClockwise,
  ArrowsIn,
  At,
  Bell as PBell,
  BookmarkSimple,
  CameraRotate,
  Camera as PCamera,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  ChatCircle,
  ChatTeardropText,
  Check as PCheck,
  Checks,
  Clock as PClock,
  DotsThree,
  Eye as PEye,
  EyeSlash,
  FilmSlate,
  GearSix,
  GridFour,
  Hash as PHash,
  Heart as PHeart,
  House as PHouse,
  Image as PImage,
  Info as PInfo,
  Link as PLink,
  List,
  MagnifyingGlass,
  MapPin as PMapPin,
  Microphone,
  MicrophoneSlash,
  MusicNotes,
  NotePencil,
  PaperPlaneTilt,
  Pause as PPause,
  PencilSimple,
  PencilSimpleLine,
  PhoneDisconnect,
  PhoneIncoming as PPhoneIncoming,
  Phone as PPhone,
  Play as PPlay,
  PlusSquare,
  Plus as PPlus,
  Question,
  SignOut,
  Smiley,
  SpeakerHigh,
  Timer as PTimer,
  UserMinus as PUserMinus,
  UserPlus as PUserPlus,
  Users as PUsers,
  VideoCamera,
  VideoCameraSlash,
  X as PX,
  Lightning,
  LightningSlash,
  HandPalm,
  Sparkle as PSparkle,
  DownloadSimple,
  PaintBrush,
  Highlighter as PHighlighter,
  Eraser as PEraser,
  ArrowUUpLeft,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  Star as PStar,
  TextAa,
  Rows as PRows,
  SquaresFour,
  CheckCircle,
  Circle as PCircle,
  Sticker as PSticker,
  Scribble as PScribble,
  PushPin,
  QrCode as PQrCode,
  Copy as PCopy,
  ChatTeardropDots,
  BellSlash,
  Trash as PTrash,
  ArrowBendUpLeft,
  Cards,
  SealCheck,
  ClockCounterClockwise,
  PhoneOutgoing as PPhoneOutgoing,
  PhoneX,
  Tray,
  ArrowDown as PArrowDown,
  Feather as PFeather,
  Repeat as PRepeat,
  Quotes as PQuotes,
  ChartBarHorizontal,
  Globe as PGlobe,
  ArrowRight as PArrowRight,
  CaretUp,
  ShareFat,
  SlidersHorizontal,
  FolderSimple,
  PlusCircle,
  EnvelopeSimpleOpen,
  LockSimple,
  User as PUser,
  WarningCircle,
  ShoppingBag as PShoppingBag,
  Storefront,
  Envelope,
  NavigationArrow,
  Package as PPackage,
  Truck as PTruck,
  Tag as PTag,
  ChartLineUp,
  Medal as PMedal,
  ShieldCheck as PShieldCheck,
} from "@phosphor-icons/react";

function weightOf(strokeWidth, weight) {
  if (weight) return weight;
  if (strokeWidth == null) return "regular";
  const value = Number(strokeWidth);
  if (value === 0) return "fill";
  if (value >= 2.4) return "bold";
  if (value <= 1.6) return "light";
  return "regular";
}

function wrap(Icon, fixed) {
  function AppIcon({ strokeWidth, weight, size, ...rest }) {
    return <Icon weight={weightOf(strokeWidth, weight || fixed)} size={size || "1em"} {...rest} />;
  }
  AppIcon.displayName = `Icon(${Icon.displayName || "phosphor"})`;
  return AppIcon;
}

export const ArrowUpRight = wrap(PArrowUpRight);
export const Bell = wrap(PBell);
export const Bookmark = wrap(BookmarkSimple);
export const Archive = wrap(PArchive);
export const ChevronLeft = wrap(CaretLeft);
export const ChevronRight = wrap(CaretRight);
export const ChevronDown = wrap(CaretDown);
export const SquarePlay = wrap(FilmSlate);
export const Heart = wrap(PHeart);
export const House = wrap(PHouse);
export const Image = wrap(PImage);
export const MessageCircle = wrap(ChatCircle);
export const PenLine = wrap(PencilSimpleLine);
export const MessageSquareText = wrap(ChatTeardropText);
export const AtSign = wrap(At);
export const LayoutGrid = wrap(GridFour);
export const Play = wrap(PPlay);
export const Plus = wrap(PPlus);
export const Camera = wrap(PCamera);
export const SwitchCamera = wrap(CameraRotate);
export const BarChart2 = wrap(ChartBar);
export const CheckCheck = wrap(Checks);
export const Hash = wrap(PHash);
export const HelpCircle = wrap(Question);
export const Pencil = wrap(PencilSimple);
export const Link = wrap(PLink);
export const MapPin = wrap(PMapPin);
export const Mic = wrap(Microphone);
export const MicOff = wrap(MicrophoneSlash);
export const Music = wrap(MusicNotes);
export const Pause = wrap(PPause);
export const Phone = wrap(PPhone);
export const PhoneOff = wrap(PhoneDisconnect);
export const PhoneIncoming = wrap(PPhoneIncoming);
export const Video = wrap(VideoCamera);
export const VideoOff = wrap(VideoCameraSlash);
export const Volume2 = wrap(SpeakerHigh);
export const Smile = wrap(Smiley);
export const Timer = wrap(PTimer);
export const X = wrap(PX);
export const Eye = wrap(PEye);
export const EyeOff = wrap(EyeSlash);
export const MoreHorizontal = wrap(DotsThree, "bold");
export const Search = wrap(MagnifyingGlass);
export const Send = wrap(PaperPlaneTilt);
export const Settings = wrap(GearSix);
export const Users = wrap(PUsers);
export const Check = wrap(PCheck);
export const Clock = wrap(PClock);
export const RotateCcw = wrap(ArrowCounterClockwise);
export const UserPlus = wrap(PUserPlus);
export const UserMinus = wrap(PUserMinus);
export const LogOut = wrap(SignOut);
export const Minimize2 = wrap(ArrowsIn);
export const Info = wrap(PInfo);
export const SquarePen = wrap(NotePencil);
export const Menu = wrap(List);
export const SquarePlus = wrap(PlusSquare);
export const Flash = wrap(Lightning);
export const FlashOff = wrap(LightningSlash);
export const Hand = wrap(HandPalm);
export const Sparkle = wrap(PSparkle);
export const Download = wrap(DownloadSimple);
export const Brush = wrap(PaintBrush);
export const Highlighter = wrap(PHighlighter);
export const Eraser = wrap(PEraser);
export const Undo = wrap(ArrowUUpLeft);
export const SoundOn = wrap(SpeakerSimpleHigh);
export const SoundOff = wrap(SpeakerSimpleSlash);
export const Star = wrap(PStar);
export const TextIcon = wrap(TextAa);
export const Rows = wrap(PRows);
export const Grid4 = wrap(SquaresFour);
export const Checked = wrap(CheckCircle);
export const Ring = wrap(PCircle);
export const StickerIcon = wrap(PSticker);
export const Scribble = wrap(PScribble);
export const Pin = wrap(PushPin);
export const QrCode = wrap(PQrCode);
export const Copy = wrap(PCopy);
export const NoteIcon = wrap(ChatTeardropDots);
export const BellOff = wrap(BellSlash);
export const Trash = wrap(PTrash);
export const Reply = wrap(ArrowBendUpLeft);
export const Carousel = wrap(Cards, "fill");
export const Verified = wrap(SealCheck, "fill");
export const Recent = wrap(ClockCounterClockwise);
export const PhoneOutgoing = wrap(PPhoneOutgoing);
export const PhoneMissed = wrap(PhoneX);
export const Inbox = wrap(Tray);
export const ArrowDown = wrap(PArrowDown, "bold");
export const Feather = wrap(PFeather);
export const Repost = wrap(PRepeat);
export const Quote = wrap(PQuotes);
export const Poll = wrap(ChartBarHorizontal);
export const Globe = wrap(PGlobe);
export const ArrowRight = wrap(PArrowRight, "bold");
export const ChevronUp = wrap(CaretUp);
export const Forward = wrap(ShareFat);
export const Sliders = wrap(SlidersHorizontal);
export const Folder = wrap(FolderSimple);
export const AddCircle = wrap(PlusCircle);
export const MarkRead = wrap(EnvelopeSimpleOpen);
export const Lock = wrap(LockSimple);
export const UserIcon = wrap(PUser);
export const Warn = wrap(WarningCircle, "fill");
export const Bag = wrap(PShoppingBag);
export const Shop = wrap(Storefront);
export const Mail = wrap(Envelope);
export const Directions = wrap(NavigationArrow);
export const Box = wrap(PPackage);
export const Truck = wrap(PTruck);
export const PriceTag = wrap(PTag);
export const Trend = wrap(ChartLineUp);
export const Medal = wrap(PMedal);
export const ReturnIcon = wrap(ArrowUUpLeft);
export const ShieldCheck = wrap(PShieldCheck);
export const Bolt = wrap(Lightning);
