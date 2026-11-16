// WebSocket client for the Space hub (calls/src/worker.js).
// Reconnects with backoff, keeps the socket alive with pings and detects
// "zombie" sockets, like Spinchat's signaling client.

const IDLE_MS = 50_000;
const PING_MS = 20_000;

function hubUrl() {
  const base = import.meta.env.VITE_HUB_URL;
  if (base) return base;
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/calls/hub`;
}

export function createHub({ hello, onMessage, onStatus }) {
  let socket = null;
  let attempt = 0;
  let stopped = false;
  let retryTimer = 0;
  let pingTimer = 0;
  let idleTimer = 0;
  let status = "idle";

  function setStatus(next) {
    if (status === next) return;
    status = next;
    onStatus?.(next);
  }

  function armIdle() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => socket?.close(), IDLE_MS);
  }

  function schedule() {
    if (stopped) return;
    const delay = Math.min(10_000, 500 * 2 ** attempt) * (0.75 + Math.random() * 0.5);
    attempt += 1;
    setStatus("reconnecting");
    retryTimer = window.setTimeout(open, delay);
  }

  function open() {
    if (stopped) return;
    setStatus(attempt ? "reconnecting" : "connecting");
    let ws;
    try {
      ws = new WebSocket(hubUrl());
    } catch {
      schedule();
      return;
    }
    socket = ws;
    ws.onopen = () => {
      attempt = 0;
      armIdle();
      ws.send(JSON.stringify({ type: "hello", ...hello() }));
      window.clearInterval(pingTimer);
      pingTimer = window.setInterval(() => send({ type: "ping" }), PING_MS);
    };
    ws.onmessage = (event) => {
      armIdle();
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "ready") setStatus("open");
      if (message.type === "pong") return;
      onMessage(message);
    };
    ws.onclose = () => {
      window.clearInterval(pingTimer);
      window.clearTimeout(idleTimer);
      if (socket === ws) socket = null;
      schedule();
    };
    ws.onerror = () => ws.close();
  }

  function send(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function wake() {
    // Coming back online or to the foreground: retry now instead of waiting.
    if (stopped || socket) return;
    window.clearTimeout(retryTimer);
    attempt = 0;
    open();
  }

  window.addEventListener("online", wake);
  document.addEventListener("visibilitychange", wake);
  open();

  return {
    send,
    get status() { return status; },
    close() {
      stopped = true;
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", wake);
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      window.clearTimeout(idleTimer);
      socket?.close();
      socket = null;
      setStatus("idle");
    },
  };
}
