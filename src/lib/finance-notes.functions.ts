import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance } from "@/lib/finance-perms";

export const listFinanceNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertFinance(supabase, userId);
    const { data: rows, error } = await supabase.from("finance_conversation_notes").select("*").eq("agreement_id", data.agreementId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.created_by))];
    const { data: authors } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
    return (rows ?? []).map((r) => ({ ...r, author: authors?.find((p) => p.id === r.created_by)?.full_name ?? "Staff" }));
  });

export const addFinanceNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), body: z.string().trim().min(1).max(5000), channel: z.enum(["note", "phone", "in_person", "email", "message"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertFinance(supabase, userId, "arrears");
    const { data: agreement } = await supabase.from("finance_agreements").select("id").eq("id", data.agreementId).is("deleted_at", null).maybeSingle();
    if (!agreement) throw new Error("Agreement not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("finance_conversation_notes").insert({ agreement_id: data.agreementId, body: data.body, channel: data.channel, created_by: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });