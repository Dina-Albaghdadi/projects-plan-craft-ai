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
    const { data: existingPlan } = await db
      .from("project_plans")
      .select("id")
      .eq("request_id", data.id)
      .maybeSingle();
    if (existingPlan) {
      return { ok: false as const, message: "A plan already exists for this request." };
    }
    // Atomic claim: only one caller can move pending/failed -> processing,
    // so double clicks or parallel tabs cannot start two generations.
    const { data: claimed } = await db
      .from("project_requests")
      .update({ status: "processing" })
      .eq("id", data.id)
      .in("status", ["pending", "failed"])
      .select("id, status")
      .maybeSingle();
    if (!claimed) {
      const { data: cur } = await db.from("project_requests").select("status").eq("id", data.id).maybeSingle();
      if (!cur) return { ok: false as const, message: "Request not found." };
      return {
        ok: false as const,
        message: cur.status === "processing" ? "This plan is already being generated." : "This request can't be generated again.",
      };
    }
    const req = { id: data.id };
    const prevStatus = "pending";
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const secret = process.env["N8N_WEBHOOK_SECRET"];
      if (secret) headers["x-plancraft-secret"] = secret;
      const res = await fetch(webhook, {
        method: "POST",
        headers,
        body: JSON.stringify({ request_id: req.id }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        console.error(`n8n webhook failed [${res.status}]: ${await res.text()}`);
        throw new Error(String(res.status));
      }
      return { ok: true as const, message: "Your plan is being generated. This page will update when it's ready." };
    } catch (e) {
      console.error("n8n webhook error", e);
      await db.from("project_requests").update({ status: prevStatus }).eq("id", data.id);
      return { ok: false as const, message: "The automation service could not be reached. Please try again later." };
    }
  });
