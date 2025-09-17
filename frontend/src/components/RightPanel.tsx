import React, { useMemo, useState } from "react";
import type { TicketSkeleton } from "../api";

type Tab = "actions" | "suggestions" | "ticket" | "summary";

export type Classification = {
  type: "Incident" | "Service Request";
  impact: "Low" | "Medium" | "High" | "Critical";
  urgency: "Low" | "Medium" | "High" | "Critical";
  priority: "P1" | "P2" | "P3" | "P4";
  ci?: string;
};

const DEFAULT_CLASSIFICATION: Classification = {
  type: "Incident",
  impact: "Low",
  urgency: "Low",
  priority: "P4",
  ci: "",
};

export default function RightPanel({
  nextActions = [],
  runbook = [],
  suggestions = [],
  ticket = null,
  classification = DEFAULT_CLASSIFICATION,
  onClassificationChange = () => {},
  onRebuildTicket = () => {},
  summary = "",
  onSummarize = () => {},
}: {
  nextActions?: string[];
  runbook?: string[];
  suggestions?: string[];
  ticket?: TicketSkeleton | null;
  classification?: Classification;
  onClassificationChange?: (c: Partial<Classification>) => void;
  onRebuildTicket?: () => void;
  summary?: string;
  onSummarize?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("actions");

  return (
    <aside
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        background: "#fff",
        padding: 12,
        position: "sticky",
        top: 0,
        height: "calc(100vh - 24px)",
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <TabBtn onClick={() => setTab("actions")} active={tab === "actions"}>Next-Best-Actions</TabBtn>
        <TabBtn onClick={() => setTab("suggestions")} active={tab === "suggestions"}>Suggesties</TabBtn>
        <TabBtn onClick={() => setTab("ticket")} active={tab === "ticket"}>Ticket</TabBtn>
        <TabBtn onClick={() => setTab("summary")} active={tab === "summary"}>Samenvatting</TabBtn>
      </div>

      {tab === "actions" && <Actions nextActions={nextActions} runbook={runbook} />}
      {tab === "suggestions" && <Suggestions suggestions={suggestions} />}
      {tab === "ticket" && (
        <TicketPanel
          ticket={ticket}
          classification={classification}
          onChange={onClassificationChange}
          onRebuild={onRebuildTicket}
        />
      )}
      {tab === "summary" && <SummaryPanel summary={summary} onSummarize={onSummarize} />}
    </aside>
  );
}

function Actions({ nextActions, runbook }: { nextActions: string[]; runbook: string[] }) {
  return (
    <div>
      <h3 style={{ margin: "6px 0 8px" }}>Volgende stappen</h3>
      {nextActions.length === 0 ? (
        <Empty text="Nog geen acties…" />
      ) : (
        <ol style={{ paddingLeft: 18 }}>
          {nextActions.map((a, i) => (<li key={i} style={{ margin: "6px 0" }}>{a}</li>))}
        </ol>
      )}

      {runbook.length > 0 && (
        <>
          <h4 style={{ marginTop: 14 }}>Runbook</h4>
          <ol style={{ paddingLeft: 18 }}>
            {runbook.map((s, i) => (<li key={i} style={{ margin: "4px 0" }}>{s}</li>))}
          </ol>
        </>
      )}

      <p style={{ marginTop: 12, opacity: .7 }}>
        <strong>Uitleg:</strong> <em>Next-Best-Actions</em> = concrete handelingen (doen). <em>Suggesties</em> = vragen om context te verzamelen (vragen).
      </p>
    </div>
  );
}

function Suggestions({ suggestions }: { suggestions: string[] }) {
  const min3 = useMemo(() => {
    const base = suggestions.filter(Boolean);
    while (base.length < 3) base.push("Heeft u een exacte foutmelding of referentie die we kunnen noteren?");
    return base.slice(0, 6);
  }, [suggestions]);

  return (
    <div>
      <h3 style={{ margin: "6px 0 8px" }}>AI Vraagsuggesties</h3>
      <ul style={{ paddingLeft: 14 }}>
        {min3.map((s, i) => (<li key={i} style={{ margin: "6px 0" }}>{s}</li>))}
      </ul>
    </div>
  );
}

function TicketPanel({
  ticket,
  classification,
  onChange,
  onRebuild,
}: {
  ticket: TicketSkeleton | null;
  classification: Classification;
  onChange: (c: Partial<Classification>) => void;
  onRebuild: () => void;
}) {
  return (
    <div>
      <h3 style={{ margin: "6px 0 12px" }}>Ticket skeleton</h3>

      <fieldset style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 10 }}>
        <legend style={{ padding: "0 6px" }}>ITILv4 intake</legend>

        <Row>
          <KV k="Type">
            <select value={classification.type} onChange={(e) => onChange({ type: e.target.value as any })}>
              <option>Incident</option>
              <option>Service Request</option>
            </select>
          </KV>
        </Row>

        <Row>
          <KV k="Impact">
            <SelectIUI value={classification.impact} onChange={(v) => onChange({ impact: v })} />
          </KV>
          <KV k="Urgency">
            <SelectIUI value={classification.urgency} onChange={(v) => onChange({ urgency: v })} />
          </KV>
          <KV k="Priority"><strong>{classification.priority}</strong></KV>
        </Row>

        <Row>
          <KV k="CI">
            <input
              value={classification.ci ?? ""}
              onChange={(e) => onChange({ ci: e.target.value })}
              placeholder="Configuration Item / systeem"
              style={{ width: "100%" }}
            />
          </KV>
        </Row>

        <button
          onClick={onRebuild}
          style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#111827", color: "#fff", fontWeight: 700, cursor: "pointer" }}
        >
          Herbereken ticket
        </button>
      </fieldset>

      {!ticket ? (
        <Empty text="Nog geen ticket…" />
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
          <KV k="Titel" v={ticket.title} />
          <KV k="Omschrijving" v={ticket.description || ticket.short_description || ticket.summary || "—"} />
          <KV k="Prioriteit" v={ticket.priority} />
          <KV k="CI" v={ticket.ci || "—"} />
          {ticket.tags?.length ? <KV k="Tags" v={ticket.tags.join(", ")} /> : null}
        </div>
      )}
    </div>
  );
}

function SummaryPanel({ summary, onSummarize }: { summary: string; onSummarize: () => void }) {
  return (
    <div>
      <h3 style={{ margin: "6px 0 8px" }}>Samenvatting</h3>
      <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
        <button
          onClick={onSummarize}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#111827", color: "#fff", fontWeight: 700 }}
        >
          Genereer samenvatting
        </button>
        {summary && (
          <button
            onClick={() => navigator.clipboard.writeText(summary)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontWeight: 700 }}
          >
            Kopieer
          </button>
        )}
      </div>
      {!summary ? <Empty text="Nog geen samenvatting…" /> : <p style={{ whiteSpace: "pre-wrap" }}>{summary}</p>}
    </div>
  );
}

function SelectIUI({
  value,
  onChange,
}: {
  value: "Low" | "Medium" | "High" | "Critical";
  onChange: (v: "Low" | "Medium" | "High" | "Critical") => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as any)}>
      <option>Low</option>
      <option>Medium</option>
      <option>High</option>
      <option>Critical</option>
    </select>
  );
}

function TabBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: props.active ? "#111827" : "#fff",
        color: props.active ? "#fff" : "#111827",
        fontWeight: 700,
        cursor: "pointer",
      }}
    />
  );
}

function KV({ k, v, children }: { k: string; v?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "4px 0" }}>
      <div style={{ minWidth: 110, fontWeight: 600 }}>{k}</div>
      <div style={{ flex: 1 }}>{children ?? v}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr", marginBottom: 6 }}>{children}</div>;
}
function Empty({ text }: { text: string }) {
  return <div style={{ opacity: 0.6 }}>{text}</div>;
}
