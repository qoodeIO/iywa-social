// WebSocket client for the Space hub (calls/src/worker.js), ported from src/live/hub.js.
// Reconnects with backoff, keeps the socket alive with pings and detects "zombie"
// sockets. When the hub has never been reached the status is "offline" (not an
// error): the app keeps working with demo chats and retries quietly in the background.

import { AppState } from "react-native";
import { hubUrl } from "./config";

const IDLE_MS = 50_000;
const PING_MS = 20_000;
const MAX_WAIT = 30_000;

export function createHub({ hello, onMessage, onStatus }) {
  const url = hubUrl();
  let socket = null;
  let attempt = 0;
  let stopped = false;
  let retryTimer = 0;
  let pingTimer = 0;
  let idleTimer = 0;
  let everOpen = false;
  let status = "idle";

  function setStatus(next) {
    if (status === next) return;
    status = next;
    onStatus?.(next);
  }

  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => socket?.close(), IDLE_MS);
  }

  function schedule() {
    if (stopped) return;
    const cap = everOpen ? 10_000 : MAX_WAIT;
    const delay = Math.min(cap, 500 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
    attempt += 1;
    // Never reached: stay quietly offline instead of "reconnecting" forever.
    setStatus(everOpen ? "reconnecting" : "offline");
    clearTimeout(retryTimer);
    retryTimer = setTimeout(open, delay);
  }

  function open() {
    if (stopped || !url) return;
    if (!everOpen && attempt === 0) setStatus("connecting");
    else if (everOpen) setStatus("reconnecting");
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      schedule();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      armIdle();
      try {
        ws.send(JSON.stringify({ type: "hello", ...hello() }));
      } catch {
        // closed in between
      }
      clearInterval(pingTimer);
      pingTimer = setInterval(() => send({ type: "ping" }), PING_MS);
    };
    ws.onmessage = (event) => {
      armIdle();
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "ready") {
        everOpen = true;
        setStatus("open");
      }
      if (message.type === "pong") return;
      onMessage(message);
    };
    ws.onclose = () => {
      clearInterval(pingTimer);
      clearTimeout(idleTimer);
      if (socket === ws) socket = null;
      schedule();
    };
    ws.onerror = () => {
      try { ws.close(); } catch { /* already closed */ }
    };
  }

  function send(message) {
    if (!socket || socket.readyState !== 1) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function wake() {
    // Back in the foreground: retry now instead of waiting.
    if (stopped || socket || !url) return;
    clearTimeout(retryTimer);
    attempt = 0;
    open();
  }

  const sub = AppState.addEventListener("change", (next) => {
    if (next === "active") wake();
  });
  if (url) open();
  else setStatus("offline");

  return {
    send,
    get status() { return status; },
    close() {
      stopped = true;
      sub.remove();
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      clearTimeout(idleTimer);
      try { socket?.close(); } catch { /* ignore */ }
      socket = null;
      setStatus("idle");
    },
  };
}
