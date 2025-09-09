// frontend/src/utils/itil.ts
export type Impact = "Low"|"Medium"|"High"|"Critical";
export type Urgency = "Low"|"Medium"|"High"|"Critical";
export type Priority = "P1"|"P2"|"P3"|"P4";

const MATRIX: Record<Impact, Record<Urgency, Priority>> = {
  Low:      { Low:"P4", Medium:"P4", High:"P3", Critical:"P3" },
  Medium:   { Low:"P4", Medium:"P3", High:"P2", Critical:"P2" },
  High:     { Low:"P3", Medium:"P2", High:"P2", Critical:"P1" },
  Critical: { Low:"P3", Medium:"P2", High:"P1", Critical:"P1" },
};
const TTR: Record<Priority, number> = { P1:60, P2:240, P3:1440, P4:2880 };

export function priorityOf(impact: Impact, urgency: Urgency): Priority {
  return (MATRIX[impact] && MATRIX[impact][urgency]) || "P4";
}
export function ttrMins(priority: Priority): number { return TTR[priority] ?? 2880; }
