import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
  if (!ok) throw new Error("Only admins can delete claims.");
}


const STATUSES = ["draft", "submitted", "accepted", "rejected", "closed"] as const;
const DOC_TYPES = ["commission_invoice", "storage_invoice", "claim_form", "other"] as const;

export const listClaims = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(STATUSES).optional(),
        search: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("claims")
      .select("*, documents:claim_documents(id,doc_type,file_path,file_name,file_size_bytes,created_at)")
      .is("deleted_at", null)
      .order("accident_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.search && data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(
        `customer_full_name.ilike.${s},customer_email.ilike.${s},customer_phone.ilike.${s},customer_address.ilike.${s},vehicle_reg.ilike.${s},claim_reference.ilike.${s},notes.ilike.${s}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

const claimInput = z.object({
  customer_full_name: z.string().min(1).max(200),
  customer_email: z.string().email().max(200).nullable().optional(),
  customer_phone: z.string().max(50).nullable().optional(),
  customer_address: z.string().max(1000).nullable().optional(),
  accident_date: z.string(),
  claim_submitted_date: z.string().nullable().optional(),
  vehicle_reg: z.string().max(30).nullable().optional(),
  claim_reference: z.string().max(100).nullable().optional(),
  commission_amount_pence: z.number().int().min(0).optional(),
  storage_amount_pence: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export const createClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => claimInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row, error } = await supabase
      .from("claims")
      .insert({
        ...data,
        customer_email: data.customer_email || null,
        customer_phone: data.customer_phone || null,
        customer_address: data.customer_address || null,
        claim_submitted_date: data.claim_submitted_date || null,
        vehicle_reg: data.vehicle_reg || null,
        claim_reference: data.claim_reference || null,
        notes: data.notes || null,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => claimInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabase
      .from("claims")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const updateClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(STATUSES) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const patch: any = { status: data.status };
    if (data.status === "closed") patch.closed_date = new Date().toISOString().slice(0, 10);
    const { data: row, error } = await supabase
      .from("claims")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const setClaimFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        field: z.enum(["commission", "storage"]),
        received: z.boolean(),
        amount_pence: z.number().int().min(0).nullable().optional(),
        received_date: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const today = new Date().toISOString().slice(0, 10);
    const patch: any = {};
    if (data.field === "commission") {
      patch.commission_received = data.received;
      patch.commission_received_date = data.received ? (data.received_date ?? today) : null;
      if (data.amount_pence != null) patch.commission_amount_pence = data.amount_pence;
    } else {
      patch.storage_received = data.received;
      patch.storage_received_date = data.received ? (data.received_date ?? today) : null;
      if (data.amount_pence != null) patch.storage_amount_pence = data.amount_pence;
    }
    const { data: row, error } = await supabase
      .from("claims")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("claims")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const addClaimDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        claim_id: z.string().uuid(),
        doc_type: z.enum(DOC_TYPES),
        file_path: z.string().min(1).max(500),
        file_name: z.string().min(1).max(300),
        file_size_bytes: z.number().int().nonnegative().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row, error } = await supabase
      .from("claim_documents")
      .insert({ ...data, uploaded_by: userId })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteClaimDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    // Fetch to also remove from storage
    const { data: doc } = await supabase
      .from("claim_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabase.from("claim_documents").delete().eq("id", data.id);
    if (error) throw error;
    if (doc?.file_path) {
      await supabase.storage.from("claim-documents").remove([doc.file_path]);
    }
    return { ok: true };
  });

export const getClaimDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ file_path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: signed, error } = await supabase.storage
      .from("claim-documents")
      .createSignedUrl(data.file_path, 60 * 60);
    if (error) throw error;
    return { url: signed?.signedUrl ?? "" };
  });
