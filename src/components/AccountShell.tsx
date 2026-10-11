import { useState, useLayoutEffect, createContext, useContext, type ReactNode } from "react";
import { Link, useRouter, useLocation } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import {
  History, LogOut, Wrench, Users, Settings, FileBarChart, Package, FolderTree,
  ClipboardList, Undo2, Receipt, ChevronDown, ShoppingBag, Menu, LayoutDashboard, FileText, Bike, Trash2,
  ChartNoAxesCombined, UserRound, Inbox, Globe, ChevronsUpDown, type LucideIcon,
} from "lucide-react";
import { UserAvatarImg, useMyAvatarUrl } from "./UserAvatar";
import { AppShell } from "./AppShell";
import { BackButton } from "./BackButton";
import { useAppMode } from "@/lib/app-mode";
import { useAuth, signOut } from "@/lib/auth-client";
import { useMyStaffPermissions } from "@/hooks/use-staff-permissions";
import { setSidebarHidden, useSidebarHidden } from "@/hooks/use-sidebar-hidden";
import { isActivityBlocked } from "@/lib/activity-access";
import { TillToolbar } from "@/components/till/TillModules";
import { FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { RouteProgress } from "./RouteProgress";

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

type ShellOptions = {
  title?: string;
  hideHeader?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  hideFooter?: boolean;
  hideFloating?: boolean;
  hideLastSignIn?: boolean;
};

// Set by AccountShellLayout: pages hand it their shell options instead of
// rendering their own shell, so the sidebar, header and toolbars stay mounted
// while only the page content changes on navigation.
const ShellRegistry = createContext<((options: ShellOptions | null) => void) | null>(null);

/** Persistent signed-in layout; wraps the authenticated route's <Outlet />. */
export function AccountShellLayout({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ShellOptions | null>(null);
  return (
    <ShellRegistry.Provider value={setOptions}>
      <AccountShellFrame options={options}>{children}</AccountShellFrame>
    </ShellRegistry.Provider>
  );
}

/**
 * Page wrapper. Inside AccountShellLayout it only reports its title/options to
 * the persistent shell; on its own it renders the full shell.
 */
export function AccountShell({ children, ...options }: ShellOptions & { children: ReactNode }) {
  const register = useContext(ShellRegistry);
  const { title, hideHeader, compact, hideFooter, hideFloating, hideLastSignIn } = options;
  useLayoutEffect(() => {
    if (!register) return;
    register({ title, hideHeader, compact, hideFooter, hideFloating, hideLastSignIn });
    return () => register(null);
  }, [register, title, hideHeader, compact, hideFooter, hideFloating, hideLastSignIn]);
  if (register) return <>{children}</>;
  return <AccountShellFrame options={options}>{children}</AccountShellFrame>;
}

/**
 * The shell itself (shadcn sidebar + inset). `options === null` means the
 * current page has no shell (receipts, invoices); the element tree stays the
 * same so the page never remounts, only the chrome is left out.
 */
function AccountShellFrame({ children, options }: { children: ReactNode; options: ShellOptions | null }) {
  const bare = options === null;
  const { title, compact = false, hideLastSignIn = false } = options ?? {};
  const { user, isAdmin, loading, rolesLoading } = useAuth();
  const { pathname } = useLocation();
  const { hidden } = useSidebarHidden();
  const appMode = useAppMode();
  const rolesReady = !loading && !rolesLoading;

  // Native app: the compact AppShell (top bar + bottom tab nav) replaces this shell.
  if (appMode) {
    return bare ? <>{children}</> : <AppShell title={title}>{children}</AppShell>;
  }

  return (
    <SidebarProvider open={!hidden} onOpenChange={(open) => setSidebarHidden(!open)}>
      <RouteProgress />
      {!bare && <AdminSidebar />}
      <SidebarInset className={bare ? undefined : "min-w-0"}>
        {!bare && (
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur md:rounded-t-xl">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 h-5" />
            <BackButton compact />
            {title && <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>}
            <Link
              to="/"
              className="ml-auto hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-accent hover:text-accent-foreground sm:inline-flex"
            >
              <Globe className="h-4 w-4" /> Website
            </Link>
          </header>
        )}
        <div
          data-account-workspace={bare ? undefined : ""}
          className={bare ? undefined : cn("min-w-0 flex-1", compact ? "p-3 md:p-4" : "p-4 md:p-6", rolesReady && isAdmin && "pb-24 lg:pb-6")}
        >
          {!bare && pathname === "/staff/pos" && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <TillToolbar />
            </div>
          )}
          {!bare && !hideLastSignIn && <LastSignInBanner user={user} emphasized={isAdmin} />}
          {children}
        </div>
        {!bare && rolesReady && isAdmin && <AdminBottomNav pathname={pathname} />}
      </SidebarInset>
    </SidebarProvider>
  );
}

type NavLink = { to: string; label: string; icon: LucideIcon; show?: boolean };
type NavGroup = { key: string; title: string; links: NavLink[] };

function AdminSidebar() {
  const auth = useAuth();
  const { user, isStaff, isAdmin, loading, rolesLoading } = auth;
  const { perms } = useMyStaffPermissions();
  const { data: avatarUrl } = useMyAvatarUrl(!!user);
  const router = useRouter();
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const rolesReady = !loading && !rolesLoading;

  const groups: NavGroup[] = !rolesReady
    ? []
    : isAdmin
      ? [
          {
            key: "admin-till",
            title: "Till & Sales",
            links: [
              { to: "/staff/pos", label: "POS", icon: Wrench },
              { to: "/staff/sales", label: "Sales", icon: ShoppingBag },
              { to: "/staff/refunds", label: "Refunds", icon: Undo2 },
              { to: "/staff/customers", label: "Customers", icon: UserRound },
              { to: "/admin/enquiries", label: "Enquiries", icon: Inbox },
            ],
          },
          {
            key: "admin-catalogue",
            title: "Catalogue & Stock",
            links: [
              { to: "/staff/products", label: "Products", icon: Package },
              { to: "/staff/categories", label: "Categories", icon: FolderTree },
              { to: "/admin/inventory", label: "Stock / Inventory", icon: Package },
              { to: "/admin/lost-damaged", label: "Lost & Damaged", icon: ClipboardList },
            ],
          },
          {
            key: "admin-rental",
            title: "Rental & Claims",
            links: [
              { to: "/admin/rental", label: "Rental", icon: Bike },
              { to: "/admin/finance", label: "Motorbike Financing", icon: Bike, show: FEATURES.finance },
              { to: "/admin/claims", label: "Claims", icon: FileText },
            ],
          },
          {
            key: "admin-money",
            title: "Money & Reports",
            links: [
              { to: "/staff/expenses", label: "Expenses", icon: Receipt },
              { to: "/admin/profit-loss", label: "Profit & Loss", icon: ChartNoAxesCombined },
              { to: "/admin/reports", label: "Admin Reports", icon: FileBarChart },
            ],
          },
          {
            key: "admin-system",
            title: "System",
            links: [
              { to: "/admin/team", label: "Team & Roles", icon: Users },
              { to: "/admin/activity", label: "Activity", icon: History, show: !isActivityBlocked(user?.email) },
              { to: "/admin/recycle", label: "Recycle Bin", icon: Trash2 },
              { to: "/admin/settings", label: "Settings", icon: Settings },
            ],
          },
        ]
      : isStaff
        ? [
            {
              key: "staff",
              title: "Staff",
              links: [
                { to: "/staff/pos", label: "POS", icon: Wrench, show: perms.pos },
                { to: "/staff/sales", label: "Sales", icon: ShoppingBag, show: perms.sales },
                { to: "/staff/customers", label: "Customers", icon: UserRound, show: perms.pos },
                { to: "/staff/products", label: "Products", icon: Package, show: perms.products },
                { to: "/staff/categories", label: "Categories", icon: FolderTree, show: perms.categories },
                { to: "/staff/refunds", label: "Refunds", icon: Undo2, show: perms.refunds },
                { to: "/staff/expenses", label: "Expenses", icon: Receipt, show: perms.expenses },
              ],
            },
          ]
        : [];

  async function handleSignOut() {
    await signOut();
    router.navigate({ to: "/auth" });
  }

  const roleLabel = auth.isOwner ? "Owner" : isAdmin ? "Admin" : "Staff";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={BRAND.name}>
              <Link to={isAdmin ? "/admin" : "/staff/pos"}>
                <img
                  src="/images/brand/staines-badge.webp"
                  alt=""
                  className="size-8 shrink-0 rounded-full object-contain"
                />
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{BRAND.name}</span>
                  <span className="truncate text-xs text-sidebar-foreground/70">Workshop admin</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {rolesReady && isAdmin && (
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/admin"} tooltip="Dashboard">
                  <Link to="/admin" onClick={() => isMobile && setOpenMobile(false)}>
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        {groups.map((g) => (
          <NavSection
            key={g.key}
            group={g}
            pathname={pathname}
            forceOpen={state === "collapsed" && !isMobile}
            onNavigate={() => isMobile && setOpenMobile(false)}
          />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={user?.email ?? "Account"}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <span className="shrink-0">
                    <UserAvatarImg url={avatarUrl} name={user?.email ?? undefined} size={32} />
                  </span>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">{user?.email}</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">{roleLabel}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "bottom" : "right"} align="end" className="min-w-56 rounded-lg">
                <DropdownMenuLabel className="truncate font-normal text-ink-muted">{user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/staff/pos"><Wrench /> Workshop (POS)</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/"><Globe /> View website</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavSection({
  group,
  pathname,
  forceOpen,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  forceOpen: boolean;
  onNavigate: () => void;
}) {
  const [open, toggle] = useCollapsed(group.key);
  const links = group.links.filter((l) => l.show !== false);
  if (links.length === 0) return null;
  return (
    <Collapsible open={open || forceOpen} onOpenChange={toggle} className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full">
            {group.title}
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={pathname === to} tooltip={label}>
                    <Link to={to} onClick={onNavigate}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
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

/** Phone/tablet tab bar for administrators; on large screens the sidebar is enough. */
function AdminBottomNav({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar();
  const isActive = (to: string) => (to === "/admin" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <nav
      aria-label="Administrator navigation"
      className="fixed inset-x-0 bottom-0 z-[70] h-[4.25rem] overflow-x-auto border-t border-border bg-surface-elevated shadow-[0_-3px_14px_color-mix(in_oklab,var(--foreground)_10%,transparent)] lg:hidden"
    >
      <div className="flex h-full min-w-max items-stretch">
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex w-[5.75rem] shrink-0 flex-col items-center justify-center gap-1 text-foreground transition-colors hover:bg-surface hover:text-primary"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span className="whitespace-nowrap text-[11px] font-medium leading-none">Menu</span>
        </button>
        {ADMIN_BOTTOM_LINKS.map(({ to, label, icon: Icon }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex w-[5.75rem] shrink-0 flex-col items-center justify-center gap-1 transition-colors ${active ? "text-primary" : "text-foreground hover:bg-surface hover:text-primary"}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span className="whitespace-nowrap text-[11px] font-medium leading-none">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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

  return (
    <div
      className={cn(
        "mb-4 inline-flex flex-wrap items-center gap-x-2 rounded-lg border bg-surface-elevated px-3 py-1.5 text-xs text-ink-muted",
        emphasized ? "border-primary/30" : "border-border",
      )}
    >
      <span className="font-medium text-primary">Last sign-in</span>
      <span className="font-semibold text-foreground">{dateLabel}</span>
      <span>· {sinceLabel}</span>
    </div>
  );
}
