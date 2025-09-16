import { useEffect, useRef, useState } from "react";
import api, { type TicketSkeleton, type TicketOverrides } from "../api";
import { startMicPcm16k, type MicStopper } from "../lib/capturePcm16k";
import { maskPII } from "../utils/pii";
import RightPanel, { type Classification } from "./RightPanel";
import { createSSEClient } from "../lib/sseClient";

type DGAlt = { transcript?: string; words?: Array<{ speaker?: number }> };
type DGRealtime =
  | { channel?: { alternatives?: DGAlt[]; is_final?: boolean }; alternatives?: DGAlt[]; is_final?: boolean }
  | any;

type Segment = { id: string; speaker: "Agent" | "Klant"; text: string; final: boolean; flagged: boolean };

export default function CallLogixTranscriptie() {
  const [recording, setRecording] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState<string>("");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [runbook, setRunbook] = useState<string[]>([]);
  const [ticket, setTicket] = useState<TicketSkeleton | null>(null);
  const [slaBadge, setSlaBadge] = useState<string>("P4 · TTR ~48u");
  const [summary, setSummary] = useState<string>("");

  const [classif, setClassif] = useState<Classification>({
    type: "Incident",
    impact: "Low",
    urgency: "Medium",
    priority: "P4",
    ci: "",
  });

  const wsRef = useRef<WebSocket | null>(null);
  const micStopRef = useRef<MicStopper | null>(null);
  const convoIdRef = useRef<string>("");
  const sseSuggestRef = useRef<ReturnType<typeof createSSEClient> | null>(null);
  const sseAssistRef = useRef<ReturnType<typeof createSSEClient> | null>(null);
  const debounceTicket = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [coach, setCoach] = useState<string>("");
  const lastContextRef = useRef<string>("");

  const [sseStatus, setSseStatus] = useState<"connecting" | "open" | "reconnecting" | "closed">("closed");

  useEffect(() => () => { void stopRecording(); }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!recording) return;
      const idle = Date.now() - lastActivityRef.current;
      setCoach(idle > 8000 ? "Tip: vat samen of stel een verduidelijkingsvraag." : "");
    }, 2000);
    return () => clearInterval(iv);
  }, [recording]);

  function buildWsUrl(token: string) {
    const base = (import.meta.env.VITE_API_BASE_URL as string) || "";
    const wssBase = base.replace(/^http/i, "ws");
    const url = new URL(`${wssBase}/ws/mic`);
    url.searchParams.set("conversation_id", convoIdRef.current);
    url.searchParams.set("token", token);
    url.searchParams.set("codec", "linear16");
    url.searchParams.set("sample_rate", "16000");
    url.searchParams.set("language", "nl");
    url.searchParams.set("model", "nova-2");
    url.searchParams.set("smart_format", "true");
    url.searchParams.set("interim_results", "true");
    url.searchParams.set("diarize", "true");
    return url.toString();
  }

  function onWsMessage(ev: MessageEvent) {
    const handleString = (s: string) => { try { handleDG(JSON.parse(s)); } catch {} };
    if (typeof ev.data === "string") return handleString(ev.data);
    if (ev.data instanceof ArrayBuffer) {
      const txt = new TextDecoder().decode(new Uint8Array(ev.data));
      return handleString(txt);
    }
    if ((ev.data as any)?.text) (ev.data as Blob).text().then(handleString).catch(() => {});
  }

  async function handleDG(msg: DGRealtime) {
    const isFinal = Boolean(msg?.channel?.is_final ?? msg?.is_final ?? false);
    const alt: DGAlt | undefined = msg?.channel?.alternatives?.[0] ?? msg?.alternatives?.[0];
    const textRaw = (alt?.transcript || "").trim();
    if (!textRaw && !isFinal) return;

    lastActivityRef.current = Date.now();

    let speaker: "Agent" | "Klant" = "Klant";
    const sp = alt?.words?.find((w) => typeof w.speaker === "number")?.speaker;
    if (sp === 1) speaker = "Agent";

    if (isFinal) {
      setInterim("");
      if (textRaw) {
        const { masked, flagged } = maskPII(textRaw);
        setSegments((list) => {
          const seg: Segment = { id: crypto.randomUUID(), speaker, text: masked, final: true, flagged };
          const next = [...list, seg];
          const ctx = lastN(next, 4);
          lastContextRef.current = ctx;

          void api.suggest(convoIdRef.current, ctx).catch(() => {});
          void api.assist(convoIdRef.current, ctx).catch(() => {});
          if (debounceTicket.current) window.clearTimeout(debounceTicket.current);
          debounceTicket.current = window.setTimeout(() => rebuildTicket(ctx), 1200);

          return next;
        });
      }
    } else {
      const { masked } = maskPII(textRaw);
      setInterim(masked);
    }
  }

  function priFromIU(urg: Classification["urgency"], imp: Classification["impact"]): Classification["priority"] {
    const map = { Low: 4, Medium: 3, High: 2, Critical: 1 } as const;
    const u = map[urg] ?? 3;
    const i = map[imp] ?? 4;
    const p = Math.min(4, Math.max(1, Math.round((u + i) / 2)));
    return `P${p}` as Classification["priority"];
  }

  function formatTTR(mins: number) {
    if (mins % 60 === 0) return `${Math.round(mins / 60)}u`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}u${m}m` : `${m}m`;
  }

  function lastN(list: Segment[], n: number) {
    return list.slice(-n).map((s) => `${s.speaker}: ${s.text}`).join("\n");
  }

  // ---------- SSE handlers ----------
  const parseJSON = (raw: any) => { try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return {}; } };

  function fallbackQuestions(ctx: string): string[] {
    const q: string[] = [];
    const low = ctx.toLowerCase();
    if (low.includes("inlog")) q.push("Krijgt u een foutmelding bij het inloggen? Zo ja, welke exacte melding?");
    if (low.includes("netwerk")) q.push("Werkt het op een ander netwerk of via hotspot? Kunt u een ping/gateway-test proberen?");
    if (low.includes("email") || low.includes("mail")) q.push("Gaat het om de e-mailclient of webmail? En welke account/omgeving?");
    q.push("Sinds wanneer speelt dit en is er kort ervoor iets gewijzigd (update/wijziging)?");
    q.push("Op hoeveel gebruikers/locaties treedt dit op (impact)?");
    q.push("Welke stappen zijn al geprobeerd en met welk resultaat?");
    return Array.from(new Set(q));
  }

  function handleSuggestionsEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const cid = d.conversation_id ?? d.conversationId ?? null;
    if (cid && cid !== convoIdRef.current) return;
    const list = d.suggestions ?? d.items ?? d.list ?? d.payload?.suggestions ?? (Array.isArray(d) ? d : []);
    let out = Array.isArray(list) ? list : [];
    if (out.length < 3) out = [...out, ...fallbackQuestions(lastContextRef.current)];
    setSuggestions(Array.from(new Set(out)).slice(0, 6));
  }

  function handleAssistEvent(raw: any) {
    const d: any = parseJSON(raw) ?? {};
    const
