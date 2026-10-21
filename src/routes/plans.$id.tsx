import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getRequest, triggerPlanGeneration } from "@/lib/plans.functions";
import { parseList, parsePhases } from "@/lib/plan-shape";
import { StatusBadge, formatDate } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/plans/$id")({
  head: () => ({
    meta: [
      { title: "Project plan — PlanCraft AI" },
      { name: "description", content: "Review your project request and its structured plan." },
      { property: "og:title", content: "Project plan — PlanCraft AI" },
      { property: "og:description", content: "Review your project request and its structured plan." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest({ data: { id } }),
    retry: false,
    refetchInterval: (query) => (query.state.data?.request.status === "processing" ? 5000 : false),
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const r = await triggerPlanGeneration({ data: { id } });
      setMsg(r.message);
      if (r.ok) q.refetch();
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm font-medium text-primary hover:underline">← Back to My Plans</Link>
      {q.isPending && <Skeleton className="mt-6 h-64 rounded-2xl" />}
      {(q.isError || q.data === null) && (
        <p className="mt-6 rounded-xl border border-border p-6 text-muted-foreground">
          {q.isError ? "This request couldn't be loaded." : "This request doesn't exist."}
        </p>
      )}
      {q.data && (
        <>
          <article className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight">{q.data.request.title}</h1>
              <StatusBadge status={q.data.request.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Created {formatDate(q.data.request.created_at)}</p>
            <Detail label="Description" value={q.data.request.description} />
            <Detail label="Main goal" value={q.data.request.goal} />
            <Detail label="Additional context" value={q.data.request.additional_context} />
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!q.data.plan && q.data.request.status !== "completed" && (
                <Button onClick={generate} disabled={busy || q.data.request.status === "processing"}>
                  {busy ? "Starting…" : "Generate My Plan"}
                </Button>
              )}
              {msg && q.data.request.status !== "completed" && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
            </div>
          </article>
          {q.data.request.status === "processing" ? (
            <p role="status" className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Your plan is being generated. This page checks for updates every few seconds.
            </p>
          ) : q.data.request.status === "failed" ? (
            <p role="alert" className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
              Plan generation failed. Please try again.
            </p>
          ) : null}
          {q.data.plan && q.data.request.status !== "processing" ? <PlanView plan={q.data.plan} /> : (!q.data.plan && q.data.request.status !== "processing" && q.data.request.status !== "failed") ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              This request has been saved. Click "Generate My Plan" to create it.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2>
      <p className="mt-1 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

type Plan = { summary: string; project_goal: string | null; phases: unknown; recommended_actions: unknown; risks: unknown; estimated_duration: string | null };

function PlanView({ plan }: { plan: Plan }) {
  const phases = parsePhases(plan.phases);
  const actions = parseList(plan.recommended_actions);
  const risks = parseList(plan.risks);
  return (
    <div className="mt-8 space-y-6">
      <Section title="Summary"><p className="whitespace-pre-wrap">{plan.summary}</p></Section>
      {plan.project_goal && <Section title="Project goal"><p>{plan.project_goal}</p></Section>}
      {plan.estimated_duration && <Section title="Estimated duration"><p className="font-display text-lg font-semibold">{plan.estimated_duration}</p></Section>}
      {phases.length > 0 && (
        <Section title="Execution phases">
          <ol className="space-y-3">
            {phases.map((p, i) => (
              <li key={i} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold"><span className="text-primary">{i + 1}.</span> {p.title ?? `Phase ${i + 1}`}</h3>
                  {p.priority && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{p.priority}</span>}
                </div>
                {p.objective && <p className="mt-1 text-sm"><span className="font-medium">Objective:</span> {p.objective}</p>}
                {p.description && <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>}
                {p.actions.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{p.actions.map((a, j) => <li key={j}>{a}</li>)}</ul>}
              </li>
            ))}
          </ol>
        </Section>
      )}
      {actions.length > 0 && <Section title="Recommended actions"><ul className="list-disc space-y-1 pl-5">{actions.map((a, i) => <li key={i}>{a}</li>)}</ul></Section>}
      {risks.length > 0 && <Section title="Risks and considerations"><ul className="list-disc space-y-1 pl-5">{risks.map((a, i) => <li key={i}>{a}</li>)}</ul></Section>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
