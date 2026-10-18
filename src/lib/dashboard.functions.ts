import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertRole(supabase: any, userId: string, roles: string[]) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  if (!(data ?? []).some((r: any) => roles.includes(r.role))) throw new Error("Forbidden");
}

const TZ = "Europe/London";

/** "YYYY-MM-DD" in London for the given instant. */
function londonDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at);
}

/** The UTC instant of midnight in London on a "YYYY-MM-DD" date (handles BST). */
function londonMidnight(day: string): Date {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(utcMidnight);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return new Date(utcMidnight.getTime() - (h * 60 + m) * 60_000);
}

const sum = (rows: Array<{ amount_pence: number | null }>) => rows.reduce((s, r) => s + (r.amount_pence ?? 0), 0);

/** Everything the admin dashboard shows, in one round trip. */
export const getDashboardOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertRole(supabase, userId, ["owner", "admin"]);
    await (await import("@/lib/recurring-expenses.server")).postDueRecurringExpensesQuietly();

    const now = new Date();
    const today = londonDate(now);
    const todayStart = londonMidnight(today);
    const weekDays = Array.from({ length: 7 }, (_, i) => londonDate(new Date(now.getTime() - (6 - i) * 86_400_000)));
    const weekStart = londonMidnight(weekDays[0]);
    const monthFirst = `${today.slice(0, 7)}-01`;
    const monthStart = londonMidnight(monthFirst);
    const [y, m] = monthFirst.split("-").map(Number);
    const nextMonthFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

    const [sales, recent, expenses, refunds, till, products, enquiries, newEnquiries, rentals, customers, negative] =
      await Promise.all([
        supabase
          .from("sales")
          .select("amount_pence, created_at")
          .is("deleted_at", null)
          .gte("created_at", monthStart < weekStart ? monthStart.toISOString() : weekStart.toISOString()),
        supabase
          .from("sales")
          .select("id, receipt_no, amount_pence, payment_method, created_at, pos_customer:pos_customers(name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("expenses")
          .select("amount_pence")
          .is("deleted_at", null)
          // A repeating expense's own row is its first occurrence (later ones are
          // generated copies), so it counts — same as the Expenses page and P&L.
          .gte("expense_date", monthFirst)
          .lt("expense_date", nextMonthFirst),
        supabase.from("refunds").select("amount_pence").is("deleted_at", null).gte("created_at", todayStart.toISOString()),
        supabase
          .from("till_sessions")
          .select("opened_at, opening_float_pence")
          .is("deleted_at", null)
          .is("closed_at", null)
          .order("opened_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name, stock_qty, min_stock, is_service")
          .is("deleted_at", null)
          .eq("is_active", true),
        supabase
          .from("contact_enquiries")
          .select("id, name, service, created_at")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(4),
        supabase.from("contact_enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
        supabase
          .from("rentals")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .or(`end_date.is.null,end_date.gte.${today}`),
        supabase.from("pos_customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("sales").select("amount_pence").is("deleted_at", null).lt("amount_pence", 0),
      ]);

    const saleRows = (sales.data ?? []) as Array<{ amount_pence: number; created_at: string }>;
    const byDay = new Map(weekDays.map((d) => [d, 0]));
    let todayPence = 0;
    let todayCount = 0;
    let weekPence = 0;
    let monthPence = 0;
    for (const r of saleRows) {
      const at = new Date(r.created_at);
      const day = londonDate(at);
      if (at >= monthStart) monthPence += r.amount_pence ?? 0;
      if (at >= weekStart) {
        weekPence += r.amount_pence ?? 0;
        byDay.set(day, (byDay.get(day) ?? 0) + (r.amount_pence ?? 0));
      }
      if (day === today) {
        todayPence += r.amount_pence ?? 0;
        todayCount += 1;
      }
    }

    const productRows = (products.data ?? []) as Array<{
      id: string; name: string; stock_qty: number | null; min_stock: number | null; is_service: boolean | null;
    }>;
    const lowStock = productRows
      .filter((p) => !p.is_service && (p.stock_qty ?? 0) <= (p.min_stock ?? 0))
      .sort((a, b) => (a.stock_qty ?? 0) - (b.stock_qty ?? 0));

    const negativeRows = (negative.data ?? []) as Array<{ amount_pence: number }>;

    return {
      today: { salesPence: todayPence, salesCount: todayCount, refundsPence: sum(refunds.data ?? []) },
      weekPence,
      monthPence,
      monthExpensesPence: sum(expenses.data ?? []),
      week: weekDays.map((d) => ({ day: d, pence: byDay.get(d) ?? 0 })),
      till: till.data
        ? { openedAt: till.data.opened_at as string, floatPence: (till.data.opening_float_pence as number) ?? 0 }
        : null,
      recentSales: (recent.data ?? []) as Array<{
        id: string; receipt_no: string | null; amount_pence: number; payment_method: string | null;
        created_at: string; pos_customer: { name: string } | null;
      }>,
      productsCount: productRows.length,
      lowStock: lowStock.slice(0, 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock_qty ?? 0 })),
      lowStockCount: lowStock.length,
      newEnquiries: (enquiries.data ?? []) as Array<{ id: string; name: string; service: string | null; created_at: string }>,
      newEnquiriesCount: newEnquiries.count ?? 0,
      activeRentals: rentals.count ?? 0,
      customersCount: customers.count ?? 0,
      negative: { count: negativeRows.length, pence: sum(negativeRows) },
    };
  });
