import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance } from "@/lib/finance-perms";

export const getMyAdminSignature = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertFinance(supabase, userId, undefined, true);
    const { data, error } = await supabase.from("admin_signatures").select("signed_name,signature_data,updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const saveMyAdminSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(3).max(120), signature: z.string().startsWith("data:image/png;base64,").max(400000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertFinance(supabase, userId, undefined, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_signatures").upsert({ user_id: userId, signed_name: data.name, signature_data: data.signature, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const applyMySignatureToFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ agreementId: z.string().uuid(), confirm: z.literal(true) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertFinance(supabase, userId, undefined, true);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signature, error: signatureError } = await supabaseAdmin.from("admin_signatures").select("signed_name,signature_data").eq("user_id", userId).maybeSingle();
    if (signatureError) throw new Error(signatureError.message);
    if (!signature) throw new Error("Save your signature in finance settings first.");
    const { data: agreement } = await supabaseAdmin.from("finance_agreements").select("id,status,company_signature_data").eq("id", data.agreementId).is("deleted_at", null).maybeSingle();
    if (!agreement || !["signed", "active", "completed", "defaulted", "settled", "terminated", "recovered", "closed"].includes(agreement.status)) throw new Error("The customer must sign the agreement first.");
    if (agreement.company_signature_data) throw new Error("This agreement already has an administrator signature.");
    const { snapshotFinance, logFinanceTx } = await import("@/lib/finance.server");
    const undoId = await snapshotFinance(data.agreementId, "Administrator signed", userId);
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("finance_agreements").update({ company_signature_data: signature.signature_data, company_signed_name: signature.signed_name, company_signed_by: userId, company_signed_at: now, updated_at: now }).eq("id", data.agreementId);
    if (error) throw new Error(error.message);
    await logFinanceTx(data.agreementId, "company_signed", { note: `Signed for company by ${signature.signed_name}`, by: userId, undoId });
    return { ok: true };
  });