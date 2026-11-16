// Tiny hand-offs between the chat screen and the routes it opens (chat info).
const pendingFind = new Set();

export function requestFind(id) {
  pendingFind.add(id);
}

let pendingFolder = null;

export function requestFolder(id) {
  pendingFolder = id;
}

export function takeFolder() {
  const id = pendingFolder;
  pendingFolder = null;
  return id;
}

export function takeFind(id) {
  const had = pendingFind.has(id);
  pendingFind.delete(id);
  return had;
}
