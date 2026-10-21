import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// All database access goes through these server functions using the
// server-only admin client. The tables have RLS enabled with no public
// policies, so the browser can never read or write them directly.

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  goal: z.string().trim().max(500).optional().nullable(),
  additional_context: z.string().trim().max(5000).optional().nullable(),
});

const idSchema = z.object({ id: z.string().uuid() });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const createRequest = createServerFn({ method: "POST" })
  .validator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db
      .from("project_requests")
      .insert({
        title: data.title,
        description: data.description,
        goal: data.goal || null,
        additional_context: data.additional_context || null,
      })
      .select("id")
      .single();
    if (error) throw new Error("Could not save your request.");
    return row;
  });

export const listRequests = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("project_requests")
    .select("id, title, description, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load your plans.");
  return data;
});

export const getRequest = createServerFn({ method: "GET" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: request, error } = await db
      .from("project_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Could not load this request.");
    if (!request) return null;
    const { data: plan, error: planErr } = await db
      .from("project_plans")
      .select("*")
      .eq("request_id", data.id)
      .maybeSingle();
    if (planErr) throw new Error("Could not load the plan.");
    return { request, plan };
  });

// Integration point for n8n. Not connected yet: when N8N_WEBHOOK_URL is
// configured, this will POST the request to n8n (with a shared secret),
// set status to "processing", and return immediately; n8n writes the plan
// to project_plans and the UI polls for the result.
export const triggerPlanGeneration = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const webhook = process.env["N8N_WEBHOOK_URL"];
    if (!webhook) {
      return {
        ok: false as const,
        message: "Plan generation is not connected yet. The n8n workflow still needs to be configured.",
      };
    }
    const db = await admin();
    const { data: req } = await db
      .from("project_requests")
      .select("id, title, description, goal, additional_context, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) return { ok: false as const, message: "Request not found." };
    if (req.status === "processing") {
      return { ok: false as const, message: "This plan is already being generated." };
    }
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-plancraft-secret": process.env["N8N_WEBHOOK_SECRET"] ?? "",
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(String(res.status));
      await db.from("project_requests").update({ status: "processing" }).eq("id", data.id);
      return { ok: true as const, message: "Plan generation started." };
    } catch {
      return { ok: false as const, message: "The automation service could not be reached. Please try again later." };
    }
  });
