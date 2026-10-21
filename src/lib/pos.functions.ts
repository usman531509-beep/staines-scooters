import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/activity-log";
import { addCreditPayment, creditStatus, refreshSaleCredit } from "@/lib/credit-ledger";

async function assertStaff(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => ["owner", "admin", "staff"].includes(r.role));
  if (!ok) throw new Error("Forbidden");
}

// ============ Catalogue ============

export const listCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ includeHidden: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase
      .from("categories")
      .select("*")
      .is("deleted_at", null)
      .order("sort_order")
      .order("name");
    if (!data.includeHidden) q = q.eq("hidden", false);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const setCategoryHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) throw new Error("Only admins can hide/unhide categories.");
    const { error } = await supabase.from("categories").update({ hidden: data.hidden }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const upsertCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(60),
      sort_order: z.number().int().min(0).max(9999).default(0),
      parent_id: z.string().uuid().nullable().optional(),
      image_url: z.string().max(1000).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const payload: any = { name: data.name, sort_order: data.sort_order, parent_id: data.parent_id ?? null };
    if (data.image_url !== undefined) payload.image_url = data.image_url;
    const q = data.id
      ? supabase.from("categories").update(payload).eq("id", data.id).select().single()
      : supabase.from("categories").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw error;
    return row;
  });


export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    // Soft-delete: send to Recycle Bin.
    const { error } = await supabase
      .from("categories")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      includeInactive: z.boolean().optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    let q = supabase
      .from("products")
      .select("*, category:categories(id,name,image_url)")
      .is("deleted_at", null)
      .order("name")
      .limit(500);
    if (!data.includeInactive) q = q.eq("is_active", true);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.eq.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getTopSellingProductIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    // Aggregate sold qty per product from recent sale_items (last 90 days).
    const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("sale_items")
      .select("product_id, qty, created_at")
      .gte("created_at", since)
      .not("product_id", "is", null)
      .limit(5000);
    if (error) throw error;
    const totals = new Map<string, number>();
    for (const row of (data ?? []) as any[]) {
      if (!row.product_id) continue;
      totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + Number(row.qty ?? 0));
    }
    // Return ordered list of product ids by qty desc.
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, qty]) => ({ id, qty }));
  });

export const setProductBestSellerExcluded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), excluded: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) throw new Error("Only admins can change Best Sellers.");
    const { error } = await supabase.from("products").update({ exclude_from_best_sellers: data.excluded }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Admin can pin any product (from any category) into the POS Best Sellers row.
export const setProductBestSellerPinned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) throw new Error("Only admins can change Best Sellers.");
    const patch: any = { pin_to_best_sellers: data.pinned };
    if (data.pinned) patch.exclude_from_best_sellers = false;
    const { error } = await supabase.from("products").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Admin drag-and-drop manual ordering of POS product tiles.
export const reorderProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) throw new Error("Only admins can reorder products.");
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await supabase.from("products").update({ pos_sort_order: i + 1 }).eq("id", data.ids[i]);
      if (error) throw error;
    }
    return { ok: true };
  });

export const findProductByBarcode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string().trim().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: p } = await supabase
      .from("products")
      .select("*, category:categories(id,name,image_url)")
      .or(`barcode.eq.${data.code},sku.eq.${data.code}`)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    return p;
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(120),
      description: z.string().max(500).optional().nullable(),
      sku: z.string().trim().max(40).optional().nullable(),
      barcode: z.string().trim().max(40).optional().nullable(),
      category_id: z.string().uuid().optional().nullable(),
      cost_price_pence: z.number().int().min(0),
      retail_price_pence: z.number().int().min(0),
      vat_rate: z.number().min(0).max(100).default(0),
      stock_qty: z.number().int().min(0).default(0),
      min_stock: z.number().int().min(0).default(0),
      is_service: z.boolean().default(false),
      is_active: z.boolean().default(true),
      image_url: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { id, ...payload } = data;
    // Stock qty is managed exclusively by the Stock/Inventory module
    // (receive/adjust/waste/count). Never let the products form change it.
    delete (payload as any).stock_qty;
    if (!id) (payload as any).stock_qty = 0;
    // null out empties on uniques
    if (!payload.sku) (payload as any).sku = null;
    if (!payload.barcode) (payload as any).barcode = null;
    const q = id
      ? supabase.from("products").update(payload).eq("id", id).select().single()
      : supabase.from("products").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw error;
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    // Soft delete: send to Recycle Bin (deactivates too so POS hides it).
    const { error } = await supabase
      .from("products")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const hardDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error } = await supabase
      .from("products")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (roles ?? []).some((r: any) => ["owner", "admin"].includes(r.role));
  if (!ok) throw new Error("Admins only");
}

export const bulkDeleteProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { error, count } = await supabase
      .from("products")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: userId }, { count: "exact" })
      .in("id", data.ids)
      .is("deleted_at", null);
    if (error) throw error;
    return { ok: true, deleted: count ?? data.ids.length };
  });

export const deleteAllProductsExceptEngineOil = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: rows, error } = await supabase
      .from("products")
      .select("id, name")
      .is("deleted_at", null)
      .not("name", "ilike", "%engine oil%");
    if (error) throw error;
    const ids = (rows ?? []).map((p: any) => p.id);
    if (ids.length === 0) return { ok: true, deleted: 0, kept: "engine oil" };
    const { error: updateError, count } = await supabase
      .from("products")
      .update({ is_active: false, deleted_at: new Date().toISOString(), deleted_by: userId }, { count: "exact" })
      .in("id", ids);
    if (updateError) throw updateError;
    return { ok: true, deleted: count ?? ids.length, kept: "engine oil" };
  });

async function softDeleteSales(supabase: any, ids: string[], userId: string) {
  if (ids.length === 0) return 0;
  const { error, count } = await supabase
    .from("sales")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId }, { count: "exact" })
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? ids.length;
}

export const bulkDeleteSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ids: z.array(z.string().uuid()).min(1).max(1000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: rows } = await supabase.from("sales").select("id, receipt_no").in("id", data.ids);
    const deleted = await softDeleteSales(supabase, data.ids, userId);
    for (const r of rows ?? []) {
      await logActivity(supabase, {
        actorId: userId,
        module: "sales",
        action: "sale_deleted",
        label: String(r.receipt_no ?? r.id.slice(0, 8)),
        entityId: r.id,
        details: { bulk: true },
      });
    }
    return { ok: true, deleted };
  });

export const deleteAllSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data: rows } = await supabase.from("sales").select("id").is("deleted_at", null).eq("is_credit_only", false);
    const ids = (rows ?? []).map((r: any) => r.id);
    const deleted = await softDeleteSales(supabase, ids, userId);
    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "sale_deleted",
      label: `All sales (${deleted})`,
      details: { bulk: true, count: deleted },
    });
    return { ok: true, deleted };
  });

// ============ Checkout ============

const cartItemSchema = z.object({
  productId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  sku: z.string().max(40).optional().nullable(),
  qty: z.number().positive().max(9999),
  unitPricePence: z.number().int().min(0),
  discountPence: z.number().int().min(0).default(0),
  vatRate: z.number().min(0).max(100).default(0),
  isService: z.boolean().default(false),
  description: z.string().max(1000).optional().nullable(),
  costPricePence: z.number().int().min(0).optional().nullable(),
  mileage: z.number().int().min(0).max(10000000).optional().nullable(),
});

export const recordSaleV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      items: z.array(cartItemSchema).min(1),
      paymentMethod: z.enum(["cash", "card", "bank_transfer", "split", "credit"]).default("cash"),
      // Credit sale: what the customer paid at the till now, and how (the rest is owed).
      creditPaidNowPence: z.number().int().min(0).optional().nullable(),
      creditPaidNowMethod: z.enum(["cash", "card", "bank_transfer"]).optional().nullable(),
      orderDiscountPence: z.number().int().min(0).default(0),
      notes: z.string().max(500).optional().nullable(),
      saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      // Till extras: cash handed over, and how a card+cash sale was split.
      cashTenderedPence: z.number().int().min(0).optional().nullable(),
      cashPartPence: z.number().int().min(0).optional().nullable(),
      cardPartPence: z.number().int().min(0).optional().nullable(),
      customerId: z.string().uuid().optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);

    // Compute totals
    let subtotal = 0;
    let lineDiscounts = 0;
    let tax = 0;
    const computed = data.items.map((it) => {
      const gross = Math.round(it.unitPricePence * it.qty);
      const afterLineDisc = Math.max(0, gross - it.discountPence);
      // VAT disabled — the business does not charge VAT.
      subtotal += gross;
      lineDiscounts += it.discountPence;
      return { ...it, vatRate: 0, lineTotalPence: afterLineDisc };
    });


    let total = subtotal - lineDiscounts;
    const orderDisc = Math.min(data.orderDiscountPence, total);
    total -= orderDisc;

    const totalDiscount = lineDiscounts + orderDisc;
    // Stored on the sale as the ORDER-LEVEL discount only: line-level discounts
    // are already baked into sale_items.line_total_pence, so counting them
    // again here would double-discount the sale and understate profit.
    const orderLevelDiscount = orderDisc;
    const finalTotal = Math.max(0, total);

    const isCredit = data.paymentMethod === "credit";
    const paidNow = isCredit ? data.creditPaidNowPence ?? 0 : 0;
    if (isCredit) {
      if (!data.customerId) throw new Error("Choose the customer before putting a sale on credit.");
      if (paidNow >= finalTotal) throw new Error("They're paying it all now — use Cash or Card instead of Credit.");
    }

    const description =
      data.items.length === 1
        ? `${data.items[0].name}${data.items[0].qty !== 1 ? ` ×${data.items[0].qty}` : ""}`
        : `${data.items.length} items`;

    // Optional back-dating (from the Add New Sale page)
    let createdAt: string | null = null;
    if (data.saleDate) {
      const today = new Date();
      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      createdAt = data.saleDate === iso ? today.toISOString() : new Date(`${data.saleDate}T12:00:00`).toISOString();
    }

    // Attach the sale to the open till session so cash-in-drawer adds up.
    const { data: openSession } = await supabase
      .from("till_sessions")
      .select("id")
      .is("closed_at", null)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const openTillId = openSession?.id ?? null;


    // Insert sale
    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        ...(createdAt ? { created_at: createdAt } : {}),
        description,
        amount_pence: finalTotal,
        subtotal_pence: subtotal,
        discount_pence: orderLevelDiscount,
        tax_pence: tax,
        payment_method: data.paymentMethod,
        notes: data.notes ?? null,
        staff_id: userId,
        till_session_id: openTillId,
        cash_tendered_pence: data.cashTenderedPence ?? null,
        cash_part_pence: data.cashPartPence ?? null,
        card_part_pence: data.cardPartPence ?? null,
        pos_customer_id: data.customerId ?? null,
        ...(isCredit
          ? { credit_amount_pence: finalTotal, credit_paid_pence: 0, credit_status: creditStatus(finalTotal, 0) }
          : {}),
      })
      .select()
      .single();
    if (saleErr) throw saleErr;

    // Insert line items
    const itemsPayload = computed.map((it) => {
      return {
        sale_id: sale.id,
        product_id: it.productId ?? null,
        name: it.name,
        sku: it.sku ?? null,
        qty: it.qty,
        unit_price_pence: it.unitPricePence,
        discount_pence: it.discountPence,
        vat_rate: it.vatRate,
        line_total_pence: it.lineTotalPence,
        is_service: it.isService,
        description: (it as any).description ?? null,
        cost_price_pence: (it as any).costPricePence ?? null,
        mileage: (it as any).mileage ? Number((it as any).mileage) : null,
      };
    });

    const { error: itemsErr } = await supabase.from("sale_items").insert(itemsPayload);
    if (itemsErr) throw itemsErr;

    // Part paid at the till: the first payment towards the credit.
    if (isCredit && paidNow > 0) {
      await addCreditPayment(supabase, {
        saleId: sale.id,
        receiptNo: sale.receipt_no,
        amountPence: paidNow,
        method: data.creditPaidNowMethod ?? "cash",
        userId,
        note: "Paid at the till",
      });
    }

    // Decrement stock for non-services with a product id
    for (const it of computed) {
      if (it.isService || !it.productId) continue;
      const { data: prod } = await supabase.from("products").select("stock_qty").eq("id", it.productId).maybeSingle();
      if (prod) {
        const newQty = Math.max(0, (prod.stock_qty ?? 0) - Math.ceil(it.qty));
        await supabase.from("products").update({ stock_qty: newQty }).eq("id", it.productId);
      }
    }

    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "sale_added",
      label: String(sale.receipt_no ?? sale.id.slice(0, 8)),
      entityId: sale.id,
      details: { totalPence: finalTotal, source: "till", paymentMethod: sale.payment_method },
    });

    // No email per sale: the shop inbox only gets website enquiries and registrations,
    // and customers get a receipt when staff press WhatsApp or Email.


    return {
      saleId: sale.id,
      total: finalTotal,
      subtotal,
      discount: totalDiscount,
      tax,
    };
  });


export const getSaleFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ saleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const [saleRes, itemsRes] = await Promise.all([
      supabase
        .from("sales")
        .select("*, pos_customer:pos_customers(id, name, phone, email)")
        .eq("id", data.saleId)
        .maybeSingle(),
      supabase
        .from("sale_items")
        .select("*, product:products(cost_price_pence)")
        .eq("sale_id", data.saleId)
        .order("created_at"),
    ]);
    if (!saleRes.data) throw new Error("Sale not found");
    const items = (itemsRes.data ?? []).map((it: any) => ({
      ...it,
      // Fall back to the product's current cost when the line has none recorded.
      cost_price_pence: it.cost_price_pence ?? it.product?.cost_price_pence ?? null,
    }));
    return { sale: saleRes.data, items };
  });

/** Emails the customer the same receipt as the printed one, with it attached as a PDF. */
export const emailSaleReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ saleId: z.string().uuid(), to: z.string().trim().email("Enter a valid email address") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { loadReceiptDoc, receiptPdfBuffer } = await import("@/lib/receipt-link.server");
    const loaded = await loadReceiptDoc(supabase, data.saleId);
    if (!loaded) throw new Error("Sale not found");
    const { doc, sale } = loaded;
    const { receiptEmailHtml, receiptText, receiptFileName, RECEIPT_LOGO } = await import("@/lib/receipt-doc");
    const { BRAND } = await import("@/lib/brand");
    const { sendEmailOrThrow, SHOP_MAILBOX } = await import("@/lib/notify.server");
    const logoUrl = `${BRAND.siteUrl}${RECEIPT_LOGO.path}`;
    const pdf = await receiptPdfBuffer(doc);

    const first = (doc.customerName ?? "").split(" ")[0];
    await sendEmailOrThrow({
      to: data.to,
      replyTo: SHOP_MAILBOX,
      subject: `Your ${BRAND.name} receipt #${doc.receiptNo}`,
      text: `${first ? `Hi ${first},\n\n` : ""}Thanks for your purchase. Your receipt is below and attached.\n\n${receiptText(doc)}`,
      html: `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;margin:0 0 12px">${first ? `Hi ${first.replace(/[<>&]/g, "")},<br><br>` : ""}Thanks for your purchase at ${BRAND.name}. Your receipt is below and attached as a PDF.</p>${receiptEmailHtml(doc, logoUrl)}`,
      attachments: [
        { filename: receiptFileName(doc), contentType: "application/pdf", content: pdf },
      ],
    });

    // Remember the address on the till customer if they didn't have one yet.
    if (sale.pos_customer && !sale.pos_customer.email) {
      await supabase.from("pos_customers").update({ email: data.to }).eq("id", sale.pos_customer.id);
    }
    return { ok: true, to: data.to };
  });

/** The WhatsApp message for a sale's receipt (a text carrying the receipt link), plus the customer's number and email. */
export const getReceiptWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ saleId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { loadReceiptDoc, receiptLink } = await import("@/lib/receipt-link.server");
    const loaded = await loadReceiptDoc(supabase, data.saleId);
    if (!loaded) throw new Error("Sale not found");
    const { doc, sale } = loaded;
    const { BRAND } = await import("@/lib/brand");
    const first = (doc.customerName ?? "").split(" ")[0];
    // Single line breaks only: WhatsApp's desktop app keeps just the last
    // paragraph of a pre-filled message that contains blank lines.
    const text = [
      `${first ? `Hi ${first}, thank` : "Thank"} you for shopping at ${BRAND.name}!`,
      `Receipt #${doc.receiptNo}`,
      ...doc.items.map((it) => `- ${it.name}: ${it.value}`),
      `*Total: ${doc.total}*`,
      ...doc.payment.map((p) => `${p.label.trim()}: ${p.value}`),
      `View / download your receipt: ${receiptLink(data.saleId)}`,
    ].join("\n");
    return {
      phone: (sale.pos_customer?.phone as string | null) ?? null,
      email: (sale.pos_customer?.email as string | null) ?? null,
      text,
    };
  });

export const listSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      range: z.enum(["today", "week", "month", "all"]).default("today"),
      search: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    let since: Date | null = new Date();
    let until: Date | null = null;
    if (data.from || data.to) {
      since = data.from ? new Date(data.from) : null;
      until = data.to ? new Date(new Date(data.to).setHours(23, 59, 59, 999)) : null;
    } else if (data.range === "today") since.setHours(0, 0, 0, 0);
    else if (data.range === "week") since.setDate(since.getDate() - 7);
    else if (data.range === "month") since.setMonth(since.getMonth() - 1);
    else since = null;

    // Resolve search → matching sale IDs (once), then reuse in totals + page queries.
    let matchedSaleIds: string[] = [];
    let matchedCustomerIds: string[] = [];
    const searchTerm = (data.search ?? "").trim();
    if (searchTerm) {
      const like = `%${searchTerm}%`;
      // Match sales whose sale_items contain the typed word anywhere in the
      // product/item name — one word of a multi-word name is enough (ilike).
      // Constrain to the same date window as the listing and de-duplicate, so
      // the resulting id list stays small enough for a PostgREST query string.
      let itemsQ = supabase
        .from("sale_items")
        .select("sale_id, sale:sales!inner(created_at)")
        .ilike("name", like)
        .order("created_at", { ascending: false, referencedTable: "sale" })
        .limit(5000);
      if (since) itemsQ = itemsQ.gte("sale.created_at", since.toISOString());
      if (until) itemsQ = itemsQ.lte("sale.created_at", until.toISOString());
      const itemsRes = await itemsQ;
      if (itemsRes.error) console.error("sales product search failed", itemsRes.error.message);
      // Newest sales first, so a truncated list keeps the most relevant matches.
      const seen = new Set<string>();
      for (const r of ((itemsRes.data as any[]) ?? [])) {
        const id = r?.sale_id;
        if (id && !seen.has(id)) seen.add(id);
      }
      matchedSaleIds = Array.from(seen).slice(0, 300);

      const customersRes = await supabase
        .from("pos_customers")
        .select("id")
        .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
        .limit(100);
      matchedCustomerIds = ((customersRes.data as any[]) ?? []).map((c) => c.id);
    }

    const buildSearchOr = (s: string, saleIds: string[]) => {
      const like = `%${s}%`;
      const parts = [
        `description.ilike.${like}`,
        `notes.ilike.${like}`,
      ];
      // receipt_no is bigint — only add when the search is numeric
      if (/^\d+$/.test(s)) parts.push(`receipt_no.eq.${s}`);
      // id is uuid — only add when the search looks like a uuid
      if (/^[0-9a-f-]{8,}$/i.test(s)) parts.push(`id.eq.${s}`);
      if (saleIds.length) parts.push(`id.in.(${saleIds.join(",")})`);
      if (matchedCustomerIds.length) parts.push(`pos_customer_id.in.(${matchedCustomerIds.join(",")})`);
      return parts.join(",");
    };

    // Totals across the full filter (not just the page) — light query.
    let totalsQ = supabase
      .from("sales")
      .select("amount_pence, refunded, discount_pence, tax_pence, items:sale_items(qty, line_total_pence, cost_price_pence, product:products(cost_price_pence))")
      .is("deleted_at", null)
      .eq("is_credit_only", false)
      .limit(2000);
    if (since) totalsQ = totalsQ.gte("created_at", since.toISOString());
    if (until) totalsQ = totalsQ.lte("created_at", until.toISOString());
    if (searchTerm) totalsQ = totalsQ.or(buildSearchOr(searchTerm, matchedSaleIds));
    const { data: totalsRows } = await totalsQ;
    let totalAmount = 0, totalProfit = 0, refundedAmount = 0, count = 0;
    for (const r of totalsRows ?? []) {
      if ((r as any).refunded) { refundedAmount += (r as any).amount_pence ?? 0; continue; }
      totalAmount += (r as any).amount_pence ?? 0;
      count++;
      const items = Array.isArray((r as any).items) ? (r as any).items : [];
      const lineRevenue = items.reduce((s: number, it: any) => s + (it.line_total_pence ?? 0), 0);
      const cogs = items.reduce((s: number, it: any) => s + Math.round(Number(it.qty ?? 0) * (it.cost_price_pence ?? it.product?.cost_price_pence ?? 0)), 0);
      const tax = (r as any).tax_pence ?? 0;
      // Revenue is what was actually charged; line totals already net line discounts.
      const revenue = (r as any).amount_pence ?? Math.max(0, lineRevenue - ((r as any).discount_pence ?? 0));
      totalProfit += Math.max(0, revenue - tax) - cogs;
    }

    // Paged rows
    let q = supabase
      .from("sales")
      .select("*, pos_customer:pos_customers(name, phone, email), items:sale_items(qty, unit_price_pence, discount_pence, line_total_pence, name, description, cost_price_pence, mileage, product:products(cost_price_pence))")
      .is("deleted_at", null)
      .eq("is_credit_only", false)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (since) q = q.gte("created_at", since.toISOString());
    if (until) q = q.lte("created_at", until.toISOString());
    if (searchTerm) q = q.or(buildSearchOr(searchTerm, matchedSaleIds));
    const { data: rows, error } = await q;
    if (error) throw error;

    const enriched = (rows ?? []).map((r: any) => {
      const items = Array.isArray(r.items) ? r.items : [];
      const lineRevenue = items.reduce((s: number, it: any) => s + (it.line_total_pence ?? 0), 0);
      const cogs = items.reduce((s: number, it: any) => s + Math.round(Number(it.qty ?? 0) * (it.cost_price_pence ?? it.product?.cost_price_pence ?? 0)), 0);
      const tax = r.tax_pence ?? 0;
      const revenue = r.amount_pence ?? Math.max(0, lineRevenue - (r.discount_pence ?? 0));
      const profit = Math.max(0, revenue - tax) - cogs;
      return { ...r, profit_pence: profit };
    });


    return {
      sales: enriched,
      totalAmount,
      totalProfit,
      refundedAmount,
      count,
      nextOffset: (rows?.length ?? 0) < data.limit ? null : data.offset + data.limit,
    };
  });

// ============ Sale edit ============

const saleItemEditSchema = z.object({
  id: z.string().uuid().optional(),
  qty: z.number().positive().max(9999),
  unit_price_pence: z.number().int().min(0),
  discount_pence: z.number().int().min(0),
  name: z.string().trim().min(1).max(200).optional(),
  product_id: z.string().uuid().nullable().optional(),
  vat_rate: z.number().min(0).max(1).optional(),
  is_service: z.boolean().optional(),
  sku: z.string().max(120).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  cost_price_pence: z.number().int().min(0).nullable().optional(),
});

export const updateSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      saleId: z.string().uuid(),
      // "credit" is still accepted so historic credit sales can be edited
      // without changing their recorded payment method.
      payment_method: z.enum(["cash", "card", "bank_transfer", "split", "credit"]).optional(),
      notes: z.string().max(2000).nullable().optional(),
      description: z.string().max(500).nullable().optional(),
      discount_pence: z.number().int().min(0).optional(),
      created_at: z.string().min(1).nullable().optional(),
      pos_customer_id: z.string().uuid().nullable().optional(),
      items: z.array(saleItemEditSchema).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);

    // Load current sale + items
    const { data: sale, error: sErr } = await supabase.from("sales").select("*").eq("id", data.saleId).maybeSingle();
    if (sErr) throw sErr;
    if (!sale) throw new Error("Sale not found");

    // Sync items: update existing, insert new, delete removed
    if (data.items) {
      const { data: existing } = await supabase.from("sale_items").select("id").eq("sale_id", data.saleId);
      const existingIds = new Set((existing ?? []).map((r: any) => r.id));
      const keepIds = new Set(data.items.filter((it) => it.id && existingIds.has(it.id)).map((it) => it.id as string));

      // Deletes
      const toDelete = Array.from(existingIds).filter((id) => !keepIds.has(id as string)) as string[];
      if (toDelete.length) {
        const { error } = await supabase.from("sale_items").delete().in("id", toDelete);
        if (error) throw error;
      }

      // Updates + inserts
      for (const it of data.items) {
        const line = Math.max(0, Math.round(Number(it.qty) * it.unit_price_pence) - it.discount_pence);
        if (it.id && existingIds.has(it.id)) {
          const patch: any = {
            qty: it.qty,
            unit_price_pence: it.unit_price_pence,
            discount_pence: it.discount_pence,
            line_total_pence: line,
          };
          if (it.name) patch.name = it.name;
          if (it.description !== undefined) patch.description = it.description;
          if (it.cost_price_pence !== undefined) patch.cost_price_pence = it.cost_price_pence;
          const { error } = await supabase.from("sale_items").update(patch).eq("id", it.id);
          if (error) throw error;
        } else {
          if (!it.name) throw new Error("New item requires a name");
          const insert: any = {
            sale_id: data.saleId,
            name: it.name,
            qty: it.qty,
            unit_price_pence: it.unit_price_pence,
            discount_pence: it.discount_pence,
            line_total_pence: line,
            vat_rate: it.vat_rate ?? 0,
            is_service: it.is_service ?? false,
            product_id: it.product_id ?? null,
            sku: it.sku ?? null,
            description: it.description ?? null,
            cost_price_pence: it.cost_price_pence ?? null,
          };
          const { error } = await supabase.from("sale_items").insert(insert);
          if (error) throw error;
        }
      }
    }

    // Recompute totals from current items
    const { data: items } = await supabase.from("sale_items").select("qty, unit_price_pence, line_total_pence").eq("sale_id", data.saleId);
    const subtotal = (items ?? []).reduce((s: number, it: any) => s + Math.round(Number(it.qty) * it.unit_price_pence), 0);
    const linesTotal = (items ?? []).reduce((s: number, it: any) => s + (it.line_total_pence ?? 0), 0);
    const orderDiscount = data.discount_pence ?? sale.discount_pence ?? 0;
    const amount = Math.max(0, linesTotal - orderDiscount);

    const patch: any = {
      subtotal_pence: subtotal,
      discount_pence: orderDiscount,
      amount_pence: amount,
    };
    if (data.payment_method) patch.payment_method = data.payment_method;

    // Credit: what's owed follows the edited total; a sale with payments towards
    // it stays on credit so the payment history isn't orphaned.
    const method = data.payment_method ?? sale.payment_method;
    if (sale.payment_method === "credit" && method !== "credit") {
      if ((sale.credit_paid_pence ?? 0) > 0) {
        throw new Error("Payments have been taken towards this credit, so it has to stay on Credit.");
      }
      patch.credit_amount_pence = 0;
      patch.credit_paid_pence = 0;
      patch.credit_status = null;
    }
    if (method === "credit") {
      const customerId = data.pos_customer_id !== undefined ? data.pos_customer_id : sale.pos_customer_id;
      if (!customerId) throw new Error("A credit sale needs a customer.");
      patch.credit_amount_pence = amount;
    }
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.description !== undefined) patch.description = data.description;
    if (data.pos_customer_id !== undefined) patch.pos_customer_id = data.pos_customer_id;
    if (data.created_at) {
      const d = new Date(data.created_at);
      if (isNaN(d.getTime())) throw new Error("Invalid sale date");
      patch.created_at = d.toISOString();
    }
    const { error: uErr } = await supabase.from("sales").update(patch).eq("id", data.saleId);
    if (uErr) throw uErr;
    if (method === "credit") await refreshSaleCredit(supabase, data.saleId);

    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "sale_edited",
      label: String(sale.receipt_no ?? sale.id.slice(0, 8)),
      entityId: sale.id,
      details: { fields: Object.keys(data).filter((k) => k !== "saleId") },
    });

    return { ok: true };
  });




// Single-sale soft delete (staff-only) — sends to Recycle Bin.
export const deleteSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertStaff(supabase, userId);
    const { data: row } = await supabase.from("sales").select("receipt_no, amount_pence").eq("id", data.id).maybeSingle();
    const n = await softDeleteSales(supabase, [data.id], userId);
    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "sale_deleted",
      label: String(row?.receipt_no ?? data.id.slice(0, 8)),
      entityId: data.id,
      details: { totalPence: row?.amount_pence ?? null },
    });
    return { ok: true, deleted: n };
  });

// Admin-only: fully reverse a sale as if it never happened.
// Restores stock, removes refunds, then hard-deletes the sale.
export const undoSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const saleId = data.id;

    // Load sale
    const { data: sale, error: sErr } = await supabase.from("sales").select("*").eq("id", saleId).maybeSingle();
    if (sErr) throw sErr;
    if (!sale) throw new Error("Sale not found");

    // Restore stock for product-backed, non-service line items
    const { data: items } = await supabase.from("sale_items").select("id, product_id, qty, is_service").eq("sale_id", saleId);
    for (const it of items ?? []) {
      if (it.is_service || !it.product_id) continue;
      const { data: prod } = await supabase.from("products").select("stock_qty").eq("id", it.product_id).maybeSingle();
      if (prod) {
        const restored = (prod.stock_qty ?? 0) + Math.ceil(Number(it.qty) || 0);
        await supabase.from("products").update({ stock_qty: restored }).eq("id", it.product_id);
      }
    }

    // Delete refunds tied to this sale (refund_items cascade via refund_id)
    const { data: refunds } = await supabase.from("refunds").select("id").eq("sale_id", saleId);
    const refundIds = (refunds ?? []).map((r: any) => r.id);
    if (refundIds.length) {
      await supabase.from("refund_items").delete().in("refund_id", refundIds);
      await supabase.from("refunds").delete().in("id", refundIds);
    }

    // Cash taken towards a credit sale goes back out of the till; the
    // credit_payments rows go with the sale (ON DELETE CASCADE).
    if (sale.payment_method === "credit") {
      const { data: cashPays } = await supabase
        .from("credit_payments")
        .select("amount_pence")
        .eq("sale_id", saleId)
        .eq("method", "cash")
        .eq("status", "succeeded");
      const cashBack = (cashPays ?? []).reduce((a: number, p: any) => a + (p.amount_pence ?? 0), 0);
      if (cashBack > 0) {
        const { data: till } = await supabase
          .from("till_sessions")
          .select("id")
          .is("closed_at", null)
          .is("deleted_at", null)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (till?.id) {
          await supabase.from("till_cash_movements").insert({
            till_session_id: till.id,
            kind: "payout",
            amount_pence: cashBack,
            reason: `Undo credit sale #${sale.receipt_no ?? ""} · cash returned`,
            created_by: userId,
          });
        }
      }
    }

    // Delete line items then the sale itself
    await supabase.from("sale_items").delete().eq("sale_id", saleId);
    const { error: delErr } = await supabase.from("sales").delete().eq("id", saleId);
    if (delErr) throw delErr;

    await logActivity(supabase, {
      actorId: userId,
      module: "sales",
      action: "sale_undone",
      label: String(sale.receipt_no ?? saleId.slice(0, 8)),
      entityId: saleId,
      details: { totalPence: sale.amount_pence ?? null },
    });

    return { ok: true };
  });
