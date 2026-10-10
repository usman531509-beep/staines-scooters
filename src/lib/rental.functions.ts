import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";
import { isWeekDue } from "@/lib/rental-due";
import { assertOnlinePaymentsEnabled } from "@/lib/online-payments";


// ------ role helpers -------------------------------------------------------
async function isStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
}
async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
}
async function assertStaff(supabase: any, userId: string) {
  if (!(await isStaff(supabase, userId))) throw new Error("Forbidden");
}
async function assertAdmin(supabase: any, userId: string) {
  if (!(await isAdmin(supabase, userId))) throw new Error("Admins only.");
}

// ------ date helpers -------------------------------------------------------
function toDate(iso: string): Date {
  // Treat as UTC midnight to avoid timezone drift.
  return new Date(iso + "T00:00:00Z");
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setUTCDate(nd.getUTCDate() + n);
  return nd;
}
/** Schedule horizon: today only — the next week is not pre-created. */
function billingHorizonIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function mondayOf(d: Date): Date {
  // Billing weeks always run Monday → Sunday.
  const dow = d.getUTCDay(); // 0=Sun
  const off = (dow + 6) % 7; // days since Monday
  return addDays(d, -off);
}
// The day the finished week is actually collected: first `billingDay` weekday
// on/after the Sunday the week ended (0=Sun, 1=Mon ... 6=Sat).
function chargeDateOf(weekEnd: Date, billingDay: number): Date {
  const off = (billingDay - weekEnd.getUTCDay() + 7) % 7;
  return addDays(weekEnd, off);
}

// Compute weeks that should exist for a rental up to `upToDate` (inclusive).
// Rent is collected in arrears: a week only becomes payable once it has ended
// and the admin's chosen collection day has arrived.
function computeWeeks(
  startIso: string,
  endIso: string | null,
  upToIso: string,
  weeklyRate: number,
  billingDay = 1,
) {
  const start = toDate(startIso);
  const end = endIso ? toDate(endIso) : null;
  const upTo = toDate(upToIso);

  let weekStart = mondayOf(start);
  const rows: { week_start: string; week_end: string; days_charged: number; amount_pence: number }[] = [];
  let isFirst = true;
  // Guard against runaway loops.
  for (let i = 0; i < 520; i++) {
    const weekEnd = addDays(weekStart, 6);
    if (end && weekStart > end) break;
    // Show the period as soon as it has started; collection still happens on
    // the billing day after the week ends.
    if (weekStart > upTo) break;

    // Full weeks are charged in full; the first (and any partial final) week
    // is prorated by days — the hire day itself is free.
    const from = isFirst ? addDays(start, 1) : weekStart;
    const to = end && end < weekEnd ? end : weekEnd;
    const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    if (days > 0) {
      rows.push({
        week_start: toIso(weekStart),
        week_end: toIso(weekEnd),
        days_charged: days,
        amount_pence: days >= 7 ? weeklyRate : Math.round((weeklyRate * days) / 7),
      });
    }
    weekStart = addDays(weekStart, 7);
    isFirst = false;
  }
  return rows;
}


// Ensure weeks are inserted up to today (idempotent).
async function ensureWeeks(supabase: any, rentalId: string) {
  const { data: r, error } = await supabase.from("rentals").select("*").eq("id", rentalId).maybeSingle();
  if (error || !r) return;
  const today = billingHorizonIso(); // include the upcoming week so the next payment is pre-set
  const rows = computeWeeks(r.start_date, r.end_date, today, r.weekly_rate_pence, r.billing_day ?? 1);
  if (!rows.length) return;
  // Upsert; unique constraint on (rental_id, week_start)
  await supabase.from("rental_weeks").upsert(
    rows.map((w) => ({ rental_id: rentalId, ...w })),
    { onConflict: "rental_id,week_start", ignoreDuplicates: true },
  );
}

/**
 * Recompute the ledger after the rental period / rate / billing day changes.
 * Paid weeks are never touched. Unpaid weeks that no longer exist in the new
 * schedule are removed, mismatched ones are corrected, and new ones inserted.
 */
async function resyncWeeks(supabase: any, rentalId: string) {
  const { data: r } = await supabase.from("rentals").select("*").eq("id", rentalId).maybeSingle();
  if (!r) return;
  const today = billingHorizonIso(); // include the upcoming week so the next payment is pre-set
  const rows = computeWeeks(r.start_date, r.end_date, today, r.weekly_rate_pence, r.billing_day ?? 1);
  const byStart = new Map(rows.map((w) => [w.week_start, w]));

  const { data: existing } = await supabase
    .from("rental_weeks")
    .select("id, week_start, week_end, days_charged, amount_pence, status, deleted_at")
    .eq("rental_id", rentalId);

  const live = (existing ?? []).filter((w: any) => !w.deleted_at);
  for (const w of live) {
    if (w.status === "paid") continue;
    const target = byStart.get(w.week_start);
    if (!target) {
      await supabase.from("rental_weeks").delete().eq("id", w.id);
      continue;
    }
    if (
      w.week_end !== target.week_end ||
      w.days_charged !== target.days_charged ||
      w.amount_pence !== target.amount_pence
    ) {
      await supabase
        .from("rental_weeks")
        .update({
          week_end: target.week_end,
          days_charged: target.days_charged,
          amount_pence: target.amount_pence,
        })
        .eq("id", w.id);
    }
  }

  if (rows.length) {
    await supabase.from("rental_weeks").upsert(
      rows.map((w) => ({ rental_id: rentalId, ...w })),
      { onConflict: "rental_id,week_start", ignoreDuplicates: true },
    );
  }
}


// ============ SETTINGS =====================================================
export const getRentalSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase.from("rental_settings").select("*").maybeSingle();
    return data ?? { default_weekly_rate_pence: 6000, default_deposit_pence: 20000, default_billing_day: 1 };
  });

export const updateRentalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        default_weekly_rate_pence: z.number().int().min(0),
        default_deposit_pence: z.number().int().min(0),
        default_billing_day: z.number().int().min(0).max(6).default(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: row, error } = await supabase
      .from("rental_settings")
      .update({ ...data, updated_by: userId })
      .eq("id", true)
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

// ============ BIKES ========================================================
export const listBikes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("rental_bikes")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertBike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        make: z.string().min(1).max(100),
        model: z.string().max(100).nullable().optional().default(""),
        registration: z.string().min(1).max(20),
        year: z.number().int().min(1900).max(2100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { data: row, error } = await supabase.from("rental_bikes").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase.from("rental_bikes").insert({ ...data, created_by: userId }).select("*").single();
    if (error) throw error;
    return row;
  });

export const deleteBike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("rental_bikes")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId, active: false })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ RENTALS ======================================================
export const listRentals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["active", "ended", "all"]).default("all"), search: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("rentals")
      .select("*, bike:rental_bikes(id,make,model,registration), rental_customer:rental_customers(id,full_name,email,phone)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    // ensure weeks up-to-date for each active rental
    for (const r of rows ?? []) {
      if (r.status === "active") await ensureWeeks(supabase, r.id);
    }
    const uids = Array.from(new Set((rows ?? []).map((r: any) => r.customer_id).filter(Boolean)));
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", uids)
      : { data: [] as any[] };
    const byId = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    let out = (rows ?? []).map((r: any) => ({ ...r, customer: byId[r.customer_id] ?? r.rental_customer ?? null }));

    if (data.search?.trim()) {
      const s = data.search.trim().toLowerCase();
      out = out.filter((r: any) =>
        [r.customer?.full_name, r.customer?.email, r.customer?.phone, r.bike?.registration, r.bike?.model, r.notes]
          .some((v: string) => (v ?? "").toString().toLowerCase().includes(s)),
      );
    }
    return out;
  });

export const getRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: rental, error } = await supabase
      .from("rentals")
      .select("*, bike:rental_bikes(*), rental_customer:rental_customers(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!rental) throw new Error("Rental not found");
    await assertStaff(supabase, userId);
    await ensureWeeks(supabase, rental.id);
    const [{ data: weeks }, { data: payments }, { data: docs }, { data: pcns }, prof] = await Promise.all([
      supabase.from("rental_weeks").select("*").eq("rental_id", rental.id).is("deleted_at", null).order("week_start"),
      supabase.from("rental_payments").select("*").eq("rental_id", rental.id).order("paid_at", { ascending: false }),
      supabase.from("rental_documents").select("*").eq("rental_id", rental.id).order("uploaded_at", { ascending: false }),
      supabase.from("rental_pcns").select("*").eq("rental_id", rental.id).is("deleted_at", null).order("issued_on", { ascending: false }),
      rental.customer_id
        ? supabase.from("profiles").select("id,full_name,email,phone,address").eq("id", rental.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      rental,
      weeks: weeks ?? [],
      payments: payments ?? [],
      documents: docs ?? [],
      pcns: pcns ?? [],
      profile: (prof as any)?.data ?? rental.rental_customer ?? null,
    };

  });

const rentalInput = z.object({
  rental_customer_id: z.string().uuid().nullable().optional(),
  bike_id: z.string().uuid().nullable().optional(),
  start_date: z.string(),
  end_date: z.string().nullable().optional(),
  weekly_rate_pence: z.number().int().min(0),
  deposit_pence: z.number().int().min(0),
  billing_day: z.number().int().min(0).max(6).optional(),
  notes: z.string().max(4000).nullable().optional(),
});


export const createRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rentalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row, error } = await supabase
      .from("rentals")
      .insert({ ...data, created_by: userId })
      .select("*")
      .single();
    if (error) throw error;
    await ensureWeeks(supabase, row.id);
    return row;
  });

export const updateRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rentalInput.partial().extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabase.from("rentals").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    const scheduleChanged =
      "start_date" in patch || "end_date" in patch || "weekly_rate_pence" in patch || "billing_day" in patch;
    if (scheduleChanged) await resyncWeeks(supabase, id);
    else await ensureWeeks(supabase, id);
    return row;
  });

export const endRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), end_date: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("rentals").update({ status: "ended", end_date: data.end_date }).eq("id", data.id);
    if (error) throw error;
    // Resync (not just ensure) so any unpaid weeks that fall after the end date are removed.
    await resyncWeeks(supabase, data.id);
    return { ok: true };
  });

export const deleteRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("rentals")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Permanently erase a rental and every trace of it (weeks, payments, PCNs, documents + files). */
export const purgeRental = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.id;

    // Remove stored document files first, then all child rows, then the rental.
    const { data: docs } = await supabaseAdmin
      .from("rental_documents")
      .select("storage_path")
      .eq("rental_id", id);
    const paths = (docs ?? []).map((d: any) => d.storage_path).filter(Boolean);
    if (paths.length) {
      await supabaseAdmin.storage.from("rental-documents").remove(paths);
    }

    for (const table of ["rental_documents", "rental_weeks", "rental_payments", "rental_pcns"] as const) {
      const { error } = await supabaseAdmin.from(table).delete().eq("rental_id", id);
      if (error) throw error;
    }
    const { error } = await supabaseAdmin.from("rentals").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  });

// ============ MANUAL PAYMENTS / DEPOSIT ====================================
export const markWeekPaidManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        week_id: z.string().uuid(),
        method: z.enum(["cash", "card", "bank_transfer", "other"]).default("cash"),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: wk } = await supabase.from("rental_weeks").select("*").eq("id", data.week_id).maybeSingle();
    if (!wk) throw new Error("Week not found");
    if (wk.status === "paid") throw new Error("Already paid");
    const paidAt = new Date().toISOString();
    await supabase.from("rental_weeks").update({ status: "paid", paid_at: paidAt }).eq("id", wk.id);
    await supabase.from("rental_payments").insert({
      rental_id: wk.rental_id,
      week_id: wk.id,
      amount_pence: wk.amount_pence,
      kind: "weekly",
      method: data.method,
      paid_at: paidAt,
      note: data.note ?? null,
      recorded_by: userId,
    });
    return { ok: true };
  });

/** Admin: revert a week back to unpaid and remove its recorded payments. */
export const markWeekUnpaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: wk } = await supabase.from("rental_weeks").select("id").eq("id", data.week_id).maybeSingle();
    if (!wk) throw new Error("Week not found");
    await supabase.from("rental_payments").delete().eq("week_id", wk.id);
    const { error } = await supabase
      .from("rental_weeks")
      .update({ status: "unpaid", paid_at: null })
      .eq("id", wk.id);
    if (error) throw error;
    return { ok: true };
  });



export const recordDepositManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rental_id: z.string().uuid(),
        amount_pence: z.number().int().positive(),
        method: z.enum(["cash", "card", "bank_transfer", "other"]).default("cash"),
        kind: z.enum(["deposit", "deposit_refund"]).default("deposit"),
        note: z.string().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: r } = await supabase.from("rentals").select("*").eq("id", data.rental_id).maybeSingle();
    if (!r) throw new Error("Rental not found");
    const now = new Date().toISOString();
    await supabase.from("rental_payments").insert({
      rental_id: r.id,
      amount_pence: data.amount_pence,
      kind: data.kind,
      method: data.method,
      note: data.note ?? null,
      recorded_by: userId,
      paid_at: now,
    });
    const patch: any = {};
    if (data.kind === "deposit") patch.deposit_paid_pence = (r.deposit_paid_pence ?? 0) + data.amount_pence;
    else {
      patch.deposit_refunded_pence = (r.deposit_refunded_pence ?? 0) + data.amount_pence;
      patch.deposit_refunded_at = now;
    }
    await supabase.from("rentals").update(patch).eq("id", r.id);

    return { ok: true, refunded_at: data.kind === "deposit_refund" ? now : null };
  });


// ============ DOCUMENTS ====================================================
export const listRentalDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: rows, error } = await supabase.from("rental_documents").select("*").eq("rental_id", data.rental_id).order("uploaded_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const addRentalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        rental_id: z.string().uuid(),
        doc_type: z.enum(["driving_licence", "cbt", "proof_of_address", "vehicle_insurance", "other"]),
        storage_path: z.string().min(1).max(500),
        file_name: z.string().min(1).max(300),
        expires_at: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row, error } = await supabase
      .from("rental_documents")
      .insert({ ...data, uploaded_by: userId })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteRentalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: doc } = await supabase.from("rental_documents").select("storage_path").eq("id", data.id).maybeSingle();
    const { error } = await supabase.from("rental_documents").delete().eq("id", data.id);
    if (error) throw error;
    if (doc?.storage_path) await supabase.storage.from("rental-documents").remove([doc.storage_path]);
    return { ok: true };
  });

export const getRentalDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storage_path: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: signed, error } = await supabase.storage.from("rental-documents").createSignedUrl(data.storage_path, 60 * 60);
    if (error) throw error;
    return { url: signed?.signedUrl ?? "" };
  });

// ============ PCNs =========================================================
const pcnInput = z.object({
  rental_id: z.string().uuid(),
  issued_on: z.string(),
  reference: z.string().max(200).nullable().optional(),
  amount_pence: z.number().int().min(0).default(0),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["outstanding", "paid", "transferred_to_customer", "disputed", "void"]).default("outstanding"),
  document_path: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listPcns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase.from("rental_pcns").select("*, rental:rentals(id,customer_id,bike_id,bike:rental_bikes(registration))").is("deleted_at", null).order("issued_on", { ascending: false });
    if (data.rental_id) q = q.eq("rental_id", data.rental_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertPcn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => pcnInput.partial({ status: true }).extend({ id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    if (data.id) {
      const { id, ...patch } = data;
      const { data: row, error } = await supabase.from("rental_pcns").update(patch).eq("id", id).select("*").single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase.from("rental_pcns").insert({ ...pcnInput.parse(data), created_by: userId }).select("*").single();
    if (error) throw error;
    return row;
  });

export const deletePcn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("rental_pcns")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ DASHBOARD ====================================================
export const rentalDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const [{ data: rentals }, { data: weeks }, { data: payments }, { data: pcns }] = await Promise.all([
      supabase.from("rentals").select("id,status,billing_day,deposit_pence,deposit_paid_pence,deposit_refunded_pence").is("deleted_at", null),
      supabase.from("rental_weeks").select("rental_id,week_end,amount_pence,status").is("deleted_at", null),
      supabase.from("rental_payments").select("amount_pence,kind,paid_at"),
      supabase.from("rental_pcns").select("amount_pence,status").is("deleted_at", null),
    ]);
    const activeCount = (rentals ?? []).filter((r: any) => r.status === "active").length;
    const depositHeld = (rentals ?? []).reduce((s: number, r: any) => s + (r.deposit_paid_pence ?? 0) - (r.deposit_refunded_pence ?? 0), 0);
    const billingDayById: Record<string, number> = Object.fromEntries(
      ((rentals ?? []) as any[]).map((r) => [r.id, r.billing_day ?? 1]),
    );
    const outstandingRent = (weeks ?? [])
      .filter((w: any) => w.status === "unpaid" && isWeekDue(w.week_end, billingDayById[w.rental_id] ?? 1))
      .reduce((s: number, w: any) => s + (w.amount_pence ?? 0), 0);
    const totalIncome = (payments ?? [])
      .filter((p: any) => p.kind !== "deposit_refund")
      .reduce((s: number, p: any) => s + (p.amount_pence ?? 0), 0);
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const incomeThisMonth = (payments ?? [])
      .filter((p: any) => p.kind !== "deposit_refund" && (p.paid_at ?? "").startsWith(monthKey))
      .reduce((s: number, p: any) => s + (p.amount_pence ?? 0), 0);
    const outstandingPcns = (pcns ?? []).filter((p: any) => p.status === "outstanding").reduce((s: number, p: any) => s + (p.amount_pence ?? 0), 0);
    return { activeCount, depositHeld, outstandingRent, totalIncome, incomeThisMonth, outstandingPcns };
  });

// ============ STRIPE CHECKOUT ==============================================
const checkoutInput = z.object({
  environment: z.enum(["sandbox", "live"]),
  returnUrl: z.string().url(),
});

/**
 * Returns a Stripe customer id that is guaranteed to exist in the CURRENT Stripe
 * environment. Stored ids can become invalid (created in a different environment,
 * or deleted in Stripe) which makes checkout fail with "No such customer".
 * In that case we transparently create a fresh customer and persist it.
 */
/** Look up the rental customer's name/email from our own records. */
async function rentalContact(rentalId: string): Promise<{ email: string | null; name: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let email: string | null = null;
  let name: string | null = null;
  const { data: r } = await supabaseAdmin.from("rentals").select("customer_id, rental_customer_id").eq("id", rentalId).maybeSingle();
  if ((r as any)?.customer_id) {
    const { data: p } = await supabaseAdmin.from("profiles").select("full_name,email").eq("id", (r as any).customer_id).maybeSingle();
    email = (p as any)?.email ?? null;
    name = (p as any)?.full_name ?? null;
  }
  if ((!name || !email) && (r as any)?.rental_customer_id) {
    const { data: c } = await supabaseAdmin.from("rental_customers").select("full_name,email").eq("id", (r as any).rental_customer_id).maybeSingle();
    email = email ?? ((c as any)?.email ?? null);
    name = name ?? ((c as any)?.full_name ?? null);
  }
  return { email, name };
}

async function ensureStripeCustomer(
  stripe: any,
  rentalId: string,
  storedId: string | null | undefined,
  fallback: { email?: string | null; name?: string | null },
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const contact = await rentalContact(rentalId);
  const email = fallback.email ?? contact.email ?? null;
  const name = fallback.name ?? contact.name ?? null;

  if (storedId) {
    try {
      const existing = await stripe.customers.retrieve(storedId);
      if (existing && !(existing as any).deleted) {
        // Keep the Stripe customer named so Stripe's payment notification
        // emails to the admin show who paid.
        const patch: Record<string, string> = {};
        if (name && (existing as any).name !== name) patch.name = name;
        if (email && !(existing as any).email) patch.email = email;
        if (Object.keys(patch).length) {
          try {
            await stripe.customers.update(storedId, patch);
          } catch {
            // non-fatal
          }
        }
        return storedId;
      }
    } catch {
      // fall through and recreate
    }
  }
  const created = await stripe.customers.create({
    ...(email && { email }),
    ...(name && { name }),
    metadata: { rentalId, ...(name ? { customerName: name } : {}) },
  });
  await supabaseAdmin
    .from("rentals")
    .update({ stripe_customer_id: created.id, default_payment_method_id: null })
    .eq("id", rentalId);
  return created.id;
}


// ============ RENTAL CUSTOMERS =============================================
const rentalCustomerInput = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1).max(200),
  date_of_birth: z.string().nullable().optional(),
  address: z.string().max(600).nullable().optional(),
  licence_number: z.string().max(100).nullable().optional(),
  email: z.string().max(255).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  photo_path: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listRentalCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase.from("rental_customers").select("*").is("deleted_at", null).order("full_name");
    const s = data.search?.trim();
    if (s) q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,licence_number.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertRentalCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => rentalCustomerInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { id, ...patch } = data;
    const clean = {
      ...patch,
      date_of_birth: patch.date_of_birth || null,
      email: patch.email?.trim() || null,
      phone: patch.phone?.trim() || null,
    };
    if (id) {
      const { data: row, error } = await supabase.from("rental_customers").update(clean).eq("id", id).select("*").single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await supabase
      .from("rental_customers")
      .insert({ ...clean, created_by: userId })
      .select("*")
      .single();
    if (error) throw error;
    return row;
  });

export const deleteRentalCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("rental_customers")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ CARD ON FILE / AUTOPAY =======================================
async function canManageRental(supabase: any, userId: string, rentalId: string) {
  await assertStaff(supabase, userId);
  const { data: r } = await supabase.from("rentals").select("id").eq("id", rentalId).maybeSingle();
  if (!r) throw new Error("Rental not found");
  return r;
}

/** Embedded Stripe "setup" session — stores/updates the card for future weekly rent. */
export const createCardSetupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => checkoutInput.extend({ rental_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { supabase, userId } = context as any;
      assertOnlinePaymentsEnabled();
      await canManageRental(supabase, userId, data.rental_id);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: r } = await supabaseAdmin.from("rentals").select("*").eq("id", data.rental_id).maybeSingle();
      if (!r) throw new Error("Rental not found");
      const stripe = createStripeClient(data.environment as StripeEnv);

      const customerId = await ensureStripeCustomer(stripe, data.rental_id, (r as any).stripe_customer_id, {});

      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        currency: "gbp",
        ui_mode: "embedded_page",
        customer: customerId,
        return_url: data.returnUrl,
        setup_intent_data: { description: "Rental weekly rent card" },
        metadata: { rentalKind: "rental_card_setup", rentalId: data.rental_id },
      });
      return { clientSecret: session.client_secret ?? "" };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

/** Remove the stored card. */
export const removeRentalCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await canManageRental(supabase, userId, data.rental_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("rentals")
      .update({
        default_payment_method_id: null,
        card_brand: null,
        card_last4: null,
        card_exp_month: null,
        card_exp_year: null,
      })
      .eq("id", data.rental_id);
    if (error) throw error;
    return { ok: true };
  });

/** Which weekday the weekly rent is created & collected on. */
export const setRentalBillingDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ rental_id: z.string().uuid(), billing_day: z.number().int().min(0).max(6) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("rentals").update({ billing_day: data.billing_day }).eq("id", data.rental_id);
    if (error) throw error;
    await ensureWeeks(supabase, data.rental_id);
    return { ok: true };
  });

/** Admin: take an unpaid week from the stored card immediately. */
export const chargeWeekNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week_id: z.string().uuid(), environment: z.enum(["sandbox", "live"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    assertOnlinePaymentsEnabled();
    await assertStaff(supabase, userId);
    const { chargeRentalWeek } = await import("@/lib/rental-billing.server");
    return await chargeRentalWeek(data.week_id, data.environment as StripeEnv);
  });

/** Admin: set the amount for a billing week manually (e.g. the first payment). */
export const setWeekAmount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week_id: z.string().uuid(), amount_pence: z.number().int().min(0).max(1000000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: wk } = await supabase.from("rental_weeks").select("id,status").eq("id", data.week_id).maybeSingle();
    if (!wk) throw new Error("Week not found");

    const { error } = await supabase
      .from("rental_weeks")
      .update({ amount_pence: data.amount_pence })
      .eq("id", data.week_id);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: change the billing period (start/end dates) of a billing week. */
export const setWeekDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        week_id: z.string().uuid(),
        week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const start = new Date(data.week_start + "T00:00:00Z");
    const end = new Date(data.week_end + "T00:00:00Z");
    if (end < start) throw new Error("End date must be on or after the start date");
    const { error } = await supabase
      .from("rental_weeks")
      .update({
        week_start: data.week_start,
        week_end: data.week_end,
        days_charged: Math.floor((end.getTime() - start.getTime()) / 86400000) + 1,
      })
      .eq("id", data.week_id);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: delete a scheduled rental payment (billing week). */
export const deleteRentalWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ week_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    await supabase.from("rental_payments").delete().eq("week_id", data.week_id);
    const { error } = await supabase
      .from("rental_weeks")
      .update({ deleted_at: new Date().toISOString(), status: "unpaid", paid_at: null })
      .eq("id", data.week_id);
    if (error) throw error;
    return { ok: true };
  });

/** Admin: delete one or more received rental payments. */
export const deleteRentalPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("rental_payments").delete().in("id", data.ids);
    if (error) throw error;
    return { ok: true, deleted: data.ids.length };
  });



/** Admin: cross-rental payments overview — every billing week + collected payments. */
export const rentalPaymentsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "unpaid", "paid", "failed"]).default("all"),
        search: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);

    const { data: rentals } = await supabase
      .from("rentals")
      .select("*, bike:rental_bikes(make,model,registration), rental_customer:rental_customers(id,full_name,email,phone)")
      .is("deleted_at", null);

    for (const r of (rentals ?? []) as any[]) {
      if (r.status === "active") await ensureWeeks(supabase, r.id);
    }

    const uids = Array.from(new Set(((rentals ?? []) as any[]).map((r) => r.customer_id).filter(Boolean)));
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", uids)
      : { data: [] as any[] };
    const byId = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.id, p]));
    const rentalById: Record<string, any> = {};
    for (const r of (rentals ?? []) as any[]) {
      rentalById[r.id] = { ...r, customer: byId[r.customer_id] ?? r.rental_customer ?? null };
    }
    const ids = Object.keys(rentalById);

    const [{ data: weeks }, { data: payments }] = await Promise.all([
      ids.length
        ? supabase.from("rental_weeks").select("*").in("rental_id", ids).is("deleted_at", null).order("week_start", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("rental_payments").select("*").in("rental_id", ids).order("paid_at", { ascending: false }).limit(300)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let rows = ((weeks ?? []) as any[]).map((w) => {
      const r = rentalById[w.rental_id] ?? {};
      return {
        ...w,
        rental: {
          id: r.id,
          status: r.status,
          card_brand: r.card_brand ?? null,
          card_last4: r.card_last4 ?? null,
          weekly_rate_pence: r.weekly_rate_pence ?? 0,
          billing_day: r.billing_day ?? 1,
        },
        customer_name: r.customer?.full_name ?? "—",
        customer_email: r.customer?.email ?? null,
        customer_phone: r.customer?.phone ?? null,
        registration: r.bike?.registration ?? null,
      };
    });

    // Rent is only shown once its due date (the rental's billing day after the
    // week ends) has arrived — unpaid future weeks stay hidden.
    rows = rows.filter((w) => w.status === "paid" || isWeekDue(w.week_end, w.rental.billing_day ?? 1));

    if (data.status === "unpaid") rows = rows.filter((w) => w.status !== "paid");
    else if (data.status === "paid") rows = rows.filter((w) => w.status === "paid");
    else if (data.status === "failed") rows = rows.filter((w) => w.status !== "paid" && !!w.last_charge_error);

    if (data.search?.trim()) {
      const s = data.search.trim().toLowerCase();
      rows = rows.filter((w) =>
        [w.customer_name, w.customer_email, w.customer_phone, w.registration, w.week_start]
          .some((v: any) => (v ?? "").toString().toLowerCase().includes(s)),
      );
    }

    const outstanding = rows.filter((w) => w.status !== "paid").reduce((a, w) => a + (w.amount_pence ?? 0), 0);
    const collected = rows.filter((w) => w.status === "paid").reduce((a, w) => a + (w.amount_pence ?? 0), 0);
    const failedCount = rows.filter((w) => w.status !== "paid" && !!w.last_charge_error).length;
    const cardsOnFile = Object.values(rentalById).filter((r: any) => !!r.card_last4).length;

    return {
      weeks: rows,
      payments: ((payments ?? []) as any[]).map((p) => ({
        ...p,
        customer_name: rentalById[p.rental_id]?.customer?.full_name ?? "—",
        registration: rentalById[p.rental_id]?.bike?.registration ?? null,
        rental_status: rentalById[p.rental_id]?.status ?? null,
      })),
      totals: { outstanding, collected, failedCount, cardsOnFile, rentals: ids.length },
    };
  });

// ============ HISTORY ======================================================
async function summariseRentals(supabase: any, rows: any[]) {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const { data: weeks } = await supabase
    .from("rental_weeks")
    .select("rental_id,amount_pence,status")
    .in("rental_id", ids)
    .is("deleted_at", null);
  const agg: Record<string, { paid: number; outstanding: number; weeks: number }> = {};
  for (const w of (weeks ?? []) as any[]) {
    const a = (agg[w.rental_id] ??= { paid: 0, outstanding: 0, weeks: 0 });
    a.weeks += 1;
    if (w.status === "paid") a.paid += w.amount_pence ?? 0;
    else a.outstanding += w.amount_pence ?? 0;
  }
  return rows.map((r) => ({ ...r, totals: agg[r.id] ?? { paid: 0, outstanding: 0, weeks: 0 } }));
}

export const getBikeHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bikeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: bike, error: be } = await supabase.from("rental_bikes").select("*").eq("id", data.bikeId).maybeSingle();
    if (be) throw be;
    if (!bike) throw new Error("Bike not found");
    const { data: rows, error } = await supabase
      .from("rentals")
      .select("*, rental_customer:rental_customers(id,full_name,email,phone)")
      .eq("bike_id", data.bikeId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false });
    if (error) throw error;
    const uids = Array.from(new Set((rows ?? []).map((r: any) => r.customer_id).filter(Boolean)));
    const { data: profs } = uids.length
      ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", uids)
      : { data: [] as any[] };
    const byId = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    const withCustomer = (rows ?? []).map((r: any) => ({ ...r, customer: byId[r.customer_id] ?? r.rental_customer ?? null }));
    return { bike, rentals: await summariseRentals(supabase, withCustomer) };
  });

export const getRentalCustomerHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: customer, error: ce } = await supabase
      .from("rental_customers")
      .select("*")
      .eq("id", data.customerId)
      .maybeSingle();
    if (ce) throw ce;
    if (!customer) throw new Error("Customer not found");
    const or = [`rental_customer_id.eq.${customer.id}`];
    if (customer.user_id) or.push(`customer_id.eq.${customer.user_id}`);
    const { data: rows, error } = await supabase
      .from("rentals")
      .select("*, bike:rental_bikes(id,make,model,registration,year)")
      .or(or.join(","))
      .is("deleted_at", null)
      .order("start_date", { ascending: false });
    if (error) throw error;
    return { customer, rentals: await summariseRentals(supabase, rows ?? []) };
  });

/**
 * Admin: change the weekly rent rate. Existing billing weeks (paid or unpaid)
 * keep their amounts — only weeks that start after the date of the change are
 * created/charged at the new rate.
 */
export const setWeeklyRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ rental_id: z.string().uuid(), weekly_rate_pence: z.number().int().min(0).max(1000000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase
      .from("rentals")
      .update({ weekly_rate_pence: data.weekly_rate_pence })
      .eq("id", data.rental_id);
    if (error) throw error;
    // Recompute unpaid weeks at the new rate immediately (paid weeks untouched).
    await resyncWeeks(supabase, data.rental_id);
    return { ok: true };
  });

// ------ agreed overdue-rent repayment plan ---------------------------------
async function loadArrearsPlan(supabase: any, targetUserId: string) {
  const { data: plan } = await supabase
    .from("rental_arrears_plans")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .maybeSingle();
  if (!plan) return { plan: null, installments: [] as any[] };
  const { data: installments } = await supabase
    .from("rental_arrears_installments")
    .select("*")
    .eq("plan_id", plan.id)
    .order("seq");
  return { plan, installments: installments ?? [] };
}

/** Staff view of a customer's agreed repayment plan. */
export const getArrearsPlanForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    return loadArrearsPlan(supabase, data.userId);
  });

// ------ Rental bike MOT ----------------------------------------------------
/** Refresh MOT expiry for every rental bike (DVSA, max once per 12h each). */
export const refreshRentalBikesMot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { lookupMot } = await import("@/lib/rental-mot.server");
    const { data: bikes } = await supabaseAdmin
      .from("rental_bikes")
      .select("id, registration, mot_expiry_date, mot_checked_at")
      .is("deleted_at", null);
    const today = new Date().toISOString().slice(0, 10);
    for (const b of (bikes ?? []) as any[]) {
      const stale = !b.mot_checked_at || Date.now() - Date.parse(b.mot_checked_at) > 12 * 3600_000;
      if (stale) {
        const r = await lookupMot(b.registration);
        const patch: any = { mot_checked_at: new Date().toISOString() };
        if (r.outcome === "ok") {
          const expiry = r.vehicle.motExpiryDate ?? r.vehicle.motTestDueDate ?? null;
          patch.mot_expiry_date = expiry;
          patch.mot_status = expiry ? (expiry < today ? "expired" : "valid") : "no_mot_data";
        } else if (r.outcome === "not_found" || r.outcome === "invalid_registration") {
          patch.mot_status = r.outcome;
        } else {
          continue; // temporary failure — try again next time
        }
        await supabaseAdmin.from("rental_bikes").update(patch).eq("id", b.id);
      }
    }
    return { checked: (bikes ?? []).length };
  });
