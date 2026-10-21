// Defensive parsing of AI-generated JSON stored in project_plans.
export type Phase = {
  title?: string;
  objective?: string;
  description?: string;
  actions: string[];
  priority?: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function toText(v: unknown): string | undefined {
  if (typeof v === "string") return str(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const main = str(o.title) ?? str(o.action) ?? str(o.risk) ?? str(o.name) ?? str(o.description);
    const extra = str(o.mitigation) ?? (main !== str(o.description) ? str(o.description) : undefined);
    if (main) return extra ? `${main} — ${extra}` : main;
  }
  return undefined;
}

export function parseList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(toText).filter((x): x is string => !!x);
}

export function parsePhases(v: unknown): Phase[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p): Phase | null => {
      if (typeof p === "string") return str(p) ? { title: p, actions: [] } : null;
      if (!p || typeof p !== "object") return null;
      const o = p as Record<string, unknown>;
      const phase: Phase = {
        title: str(o.title) ?? str(o.name),
        objective: str(o.objective),
        description: str(o.description),
        actions: parseList(o.actions),
        priority: str(o.priority),
      };
      return phase.title || phase.description || phase.objective || phase.actions.length ? phase : null;
    })
    .filter((x): x is Phase => !!x);
}
