import { useState, createContext, useContext, type ReactNode } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { CreditCard, History, LogOut, Wrench, ShieldCheck, Users, Settings, FileBarChart, Package, FolderTree, ClipboardList, Undo2, Receipt, ChevronDown, ChevronRight, PanelLeftOpen, ShoppingBag, Menu, X, LayoutDashboard, FileText, Bike, Trash2, ChartNoAxesCombined, UserRound, Inbox } from "lucide-react";
import { UserAvatarImg, useMyAvatarUrl } from "./UserAvatar";
import { SiteLayout } from "./SiteLayout";
import { AppShell } from "./AppShell";
import { BackButton } from "./BackButton";
import { useAppMode } from "@/lib/app-mode";
import { useAuth, signOut } from "@/lib/auth-client";
import { useMyStaffPermissions } from "@/hooks/use-staff-permissions";
import { setSidebarHidden, useSidebarHidden } from "@/hooks/use-sidebar-hidden";
import { isActivityBlocked } from "@/lib/activity-access";
import { TillToolbar } from "@/components/till/TillModules";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/features";

function useCollapsed(key: string, initial = false) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return !initial;
    const v = window.localStorage.getItem(`nav:${key}`);
    return v === null ? !initial : v === "1";
  });
  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(`nav:${key}`, next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  };
  return [open, toggle] as const;
}

type SidebarContextType = { hidden: boolean; toggle: () => void };
const SidebarContext = createContext<SidebarContextType>({ hidden: false, toggle: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function AccountShell({ children, title, hideHeader = false, compact = false, hideFooter = false, hideFloating = true, hideLastSignIn = false }: { children: ReactNode; title?: string; hideHeader?: boolean; compact?: boolean; fullWidth?: boolean; hideFooter?: boolean; hideFloating?: boolean; hideLastSignIn?: boolean }) {
  const auth = useAuth();
  const { loading, rolesLoading, user, isStaff, isAdmin } = auth;
  const { data: avatarUrl } = useMyAvatarUrl(!!user);
  const { perms } = useMyStaffPermissions();
  const router = useRouter();
  const { pathname } = useLocation();
  const isPosPage = pathname === "/staff/pos";
  const [staffOpen, toggleStaff] = useCollapsed("staff");
  const [tillOpen, toggleTill] = useCollapsed("admin-till");
  const [catOpen, toggleCat] = useCollapsed("admin-catalogue");
  const [rentalOpen, toggleRental] = useCollapsed("admin-rental");
  const [moneyOpen, toggleMoney] = useCollapsed("admin-money");
  const [sysOpen, toggleSys] = useCollapsed("admin-system");
  const { hidden, toggle: toggleHidden } = useSidebarHidden();
  const [mobileOpen, setMobileOpen] = useState(false);
  const appMode = useAppMode();
  const rolesReady = !loading && !rolesLoading;

  // Native app: replace the entire sidebar/header shell with the compact
  // AppShell (top bar + bottom tab nav). Desktop and mobile-web are unchanged.
  if (appMode) {
    return <AppShell title={title}>{children}</AppShell>;
  }

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/auth" });
  }

  function requestPosFullscreen() {
    // Auto fullscreen disabled per user request. Use the in-POS button to toggle.
  }

  const sidebarContent = (
    <>
      <Link to="/" className="mb-4 block px-2" aria-label={`${BRAND.name} home`}>
        <img src="/images/brand/staines-logo.png" alt={BRAND.name} className="h-16 w-auto" />
      </Link>
      <div className="mb-3 flex items-center justify-between gap-2 px-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Navigation</span>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-elevated px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-foreground hover:border-primary hover:text-primary"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>

      {rolesReady && isStaff && !isAdmin && (
        <Section title="Staff" open={staffOpen} onToggle={toggleStaff} className="mt-6">
          {perms.pos && <NavItem to="/staff/pos" icon={Wrench} onNavigate={() => { setMobileOpen(false); requestPosFullscreen(); }}>POS</NavItem>}
          {perms.sales && <NavItem to="/staff/sales" icon={ShoppingBag} onNavigate={() => setMobileOpen(false)}>Sales</NavItem>}
          {perms.pos && <NavItem to="/staff/customers" icon={UserRound} onNavigate={() => setMobileOpen(false)}>Customers</NavItem>}
          {perms.products && <NavItem to="/staff/products" icon={Package} onNavigate={() => setMobileOpen(false)}>Products</NavItem>}
          {perms.categories && <NavItem to="/staff/categories" icon={FolderTree} onNavigate={() => setMobileOpen(false)}>Categories</NavItem>}
          {perms.refunds && <NavItem to="/staff/refunds" icon={Undo2} onNavigate={() => setMobileOpen(false)}>Refunds</NavItem>}
          {perms.expenses && <NavItem to="/staff/expenses" icon={Receipt} onNavigate={() => setMobileOpen(false)}>Expenses</NavItem>}
        </Section>
      )}

      {rolesReady && isAdmin && (
        <>
          <Section title="Till & Sales" open={tillOpen} onToggle={toggleTill} className="mt-6">
            <NavItem to="/staff/pos" icon={Wrench} onNavigate={() => { setMobileOpen(false); requestPosFullscreen(); }}>POS</NavItem>
            <NavItem to="/staff/sales" icon={ShoppingBag} onNavigate={() => setMobileOpen(false)}>Sales</NavItem>
            <NavItem to="/staff/refunds" icon={Undo2} onNavigate={() => setMobileOpen(false)}>Refunds</NavItem>
            <NavItem to="/staff/customers" icon={UserRound} onNavigate={() => setMobileOpen(false)}>Customers</NavItem>
            <NavItem to="/admin/enquiries" icon={Inbox} onNavigate={() => setMobileOpen(false)}>Enquiries</NavItem>
            <NavItem to="/admin/card-terminal" icon={CreditCard} onNavigate={() => setMobileOpen(false)}>Card Terminal</NavItem>
          </Section>

          <Section title="Catalogue & Stock" open={catOpen} onToggle={toggleCat} className="mt-6">
            <NavItem to="/staff/products" icon={Package} onNavigate={() => setMobileOpen(false)}>Products</NavItem>
            <NavItem to="/staff/categories" icon={FolderTree} onNavigate={() => setMobileOpen(false)}>Categories</NavItem>
            <NavItem to="/admin/inventory" icon={Package} onNavigate={() => setMobileOpen(false)}>Stock/Inventory</NavItem>
            <NavItem to="/admin/lost-damaged" icon={ClipboardList} onNavigate={() => setMobileOpen(false)}>Lost &amp; Damaged</NavItem>
          </Section>

          <Section title="Rental & Claims" open={rentalOpen} onToggle={toggleRental} className="mt-6">
            <NavItem to="/admin/rental" icon={Bike} onNavigate={() => setMobileOpen(false)}>Rental</NavItem>
            {FEATURES.finance && <NavItem to="/admin/finance" icon={Bike} onNavigate={() => setMobileOpen(false)}>Motorbike Financing</NavItem>}
            <NavItem to="/admin/claims" icon={FileText} onNavigate={() => setMobileOpen(false)}>Claims</NavItem>
          </Section>

          <Section title="Money & Reports" open={moneyOpen} onToggle={toggleMoney} className="mt-6">
            <NavItem to="/staff/expenses" icon={Receipt} onNavigate={() => setMobileOpen(false)}>Expenses</NavItem>
            <NavItem to="/admin/profit-loss" icon={FileBarChart} onNavigate={() => setMobileOpen(false)}>Profit &amp; Loss</NavItem>
            <NavItem to="/admin/reports" icon={FileBarChart} onNavigate={() => setMobileOpen(false)}>Admin Reports</NavItem>
          </Section>

          <Section title="System" open={sysOpen} onToggle={toggleSys} className="mt-6">
            <NavItem to="/admin" icon={ShieldCheck} onNavigate={() => setMobileOpen(false)}>Dashboard</NavItem>
            <NavItem to="/admin/team" icon={Users} onNavigate={() => setMobileOpen(false)}>Team &amp; Roles</NavItem>
            {!isActivityBlocked(user?.email) && <NavItem to="/admin/activity" icon={History} onNavigate={() => setMobileOpen(false)}>Activity</NavItem>}
            <NavItem to="/admin/recycle" icon={Trash2} onNavigate={() => setMobileOpen(false)}>Recycle Bin</NavItem>
            <NavItem to="/admin/settings" icon={Settings} onNavigate={() => setMobileOpen(false)}>Settings</NavItem>
          </Section>
        </>
      )}

      <button
        onClick={handleSignOut}
        className="mt-6 flex w-full items-center gap-3 rounded-sm border border-border bg-surface-elevated px-3 py-3 text-xs font-semibold uppercase tracking-widest text-foreground hover:border-primary hover:text-primary"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </>
  );

  return (
    <SidebarContext.Provider value={{ hidden, toggle: toggleHidden }}>
      <SiteLayout hideHeader={hideHeader || (!!user && auth.isAdmin)} hideFooter={hideFooter} hideFloating={hideFloating}>
        <div data-account-workspace className={`w-full max-w-none px-0 grid grid-cols-[minmax(0,1fr)] gap-6 ${compact ? "" : "pt-2 pb-6 lg:pb-10"} ${rolesReady && isAdmin ? "pb-[4.75rem]" : ""} ${hidden ? "" : "lg:grid-cols-[260px_minmax(0,1fr)]"}`}>
          {/* Desktop sidebar */}
          {!hidden && (
            <aside className={`hidden lg:sticky lg:block lg:self-start ${isAdmin ? "lg:top-2" : "lg:top-24"}`}>
              {sidebarContent}
            </aside>
          )}

          <section className="min-w-0">
            <div className={`flex flex-wrap items-center gap-3 ${compact ? "" : "mb-4"}`}>
              {isPosPage && (
                <div className="order-first flex flex-wrap items-center gap-1.5">
                  <TillToolbar />
                </div>
              )}
              {/* Back button — hidden on root/home pages via BackButton logic */}
              <BackButton />
              {/* Desktop show-sidebar */}
              {hidden && !compact && (
                <button
                  onClick={toggleHidden}
                  title="Show sidebar"
                  className="hidden items-center gap-1 rounded-sm border border-border bg-surface-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary lg:inline-flex"
                >
                  <PanelLeftOpen className="h-4 w-4" /> Show menu
                </button>
              )}
              {title && <h1 className="font-display text-2xl uppercase leading-none sm:text-3xl md:text-4xl">{title}</h1>}
              {/* Admin actions stay together alongside the page heading. */}
              <div className={`flex items-center gap-2 ${isAdmin ? "ml-auto w-auto shrink-0" : "w-full lg:ml-auto lg:w-auto"}`}>
                {/* Mobile hamburger — first item in this row on mobile */}
                <button
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                  className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-elevated px-3 py-2 text-[10px] font-semibold uppercase tracking-widest hover:border-primary hover:text-primary lg:hidden"
                >
                  <Menu className="h-5 w-5" /> Menu
                </button>
                <div className="ml-auto flex items-center gap-2 lg:ml-0">
                  <span title={user?.email ?? undefined} className="rounded-full">
                    <UserAvatarImg url={avatarUrl} name={user?.email ?? undefined} size={32} />
                  </span>
                  {isAdmin && (
                    <Button asChild variant="outline" size="sm" className="h-9 px-2 text-[10px] font-semibold uppercase sm:px-3">
                      <Link to="/staff/pos" title="Workshop">
                        <Wrench className="h-4 w-4" /> Workshop
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    title="Sign out"
                    className="h-9 px-2 text-[10px] font-semibold uppercase sm:px-3"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </div>
              </div>

            </div>
            {!hideLastSignIn && <LastSignInBanner user={user} emphasized={isAdmin} />}
            {children}
          </section>
        </div>

        {rolesReady && isAdmin && (
          <AdminBrowserBottomNav pathname={pathname} onMenuOpen={() => setMobileOpen(true)} />
        )}

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] overflow-y-auto bg-background p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-sm border border-border bg-surface-elevated p-1.5 hover:border-primary hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </SiteLayout>
    </SidebarContext.Provider>
  );
}

const ADMIN_BOTTOM_LINKS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/staff/pos", label: "POS", icon: Wrench },
  { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
  { to: "/staff/refunds", label: "Refunds", icon: Undo2 },
  { to: "/staff/customers", label: "Customers", icon: UserRound },
  { to: "/admin/enquiries", label: "Enquiries", icon: Inbox },
  { to: "/staff/products", label: "Products", icon: Package },
  { to: "/admin/inventory", label: "Stock/Inventory", icon: Package },
  { to: "/staff/categories", label: "Categories", icon: FolderTree },
  ...(FEATURES.finance ? [{ to: "/admin/finance", label: "Motorbike Financing", icon: Bike }] : []),
  { to: "/admin/rental", label: "Rental", icon: Bike },
  { to: "/admin/claims", label: "Claims", icon: FileText },
  { to: "/staff/expenses", label: "Expenses", icon: Receipt },
  { to: "/admin/profit-loss", label: "Profit & Loss", icon: ChartNoAxesCombined },
];

function AdminBrowserBottomNav({ pathname, onMenuOpen }: { pathname: string; onMenuOpen: () => void }) {
  const isActive = (to: string) => to === "/admin" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  return (
    <nav
      aria-label="Administrator navigation"
      className="fixed inset-x-0 bottom-0 z-[70] h-[4.25rem] overflow-x-auto border-t border-border bg-surface-elevated shadow-[0_-3px_14px_color-mix(in_oklab,var(--foreground)_10%,transparent)]"
    >
      <div className="flex h-full min-w-max items-stretch lg:min-w-full">
        <button
          type="button"
          onClick={onMenuOpen}
          className="flex w-[5.75rem] shrink-0 flex-col items-center justify-center gap-1 text-foreground transition-colors hover:bg-surface hover:text-primary lg:flex-1"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span className="whitespace-nowrap text-[10px] font-medium leading-none">Menu</span>
        </button>
        {ADMIN_BOTTOM_LINKS.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex w-[5.75rem] shrink-0 flex-col items-center justify-center gap-1 transition-colors lg:flex-1 ${active ? "text-primary" : "text-foreground hover:bg-surface hover:text-primary"}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="whitespace-nowrap text-[10px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Section({ title, open, onToggle, children, className = "" }: { title: string; open: boolean; onToggle: () => void; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <button
        onClick={onToggle}
        className="mb-3 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary hover:opacity-80"
      >
        <span>{title}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <nav className="grid gap-1 p-2">
          {children}
        </nav>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, children, onNavigate }: { to: string; icon: React.ComponentType<{ className?: string }>; children: ReactNode; onNavigate?: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      activeOptions={{ exact: true }}
      activeProps={{ className: "bg-primary text-primary-foreground" }}
      inactiveProps={{ className: "text-foreground hover:bg-surface" }}
      className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-xs font-semibold uppercase tracking-widest"
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}

// Keep some imports referenced to avoid unused warnings on future edits
void ClipboardList;


function LastSignInBanner({ user, emphasized }: { user: { last_sign_in_at?: string | null } | null; emphasized: boolean }) {
  const raw = user?.last_sign_in_at;
  if (!raw) return null;
  const last = new Date(raw);
  if (isNaN(last.getTime())) return null;
  const now = new Date();
  const diffMs = now.getTime() - last.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor(diffMs / (1000 * 60));
  const sinceLabel =
    days >= 1 ? `${days} day${days === 1 ? "" : "s"} ago`
    : hours >= 1 ? `${hours} hour${hours === 1 ? "" : "s"} ago`
    : mins >= 1 ? `${mins} minute${mins === 1 ? "" : "s"} ago`
    : "just now";
  const dateLabel = last.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  if (emphasized) {
    return (
      <div className="mb-4 rounded-sm border border-primary/60 bg-surface-elevated px-3 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">Last sign-in</p>
        <p className="mt-0.5 text-xs font-semibold text-foreground">{dateLabel}</p>
        <p className="text-[11px] text-ink-muted">{sinceLabel}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-sm border border-border bg-surface-elevated px-3 py-1.5 text-[11px] text-ink-muted">
      Last signed in <span className="font-semibold text-foreground">{dateLabel}</span> · <span className="font-semibold text-foreground">{sinceLabel}</span>
    </div>
  );

}
