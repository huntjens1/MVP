import React, { useState } from "react";
import type { TicketSkeleton } from "../api/index";

type Tab = "actions" | "suggestions" | "ticket";

export default function RightPanel({
  nextActions,
  runbook,
  suggestions,
  ticket,
}: {
  nextActions: string[];
  runbook: string[];
  suggestions: string[];
  ticket: TicketSkeleton | null;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  return (
    <aside>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <TabBtn active={tab === "actions"} onClick={() => setTab("actions")}>
          Next Actions
        </TabBtn>
        <TabBtn active={tab === "suggestions"} onClick={() => setTab("suggestions")}>
          Suggesties
        </TabBtn>
        <TabBtn active={tab === "ticket"} onClick={() => setTab("ticket")}>
          Ticket
        </TabBtn>
      </div>

      {tab === "actions" && (
        <section style={{ display: "grid", gap: 10 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>Next-Best-Actions</h3>
          {nextActions.length === 0 ? (
            <Empty text="Nog geen acties…" />
          ) : (
            <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
              {nextActions.map((s, i) => (
                <li key={i} className="rp-card">
                  {s}
                </li>
              ))}
            </ul>
          )}
          {runbook.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, margin: "6px 0 0", opacity: 0.8 }}>Runbook</h4>
              <ol style={{ paddingLeft: 18, marginTop: 6 }}>
                {runbook.map((s, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {s}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      )}

      {tab === "suggestions" && (
        <section>
          <h3 style={{ fontSize: 18, margin: 0 }}>AI Vraagsuggesties</h3>
          {suggestions.length === 0 ? (
            <Empty text="Nog geen suggesties…" />
          ) : (
            <ul style={{ display: "grid", gap: 8, padding: 0, listStyle: "none" }}>
              {suggestions.map((s, i) => (
                <li key={i} className="rp-card">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "ticket" && (
        <section style={{ display: "grid", gap: 8 }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>Ticket Skeleton</h3>
          {!ticket ? (
            <Empty text="Nog geen skeleton…" />
          ) : (
            <div className="rp-card">
              <KV k="Titel" v={ticket.title} />
              <KV k="Prioriteit" v={`${ticket.priority} (TTR ~${ticket.ttr_minutes}m)`} />
              <KV k="Impact/Urgentie" v={`${ticket.impact} / ${ticket.urgency}`} />
              <KV k="Categorie" v={ticket.category} />
              <KV k="CI" v={ticket.ci || "n.b."} />
              <KV k="Tags" v={(ticket.tags || []).join(", ")} />
              <div style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Beschrijving</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</div>
              </div>
            </div>
          )}
        </section>
      )}
    </aside>
  );
}

function TabBtn({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        background: active ? "#111827" : "#fff",
        color: active ? "#fff" : "#111827",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 8, margin: "4px 0" }}>
      <div style={{ minWidth: 110, fontWeight: 600 }}>{k}</div>
      <div>{v}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ opacity: 0.6 }}>{text}</div>;
}
