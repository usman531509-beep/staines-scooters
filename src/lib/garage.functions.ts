import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isExpenseDeleteBlocked, EXPENSE_DELETE_BLOCKED_MESSAGE } from "@/lib/expense-delete-guard";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity-log";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["staff", "admin", "owner"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

function gen(prefix: string) {
  const n = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${n}`;
}

// ============ SUPPLIERS ============
export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data, error } = await supabase.from("suppliers").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      contact_name: z.string().max(80).optional().nullable(),
      email: z.string().email().optional().nullable().or(z.literal("")),
      phone: z.string().max(40).optional().nullable(),
      address: z.string().max(300).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
      is_active: z.boolean().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const row = { ...data, email: data.email || null };
    if (data.id) {
      const { error } = await supabase.from("suppliers").update(row).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("suppliers").insert(row);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("suppliers").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ PURCHASE ORDERS ============
export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*, supplier:suppliers(name), items:purchase_order_items(*)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      supplier_id: z.string().uuid().nullable().optional(),
      expected_date: z.string().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
      items: z.array(z.object({
        product_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        sku: z.string().optional().nullable(),
        quantity: z.number().positive(),
        unit_cost_pence: z.number().int().nonnegative(),
      })).min(1),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const subtotal = data.items.reduce((s, it) => s + Math.round(it.quantity * it.unit_cost_pence), 0);
    const po_number = gen("PO");
    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        po_number,
        supplier_id: data.supplier_id ?? null,
        status: "ordered",
        subtotal_pence: subtotal,
        total_pence: subtotal,
        order_date: new Date().toISOString().slice(0, 10),
        expected_date: data.expected_date || null,
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const items = data.items.map((it) => ({
      purchase_order_id: po.id,
      product_id: it.product_id ?? null,
      name: it.name,
      sku: it.sku ?? null,
      quantity: it.quantity,
      unit_cost_pence: it.unit_cost_pence,
      total_pence: Math.round(it.quantity * it.unit_cost_pence),
    }));
    const { error: e2 } = await supabase.from("purchase_order_items").insert(items);
    if (e2) throw e2;
    return { ok: true, id: po.id, po_number };
  });

export const receivePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: items } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", data.id);
    for (const it of items ?? []) {
      if (!it.product_id) continue;
      const { data: p } = await supabase.from("products").select("stock_qty").eq("id", it.product_id).maybeSingle();
      const newQty = Number(p?.stock_qty ?? 0) + Number(it.quantity);
      await supabase.from("products").update({ stock_qty: newQty }).eq("id", it.product_id);
      await supabase.from("stock_movements").insert({
        product_id: it.product_id,
        movement_type: "purchase",
        quantity: it.quantity,
        reference_type: "purchase_order",
        reference_id: data.id,
        created_by: userId,
      });
      await supabase.from("purchase_order_items").update({ received_qty: it.quantity }).eq("id", it.id);
    }
    await supabase
      .from("purchase_orders")
      .update({ status: "received", received_date: new Date().toISOString().slice(0, 10) })
      .eq("id", data.id);
    return { ok: true };
  });

// ============ VEHICLES ============
export const listVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ search: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase.from("vehicles").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.search) q = q.or(`registration.ilike.%${data.search}%,make.ilike.%${data.search}%,model.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      user_id: z.string().uuid().optional().nullable(),
      registration: z.string().min(1).max(20),
      make: z.string().max(40).optional().nullable(),
      model: z.string().max(40).optional().nullable(),
      year: z.number().int().optional().nullable(),
      colour: z.string().max(40).optional().nullable(),
      vin: z.string().max(40).optional().nullable(),
      mileage: z.number().int().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("vehicles").update(data).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("vehicles").insert(data);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ APPOINTMENTS ============
export const listAppointments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ from: z.string().optional(), to: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let q = supabase
      .from("appointments")
      .select("*, vehicle:vehicles(registration, make, model)")
      .order("scheduled_at", { ascending: true })
      .limit(200);
    if (data.from) q = q.gte("scheduled_at", data.from);
    if (data.to) q = q.lte("scheduled_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const upsertAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      vehicle_id: z.string().uuid().optional().nullable(),
      user_id: z.string().uuid().optional().nullable(),
      scheduled_at: z.string(),
      duration_minutes: z.number().int().positive().default(60),
      service_type: z.string().min(1).max(80),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]).default("scheduled"),
      customer_name: z.string().max(80).optional().nullable(),
      customer_phone: z.string().max(30).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    if (data.id) {
      const { error } = await supabase.from("appointments").update(data).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("appointments").insert(data);
      if (error) throw error;
    }
    return { ok: true };
  });

export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "no_show"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("appointments").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("appointments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ QUOTES ============
export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data, error } = await supabase
      .from("quotes")
      .select("*, items:quote_items(*), vehicle:vehicles(registration, make, model)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const createQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      vehicle_id: z.string().uuid().optional().nullable(),
      customer_name: z.string().max(80).optional().nullable(),
      customer_phone: z.string().max(30).optional().nullable(),
      customer_email: z.string().email().optional().nullable().or(z.literal("")),
      expires_at: z.string().optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
      items: z.array(z.object({
        product_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        quantity: z.number().positive(),
        unit_price_pence: z.number().int().nonnegative(),
        discount_pence: z.number().int().nonnegative().default(0),
      })).min(1),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const subtotal = data.items.reduce((s, it) => s + Math.round(it.quantity * it.unit_price_pence), 0);
    const discount = data.items.reduce((s, it) => s + (it.discount_pence ?? 0), 0);
    const total = Math.max(0, subtotal - discount);
    const quote_number = gen("Q");
    const { data: q, error } = await supabase
      .from("quotes")
      .insert({
        quote_number,
        vehicle_id: data.vehicle_id ?? null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email || null,
        status: "draft",
        subtotal_pence: subtotal,
        discount_pence: discount,
        total_pence: total,
        expires_at: data.expires_at || null,
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    const items = data.items.map((it) => ({
      quote_id: q.id,
      product_id: it.product_id ?? null,
      name: it.name,
      quantity: it.quantity,
      unit_price_pence: it.unit_price_pence,
      discount_pence: it.discount_pence ?? 0,
      total_pence: Math.max(0, Math.round(it.quantity * it.unit_price_pence) - (it.discount_pence ?? 0)),
    }));
    const { error: e2 } = await supabase.from("quote_items").insert(items);
    if (e2) throw e2;
    return { ok: true, id: q.id, quote_number };
  });

export const updateQuoteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["draft", "sent", "accepted", "declined", "expired", "converted"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase.from("quotes").update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ REFUNDS ============
export const listRefunds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data, error } = await supabase
      .from("refunds")
      .select("*, items:refund_items(*), sale:sales(receipt_no)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data ?? [];
  });

export const createRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      sale_id: z.string().uuid().optional().nullable(),
      amount_pence: z.number().int().positive(),
      payment_method: z.string().max(40).default("cash"),
      reason: z.string().max(200).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
      items: z.array(z.object({
        product_id: z.string().uuid().nullable().optional(),
        sale_item_id: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        quantity: z.number().positive(),
        amount_pence: z.number().int().nonnegative(),
        return_to_stock: z.boolean().default(true),
      })).default([]),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const refund_number = gen("RF");
    const { data: r, error } = await supabase
      .from("refunds")
      .insert({
        refund_number,
        sale_id: data.sale_id ?? null,
        amount_pence: data.amount_pence,
        payment_method: data.payment_method,
        reason: data.reason,
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    if (data.items.length) {
      const rows = data.items.map((it) => ({
        refund_id: r.id,
        product_id: it.product_id ?? null,
        sale_item_id: it.sale_item_id ?? null,
        name: it.name,
        quantity: it.quantity,
        amount_pence: it.amount_pence,
        return_to_stock: it.return_to_stock,
      }));
      await supabase.from("refund_items").insert(rows);
      for (const it of data.items) {
        if (it.return_to_stock && it.product_id) {
          const { data: p } = await supabase.from("products").select("stock_qty").eq("id", it.product_id).maybeSingle();
          await supabase.from("products").update({ stock_qty: Number(p?.stock_qty ?? 0) + Number(it.quantity) }).eq("id", it.product_id);
          await supabase.from("stock_movements").insert({
            product_id: it.product_id,
            movement_type: "refund",
            quantity: it.quantity,
            reference_type: "refund",
            reference_id: r.id,
            created_by: userId,
          });
        }
      }
    }
    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "refund_added",
      label: String(refund_number),
      entityId: r.id,
      details: { amountPence: data.amount_pence, saleId: data.sale_id ?? null },
    });
    return { ok: true, id: r.id, refund_number };
  });

// ============ EXPENSES ============
export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    await (await import("@/lib/recurring-expenses.server")).postDueRecurringExpensesQuietly();
    const { data, error } = await supabase.from("expenses").select("*").is("deleted_at", null).order("expense_date", { ascending: false }).limit(200);
    if (error) throw error;
    return data ?? [];
  });

function computeNextRun(fromDate: string, recurrence: "weekly" | "monthly"): string {
  const d = new Date(fromDate + "T00:00:00Z");
  if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      category: z.string().min(1).max(40),
      vendor: z.string().max(80).optional().nullable(),
      description: z.string().max(300).optional().nullable(),
      amount_pence: z.number().int().positive(),
      tax_pence: z.number().int().nonnegative().default(0),
      payment_method: z.string().max(40).default("card"),
      expense_date: z.string(),
      notes: z.string().max(500).optional().nullable(),
      recurrence: z.enum(["none", "weekly", "monthly"]).default("none"),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const isRecurring = data.recurrence !== "none";
    const row: any = {
      category: data.category,
      vendor: data.vendor ?? null,
      description: data.description ?? null,
      amount_pence: data.amount_pence,
      tax_pence: data.tax_pence,
      payment_method: data.payment_method,
      expense_date: data.expense_date,
      notes: data.notes ?? null,
      recurrence: data.recurrence,
      is_template: isRecurring,
      next_run_date: isRecurring
        ? computeNextRun(data.expense_date, data.recurrence as "weekly" | "monthly")
        : null,
    };
    if (data.id) {
      const { error } = await supabase.from("expenses").update(row).eq("id", data.id);
      if (error) throw error;
      await logActivity(supabase, {
        actorId: userId,
        module: "expenses",
        action: "expense_edited",
        label: data.description || data.vendor || data.category,
        entityId: data.id,
        details: { amountPence: data.amount_pence, category: data.category, date: data.expense_date },
      });
    } else {
      const { data: created, error } = await supabase.from("expenses").insert({ ...row, created_by: userId }).select("id").maybeSingle();
      if (error) throw error;
      await logActivity(supabase, {
        actorId: userId,
        module: "expenses",
        action: "expense_added",
        label: data.description || data.vendor || data.category,
        entityId: created?.id ?? null,
        details: { amountPence: data.amount_pence, category: data.category, date: data.expense_date },
      });
    }
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as any;
    if (isExpenseDeleteBlocked(claims?.email)) throw new Error(EXPENSE_DELETE_BLOCKED_MESSAGE);
    // Admins and owners may delete expenses.
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!isAdmin) throw new Error("Only admins can delete expenses.");
    const { data: row } = await supabase.from("expenses").select("description, vendor, category, amount_pence").eq("id", data.id).maybeSingle();
    const { error } = await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    await logActivity(supabase, {
      actorId: userId,
      module: "expenses",
      action: "expense_deleted",
      label: row?.description || row?.vendor || row?.category || "Expense",
      entityId: data.id,
      details: { amountPence: row?.amount_pence ?? null },
    });
    return { ok: true };
  });


export const deleteRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row } = await supabase.from("refunds").select("refund_number, amount_pence, sale_id").eq("id", data.id).maybeSingle();
    const { error } = await supabase
      .from("refunds")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "refund_deleted",
      label: String(row?.refund_number ?? data.id.slice(0, 8)),
      entityId: data.id,
      details: { amountPence: row?.amount_pence ?? null },
    });
    return { ok: true };
  });

// ============ REPORTS ============
export const getReportsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ days: z.number().int().positive().max(365).default(30) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const since = new Date();
    since.setDate(since.getDate() - data.days);
    const sinceIso = since.toISOString();
    const sinceDate = since.toISOString().slice(0, 10);

    const [sales, refunds, expenses, lowStock] = await Promise.all([
      supabase.from("sales").select("amount_pence, tax_pence, subtotal_pence, created_at, payment_method").is("deleted_at", null).eq("is_credit_only", false).gte("created_at", sinceIso),
      supabase.from("refunds").select("amount_pence, created_at").gte("created_at", sinceIso),
      supabase.from("expenses").select("amount_pence, category, expense_date").gte("expense_date", sinceDate),
      supabase.from("products").select("id, name, sku, stock_qty").eq("is_active", true).order("stock_qty"),
    ]);

    const salesRows = sales.data ?? [];
    const refundRows = refunds.data ?? [];
    const expenseRows = expenses.data ?? [];
    const lowRows = (lowStock.data ?? []).filter((p: any) => Number(p.stock_qty ?? 0) <= 5).slice(0, 20);

    const totals = {
      sales_pence: salesRows.reduce((s: number, r: any) => s + (r.amount_pence ?? 0), 0),
      sales_tax_pence: salesRows.reduce((s: number, r: any) => s + (r.tax_pence ?? 0), 0),
      sales_count: salesRows.length,
      refunds_pence: refundRows.reduce((s: number, r: any) => s + (r.amount_pence ?? 0), 0),
      refunds_count: refundRows.length,
      expenses_pence: expenseRows.reduce((s: number, r: any) => s + (r.amount_pence ?? 0), 0),
      expenses_count: expenseRows.length,
    };
    const byPayment: Record<string, number> = {};
    for (const r of salesRows as any[]) {
      const k = r.payment_method ?? "unknown";
      byPayment[k] = (byPayment[k] ?? 0) + (r.amount_pence ?? 0);
    }
    const expensesByCategory: Record<string, number> = {};
    for (const r of expenseRows as any[]) {
      expensesByCategory[r.category] = (expensesByCategory[r.category] ?? 0) + (r.amount_pence ?? 0);
    }
    const net_pence = totals.sales_pence - totals.refunds_pence - totals.expenses_pence;
    return { days: data.days, totals, byPayment, expensesByCategory, net_pence, lowStock: lowRows };
  });
