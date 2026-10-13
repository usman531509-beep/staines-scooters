import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, LogOut, History, LayoutDashboard, RefreshCw, Menu, X, ChevronLeft, ShieldCheck, Wrench, ShoppingBag, Package, FolderTree, Undo2, Receipt, ClipboardList, FileBarChart, Settings, Users, FileText, Bike, Trash2, UserRound, Inbox } from "lucide-react";
import { signOut, useAuth } from "@/lib/auth-client";
import { useMyStaffPermissions } from "@/hooks/use-staff-permissions";
import { UserAvatarImg, useMyAvatarUrl } from "./UserAvatar";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { isActivityBlocked } from "@/lib/activity-access";
import { Button } from "@/components/ui/button";
import { BRAND, siteLink } from "@/lib/brand";



// AppShell — the ONLY chrome shown inside the native Capacitor app.
// Structure: fixed top bar (title + Sign out) → scrollable content → fixed
// bottom tab bar of the staff / admin modules the user can open.

type NavEntry = { to: string; label: string; icon: typeof CreditCard };

const ADMIN_TABS: NavEntry[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/pos", label: "POS", icon: Wrench },
  { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
  { to: "/staff/refunds", label: "Refunds", icon: Undo2 },
  { to: "/staff/customers", label: "Customers", icon: UserRound },
  { to: "/staff/products", label: "Products", icon: Package },
  { to: "/staff/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/rental", label: "Rental", icon: Bike },
  { to: "/admin/claims", label: "Claims", icon: FileText },
  { to: "/staff/expenses", label: "Expenses", icon: Receipt },
  { to: "/admin/profit-loss", label: "Profit & Loss", icon: FileBarChart },
];

const STAFF_TABS: NavEntry[] = [
  { to: "/staff/pos", label: "POS", icon: Wrench },
  { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
  { to: "/staff/products", label: "Stock", icon: Package },
  { to: "/staff/categories", label: "Cats", icon: FolderTree },
];

const ADMIN_MENU = [
  {
    title: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Till & Sales",
    items: [
      { to: "/staff/pos", label: "POS", icon: Wrench },
      { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
      { to: "/staff/refunds", label: "Refunds", icon: Undo2 },
      { to: "/staff/customers", label: "Customers", icon: UserRound },
      { to: "/admin/enquiries", label: "Enquiries", icon: Inbox },
    ],
  },
  {
    title: "Catalogue & Stock",
    items: [
      { to: "/staff/products", label: "Products", icon: Package },
      { to: "/staff/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/lost-damaged", label: "Lost & Damaged", icon: ClipboardList },
    ],
  },
  {
    title: "Rental & Claims",
    items: [
      { to: "/admin/rental", label: "Rental", icon: Bike },
      { to: "/admin/claims", label: "Claims", icon: FileText },
    ],
  },
  {
    title: "Money & Reports",
    items: [
      { to: "/staff/expenses", label: "Expenses", icon: Receipt },
      { to: "/admin/profit-loss", label: "Profit & Loss", icon: FileBarChart },
      { to: "/admin/reports", label: "Admin Reports", icon: FileBarChart },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/admin/team", label: "Team & Roles", icon: Users },
      { to: "/admin/activity", label: "Activity", icon: History },
      { to: "/admin/recycle", label: "Recycle Bin", icon: Trash2 },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] satisfies Array<{ title: string; items: NavEntry[] }>;


type AppChrome = {
  openMenu: () => void;
  toggleMenu: () => void;
  menuOpen: boolean;
  signOut: () => void;
  goBack: () => void;
  showBack: boolean;
  showMenu: boolean;
  chromeless: boolean;
};
const AppChromeContext = createContext<AppChrome | null>(null);
export function useAppChrome() {
  return useContext(AppChromeContext);
}


const TITLES: Record<string, string> = {
  "/admin": "Admin Dashboard",
  "/admin/lost-damaged": "Lost & Damaged",
  "/admin/profit-loss": "Profit & Loss",
  "/admin/settings": "Settings",
  "/admin/claims": "Claims",
  "/admin/team": "Team & Roles",
  "/staff/pos": "POS",
  "/staff/sales": "Sales",
  "/staff/products": "Products",
  "/staff/categories": "Categories",
  "/staff/refunds": "Refunds",
  "/staff/customers": "Customers",
  "/admin/enquiries": "Enquiries",
  "/staff/expenses": "Expenses",
};

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading, rolesLoading, isAdmin, user } = useAuth();
  const { perms } = useMyStaffPermissions();
  const heading = title ?? TITLES[pathname] ?? BRAND.name;
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const rolesReady = !loading && !rolesLoading;
  const showRoleMenu = true;
  const staffTabs = STAFF_TABS.filter((tab) => {
    if (tab.to === "/staff/pos") return perms.pos;
    if (tab.to === "/staff/sales") return perms.sales;
    if (tab.to === "/staff/products") return perms.products;
    if (tab.to === "/staff/categories") return perms.categories;
    return true;
  });
  // Every admin (on phone, tablet, Windows or Android) sees all modules.
  const tabs = isAdmin ? ADMIN_TABS : staffTabs;
  const menuGroups = isAdmin
    ? ADMIN_MENU.map((g) => ({
        ...g,
        items: g.items.filter((i) => !(i.to === "/admin/activity" && isActivityBlocked(user?.email))),
      }))
    : [
        {
          title: "Staff",
          items: [
            perms.pos && { to: "/staff/pos", label: "POS", icon: Wrench },
            perms.sales && { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
            perms.pos && { to: "/staff/customers", label: "Customers", icon: UserRound },
            perms.products && { to: "/staff/products", label: "Products", icon: Package },
            perms.categories && { to: "/staff/categories", label: "Categories", icon: FolderTree },
            perms.refunds && { to: "/staff/refunds", label: "Refunds", icon: Undo2 },
            perms.expenses && { to: "/staff/expenses", label: "Expenses", icon: Receipt },
          ].filter(Boolean) as NavEntry[],
        },
      ];

  async function doRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries(),
        router.invalidate(),
      ]);
    } finally {
      setTimeout(() => { setRefreshing(false); setPullY(0); }, 300);
    }
  }

  // Refresh when app returns to foreground (tab visible / window focus / Capacitor resume).
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") doRefresh(); };
    const onFocus = () => doRefresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOut() {
    await signOut();
    window.location.href = siteLink("/auth");
  }

  // Disable pinch-zoom and double-tap zoom in the app shell.
  useEffect(() => {
    const preventGesture = (e: Event) => e.preventDefault();
    let startX = 0;
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) { e.preventDefault(); return; }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) { e.preventDefault(); return; }
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      // Block horizontal swipes (edge-swipe back/forward navigation).
      if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    };
    let lastTouch = 0;
    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const preventKeyZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0"].includes(e.key)) {
        e.preventDefault();
      }
    };
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);
    document.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });
    document.addEventListener("touchend", preventDoubleTap, { passive: false });
    document.addEventListener("wheel", preventWheelZoom, { passive: false });
    document.addEventListener("keydown", preventKeyZoom);
    const prevOverscroll = document.body.style.overscrollBehaviorX;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overscrollBehaviorX = "none";
    document.body.style.touchAction = "pan-y";
    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", preventMultiTouch);
      document.removeEventListener("touchend", preventDoubleTap);
      document.removeEventListener("wheel", preventWheelZoom);
      document.removeEventListener("keydown", preventKeyZoom);
      document.body.style.overscrollBehaviorX = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
    };
  }, []);

  // Pull-to-refresh: swipe down from top of page to reload data.
  useEffect(() => {
    let startY = 0;
    let pulling = false;
    const THRESHOLD = 70;
    const MAX = 120;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if ((window.scrollY || document.documentElement.scrollTop) > 0) return;
      startY = e.touches[0].clientY;
      pulling = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling || refreshing) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) { setPullY(0); return; }
      // Dampened pull distance
      const dist = Math.min(MAX, dy * 0.5);
      setPullY(dist);
      if (dy > 10) e.preventDefault();
    };
    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (pullY >= THRESHOLD && !refreshing) {
        doRefresh();
      } else {
        setPullY(0);
      }
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [pullY, refreshing]);

  const indicatorOffset = refreshing ? 60 : pullY;

  if (!rolesReady) {
    return (
      <div className="app-ui flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div>
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Loading account</p>
        </div>
      </div>
    );
  }

  const homePath = isAdmin ? "/admin" : "/staff/pos";
  const goBack = () => {
    const hasHistory = typeof window !== "undefined" && window.history.length > 1;
    if (hasHistory) router.history.back();
    else router.navigate({ to: homePath });
  };
  // Admin POS runs completely chrome-free: the POS toolbar hosts back / Menu /
  // Sign out itself so the search bar sits flush against the window title bar.
  const chromeless = isAdmin && pathname === "/staff/pos";

  return (
    <AppChromeContext.Provider
      value={{
        openMenu: () => setMenuOpen(true),
        toggleMenu: () => setMenuOpen((prev) => !prev),
        menuOpen,
        signOut: handleSignOut,
        goBack,
        showBack: pathname !== homePath,
        showMenu: showRoleMenu,
        chromeless,
      }}
    >
    <div className="app-ui flex min-h-screen flex-col bg-background pb-[calc(4.75rem+env(safe-area-inset-bottom))] text-foreground">
      {/* Pull-to-refresh indicator */}
      <div
        aria-hidden={indicatorOffset === 0}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${Math.max(0, indicatorOffset - 40)}px)`,
          opacity: indicatorOffset > 0 ? 1 : 0,
          transition: refreshing || pullY === 0 ? "transform 200ms ease, opacity 200ms ease" : "none",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated shadow-md">
          <RefreshCw
            className={`h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
            style={!refreshing ? { transform: `rotate(${pullY * 3}deg)` } : undefined}
          />
        </div>
      </div>

      {/* Top bar */}
      {!chromeless && (
      <header
        className="sticky top-0 z-40 border-b border-border bg-surface-elevated/95 px-4 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", paddingBottom: "0.75rem" }}
      >
        <div className="flex items-center justify-between gap-2">
          {pathname !== homePath && (
            <button
              type="button"
              onClick={goBack}
              aria-label="Go back"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary active:scale-95"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {showRoleMenu ? (
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-foreground shadow-sm active:scale-95"
              aria-label="Open navigation menu"
            >
              <span className="font-display text-xs uppercase tracking-[0.2em]">Menu</span>
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <Link to="/" className="min-w-0 flex-1" aria-label={`${BRAND.name} home`}>
              <img src="/images/brand/staines-logo.webp" alt={BRAND.name} className="h-11 w-auto" />
            </Link>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {!isAdmin && <AppHeaderAvatar />}
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="h-9 px-2 text-[10px] font-semibold uppercase sm:px-3">
                <Link to="/staff/pos" title="Workshop"><Wrench /> Workshop</Link>
              </Button>
            )}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground shadow-sm active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
        {!isAdmin && (
          <h1 className="mt-2 truncate font-display text-lg uppercase leading-tight text-foreground">{heading}</h1>
        )}
      </header>
      )}

      {/* The chrome-free admin POS hosts its own non-floating Menu button in the
          POS toolbar (right before "Scan part"), so no floating button is needed. */}




      {/* Website header — app pages render like a normal web page, below the app
          bar. It must scroll away instead of sticking, otherwise it would pin
          itself over the app bar (Menu / Sign out) as soon as a page scrolls. */}
      {!chromeless && !isAdmin && (
        <div className="[&>header]:static [&>header]:z-0">
          <SiteHeader />
        </div>
      )}

      {/* Content */}
      <main
        className={`min-w-0 w-full max-w-none flex-1 ${chromeless ? "p-0" : "px-0 py-4"}`}
        style={{ paddingBottom: chromeless ? undefined : "1rem" }}
      >
        {children}
      </main>

      {/* Website footer — the shell itself reserves room for the fixed bottom bar. */}
      {!chromeless && (
        <div>
          <SiteFooter />
        </div>
      )}


      {menuOpen && (
        <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[90%] max-w-[390px] overflow-y-auto border-r border-border bg-background p-4 shadow-2xl" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">{isAdmin ? "Admin Menu" : "Staff Menu"}</p>
                <p className="font-display text-xl uppercase leading-none text-foreground">Navigation</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground active:scale-95"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-5">
              {menuGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{group.title}</p>
                  <nav className="grid gap-1 rounded-md border border-border bg-surface-elevated p-2">
                    {group.items.map((item) => (
                      <DrawerLink key={item.to} item={item} active={pathname === item.to} onNavigate={() => setMenuOpen(false)} />
                    ))}
                  </nav>
                </div>
              ))}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-elevated px-3 py-3 text-xs font-semibold uppercase tracking-widest text-foreground active:scale-95"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Bottom tab bar */}
      <BottomTabs tabs={tabs} pathname={pathname} onMenuOpen={isAdmin ? () => setMenuOpen(true) : undefined} />
    </div>
    </AppChromeContext.Provider>
  );
}

// Auto-fitting bottom tab bar: every module is always visible, full label, no
// truncation. Font size and horizontal padding scale to the available width so
// all items fit in one row on phones, tablets (Surface / Android / iPad) and
// desktop app windows. Only if the width is impossibly small do we allow a
// horizontal scroll fallback.
function BottomTabs({
  tabs,
  pathname,
  onMenuOpen,
}: {
  tabs: NavEntry[];
  pathname: string;
  onMenuOpen?: () => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const hasMenu = !!onMenuOpen;
  const count = Math.max(tabs.length + (hasMenu ? 1 : 0), 1);
  const maxChars = tabs.reduce((m, t) => Math.max(m, t.label.length), 1);
  const slot = width > 0 ? width / count : 0;

  // Text width per char ≈ 0.62em for this uppercase semi-bold face.
  // Font size is derived purely from the available slot so labels NEVER
  // overlap their neighbours. Small screens with many modules simply get a
  // smaller (but still legible) label instead of clipped/overlapping text.
  const CHAR_W = 0.62;
  const GAP = 6; // breathing room between labels
  const rawFont = slot > 0 ? (slot - GAP) / (maxChars * CHAR_W) : 16;
  const fontPx = Math.max(8, Math.min(20, Math.floor(rawFont * 10) / 10));
  const padX = Math.max(1, Math.min(8, (slot - maxChars * CHAR_W * fontPx) / 2));
  const iconPx = Math.max(14, Math.min(28, fontPx * 1.5));
  // Even at the absolute minimum size the labels cannot fit → allow scrolling.
  const fits = slot === 0 || slot >= maxChars * CHAR_W * 8 + 2;
  const stretch = fits;


  return (
    <nav
      ref={navRef}
      aria-label="App navigation"
      className="app-bottom-nav fixed inset-x-0 bottom-0 z-[60] block min-h-16 border-t border-border bg-surface-elevated shadow-[0_-4px_18px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
    >
      <ul
        className={
          stretch
            ? "flex w-full items-stretch"
            : "flex items-stretch overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
        style={stretch ? undefined : { WebkitOverflowScrolling: "touch" }}
      >
        {hasMenu && (
          <li className={stretch ? "min-w-0 flex-1" : "shrink-0"}>
            <button
              type="button"
              onClick={onMenuOpen}
              aria-label="Open navigation menu"
              className="flex w-full flex-col items-center justify-end gap-1.5 py-2.5 font-semibold uppercase text-foreground active:scale-95"
              style={{
                fontSize: `${fontPx}px`,
                paddingLeft: `${padX}px`,
                paddingRight: `${padX}px`,
                letterSpacing: fontPx < 14 ? "0" : "0.02em",
                minWidth: stretch ? undefined : `${Math.round(maxChars * CHAR_W * 10) + 12}px`,
              }}
            >
              <Menu className="shrink-0 text-primary" style={{ height: `${iconPx}px`, width: `${iconPx}px` }} />
              <span className="whitespace-nowrap text-center leading-none">Menu</span>
            </button>
          </li>
        )}
        {tabs.map((tab) => {
          const active = pathname === tab.to;
          const Icon = tab.icon;
          return (
            <li key={tab.to} className={stretch ? "min-w-0 flex-1" : "shrink-0"}>
              <Link
                to={tab.to}
                className={`flex w-full flex-col items-center justify-end gap-1.5 py-2.5 font-semibold uppercase transition-colors ${
                  active ? "text-primary" : "text-ink-muted"
                }`}
                style={{
                  fontSize: `${fontPx}px`,
                  paddingLeft: `${padX}px`,
                  paddingRight: `${padX}px`,
                  letterSpacing: fontPx < 14 ? "0" : "0.02em",
                  minWidth: stretch ? undefined : `${Math.round(maxChars * CHAR_W * 10) + 12}px`,
                }}
              >
                <Icon
                  className={`shrink-0 ${active ? "text-primary" : ""}`}
                  style={{ height: `${iconPx}px`, width: `${iconPx}px` }}
                />
                <span className="whitespace-nowrap text-center leading-none">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}


function DrawerLink({ item, active, onNavigate }: { item: NavEntry; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-sm px-3 py-3 text-xs font-semibold uppercase tracking-widest ${
        active ? "bg-primary text-primary-foreground" : "text-foreground active:bg-surface"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function AppHeaderAvatar() {
  const { data: url } = useMyAvatarUrl();
  return <UserAvatarImg url={url} size={28} />;
}
