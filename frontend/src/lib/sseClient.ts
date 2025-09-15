// Production-ready SSE client (zonder class/private syntax) met auto-reconnect,
// exponential backoff + jitter en lastEventId-ondersteuning.

export type SSEHandlers = {
  onOpen?: () => void;
  onClose?: (reason?: string) => void;
  onError?: (err: any) => void;
  onEvent?: (ev: MessageEvent) => void; // ontvangt native MessageEvent
  onStatus?: (status: "connecting" | "open" | "reconnecting" | "closed") => void;
};

export type SSEClientOptions = {
  withCredentials?: boolean;
  channels?: string[]; // extra event-namen naast "message"
  minBackoffMs?: number; // default 500
  maxBackoffMs?: number; // default 10000
  maxJitterMs?: number;  // default 400
  // urlFactory kan lastEventId ontvangen (voor server-side resume)
  urlFactory: (lastEventId?: string) => string;
};

export type SSEClientHandle = {
  start: () => void;
  stop: (reason?: string) => void;
  status: () => "connecting" | "open" | "reconnecting" | "closed";
};

export function createSSEClient(opts: SSEClientOptions, h: SSEHandlers = {}): SSEClientHandle {
  let es: EventSource | null = null;
  let alive = false;
  let lastEventId: string | undefined;
  let attempt = 0;
  let state: "connecting" | "open" | "reconnecting" | "closed" = "closed";

  const setStatus = (s: typeof state) => {
    state = s;
    h.onStatus?.(s);
  };

  const stop = (reason = "client_stop") => {
    alive = false;
    try { es?.close(); } catch {}
    es = null;
    setStatus("closed");
    h.onClose?.(reason);
  };

  const scheduleReconnect = () => {
    attempt++;
    const min = opts.minBackoffMs ?? 500;
    const max = opts.maxBackoffMs ?? 10000;
    const jitter = opts.maxJitterMs ?? 400;
    const base = Math.min(max, min * Math.pow(2, attempt));
    const wait = base + Math.floor(Math.random() * jitter);
    setStatus("reconnecting");
    setTimeout(() => connect(), wait);
  };

  const connect = () => {
    if (!alive) return;
    const url = opts.urlFactory?.(lastEventId);
    setStatus(attempt === 0 ? "connecting" : "reconnecting");
    const next = new EventSource(url, { withCredentials: opts.withCredentials ?? true });
    es = next;

    next.onopen = () => {
      attempt = 0;
      setStatus("open");
      h.onOpen?.();
    };

    next.onmessage = (ev: MessageEvent) => {
      const anyEv = ev as any;
      if (anyEv && typeof anyEv.lastEventId === "string") lastEventId = anyEv.lastEventId;
      h.onEvent?.(ev);
    };

    next.onerror = (err) => {
      h.onError?.(err);
      if (!alive) return;
      try { next.close(); } catch {}
      es = null;
      scheduleReconnect();
    };

    const chans = opts.channels ?? [];
    chans.forEach((ch) => {
      next.addEventListener(ch, (ev: MessageEvent) => {
        const anyEv = ev as any;
        if (anyEv && typeof anyEv.lastEventId === "string") lastEventId = anyEv.lastEventId;
        h.onEvent?.(ev);
      });
    });
  };

  const start = () => {
    if (alive) return;
    alive = true;
    connect();
  };

  const status = () => state;

  return { start, stop, status };
}
