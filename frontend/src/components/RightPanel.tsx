// frontend/src/components/RightPanel.tsx
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
        <TabBtn onClick={() => setTab("actions")} active={tab === "actions"}>
          Next-Best-Actions
        </TabBtn>
        <TabBtn onClick={() => setTab("suggestions")} active={tab === "suggestions"}>
          Suggesties
        </TabBtn>
        <TabBtn onClick={() => setTab("ticket")} active={tab === "ticket"}>
          Ticket
        </TabBtn>
      </div>

      {tab === "actions" && (
        <div>
          <h3 style={{ margin: "6px 0 8px" }}>Volgende stappen</h3>
          {nextActions.length === 0 ? (
            <Empty text="Nog geen acties…" />
          ) : (
            <ol style={{ paddingLeft: 18 }}>
              {nextActions.map((a, i) => (
                <li key={i} style={{ margin: "6px 0" }}>
                  {a}
                </li>
              ))}
            </ol>
          )}

          {runbook.length > 0 && (
            <>
              <h4 style={{ marginTop: 14 }}>Runbook</h4>
              <ol style={{ paddingLeft: 18 }}>
                {runbook.map((s, i) => (
                  <li key={i} style={{ margin: "4px 0" }}>
                    {s}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {tab === "suggestions" && (
        <div>
          <h3 style={{ margin: "6px 0 8px" }}>AI Vraagsuggesties</h3>
          {suggestions.length === 0 ? (
            <Empty text="Nog geen suggesties…" />
          ) : (
            <ul style={{ paddingLeft: 14 }}>
              {suggestions.map((s, i) => (
                <li key={i} style={{ margin: "6px 0" }}>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "ticket" && (
        <div>
          <h3 style={{ margin: "6px 0 8px" }}>Ticket skeleton</h3>
          {!ticket ? (
            <Empty text="Nog geen ticket…" />
          ) : (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
              <KV k="Titel" v={ticket.title} />
              <KV k="Omschrijving" v={ticket.description || ticket.short_description || ticket.summary || "—"} />
              <KV k="Prioriteit" v={ticket.priority} />
              <KV
                k="TTR"
                v={
                  typeof ticket.ttr_minutes === "number"
                    ? `${Math.round(ticket.ttr_minutes / 60)}u`
                    : typeof ticket.ttr_hours === "number"
                    ? `${ticket.ttr_hours}u`
                    : ticket.priority === "P1"
                    ? "4u"
                    : ticket.priority === "P2"
                    ? "8u"
                    : ticket.priority === "P3"
                    ? "24u"
                    : "48u"
                }
              />
              <KV k="CI" v={ticket.ci || "—"} />
              {ticket.tags?.length ? <KV k="Tags" v={ticket.tags.join(", ")} /> : null}
            </div>
          )}
        </div>
      )}
    </aside>
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
