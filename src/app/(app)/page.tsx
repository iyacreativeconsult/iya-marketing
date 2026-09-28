import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Megaphone,
  Siren,
  Trash2,
  TriangleAlert,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listTeams } from "@/lib/server/services/teams";
import { listCampaignsInRange } from "@/lib/server/services/campaigns";
import { listCksForScope, listOpenPayments } from "@/lib/server/services/campaignKols";
import { getAllTeamsBudget, getPersonBudgetView, getTeamBudgetView, listTopUpRequests } from "@/lib/server/services/budget";
import { listDeleteRequests } from "@/lib/server/services/deletion";
import { budgetLevel, type BudgetSummary } from "@/lib/domain/budget";
import { isPostingOverdue, STAGE_GROUPS } from "@/lib/domain/kol";
import { typeColor } from "@/lib/domain/campaign";
import { addDays, diffDays, formatDateMs, formatMonthMs, monthRange, nowMYT, shiftMonth, weekdayMondayFirst } from "@/lib/domain/dates";
import { formatSen } from "@/lib/domain/money";
import type { Campaign, CampaignKol, SessionUser, Team } from "@/lib/domain/types";
import { COMING_SOON_DAYS } from "@/lib/config";
import { StatusBadge, TeamLabel, TypeBadge } from "@/components/badges";
import { BudgetBar, KolStageBadge } from "@/components/finance";
import { LiveGreeting } from "@/components/dashboard/LiveGreeting";
import { listContent } from "@/lib/server/services/content";
import { listAssets } from "@/lib/server/services/assets";
import { rightsState } from "@/lib/domain/content";
import { buildReport } from "@/lib/server/services/reports";
import { ClipboardList } from "lucide-react";
import { Clapperboard, TimerOff } from "lucide-react";

export const metadata = { title: "Dashboard" };

const WEEKDAYS = ["Isn", "Sel", "Rab", "Kha", "Jum", "Sab", "Ahd"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ cm?: string }> }) {
  const user = await requirePageUser();
  const { cm } = await searchParams;
  const now = nowMYT();
  const today = now.ymd;
  const thisMonth = today.slice(0, 7);
  const scope = user.activeTeamId; // "all" (Admin), id team, atau null
  const inScope = (c: { teamId: string }) => scope === "all" || c.teamId === scope;

  // Calendar mini: bulan dipilih (lalai bulan ini)
  const cal = monthRange(cm);
  const gridStart = addDays(cal.from, -weekdayMondayFirst(cal.from));
  const gridEnd = addDays(cal.to, 6 - weekdayMondayFirst(cal.to));
  const prevMonth = shiftMonth(thisMonth, -1);

  const [teams, calCampaigns, recent, cks, openPays, budget, topUps, delReqs] = await Promise.all([
    listTeams(),
    listCampaignsInRange(gridStart, gridEnd),
    listCampaignsInRange(`${prevMonth}-01`, "9999-12-31"),
    scope ? listCksForScope(user, scope) : Promise.resolve([] as CampaignKol[]),
    scope ? listOpenPayments(user, scope) : Promise.resolve([]),
    loadBudget(user, scope, thisMonth),
    user.role === "admin" ? listTopUpRequests(user) : Promise.resolve([]),
    user.role === "admin" ? listDeleteRequests(user) : Promise.resolve([]),
  ]);
  const [contents, assets, yearReport] = await Promise.all([listContent(scope), listAssets(), buildReport(user, "year", thisMonth)]);
  const reviewContent = contents.filter((c) => c.status === "Review").length;
  const rightsIssues = assets.filter((a) => a.status !== "Archived" && (scope === "all" || a.teamId === scope) && ["soon", "expired"].includes(rightsState(a, today))).length;
  const teamById = new Map(teams.map((t) => [t.id, t]));

  // ---- Kiraan campaign
  const live = recent.filter((c) => c.status !== "Cancelled" && (scope ? inScope(c) : true));
  const inMonth = (c: Campaign, m: string) => c.startDate <= monthRange(m).to && c.endDate >= `${m}-01`;
  const thisCount = live.filter((c) => inMonth(c, thisMonth)).length;
  const lastCount = live.filter((c) => inMonth(c, prevMonth)).length;
  const trend = lastCount === 0 ? (thisCount > 0 ? 100 : 0) : Math.round(((thisCount - lastCount) / lastCount) * 100);
  const ongoing = live.filter((c) => c.status === "Ongoing");
  const upcoming = live
    .filter((c) => c.startDate > today && diffDays(today, c.startDate) <= 60)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const soon = upcoming.filter((c) => diffDays(today, c.startDate) <= COMING_SOON_DAYS);

  // ---- KOL
  const activeCks = cks.filter((c) => [...STAGE_GROUPS.rundingan, ...STAGE_GROUPS.komited].includes(c.stage));
  const overdue = cks.filter((c) => isPostingOverdue(c, today));
  const activeKols = new Set(activeCks.map((c) => c.kolId)).size;
  const kolStatus = [
    { label: "Rundingan", value: cks.filter((c) => STAGE_GROUPS.rundingan.includes(c.stage)).length, stage: "rundingan", cls: "bg-stone-50 text-stone-700" },
    { label: "Belum posting", value: cks.filter((c) => STAGE_GROUPS.belumPosting.includes(c.stage)).length, stage: "belum", cls: "bg-sky-50 text-sky-800" },
    { label: "Bayaran pending", value: cks.filter((c) => c.stage === "Payment Pending").length, stage: "bayaran", cls: "bg-amber-50 text-amber-800" },
    { label: "Selesai", value: cks.filter((c) => STAGE_GROUPS.selesai.includes(c.stage)).length, stage: "selesai", cls: "bg-emerald-50 text-emerald-800" },
  ];

  // ---- Alert
  const pendingApproval = live.filter((c) => c.status === "Planning");
  const notReady = soon.filter((c) => c.status === "Idea" || c.status === "Planning" || c.status === "Approved");
  const alerts: { icon: LucideIcon; label: string; count: number; href: string; tone: "red" | "amber" | "brand" }[] = [
    { icon: TriangleAlert, label: "KOL lewat posting", count: overdue.length, href: "/kol/tracker?stage=lewat", tone: "red" },
    { icon: CalendarClock, label: `Campaign bermula ${COMING_SOON_DAYS} hari lagi, belum sedia`, count: notReady.length, href: "/campaigns", tone: "amber" },
    { icon: Clock, label: "Campaign menunggu kelulusan", count: pendingApproval.length, href: "/campaigns?status=Planning", tone: "amber" },
    { icon: Banknote, label: user.role === "admin" ? "Bayaran KOL belum dibuat" : "Bayaran KOL saya belum dibuat", count: openPays.length, href: "/kol/payments", tone: "brand" },
  ];
  alerts.push(
    { icon: Clapperboard, label: "Content menunggu semakan", count: reviewContent, href: "/content", tone: "amber" },
    { icon: TimerOff, label: "Hak guna asset hampir / sudah tamat", count: rightsIssues, href: "/content/library?use=soon", tone: "red" },
    { icon: ClipboardList, label: "Prestasi posting belum diisi", count: yearReport.pending.length, href: "/reports/pending", tone: "amber" },
  );
  if (budget) {
    const heavy = budget.rows.filter((r) => budgetLevel(r.summary) !== "ok").length;
    alerts.push({ icon: Wallet, label: user.role === "admin" ? "Bajet 80% atau lebih digunakan" : "Bajet anda 80% atau lebih", count: heavy, href: "/budget", tone: "red" });
  }
  if (user.role === "admin") {
    alerts.push(
      { icon: Wallet, label: "Permohonan tambahan bajet", count: topUps.filter((r) => r.status === "Pending").length, href: "/budget/requests", tone: "brand" },
      { icon: Trash2, label: "Permohonan padam", count: delReqs.filter((r) => r.status === "Pending").length, href: "/admin/delete-requests", tone: "brand" },
    );
  }
  const activeAlerts = alerts.filter((a) => a.count > 0);

  const scopeName = scope === "all" ? "Semua team" : teamById.get(scope ?? "")?.name ?? "-";

  return (
    <div className="space-y-5">
      <LiveGreeting name={user.name.split(" ")[0] ?? user.name} initial={now} />

      {!scope && <div className="card p-5 text-sm">Anda belum ditambah ke mana-mana team. Hubungi Admin untuk akses penuh.</div>}

      {/* ---------------- Kad ringkasan ---------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Megaphone} label="Campaign bulan ini" value={thisCount} href="/calendar">
          <Trend pct={trend} />
        </Stat>
        <Stat icon={CalendarDays} label="Campaign berjalan" value={ongoing.length} href="/campaigns?status=Ongoing">
          <span className="text-xs text-muted">{soon.length} bermula dalam {COMING_SOON_DAYS} hari</span>
        </Stat>
        <Stat icon={UsersRound} label="KOL aktif" value={activeKols} href="/kol/tracker">
          <span className={`text-xs ${overdue.length ? "font-semibold text-red-700" : "text-muted"}`}>{overdue.length} lewat posting</span>
        </Stat>
        <Stat icon={Wallet} label={budget ? budget.title : "Bajet"} value={budget ? formatSen(budget.total.budgetSen) : "-"} href="/budget">
          {budget && (
            <div className="w-full">
              <BudgetBar s={budget.total} />
              <p className="mt-1 text-xs text-muted">{budget.total.pctUsed}% digunakan · baki {formatSen(budget.total.availableSen)}</p>
            </div>
          )}
        </Stat>
      </div>

      {/* ---------------- Calendar + Bajet + Status KOL ---------------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="card p-4 xl:col-span-7">
          <Header icon={CalendarDays} title="Marketing Calendar" href="/calendar" />
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Link href={`/?cm=${shiftMonth(cal.month, -1)}`} className="btn-secondary px-2 py-1" aria-label="Bulan sebelum"><ChevronLeft className="size-4" /></Link>
              <Link href={`/?cm=${shiftMonth(cal.month, 1)}`} className="btn-secondary px-2 py-1" aria-label="Bulan seterusnya"><ChevronRight className="size-4" /></Link>
              {cal.month !== thisMonth && <Link href="/" className="ml-1 text-xs text-brand-600 hover:underline">Hari ini</Link>}
            </div>
            <span className="rounded-full border border-line px-3 py-1 text-xs font-semibold">
              {formatDateMs(cal.from)} – {formatDateMs(cal.to)}
            </span>
          </div>
          <MiniCalendar month={cal.month} gridStart={gridStart} gridEnd={gridEnd} today={today} campaigns={calCampaigns.filter((c) => c.status !== "Cancelled")} teamById={teamById} />
        </section>

        <div className="space-y-5 xl:col-span-5">
          <section className="card p-4">
            <Header icon={Wallet} title={budget?.overviewTitle ?? "Budget Overview"} href="/budget" />
            {!budget ? (
              <p className="text-sm text-muted">Tiada bajet untuk dipaparkan.</p>
            ) : (
              <ul className="space-y-3">
                {budget.rows.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2 font-medium">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="truncate">{r.label}</span>
                        <span className={`text-xs font-semibold ${budgetLevel(r.summary) === "ok" ? "text-muted" : budgetLevel(r.summary) === "warn" ? "text-amber-700" : "text-red-700"}`}>{r.summary.pctUsed}%</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        <b className="text-ink">{formatSen(r.summary.usedSen)}</b> / {formatSen(r.summary.budgetSen)}
                      </span>
                    </div>
                    <div className="mt-1.5"><BudgetBar s={r.summary} /></div>
                  </li>
                ))}
                {budget.rows.length === 0 && <li className="text-sm text-muted">Bajet bulan ini belum ditetapkan.</li>}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <Header icon={UsersRound} title="Status KOL" href="/kol/tracker" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kolStatus.map((s) => (
                <Link key={s.stage} href={`/kol/tracker?stage=${s.stage}`} className={`rounded-xl p-3 text-center transition-opacity hover:opacity-80 ${s.cls}`}>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-[11px] font-medium">{s.label}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ---------------- Akan datang + KOL ongoing + Alert ---------------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <section className="card p-4 xl:col-span-4">
          <Header icon={CalendarClock} title="Campaign akan datang" href="/campaigns" />
          <Upcoming list={upcoming.slice(0, 5)} today={today} teamById={teamById} />
        </section>

        <section className="card p-4 xl:col-span-4">
          <Header icon={UsersRound} title="KOL ongoing" href="/kol/tracker" />
          <KolOngoing list={activeCks} today={today} />
        </section>

        <section className="card p-4 xl:col-span-4">
          <Header icon={Siren} title="Alert Center" />
          {activeAlerts.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Semua terkawal. Tiada perkara yang perlu perhatian.</p>
          ) : (
            <ul className="space-y-1">
              {activeAlerts.map((a) => {
                const tone = { red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-700", brand: "bg-brand-100 text-brand-600" }[a.tone];
                return (
                  <li key={a.label}>
                    <Link href={a.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-brand-50">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone}`}><a.icon className="size-4" aria-hidden /></span>
                      <span className="min-w-0 flex-1 text-sm">{a.label}</span>
                      <span className="text-sm font-bold tabular-nums">{a.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">Paparan: {scopeName}</p>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ Data bajet ------------------------------ */

interface BudgetRow {
  key: string;
  label: string;
  color: string;
  summary: BudgetSummary;
}

async function loadBudget(user: SessionUser, scope: string | null, month: string): Promise<{ title: string; overviewTitle: string; total: BudgetSummary; rows: BudgetRow[] } | null> {
  if (!scope) return null;
  if (user.role === "admin" && scope === "all") {
    const b = await getAllTeamsBudget(user, month);
    return {
      title: "Jumlah bajet (semua team)",
      overviewTitle: "Budget Overview",
      total: b.total,
      rows: b.rows.map((r) => ({ key: r.team.id, label: r.team.name, color: r.team.color, summary: r.summary })),
    };
  }
  if (user.role === "admin") {
    const b = await getTeamBudgetView(user, scope, month);
    return {
      title: `Bajet ${b.team.name}`,
      overviewTitle: `Budget ${b.team.name}`,
      total: b.summary,
      rows: b.rows.map((r) => ({ key: r.user.id, label: r.user.name, color: b.team.color, summary: r.summary })),
    };
  }
  const b = await getPersonBudgetView(user, scope, user.id, month);
  return { title: "Bajet saya bulan ini", overviewTitle: "Bajet saya", total: b.summary, rows: [{ key: user.id, label: `${b.team.name} (saya)`, color: b.team.color, summary: b.summary }] };
}

/* ------------------------------ Komponen kecil ------------------------------ */

function Header({ icon: Icon, title, href }: { icon: LucideIcon; title: string; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4.5 text-brand-600" aria-hidden /> {title}
      </h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
          Lihat semua <ArrowRight className="size-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, href, children }: { icon: LucideIcon; label: string; value: string | number; href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="card flex gap-4 p-4 transition-colors hover:border-brand-300">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <div className="mt-1">{children}</div>
      </div>
    </Link>
  );
}

function Trend({ pct }: { pct: number }) {
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? "text-emerald-700" : "text-red-700"}`}>
      <Icon className="size-3.5" aria-hidden />
      <b>{Math.abs(pct)}%</b> <span className="text-muted">vs bulan lepas</span>
    </span>
  );
}

function MiniCalendar({ month, gridStart, gridEnd, today, campaigns, teamById }: { month: string; gridStart: string; gridEnd: string; today: string; campaigns: Campaign[]; teamById: Map<string, Team> }) {
  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line pb-1 text-center text-[11px] font-semibold text-muted">
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const items = campaigns.filter((c) => c.startDate <= d && c.endDate >= d);
          const outside = !d.startsWith(month);
          return (
            <div key={d} className={`min-h-20 border-line p-1 ${i % 7 !== 6 ? "border-r" : ""} ${i < days.length - 7 ? "border-b" : ""} ${outside ? "bg-stone-50/60" : ""}`}>
              <p className={`mb-0.5 text-[11px] font-semibold ${d === today ? "inline-grid size-5 place-items-center rounded-full bg-brand-500 text-white" : outside ? "text-muted/50" : "text-muted"}`}>{Number(d.slice(8))}</p>
              <div className="space-y-0.5">
                {items.slice(0, 2).map((c) => {
                  const col = typeColor(c.type);
                  const first = c.startDate === d || i % 7 === 0;
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`} title={`${c.name} · ${teamById.get(c.teamId)?.name ?? ""} · ${c.status}`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] leading-tight ${col.bg} ${col.text} ${first ? "font-semibold" : "opacity-70"}`}>
                      {c.name}
                    </Link>
                  );
                })}
                {items.length > 2 && <p className="px-1 text-[10px] text-muted">+{items.length - 2} lagi</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[11px] text-muted">{formatMonthMs(month)}</p>
    </div>
  );
}

function daysLabel(n: number): string {
  if (n === 0) return "Hari ini";
  if (n === 1) return "Esok";
  return `${n} hari lagi`;
}

function Upcoming({ list, today, teamById }: { list: Campaign[]; today: string; teamById: Map<string, Team> }) {
  if (list.length === 0) return <p className="text-sm text-muted">Tiada campaign dalam 60 hari akan datang.</p>;
  const [first, ...rest] = list;
  return (
    <div className="space-y-2">
      {first && (
        <Link href={`/campaigns/${first.id}`} className="block rounded-xl border border-brand-200 bg-brand-50/60 p-3 hover:border-brand-400">
          <div className="flex items-start justify-between gap-2">
            <TypeBadge type={first.type} />
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-700">{daysLabel(diffDays(today, first.startDate))}</span>
          </div>
          <p className="mt-2 font-bold">{first.name}</p>
          <p className="mt-0.5 text-xs text-muted">{formatDateMs(first.startDate)} – {formatDateMs(first.endDate)}</p>
          <div className="mt-2 flex items-center justify-between">
            <TeamLabel team={teamById.get(first.teamId)} fallback={first.teamId} />
            <StatusBadge status={first.status} />
          </div>
        </Link>
      )}
      <ul className="divide-y divide-line">
        {rest.map((c) => (
          <li key={c.id}>
            <Link href={`/campaigns/${c.id}`} className="flex items-center gap-3 py-2 hover:bg-brand-50/50">
              <span className={`size-2 shrink-0 rounded-full ${typeColor(c.type).dot}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted">{formatDateMs(c.startDate)} · {teamById.get(c.teamId)?.name}</span>
              </span>
              <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">{daysLabel(diffDays(today, c.startDate))}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KolOngoing({ list, today }: { list: CampaignKol[]; today: string }) {
  if (list.length === 0) return <p className="text-sm text-muted">Tiada KOL sedang berjalan.</p>;
  // Lewat dahulu, kemudian ikut tarikh posting terdekat
  const sorted = [...list].sort((a, b) => Number(isPostingOverdue(b, today)) - Number(isPostingOverdue(a, today)) || (a.postingDueDate || "9999").localeCompare(b.postingDueDate || "9999"));
  return (
    <ul className="divide-y divide-line">
      {sorted.slice(0, 6).map((c) => {
        const late = isPostingOverdue(c, today);
        const d = c.postingDueDate ? diffDays(today, c.postingDueDate) : null;
        const due =
          c.stage === "Payment Pending" ? "Sudah posting" : d === null ? "Tarikh belum ditetapkan" : late ? `Lewat ${Math.abs(d)} hari` : `Posting ${daysLabel(d).toLowerCase()}`;
        return (
          <li key={c.id}>
            <Link href={`/kol/campaign/${c.id}`} className="flex items-center gap-3 py-2 hover:bg-brand-50/50">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{c.kolName.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{c.kolName} <span className="font-normal text-muted">{c.kolHandle}</span></span>
                <span className="block truncate text-xs text-muted">{c.campaignName}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <KolStageBadge stage={c.stage} />
                <span className={`text-[11px] ${late ? "font-semibold text-red-700" : "text-muted"}`}>{due}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
