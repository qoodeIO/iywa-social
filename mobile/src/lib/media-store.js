// Picked and recorded media live in the picker/camera cache, which iOS and Android may purge.
// keepMedia() copies a local file into <Documents>/media so posts, stories, reels, products,
// chat photos and avatars keep working across launches. Remote URLs, data URLs and files that
// are already kept pass through unchanged; any failure falls back to the original URI.
import { Directory, File, Paths } from "expo-file-system";

const FOLDER = "media";
const MARK = `/${FOLDER}/`;

let dir = null;
function mediaDir() {
  if (!dir) {
    dir = new Directory(Paths.document, FOLDER);
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  }
  return dir;
}

function isLocal(uri) {
  return typeof uri === "string" && uri.startsWith("file://");
}

function extOf(uri) {
  const clean = uri.split("?")[0];
  const match = /\.([a-z0-9]{2,5})$/i.exec(clean);
  return match ? `.${match[1].toLowerCase()}` : "";
}

let seq = 0;
function targetFor(uri, prefix) {
  const base = mediaDir();
  if (uri.startsWith(base.uri) || uri.includes(`/Documents${MARK}`)) return null;
  const name = `${prefix ? `${prefix}-` : ""}${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}${extOf(uri)}`;
  return new File(base, name);
}

export async function keepMedia(uri, prefix) {
  if (!isLocal(uri)) return uri;
  try {
    const target = targetFor(uri, prefix);
    if (!target) return uri;
    await new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

// Synchronous variant for small files (voice notes, avatars) where the caller cannot await.
export function keepMediaSync(uri, prefix) {
  if (!isLocal(uri)) return uri;
  try {
    const target = targetFor(uri, prefix);
    if (!target) return uri;
    new File(uri).copySync(target);
    return target.uri;
  } catch {
    return uri;
  }
}

export function keepAll(uris) {
  return Promise.all((uris || []).map((uri) => keepMedia(uri)));
}

// The app container path changes on iOS between installs/updates, so absolute URIs saved
// earlier must be re-pointed at the current Documents folder when state is loaded.
export function relinkMedia(raw) {
  if (typeof raw !== "string" || !raw.includes(MARK)) return raw;
  let base;
  try { base = mediaDir().uri; } catch { return raw; }
  if (!base.endsWith("/")) base += "/";
  return raw.replace(/file:\/\/[^"\\]*?\/Documents\/media\//g, base);
}
