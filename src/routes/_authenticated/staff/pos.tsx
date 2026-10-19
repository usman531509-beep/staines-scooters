import { StaffGuard } from "@/components/StaffGuard";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { markSaleEdited } from "@/lib/last-edited-sale";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, ScanLine, X, CreditCard, Banknote, ArrowRightLeft, Printer, PanelLeftClose, PanelLeftOpen, Eye, EyeOff, Star, Menu, ChevronLeft, LogOut, AArrowDown, AArrowUp, SlidersHorizontal, Maximize2, Minimize2, ShoppingCart, Check, HandCoins } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { z } from "zod";
import { printInPlace } from "@/lib/print-in-place";
import { AccountShell } from "@/components/AccountShell";
import { useAppChrome } from "@/components/AppShell";
import { useSidebarHidden } from "@/hooks/use-sidebar-hidden";
import { CloudImage } from "@/components/CloudImage";
import { useAuth } from "@/lib/auth-client";
import { listCategories, listProducts, findProductByBarcode, recordSaleV2, getTopSellingProductIds, getSaleFull, updateSale, setProductBestSellerExcluded, setProductBestSellerPinned, undoSale, setCategoryHidden, reorderProducts, upsertProduct } from "@/lib/pos.functions";
import { beep } from "@/lib/beep";
import { useCatalogueRealtime } from "@/hooks/use-realtime";
import { PriceEntryModal } from "@/components/PriceEntryModal";
import { ProductForm } from "@/components/ProductForm";
import { CashPayDialog, CreditPayDialog, SplitPayDialog } from "@/components/till/TillModules";
import { getCustomerCredit } from "@/lib/credit.functions";
import { BRAND } from "@/lib/brand";
import { PosCustomerPicker, type PosCustomerRef } from "@/components/PosCustomerPicker";

/** Extra payment details captured by the cash / card+cash dialogs. */
type PayExtras = {
  method?: "cash" | "card" | "bank_transfer" | "split" | "credit";
  creditPaidNowPence?: number;
  creditPaidNowMethod?: "cash" | "card";
  cashTenderedPence?: number;
  cashPartPence?: number;
  cardPartPence?: number;
};


export const Route = createFileRoute("/_authenticated/staff/pos")({
  head: () => ({
    meta: [
      { title: `POS — ${BRAND.name} Staff` },
      { name: "description", content: `${BRAND.name} staff point of sale, basket and checkout.` },
      { property: "og:title", content: `POS — ${BRAND.name} Staff` },
      { property: "og:description", content: `${BRAND.name} staff point of sale, basket and checkout.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ editSale: z.string().uuid().optional() }).parse(s),
  component: () => (<StaffGuard perm="pos"><POS /></StaffGuard>),
  errorComponent: ({ error }) => <AccountShell title="POS" hideHeader><p className="text-sm text-primary">{error.message}</p></AccountShell>,
  notFoundComponent: () => <AccountShell title="POS" hideHeader><p>Not found</p></AccountShell>,
});

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  retail_price_pence: number;
  vat_rate: number;
  stock_qty: number;
  is_service: boolean;
  category_id: string | null;
  category?: { id: string; name: string; image_url?: string | null } | null;
  image_url?: string | null;
};
type CartLine = {
  productId?: string;
  name: string;
  sku: string | null;
  qty: number;
  unitPricePence: number;
  discountPence: number;
  vatRate: number;
  isService: boolean;
  description?: string;
  costPricePence?: number;
  existingItemId?: string;
  mileage?: number | null;
};

const PAY_LABEL = { cash: "Cash", card: "Card", bank_transfer: "Bank", split: "Card + Cash", credit: "Credit" } as const;

const fmt = (p: number) => {
  const abs = Math.abs(p);
  return `£${abs % 100 === 0 ? String(Math.trunc(p / 100)) : (p / 100).toFixed(2)}`;
};

function POS() {
  useCatalogueRealtime();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { editSale: editSaleId } = Route.useSearch();
  const isEditMode = !!editSaleId;
  const { isAdmin } = useAuth();
  const listCatsFn = useServerFn(listCategories);
  const listProdsFn = useServerFn(listProducts);
  const findProdFn = useServerFn(findProductByBarcode);
  const recordFn = useServerFn(recordSaleV2);
  const getSaleFn = useServerFn(getSaleFull);
  const updateSaleFn = useServerFn(updateSale);
  const setExcludeFn = useServerFn(setProductBestSellerExcluded);
  const setPinnedFn = useServerFn(setProductBestSellerPinned);
  const undoSaleFn = useServerFn(undoSale);

  const setCatHiddenFn = useServerFn(setCategoryHidden);
  const reorderFn = useServerFn(reorderProducts);
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-products"] }),
  });
  const excludeBestSeller = useMutation({
    mutationFn: (id: string) => setExcludeFn({ data: { id, excluded: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-products"] }),
    onError: (e: any) => alert(e?.message ?? "Failed to remove from Best Sellers"),
  });
  const pinBestSeller = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => setPinnedFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-products"] }),
    onError: (e: any) => alert(e?.message ?? "Failed to update Best Sellers"),
  });
  const toggleCatHidden = useMutation({
    mutationFn: (v: { id: string; hidden: boolean }) => setCatHiddenFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos-cats"] }); qc.invalidateQueries({ queryKey: ["cats-all"] }); qc.invalidateQueries({ queryKey: ["all-cats"] }); },
    onError: (e: any) => alert(e?.message ?? "Failed to update category"),
  });



  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank_transfer" | "split" | "credit">("card");
  const [orderDiscountPct] = useState(0);

  // Tell the app-update logic (src/routes/__root.tsx) not to reload while a
  // sale is in progress — a reload would wipe the in-memory basket.
  useEffect(() => {
    const busy = cart.length > 0;
    (window as any).__hmSaleInProgress = busy;
    return () => { (window as any).__hmSaleInProgress = false; };
  }, [cart.length]);
  const [orderDiscountFixedPence, setOrderDiscountFixedPence] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const lastDiscountInputPence = useRef(0);
  useEffect(() => {
    // Only resync the displayed string when pence changes from an external
    // source (preset, agreed-total, basket clear). Input-driven changes are
    // tracked in lastDiscountInputPence so we never reformat mid-keystroke.
    if (orderDiscountFixedPence !== lastDiscountInputPence.current) {
      lastDiscountInputPence.current = orderDiscountFixedPence;
      setDiscountInput(orderDiscountFixedPence === 0 ? "" : String((orderDiscountFixedPence / 100).toFixed(2)));
    }
  }, [orderDiscountFixedPence]);
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState<PosCustomerRef | null>(null);
  // Warn when the chosen customer still owes money on credit.
  const customerCreditFn = useServerFn(getCustomerCredit);
  const { data: customerCredit } = useQuery({
    queryKey: ["customer-credit", customer?.id],
    queryFn: () => customerCreditFn({ data: { customerId: customer!.id } }),
    enabled: !!customer?.id,
  });
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<{ id: string; total: number } | null>(null);
  // Auto-dismiss the yellow "Sale recorded" banner after 2 minutes
  useEffect(() => {
    if (!lastSale) return;
    const t = setTimeout(() => setLastSale(null), 120_000);
    return () => clearTimeout(t);
  }, [lastSale]);
  const [flashProductId, setFlashProductId] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const { hidden, toggle } = useSidebarHidden();
  const [editPrefilled, setEditPrefilled] = useState(false);

  // Prefill cart from an existing sale when ?editSale=<id> is present.
  const { data: editSaleData } = useQuery({
    queryKey: ["pos-edit-sale", editSaleId],
    queryFn: () => getSaleFn({ data: { saleId: editSaleId! } }),
    enabled: !!editSaleId,
    staleTime: 0,
  });

  useEffect(() => {
    if (!editSaleData || editPrefilled) return;
    const s: any = editSaleData.sale;
    const items: any[] = editSaleData.items ?? [];
    setCart(items.map((it) => ({
      existingItemId: it.id,
      productId: it.product_id ?? undefined,
      name: it.name,
      sku: it.sku ?? null,
      qty: Number(it.qty) || 1,
      unitPricePence: it.unit_price_pence,
      discountPence: it.discount_pence,
      vatRate: it.vat_rate ?? 0,
      isService: !!it.is_service,
      description: it.description ?? undefined,
      costPricePence: it.cost_price_pence ?? undefined,
    })));
    setOrderDiscountFixedPence(s.discount_pence ?? 0);
    setPaymentMethod((s.payment_method as any) ?? "card");
    setNotes(s.notes ?? "");
    setCustomer(s.pos_customer ?? null);
    setEditPrefilled(true);
  }, [editSaleData, editPrefilled]);

  // Prefill the basket from the "Add New Sale" page handoff (never saved yet).
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaleDate, setDraftSaleDate] = useState<string | null>(null);
  useEffect(() => {
    if (draftLoaded || typeof window === "undefined") return;
    setDraftLoaded(true);
    const raw = window.localStorage.getItem("pos-draft-sale");
    if (!raw) return;
    window.localStorage.removeItem("pos-draft-sale");
    try {
      const d = JSON.parse(raw);
      if (Array.isArray(d.items) && d.items.length) {
        setCart(d.items.map((it: any) => ({
          productId: it.productId ?? undefined,
          name: it.name,
          sku: null,
          qty: Number(it.qty) || 1,
          unitPricePence: it.unitPricePence ?? 0,
          discountPence: it.discountPence ?? 0,
          vatRate: 0,
          isService: false,
          costPricePence: it.costPricePence ?? undefined,
        })));
      }
      if (d.saleDate) setDraftSaleDate(d.saleDate);
      if (d.notes) setNotes(d.notes);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
    } catch {
      /* ignore malformed drafts */
    }
  }, [draftLoaded]);


  const [, setShowAllProducts] = useState(false);
  const topFn = useServerFn(getTopSellingProductIds);

  const { data: categories = [] } = useQuery({
    queryKey: ["pos-cats", isAdmin ? "all" : "visible"],
    queryFn: () => listCatsFn({ data: { includeHidden: isAdmin } }),
    staleTime: 5 * 60_000,
  });
  const sortedCategories = useMemo(() => {
    const list = [...(categories as any[])];
    list.sort((a, b) => {
      const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (so !== 0) return so;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
    return list;
  }, [categories]);
  const isBestSellers = categoryId === "__best_sellers__";
  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", isBestSellers ? null : categoryId],
    queryFn: () => listProdsFn({ data: { categoryId: isBestSellers ? undefined : (categoryId ?? undefined) } }),
    staleTime: 5 * 60_000,
  });
  const { data: topSold = [] } = useQuery({
    queryKey: ["pos-top-sold"],
    queryFn: () => topFn(),
    staleTime: 5 * 60_000,
  });

  const categoryImageById = useMemo(
    () => new Map((categories as any[]).map((c) => [c.id, c.image_url])),
    [categories],
  );
  const productImage = (p: Product) => p.image_url || p.category?.image_url || categoryImageById.get(p.category_id) || null;

  // Reset "show all" when category or search changes.
  useEffect(() => { setShowAllProducts(false); }, [categoryId, search]);

  // Totals
  const subtotal = cart.reduce((s, l) => s + Math.round(l.unitPricePence * l.qty), 0);
  const lineDiscounts = cart.reduce((s, l) => s + l.discountPence, 0);
  const afterLine = Math.max(0, subtotal - lineDiscounts);
  const orderDiscountPence = Math.min(afterLine, Math.round(afterLine * (orderDiscountPct / 100)) + orderDiscountFixedPence);
  const total = Math.max(0, afterLine - orderDiscountPence);
  const chargeTotal = total;

  const sortedProducts = useMemo(() => {
    const rank = new Map<string, number>();
    (topSold as { id: string; qty: number }[]).forEach((t, i) => rank.set(t.id, i));
    let list = [...(products as Product[])];
    if (isBestSellers) list = list.filter((p) => ((p as any).pin_to_best_sellers || rank.has(p.id)) && !(p as any).exclude_from_best_sellers);
    return list.sort((a, b) => {
      const ma = (a as any).pos_sort_order ?? null;
      const mb = (b as any).pos_sort_order ?? null;
      if (ma !== null || mb !== null) {
        if (ma === null) return 1;
        if (mb === null) return -1;
        if (ma !== mb) return ma - mb;
      }
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [products, topSold, isBestSellers]);

  const filteredProducts = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return sortedProducts;
    return sortedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.sku ?? "").toLowerCase().includes(s) ||
        (p.barcode ?? "").includes(s),
    );
  }, [sortedProducts, search]);

  // Show every product in the current category, sorted by best-sellers first (task 5).
  const canCollapse = false;
  const baseProducts = filteredProducts;

  // ===== Admin manual ordering: press & hold a tile, then drag it into place =====
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderOverride, setOrderOverride] = useState<string[] | null>(null);
  const holdTimer = useRef<any>(null);
  const draggedRef = useRef(false);

  const visibleProducts = useMemo(() => {
    if (!orderOverride) return baseProducts;
    const byId = new Map(baseProducts.map((p) => [p.id, p]));
    const out = orderOverride.map((id) => byId.get(id)).filter(Boolean) as Product[];
    for (const p of baseProducts) if (!orderOverride.includes(p.id)) out.push(p);
    return out;
  }, [baseProducts, orderOverride]);

  useEffect(() => { setOrderOverride(null); setDragId(null); }, [categoryId, search]);

  function startHold(id: string) {
    if (!isAdmin) return;
    clearTimeout(holdTimer.current);
    draggedRef.current = false;
    holdTimer.current = setTimeout(() => {
      setDragId(id);
      setOrderOverride(visibleProducts.map((p) => p.id));
      try { navigator.vibrate?.(20); } catch { /* ignore */ }
    }, 350);
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!dragId) return;
    draggedRef.current = true;
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const tile = el?.closest?.("[data-pid]") as HTMLElement | null;
    const overId = tile?.getAttribute("data-pid");
    if (!overId || overId === dragId) return;
    setOrderOverride((prev) => {
      const list = [...(prev ?? visibleProducts.map((p) => p.id))];
      const from = list.indexOf(dragId);
      const to = list.indexOf(overId);
      if (from < 0 || to < 0) return prev;
      list.splice(to, 0, list.splice(from, 1)[0]);
      return list;
    });
  }

  function endHold() {
    clearTimeout(holdTimer.current);
    if (dragId) {
      const ids = (orderOverride ?? visibleProducts.map((p) => p.id));
      reorder.mutate(ids);
      setDragId(null);
    }
  }

  const [labourModal, setLabourModal] = useState<{ product: Product } | null>(null);
  const [priceModal, setPriceModal] = useState<{ product: Product } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ product: Product; x: number; y: number } | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const upsertProductFn = useServerFn(upsertProduct);
  const saveProduct = useMutation({
    mutationFn: (p: any) => upsertProductFn({ data: p }),
    onSuccess: () => {
      setEditProduct(null);
      qc.invalidateQueries({ queryKey: ["pos-products"] });
      qc.invalidateQueries({ queryKey: ["all-products"] });
    },
    onError: (e: any) => alert(e?.message ?? "Save failed"),
  });

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, [ctxMenu]);


  function isLabourProduct(p: Product) {
    return p.name.trim().toLowerCase() === "labour";
  }

  // Automatic Belt Kit price-tier discount for a line, shown in the basket the
  // moment a product is added (£90 → 14.44% (£13 off), £110 → 30%).
  function autoLineDiscount(unitPricePence: number, qty: number, categoryName?: string | null) {
    if (!/belt\s*kit/i.test(categoryName ?? "")) return 0;
    let pct = 0;
    if (unitPricePence === 9000) pct = 14.44;
    else if (unitPricePence === 11000) pct = 30;
    return pct > 0 ? Math.round(unitPricePence * qty * (pct / 100)) : 0;
  }


  function addProduct(p: Product, priceOverridePence?: number, nameOverride?: string, mileage?: number | null) {
    if (isLabourProduct(p)) {
      beep();
      setFlashProductId(p.id);
      window.setTimeout(() => setFlashProductId((cur) => (cur === p.id ? null : cur)), 900);
      setLabourModal({ product: p });
      return;
    }
    let unitPricePence = priceOverridePence ?? p.retail_price_pence;
    // Always confirm price + (editable) title when a product tile is tapped.
    if (priceOverridePence == null) {
      setPriceModal({ product: p });
      return;
    }
    if (unitPricePence < 0) unitPricePence = 0;
    beep();
    setFlashProductId(p.id);
    window.setTimeout(() => {
      setFlashProductId((cur) => (cur === p.id ? null : cur));
    }, 900);

    // Clear the search box so all products display normally again after adding.
    setSearch("");

    setCart((c) => {
      const existing = c.findIndex((l) => l.productId === p.id);
      if (existing >= 0) {
        const next = [...c];
        const line = next[existing];
        const newQty = line.qty + 1;
        const auto = autoLineDiscount(line.unitPricePence, newQty, p.category?.name);
        next[existing] = {
          ...line,
          name: nameOverride ?? line.name,
          mileage: mileage ?? line.mileage ?? null,
          qty: newQty,
          discountPence: auto > 0 ? auto : line.discountPence,
        };
        return next;
      }
      return [
        ...c,
        {
          productId: p.id,
          name: nameOverride ?? p.name,
          sku: p.sku,
          qty: 1,
          unitPricePence,
          discountPence: autoLineDiscount(unitPricePence, 1, p.category?.name),
          vatRate: p.vat_rate,
          isService: p.is_service,
          mileage: mileage ?? null,
        },
      ];
    });

  }

  function addLabourLine(cost: number, retail: number, description: string, title?: string) {
    if (!labourModal) return;
    const p = labourModal.product;
    setSearch("");
    setCart((c) => [
      ...c,
      {
        productId: p.id,
        name: (title ?? "").trim() || p.name,
        sku: p.sku,
        qty: 1,
        unitPricePence: retail,
        discountPence: 0,
        vatRate: p.vat_rate,
        isService: p.is_service,
        description: description.trim() || undefined,
        costPricePence: cost,
      },
    ]);
    setLabourModal(null);
  }



  async function onScan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const p = await findProdFn({ data: { code: trimmed } });
      if (p) {
        // Scanned barcodes go straight in when the product already has a price.
        const pr = (p as any).retail_price_pence as number | null;
        if (pr && pr > 0) addProduct(p as any, pr);
        else addProduct(p as any);
        return;
      }
      setError(`Nothing matched ${trimmed}`);
    } catch (e: any) {
      setError(e.message ?? "Scan failed");
    }
  }

  const checkout = useMutation({
    mutationFn: async (extras?: PayExtras) => {
      if (isEditMode && editSaleId) {
        await updateSaleFn({
          data: {
            saleId: editSaleId,
            payment_method: paymentMethod,
            notes: notes || null,
            discount_pence: orderDiscountFixedPence,
            pos_customer_id: customer?.id ?? null,
            items: cart.map((l) => ({
              id: l.existingItemId,
              name: l.name,
              qty: l.qty,
              unit_price_pence: l.unitPricePence,
              discount_pence: l.discountPence,
              vat_rate: l.vatRate,
              is_service: l.isService,
              product_id: l.productId ?? null,
              sku: l.sku,
              description: l.description ?? null,
              cost_price_pence: l.costPricePence ?? null,
            })),
          },
        });
        return { edited: true } as any;
      }
      return recordFn({
        data: {
          items: cart,
          paymentMethod: extras?.method ?? paymentMethod,
          orderDiscountPence,
          notes: notes || undefined,
          saleDate: draftSaleDate ?? undefined,
          cashTenderedPence: extras?.cashTenderedPence ?? null,
          cashPartPence: extras?.cashPartPence ?? null,
          cardPartPence: extras?.cardPartPence ?? null,
          creditPaidNowPence: extras?.creditPaidNowPence ?? null,
          creditPaidNowMethod: extras?.creditPaidNowMethod ?? null,
          customerId: customer?.id ?? null,
        },
      });
    },
    onSuccess: (r: any) => {
      if (r?.edited && editSaleId) {
        markSaleEdited(editSaleId);
        qc.invalidateQueries();
        navigate({ to: "/staff/sales/$saleId", params: { saleId: editSaleId } });
        return;
      }
      setLastSale({ id: r.saleId, total: r.total });
      setCart([]);
      setOrderDiscountFixedPence(0);
      setNotes("");
      setCustomer(null);
      setDraftSaleDate(null);
      setPaymentMethod("card");
      qc.invalidateQueries();
    },
    onError: (e: any) => setError(e.message ?? "Checkout failed"),
  });

  const [payDialog, setPayDialog] = useState<null | "cash" | "split" | "credit">(null);

  async function onChargeClick(extras?: PayExtras) {
    setError(null);
    checkout.mutate(extras);
  }

  /** Card button: record the sale straight away as a card payment (no card machine). */
  async function payByCard() {
    setError(null);
    setPaymentMethod("card");
    await onChargeClick({ method: "card" });
  }

  /** Card + Cash: record both portions directly without contacting a card machine. */
  async function paySplit(cashPence: number) {
    setError(null);
    const cardPence = Math.max(0, chargeTotal - cashPence);
    setPayDialog(null);
    await onChargeClick({
      method: "split",
      cashPartPence: cashPence,
      cardPartPence: cardPence,
      cashTenderedPence: cashPence,
    });
  }





  /** The single Charge button: takes the payment the way chosen in the tabs above it. */
  function chargeSelected() {
    setError(null);
    if (isEditMode) return void onChargeClick();
    if (paymentMethod === "card") return void payByCard();
    if (paymentMethod === "split") return setPayDialog("split");
    if (paymentMethod === "credit") {
      if (!customer) return setError("Choose the customer first — a credit sale needs to know who owes it.");
      return setPayDialog("credit");
    }
    void onChargeClick({ method: paymentMethod });
  }

  useEffect(() => { scanInputRef.current?.focus(); }, []);

  // Auto fullscreen / sidebar hide disabled per user request.

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
      else void document.exitFullscreen?.().catch(() => {});
    } catch { /* ignored */ }
  };
  // Chrome-free POS inside the app: host back / Menu / Sign out in this toolbar.
  const chrome = useAppChrome();
  const chromeless = !!chrome?.chromeless;

  // Product title / price font size adjuster (persisted locally).
  const [fontScale, setFontScale] = useState(1);
  const [colCount, setColCount] = useState(5);
  useEffect(() => {
    try {
      const v = parseFloat(window.localStorage.getItem("pos:fontScale") ?? "1");
      if (!isNaN(v) && v >= 0.7 && v <= 2) setFontScale(v);
      const c = parseInt(window.localStorage.getItem("pos:colCount") ?? "5", 10);
      if (!isNaN(c) && c >= 5 && c <= 9) setColCount(c);
    } catch { /* ignored */ }
  }, []);
  const changeColCount = (n: number) => {
    const next = Math.min(9, Math.max(5, n));
    setColCount(next);
    try { window.localStorage.setItem("pos:colCount", String(next)); } catch { /* ignored */ }
  };
  const changeFontScale = (delta: number) => {
    setFontScale((prev) => {
      const next = Math.min(2, Math.max(0.7, Math.round((prev + delta) * 100) / 100));
      try { window.localStorage.setItem("pos:fontScale", String(next)); } catch { /* ignored */ }
      return next;
    });
  };
  const nameFontSize = `${Math.round(14 * fontScale)}px`;
  const priceFontSize = `${Math.round(13 * fontScale)}px`;

  return (
    <AccountShell compact hideHeader fullWidth hideFooter hideFloating hideLastSignIn>
      {/* Admins have the bottom tab bar (4.25rem), so the till stops above it. */}
      <div className={`grid w-full gap-3 overflow-hidden p-0 xl:grid-cols-[minmax(0,1fr)_400px] ${isAdmin ? "h-[calc(100dvh-4.25rem)]" : "h-[100dvh]"}`}>
        {/* LEFT — products */}
        <div className="flex min-h-0 flex-col space-y-4 overflow-y-auto pr-1">
          {/* Scan + search */}
          <div className={chromeless ? "border-b border-border bg-surface-elevated px-2 pb-2 pt-0" : "rounded-md border border-border bg-surface-elevated p-3"}>
            <div className="flex flex-wrap items-center gap-2">
              {chromeless && chrome?.showMenu && (
                <button
                  type="button"
                  onClick={chrome.toggleMenu}
                  aria-label={chrome.menuOpen ? "Close navigation menu" : "Open navigation menu"}
                  className="order-first inline-flex items-center gap-2 rounded-sm border border-border bg-surface-elevated px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
                >
                  {chrome.menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Menu
                </button>
              )}
              {chromeless && chrome?.showBack && (
                <button
                  type="button"
                  onClick={chrome.goBack}
                  aria-label="Go back"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-surface-elevated text-primary hover:border-primary"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {!chromeless && (
                <button
                  onClick={() => { if (chrome) chrome.toggleMenu(); else toggle(); }}
                  title={chrome ? (chrome.menuOpen ? "Close navigation" : "Open navigation") : hidden ? "Show menu" : "Hide menu"}
                  aria-label={chrome ? (chrome.menuOpen ? "Close navigation" : "Open navigation") : hidden ? "Show menu" : "Hide menu"}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated hover:bg-accent hover:text-accent-foreground"
                >
                  {chrome ? (chrome.menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />) : hidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>
              )}

              <div className="relative flex-1 min-w-[200px]">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  ref={scanInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Scan / search parts…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const v = (e.target as HTMLInputElement).value;
                      onScan(v);
                      setSearch("");
                    }
                  }}
                  className="h-10 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              {isAdmin && (
                <button
                  type="button"
                  title="Record a sale manually"
                  onClick={() => navigate({ to: "/staff/sales/new" })}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> New sale
                </button>
              )}
              {isAdmin && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Display options"
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      <SlidersHorizontal className="h-4 w-4" /> View
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 rounded-xl p-4">
                    <p className="text-sm font-semibold">Display</p>
                    <div className="mt-3 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-ink-muted">Product text</span>
                        <span className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Decrease product text size"
                            onClick={() => changeFontScale(-0.1)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
                          >
                            <AArrowDown className="h-4 w-4" />
                          </button>
                          <span className="w-12 text-center font-semibold tabular-nums">{Math.round(fontScale * 100)}%</span>
                          <button
                            type="button"
                            title="Increase product text size"
                            onClick={() => changeFontScale(0.1)}
                            className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-accent"
                          >
                            <AArrowUp className="h-4 w-4" />
                          </button>
                        </span>
                      </div>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-ink-muted">Products per row</span>
                        <select
                          value={colCount}
                          onChange={(e) => changeColCount(parseInt(e.target.value, 10))}
                          className="h-8 rounded-lg border border-border bg-surface-elevated px-2 text-sm"
                        >
                          {[5, 6, 7, 8, 9].map((n) => (
                            <option key={n} value={n}>{n} columns</option>
                          ))}
                        </select>
                      </label>
                      {sortedCategories.length > 0 && (
                        <div className="grid gap-2 border-t border-border pt-3">
                          <span className="text-ink-muted">Categories on the till</span>
                          <span className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              title="Hide every category from POS (Best Sellers and All always stay)"
                              onClick={() => sortedCategories.filter((c: any) => !c.hidden).forEach((c: any) => toggleCatHidden.mutate({ id: c.id, hidden: true }))}
                              className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 font-medium hover:bg-accent"
                            >
                              <EyeOff className="h-4 w-4 shrink-0" /> Hide all
                            </button>
                            <button
                              type="button"
                              title="Show every category in POS"
                              onClick={() => sortedCategories.filter((c: any) => c.hidden).forEach((c: any) => toggleCatHidden.mutate({ id: c.id, hidden: false }))}
                              className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 font-medium hover:bg-accent"
                            >
                              <Eye className="h-4 w-4 shrink-0" /> Show all
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <button
                onClick={toggleFullscreen}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated hover:bg-accent hover:text-accent-foreground"
                title={isFullscreen ? "Exit full screen" : "Full screen"}
                aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              {chromeless && chrome && (
                <button
                  onClick={chrome.signOut}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-elevated px-3 py-2 text-[11px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              )}

            </div>
            <div className="mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
              <CatChip active={isBestSellers} onClick={() => setCategoryId("__best_sellers__")}><Star className="h-3.5 w-3.5" /> Best sellers</CatChip>
              <CatChip active={categoryId === null} onClick={() => setCategoryId(null)}>All</CatChip>
              {sortedCategories.filter((c: any) => !c.hidden).map((c) => (
                <div
                  key={c.id}
                  className={`inline-flex shrink-0 items-center overflow-hidden rounded-full text-sm font-semibold transition-colors ${categoryId === c.id ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface-elevated text-foreground"}`}
                >
                  <button
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`whitespace-nowrap py-2 ${isAdmin ? "pl-4 pr-2.5" : "px-4"} ${categoryId === c.id ? "" : "hover:bg-accent hover:text-accent-foreground"}`}
                  >
                    {c.name}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Hide from POS"
                      aria-label={`Hide ${c.name} from POS`}
                      onClick={(e) => { e.stopPropagation(); toggleCatHidden.mutate({ id: c.id, hidden: true }); }}
                      className={`flex items-center self-stretch border-l py-2 pl-2 pr-3 ${categoryId === c.id ? "border-primary-foreground/30 text-primary-foreground/80 hover:text-primary-foreground" : "border-border text-ink-muted hover:bg-accent hover:text-primary"}`}
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Product grid — top 8 best-sellers first, scrollable */}
          <div className="rounded-md pb-[calc(env(safe-area-inset-bottom)+7rem)]">
            <div
              className="grid gap-1.5 sm:gap-2"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`, ...(dragId ? { touchAction: "none" as const } : {}) }}
              onPointerMove={(e) => { if (dragId) { e.preventDefault(); moveDrag(e.clientX, e.clientY); } }}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onPointerLeave={() => { clearTimeout(holdTimer.current); }}
            >
              {visibleProducts.map((p) => {
                const isFlashing = flashProductId === p.id;
                return (
                  <button
                    key={p.id}
                    data-pid={p.id}
                    onPointerDown={() => startHold(p.id)}
                    onClick={() => {
                      clearTimeout(holdTimer.current);
                      if (draggedRef.current) { draggedRef.current = false; return; }
                      addProduct(p);
                    }}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border-2 border-primary bg-white text-left transition-transform duration-200 hover:shadow-[var(--shadow-card)] ${isFlashing ? "animate-pos-pop ring-4 ring-primary/40" : ""} ${dragId === p.id ? "scale-95 opacity-70 ring-4 ring-primary/60" : ""}`}
                  >
                    {isFlashing && (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg animate-in fade-in zoom-in-90" aria-hidden>
                        <Check className="h-3.5 w-3.5" /> Added
                      </span>
                    )}
                    <div className="relative aspect-square w-full overflow-hidden bg-white p-1.5 sm:p-3">
                      <CloudImage
                        src={productImage(p)}
                        alt={p.name}
                        className={`h-full w-full object-contain transition ${isFlashing ? "opacity-60" : "group-hover:scale-105"}`}
                        fallback={
                          <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-widest text-ink-muted">No image</span>
                        }
                      />
                       {!p.is_service && p.stock_qty <= 0 && (
                        <span className="absolute right-1.5 top-1.5 rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary-foreground">Out</span>
                      )}
                      {isAdmin && isBestSellers && (
                        <button
                          type="button"
                          title="Remove from Best Sellers"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove "${p.name}" from Best Sellers?`)) {
                              if ((p as any).pin_to_best_sellers) pinBestSeller.mutate({ id: p.id, pinned: false });
                              else excludeBestSeller.mutate(p.id);
                            }
                          }}
                          className="absolute left-1.5 top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full border border-primary bg-white text-primary shadow hover:bg-primary hover:text-primary-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && !isBestSellers && (
                        <button
                          type="button"
                          title={(p as any).pin_to_best_sellers ? "Remove from Best Sellers" : "Add to Best Sellers"}
                          onClick={(e) => {
                            e.stopPropagation();
                            pinBestSeller.mutate({ id: p.id, pinned: !(p as any).pin_to_best_sellers });
                          }}
                          className={`absolute left-1.5 top-1.5 z-20 grid h-6 w-6 place-items-center rounded-full border border-primary shadow ${(p as any).pin_to_best_sellers ? "bg-primary text-primary-foreground" : "bg-white text-primary hover:bg-primary hover:text-primary-foreground"}`}
                        >
                          <Star className="h-3.5 w-3.5" fill={(p as any).pin_to_best_sellers ? "currentColor" : "none"} />
                        </button>
                      )}
                      {!/^\s*free\s+engine\s+oil\s*$/i.test(p.name) && (
                        <span onContextMenu={(e) => { if (!isAdmin) return; e.preventDefault(); e.stopPropagation(); setCtxMenu({ product: p, x: e.clientX, y: e.clientY }); }} className="absolute bottom-1 left-1.5 z-20 font-bold text-primary" style={{ fontSize: priceFontSize }}>{fmt(p.retail_price_pence)}</span>
                      )}
                    </div>

                    <div className="mt-auto flex flex-1 flex-col justify-start border-t-2 border-primary bg-primary px-1.5 py-1 sm:px-3 sm:py-2">
                      <p className="font-bold uppercase leading-tight tracking-wide text-primary-foreground break-words" style={{ fontSize: nameFontSize }}>{p.name}</p>
                    </div>


                  </button>
                );
              })}
              {visibleProducts.length === 0 && (
                <p className="col-span-full py-10 text-center text-sm text-ink-muted">No products match.</p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — cart + checkout */}
        <div className="flex min-h-0 flex-col space-y-4 overflow-y-auto pr-1">
          <PosCustomerPicker value={customer} onChange={setCustomer} disabled={checkout.isPending} />
          {customer && (customerCredit?.outstandingPence ?? 0) > 0 && (
            <div className="-mt-2 flex items-center justify-between gap-2 rounded-lg border border-primary bg-primary/15 px-3 py-2 text-xs">
              <span>
                <strong>{customer.name}</strong> owes <strong>{fmt(customerCredit!.outstandingPence)}</strong> on credit
              </span>
              <button type="button" onClick={() => navigate({ to: "/staff/credit" })} className="font-semibold underline">
                View
              </button>
            </div>
          )}
          {/* Payment + Totals + Charge (top of basket) */}
          <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
            {/* Pick how they pay here; the one button below takes the payment. */}
            <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1">
              <PayBtn active={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} icon={Banknote}>Cash</PayBtn>
              <PayBtn active={paymentMethod === "card"} onClick={() => setPaymentMethod("card")} icon={CreditCard}>Card</PayBtn>
              <PayBtn active={paymentMethod === "bank_transfer"} onClick={() => setPaymentMethod("bank_transfer")} icon={ArrowRightLeft}>Bank</PayBtn>
              <PayBtn active={paymentMethod === "split"} onClick={() => setPaymentMethod("split")} icon={ArrowRightLeft}>Split</PayBtn>
              <PayBtn active={paymentMethod === "credit"} onClick={() => setPaymentMethod("credit")} icon={HandCoins}>Credit</PayBtn>
            </div>
            <div className="mt-3 space-y-1">
              <Totals label="Subtotal" value={fmt(subtotal)} />
              {lineDiscounts > 0 && <Totals label="Line discounts" value={`− ${fmt(lineDiscounts)}`} muted />}
              {orderDiscountPence > 0 && <Totals label="Order discount" value={`− ${fmt(orderDiscountPence)}`} muted />}
              <label className="flex items-center justify-between gap-3 pt-1 text-sm">
                <span className="text-ink-muted">Discount (£)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={discountInput}
                  onChange={(e) => { const raw = e.target.value.replace(/[^0-9.]/g, ""); setDiscountInput(raw); const p = Math.max(0, Math.round((parseFloat(raw) || 0) * 100)); lastDiscountInputPence.current = p; setOrderDiscountFixedPence(p); }}
                  onBlur={() => { const p = orderDiscountFixedPence; lastDiscountInputPence.current = p; setDiscountInput(p === 0 ? "" : String((p / 100).toFixed(2))); }}
                  className="h-9 w-28 rounded-lg border border-border bg-input px-3 text-right text-sm outline-none focus:border-primary"
                />
              </label>
              <div className="my-2 border-t border-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-ink-muted">Total</span>
                <span className="text-3xl font-bold tracking-tight tabular-nums">{fmt(chargeTotal)}</span>
              </div>
              {orderDiscountFixedPence > 0 && (
                <p className="-mt-0.5 text-right text-[10px] font-medium text-ink-muted">
                  Was {fmt(Math.min(afterLine, chargeTotal + orderDiscountFixedPence))}
                </p>
              )}
            </div>

            {isEditMode && (
              <div className="mt-3 rounded-sm border border-primary/40 bg-primary/10 px-3 py-2 text-[11px] text-primary">
                Editing sale — add or remove products, then save changes.
                <button
                  onClick={() => navigate({ to: "/staff/sales/$saleId", params: { saleId: editSaleId! } })}
                  className="ml-2 underline"
                >Cancel</button>
              </div>
            )}
            <button
              type="button"
              disabled={cart.length === 0 || checkout.isPending}
              onClick={chargeSelected}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {checkout.isPending
                ? "Saving…"
                : isEditMode
                  ? `Save changes · ${fmt(chargeTotal)}`
                  : `Charge ${fmt(chargeTotal)} · ${PAY_LABEL[paymentMethod]}`}
            </button>

            {payDialog === "cash" && (
              <CashPayDialog
                totalPence={chargeTotal}
                busy={checkout.isPending}
                onCancel={() => setPayDialog(null)}
                onConfirm={(tendered) => { setPayDialog(null); void onChargeClick({ method: "cash", cashTenderedPence: tendered }); }}
              />
            )}

            {payDialog === "credit" && customer && (
              <CreditPayDialog
                totalPence={chargeTotal}
                customerName={customer.name}
                busy={checkout.isPending}
                onCancel={() => setPayDialog(null)}
                onConfirm={(paidNowPence, method) => {
                  setPayDialog(null);
                  setPaymentMethod("credit");
                  void onChargeClick({ method: "credit", creditPaidNowPence: paidNowPence, creditPaidNowMethod: method });
                }}
              />
            )}

            {payDialog === "split" && (
              <SplitPayDialog
                totalPence={chargeTotal}
                busy={checkout.isPending}
                status={null}
                onCancel={() => setPayDialog(null)}
                onConfirm={(cashPence) => void paySplit(cashPence)}
              />
            )}

            {error && <p className="mt-2 text-xs text-primary">{error}</p>}
            {lastSale && (
              <div className="mt-4 overflow-hidden rounded-lg border-2 border-sale bg-sale text-sale-foreground shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sale-foreground text-sale text-lg font-black">✓</span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Sale recorded</p>
                      <p className="font-display text-xl font-bold leading-tight">
                        {fmt(lastSale.total)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => printInPlace(`/staff/receipt/${lastSale.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-sm bg-sale-foreground px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-sale hover:opacity-90"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print
                    </button>
                    {isAdmin && (
                      <button
                        onClick={async () => {
                          if (!lastSale) return;
                          if (!confirm("Undo this sale? Stock will be restored as if it never happened.")) return;
                          try {
                            await undoSaleFn({ data: { id: lastSale.id } });
                            setLastSale(null);
                            qc.invalidateQueries({ queryKey: ["sales"] });
                            qc.invalidateQueries({ queryKey: ["products"] });
                            qc.invalidateQueries({ queryKey: ["loyalty"] });
                          } catch (e: any) {
                            alert(e?.message ?? "Undo failed");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-sm border border-sale-foreground/60 bg-sale-foreground/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-sale-foreground hover:bg-sale-foreground hover:text-sale"
                      >
                        Undo sale
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Cart */}
          <div className="rounded-xl border border-border bg-surface-elevated shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Cart</p>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
                {cart.length} {cart.length === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="max-h-[340px] divide-y divide-border overflow-auto">
              {cart.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-ink-muted">
                  <ShoppingCart className="h-6 w-6 opacity-50" />
                  Scan a barcode or tap a product to add it.
                </div>
              )}
              {cart.map((l, i) => {
                const isFreeOil = /^\s*free\s+engine\s+oil\s*$/i.test(l.name);
                return (
                <div key={i} className="space-y-2 px-4 py-3 text-base">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground break-words">{l.name}</p>
                    <div className="flex items-center gap-2">
                      {!isFreeOil && <span className="text-lg font-bold tabular-nums text-foreground">{fmt(Math.max(0, Math.round(l.unitPricePence * l.qty) - l.discountPence))}</span>}
                      <button onClick={() => setCart((c) => c.filter((_, j) => j !== i))} className="text-ink-muted hover:text-primary"><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                  <div className="flex flex-nowrap items-center gap-2 text-sm text-ink-muted">
                    <button onClick={() => setCart((c) => c.map((x, j) => j === i ? { ...x, qty: Math.max(0.5, x.qty - 1) } : x))} className="rounded-sm border border-border p-1"><Minus className="h-4 w-4" /></button>
                    <input
                      type="number" min={0.5} step={0.5} value={l.qty}
                      onChange={(e) => { const v = +e.target.value || 0; setCart((c) => c.map((x, j) => j === i ? { ...x, qty: Math.max(0.5, v) } : x)); }}
                      className="w-14 sm:w-16 rounded-sm border border-border bg-input px-1 py-1 text-center text-base text-foreground"
                    />
                    <button onClick={() => setCart((c) => c.map((x, j) => j === i ? { ...x, qty: x.qty + 1 } : x))} className="rounded-sm border border-border p-1"><Plus className="h-4 w-4" /></button>
                    {!isFreeOil && <>
                    <span>×</span>
                    <span className="text-foreground">£</span>
                    <input
                      type="number" min={0} step="any" value={l.unitPricePence === 0 ? "" : String(l.unitPricePence / 100)}
                      onChange={(e) => { const v = Math.max(0, Math.round((+e.target.value || 0) * 100)); setCart((c) => c.map((x, j) => j === i ? { ...x, unitPricePence: v } : x)); }}
                      className="w-20 sm:w-24 rounded-sm border border-border bg-input px-1 py-1 text-right text-base text-foreground"
                      title="Unit price"
                    />
                    <span className="ml-auto flex items-center gap-1" title="Line discount in £">
                      <span>− £</span>
                      <input
                        type="number" min={0} step="any" value={l.discountPence === 0 ? "" : String(l.discountPence / 100)}
                        onChange={(e) => { const v = Math.max(0, Math.round((+e.target.value || 0) * 100)); setCart((c) => c.map((x, j) => j === i ? { ...x, discountPence: v } : x)); }}
                        className="w-16 sm:w-20 rounded-sm border border-border bg-input px-1 py-1 text-right text-base text-foreground"
                      />
                    </span>
                    </>}
                  </div>
                </div>
                );
              })}

            </div>
          </div>

        </div>
      </div>
      {ctxMenu && (
        <div
          className="fixed z-[95] overflow-hidden rounded-md border border-border bg-surface shadow-lg"
          style={{ left: Math.min(ctxMenu.x, (typeof window !== "undefined" ? window.innerWidth : 400) - 180), top: Math.min(ctxMenu.y, (typeof window !== "undefined" ? window.innerHeight : 400) - 60) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setEditProduct(ctxMenu.product); setCtxMenu(null); }}
            className="block w-full px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest hover:bg-surface-elevated"
          >Edit this product</button>
        </div>
      )}

      {editProduct && (
        <ProductForm
          initial={editProduct}
          categories={categories as any[]}
          onCancel={() => setEditProduct(null)}
          onSave={(p) => saveProduct.mutate(p)}
          saving={saveProduct.isPending}
        />
      )}

      {priceModal && (
        <PriceEntryModal
          productId={priceModal.product.id}
          productName={priceModal.product.name}
          initialPence={priceModal.product.retail_price_pence}
          onCancel={() => setPriceModal(null)}
          onConfirm={(pence, nameOverride, mileage) => {
            const prod = priceModal.product;
            setPriceModal(null);
            addProduct(prod, pence, nameOverride, mileage);
          }}
        />
      )}

      {labourModal && (
        <LabourModal
          defaultTitle={labourModal.product.name}
          onCancel={() => setLabourModal(null)}
          onSave={addLabourLine}
        />
      )}

    </AccountShell>
  );
}


function LabourModal({
  defaultTitle,
  onCancel,
  onSave,
}: {
  defaultTitle: string;
  onCancel: () => void;
  onSave: (costPence: number, retailPence: number, description: string, title: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [retailStr, setRetailStr] = useState("");
  const [description, setDescription] = useState("");
  const canSave = parseFloat(retailStr || "0") > 0 && title.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    const retail = Math.max(0, Math.round(parseFloat(retailStr || "0") * 100));
    onSave(0, retail, description, title);
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        style={{ height: "3in", maxHeight: "3in" }}
      >
        <div className="flex shrink-0 items-center justify-between bg-primary px-4 py-2 text-primary-foreground">
          <h2 className="font-display text-lg uppercase tracking-widest">Labour</h2>
          <button onClick={onCancel} aria-label="Close" className="rounded-sm p-1 hover:bg-primary-foreground/20"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Title (this sale only)</span>
              <input
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
                placeholder="e.g. Brake bleed & fluid change"
                className="mt-1 w-full rounded-md border-2 border-border bg-input px-3 py-2 text-base font-semibold focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex w-[7.5rem] shrink-0 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Price £</span>
              <input
                type="number" min={0} step="any" value={retailStr}
                onChange={(e) => setRetailStr(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
                placeholder="0.00"
                className="mt-1 w-full rounded-md border-2 border-border bg-input px-2 py-2 text-center text-xl font-bold focus:border-primary focus:outline-none"
              />
            </label>
          </div>

          <label className="flex min-h-0 flex-1 flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work carried out…"
              className="mt-1 min-h-0 w-full flex-1 resize-none rounded-md border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-elevated px-3 py-2">
          <button onClick={onCancel} className="rounded-sm border border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest hover:border-primary">Cancel</button>
          <button
            disabled={!canSave}
            onClick={save}
            className="rounded-sm bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
          >Add to basket</button>
        </div>
      </div>
    </div>
  );
}


function CatChip({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface-elevated text-foreground hover:bg-accent hover:text-accent-foreground"}`}>{children}</button>
  );
}
function PayBtn({ active, onClick, icon: Icon, children }: any) {
  return (
    <button onClick={onClick} className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-md px-1 text-[13px] font-medium transition-colors ${active ? "bg-surface-elevated text-primary shadow-sm" : "text-ink-muted hover:text-foreground"}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{children}</span>
    </button>
  );
}
function Totals({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between text-sm ${muted ? "text-ink-muted" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
