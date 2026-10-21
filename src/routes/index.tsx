import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { createRequest, listRequests } from "@/lib/plans.functions";
import { StatusBadge, formatDate } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const requestsQuery = queryOptions({ queryKey: ["requests"], queryFn: () => listRequests() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlanCraft AI — Turn your ideas into actionable plans" },
      { name: "description", content: "Describe your idea and get a structured plan with phases, next steps and risks." },
      { property: "og:title", content: "PlanCraft AI — Turn your ideas into actionable plans" },
      { property: "og:description", content: "Describe your idea and get a structured plan with phases, next steps and risks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-2 rounded-full bg-primary" /> Turn your ideas into actionable plans
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
          PlanCraft <span className="text-primary">AI</span>
        </h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">
          Transform your ideas into structured plans and practical next steps.
        </p>
        <ol className="mt-6 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {["Describe your idea", "Generate a plan", "Review the result"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-secondary font-display text-xs font-semibold text-secondary-foreground">{i + 1}</span>
              {s}
              {i < 2 && <span aria-hidden className="text-border">→</span>}
            </li>
          ))}
        </ol>
      </header>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <CreateForm />
        <MyPlans />
      </div>
    </main>
  );
}

function CreateForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", goal: "", additional_context: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (d: typeof form) => createRequest({ data: d }),
    onSuccess: (row) => {
      setSavedId(row.id);
      setForm({ title: "", description: "", goal: "", additional_context: "" });
      qc.invalidateQueries({ queryKey: ["requests"] });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (m.isPending) return;
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Please enter a project title.";
    if (!form.description.trim()) errs.description = "Please describe your project.";
    setErrors(errs);
    setSavedId(null);
    if (Object.keys(errs).length === 0) m.mutate(form);
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  return (
    <section aria-labelledby="create" className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h2 id="create" className="font-display text-xl font-semibold">Create a plan</h2>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <Field id="title" label="Project Title" required error={errors.title}>
          <Input id="title" value={form.title} onChange={set("title")} maxLength={200} placeholder="Launch a handmade accessories store" aria-invalid={!!errors.title} />
        </Field>
        <Field id="description" label="Project Description" required error={errors.description}>
          <Textarea id="description" value={form.description} onChange={set("description")} maxLength={5000} rows={4} placeholder="Explain your idea and what you want to achieve." aria-invalid={!!errors.description} />
        </Field>
        <Field id="goal" label="Main Goal">
          <Input id="goal" value={form.goal} onChange={set("goal")} maxLength={500} placeholder="Optional" />
        </Field>
        <Field id="ctx" label="Additional Context">
          <Textarea id="ctx" value={form.additional_context} onChange={set("additional_context")} maxLength={5000} rows={3} placeholder="Constraints, budget, audience… (optional)" />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={m.isPending}>
          {m.isPending ? "Saving…" : "Generate My Plan"}
        </Button>
        {m.isError && <p role="alert" className="text-sm text-destructive">{m.error.message}</p>}
        {savedId && (
          <div role="status" className="rounded-lg border border-status-completed/30 bg-status-completed/10 p-3 text-sm">
            <p className="font-medium">Your request was saved.</p>
            <p className="mt-1 text-muted-foreground">AI plan generation will be available once the automation workflow is connected.</p>
            <Link to="/plans/$id" params={{ id: savedId }} className="mt-2 inline-block font-medium text-primary underline-offset-4 hover:underline">Open request →</Link>
          </div>
        )}
      </form>
    </section>
  );
}

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function MyPlans() {
  const q = useQuery(requestsQuery);
  return (
    <section aria-labelledby="mine">
      <h2 id="mine" className="font-display text-xl font-semibold">My Plans</h2>
      <div className="mt-5 space-y-3">
        {q.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        {q.isError && (
          <div className="rounded-xl border border-destructive/30 p-4 text-sm">
            <p className="text-destructive">{q.error.message}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>Retry</Button>
          </div>
        )}
        {q.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No plans yet. Describe your first idea to get started.</p>
        )}
        {q.data?.map((r) => (
          <Link key={r.id} to="/plans/$id" params={{ id: r.id }} className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">{r.title}</h3>
              <StatusBadge status={r.status} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
