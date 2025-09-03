// Tenant helpers – named exports (geen default)

export function resolveTenantId(): string {
  try {
    const stored = localStorage.getItem("clx_tenant") || "";
    if (stored.trim()) return stored.trim(); // verwacht UUID of exacte naam
  } catch { /* ignore */ }

  const env = (import.meta as any).env?.VITE_DEFAULT_TENANT_ID as string | undefined;
  if (env && env.trim()) return env.trim();

  // Leeg -> backend geeft 400 (bewust, dwingt keuze)
  return "";
}

/**
 * Sla de tenant op (UUID of exacte naam). Default: pagina herladen zodat alle
 * volgende requests de juiste `x-tenant-id` header sturen.
 */
export function setTenantId(id: string, opts: { reload?: boolean } = {}): void {
  const { reload = true } = opts;
  const v = String(id || "").trim();
  if (!v) throw new Error("setTenantId: value is empty");
  localStorage.setItem("clx_tenant", v);
  if (reload && typeof window !== "undefined") window.location.reload();
}

/** Verwijder de gekozen tenant (voor debug/switch). */
export function clearTenantId(opts: { reload?: boolean } = {}): void {
  const { reload = true } = opts;
  try { localStorage.removeItem("clx_tenant"); } catch { /* ignore */ }
  if (reload && typeof window !== "undefined") window.location.reload();
}
