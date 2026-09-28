"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  ChartColumn,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  Wrench,
  Settings,
  UserCog,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Role, Team } from "@/lib/domain/types";
import { api, toApiError } from "@/lib/client/api";
import { APP_SUBTITLE } from "@/lib/config";

type NavItem = { label: string; icon: LucideIcon; href?: string; phase?: number; children?: { label: string; href: string; match?: string[] }[] };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Marketing Calendar", icon: CalendarDays },
  { href: "/campaigns", label: "Campaign", icon: Megaphone },
  {
    href: "/budget",
    label: "Budget",
    icon: Wallet,
    children: [
      { label: "Ringkasan tahunan", href: "/budget", match: ["/budget", "/budget/month"] },
      { label: "Perbelanjaan", href: "/budget/expenses" },
      { label: "Permohonan tambahan", href: "/budget/requests" },
    ],
  },
  {
    href: "/kol",
    label: "KOL Management",
    icon: UsersRound,
    children: [
      { label: "Senarai KOL", href: "/kol", match: ["/kol", "/kol/*"] },
      { label: "Tracker posting", href: "/kol/tracker", match: ["/kol/tracker", "/kol/campaign/*"] },
      { label: "Bayaran KOL", href: "/kol/payments" },
    ],
  },
  { href: "/ideas", label: "Idea Hub", icon: Lightbulb },
  { href: "/content-bank", label: "Content Bank", icon: Archive },
  {
    href: "/content",
    label: "Content",
    icon: FolderOpen,
    children: [
      { label: "Produksi", href: "/content", match: ["/content", "/content/*"] },
      { label: "Content Calendar", href: "/content/calendar" },
      { label: "Content Library", href: "/content/library", match: ["/content/library", "/content/library/*"] },
    ],
  },
  {
    href: "/reports",
    label: "Reports",
    icon: ChartColumn,
    children: [
      { label: "Ringkasan", href: "/reports" },
      { label: "Campaign", href: "/reports/campaigns" },
      { label: "KOL", href: "/reports/kol" },
      { label: "Content", href: "/reports/content" },
      { label: "Prestasi belum diisi", href: "/reports/pending" },
    ],
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin/users",
    label: "Pengguna & Team",
    icon: UserCog,
    children: [
      { label: "Pengguna", href: "/admin/users" },
      { label: "Team", href: "/admin/teams" },
    ],
  },
  {
    href: "/admin/settings",
    label: "Tetapan",
    icon: Settings,
    children: [
      { label: "Katalog Item", href: "/admin/settings" },
      { label: "Outlet", href: "/admin/settings/outlets" },
      { label: "Senarai pilihan", href: "/admin/settings/lists" },
    ],
  },
  {
    href: "/admin/delete-requests",
    label: "Sistem",
    icon: Wrench,
    children: [
      { label: "Permohonan padam", href: "/admin/delete-requests" },
      { label: "Tong sampah", href: "/admin/trash" },
      { label: "Log Sistem", href: "/admin/logs" },
    ],
  },
];

interface Props {
  user: { name: string; email: string; role: Role; teamIds: string[] };
  teams: Team[];
  activeTeamId: string | null;
  demo?: { currentId: string; users: { id: string; name: string }[] };
  children: React.ReactNode;
}

export function AppShell({ user, teams, activeTeamId, demo, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-line bg-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain px-4 py-6 [scrollbar-width:thin]">
          <div className="mb-8 flex items-start justify-between px-2">
            <div>
              <p className="text-3xl font-extrabold leading-none text-brand-500">iya</p>
              <p className="mt-1 text-[11px] font-medium tracking-[0.2em] text-muted">CREATIVE</p>
            </div>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
              <X className="size-5" />
            </button>
          </div>
          <NavList items={NAV} onNavigate={() => setOpen(false)} />
          {user.role === "admin" && (
            <>
              <AdminSection onNavigate={() => setOpen(false)} />
            </>
          )}
          <p className="mt-auto px-3 pt-8 text-xs text-muted">{APP_SUBTITLE}</p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Main */}
      <div className="min-w-0">
        {demo && <DemoBar demo={demo} />}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <button className="btn-secondary px-2.5 lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu className="size-5" />
          </button>
          <div className="ml-auto flex items-center gap-3">
            <TeamSwitcher role={user.role} teams={teams} memberTeamIds={user.teamIds} activeTeamId={activeTeamId} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user.name}</p>
              <p className="text-xs text-muted">{user.role === "admin" ? "Marketing Admin" : "Ahli Team"}</p>
            </div>
            {!demo && <LogoutButton />}
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

/** Bahagian Admin boleh dilipat. Terbuka automatik bila berada di halaman Admin. */
function AdminSection({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const inAdmin = pathname.startsWith("/admin");
  const [open, setOpen] = useState(inAdmin);
  useEffect(() => {
    if (inAdmin) setOpen(true);
  }, [inAdmin]);
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-1 text-xs font-semibold text-muted hover:text-ink"
      >
        Admin
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && <NavList items={ADMIN_NAV} onNavigate={onNavigate} />}
    </div>
  );
}

/** Submenu aktif = padanan paling spesifik ("/kol/tracker" menang atas "/kol/*"). */
function activeChild(children: { href: string; match?: string[] }[], pathname: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const c of children) {
    for (const m of c.match ?? [c.href]) {
      const ok = m.endsWith("/*") ? pathname.startsWith(m.slice(0, -1)) : pathname === m;
      const len = m.endsWith("/*") ? m.length - 2 : m.length + 1000; // padanan tepat sentiasa menang
      if (ok && (!best || len > best.len)) best = { href: c.href, len };
    }
  }
  return best?.href ?? null;
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = item.icon;
        if (!item.href) {
          return (
            <li key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted/70" title={`Akan datang dalam Fasa ${item.phase}`}>
              <Icon className="size-4.5" aria-hidden />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-600">Fasa {item.phase}</span>
            </li>
          );
        }
        const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (item.children) return <NavGroup key={item.href} item={item} active={activeChild(item.children, pathname) !== null} pathname={pathname} onNavigate={onNavigate} />;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-brand-100 text-brand-700" : "text-ink hover:bg-brand-50"}`}
            >
              <Icon className="size-4.5" aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Menu dengan submenu yang boleh dibuka/tutup. Terbuka automatik bila berada dalam bahagian itu. */
function NavGroup({ item, active, pathname, onNavigate }: { item: NavItem; active: boolean; pathname: string; onNavigate: () => void }) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const Icon = item.icon;
  const id = `sub-${item.href!.replace(/\W/g, "")}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${active ? "text-brand-700" : "text-ink"} hover:bg-brand-50`}
      >
        <Icon className="size-4.5" aria-hidden />
        <span className="flex-1">{item.label}</span>
        <ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul id={id} className="mt-0.5 ml-5 space-y-0.5 border-l border-line pl-3">
          {item.children!.map((c, _i, all) => {
            const on = activeChild(all, pathname) === c.href;
            return (
              <li key={c.href}>
                <Link href={c.href} onClick={onNavigate} className={`block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${on ? "bg-brand-100 font-semibold text-brand-700" : "text-muted hover:bg-brand-50 hover:text-ink"}`}>
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function TeamSwitcher({ role, teams, memberTeamIds, activeTeamId }: { role: Role; teams: Team[]; memberTeamIds: string[]; activeTeamId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const options = role === "admin" ? teams : teams.filter((t) => memberTeamIds.includes(t.id));

  if (role !== "admin" && options.length <= 1) {
    const t = options[0];
    return t ? <span className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700">Sesi Aktif: {t.name}</span> : null;
  }

  async function change(teamId: string) {
    try {
      await api("/api/session/team", { body: { teamId } });
      startTransition(() => router.refresh());
    } catch (e) {
      alert(toApiError(e).message);
    }
  }

  return (
    <label className="flex items-center gap-2 rounded-full bg-brand-100 py-1 pr-1 pl-3 text-xs font-semibold text-brand-700">
      Sesi Aktif
      {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      <select
        className="rounded-full border-0 bg-white px-2 py-1 text-xs font-semibold text-ink focus:ring-2 focus:ring-brand-300"
        value={activeTeamId ?? ""}
        onChange={(e) => change(e.target.value)}
      >
        {role === "admin" && <option value="all">Semua Team</option>}
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function LogoutButton() {
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/session", { method: "DELETE" });
    } finally {
      window.location.assign("/login");
    }
  }
  return (
    <button className="btn-secondary px-2.5" onClick={logout} disabled={busy} aria-label="Log keluar" title="Log keluar">
      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
    </button>
  );
}

/** Bar Mod Demo: tukar pengguna untuk uji kebenaran Admin dan ahli team. */
function DemoBar({ demo }: { demo: { currentId: string; users: { id: string; name: string }[] } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  async function change(userId: string) {
    try {
      await api("/api/demo/user", { body: { userId } });
      startTransition(() => router.refresh());
    } catch (e) {
      alert(toApiError(e).message);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-amber-100 px-4 py-2 text-xs text-amber-950 lg:px-8">
      <span className="font-bold">Mod Demo</span>
      <span>Tiada Firebase. Data contoh dalam memori, hilang bila server dihentikan.</span>
      <label className="ml-auto flex items-center gap-2 font-semibold">
        Guna sebagai
        {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
        <select className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs" value={demo.currentId} onChange={(e) => change(e.target.value)}>
          {demo.users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
