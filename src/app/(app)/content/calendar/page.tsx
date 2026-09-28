import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listContent } from "@/lib/server/services/content";
import { listCksForScope } from "@/lib/server/services/campaignKols";
import { CONTENT_STATUS_CLS } from "@/lib/domain/content";
import { addDays, formatMonthMs, monthRange, shiftMonth, todayMYT, weekdayMondayFirst } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Content Calendar" };

const WEEKDAYS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];

export default async function ContentCalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requirePageUser();
  const { m } = await searchParams;
  const { month, from, to } = monthRange(m);
  const gridStart = addDays(from, -weekdayMondayFirst(from));
  const gridEnd = addDays(to, 6 - weekdayMondayFirst(to));
  const scope = user.activeTeamId;
  const [contents, cks] = await Promise.all([listContent(scope), scope ? listCksForScope(user, scope) : Promise.resolve([])]);
  const today = todayMYT();

  type Entry = { key: string; date: string; label: string; sub: string; href: string; cls: string };
  const entries: Entry[] = [
    ...contents
      .filter((c) => c.publishDate && c.status !== "Archived")
      .map((c) => ({ key: `c-${c.id}`, date: c.publishDate, label: c.title, sub: [c.platform, c.status].filter(Boolean).join(" · "), href: `/content/${c.id}`, cls: CONTENT_STATUS_CLS[c.status] })),
    ...cks
      .filter((k) => (k.postedDate || k.postingDueDate) && k.stage !== "Dropped")
      .map((k) => ({
        key: `k-${k.id}`,
        date: k.postedDate || k.postingDueDate,
        label: `KOL: ${k.kolName}`,
        sub: `${k.platform} · ${k.checklist.posted ? "Sudah posting" : "Dijanjikan"}`,
        href: `/kol/campaign/${k.id}`,
        cls: k.checklist.posted ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
      })),
  ];

  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Content Calendar"
        description="Bila content akan dipublish, termasuk posting KOL. (Marketing Calendar pula untuk campaign dan event.)"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/content/calendar?m=${shiftMonth(month, -1)}`} className="btn-secondary px-2.5" aria-label="Bulan sebelum"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-36 text-center font-semibold">{formatMonthMs(month)}</span>
            <Link href={`/content/calendar?m=${shiftMonth(month, 1)}`} className="btn-secondary px-2.5" aria-label="Bulan seterusnya"><ChevronRight className="size-4" /></Link>
            <Link href="/content/calendar" className="btn-secondary">Hari ini</Link>
          </div>
        }
      />
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-brand-50 text-center text-xs font-semibold text-muted">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const items = entries.filter((e) => e.date === d);
            const outside = !d.startsWith(month);
            return (
              <div key={d} className={`min-h-32 border-line p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < days.length - 7 ? "border-b" : ""} ${outside ? "bg-stone-50/60" : ""}`}>
                <p className={`mb-1 text-xs font-semibold ${d === today ? "inline-grid size-6 place-items-center rounded-full bg-brand-500 text-white" : outside ? "text-muted/60" : "text-muted"}`}>{Number(d.slice(8))}</p>
                <div className="space-y-1">
                  {items.slice(0, 4).map((e) => (
                    <Link key={e.key} href={e.href} className={`block rounded-md px-1.5 py-1 text-[11px] leading-tight ${e.cls}`} title={`${e.label} (${e.sub})`}>
                      <span className="block truncate font-semibold">{e.label}</span>
                      <span className="block truncate opacity-80">{e.sub}</span>
                    </Link>
                  ))}
                  {items.length > 4 && <p className="px-1 text-[11px] text-muted">+{items.length - 4} lagi</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ul className="space-y-2 md:hidden">
        {entries.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
          <li key={e.key}><Link href={e.href} className="card block p-3"><p className="text-xs text-muted">{e.date}</p><p className="font-semibold">{e.label}</p><p className="text-xs text-muted">{e.sub}</p></Link></li>
        ))}
      </ul>
      <p className="text-xs text-muted">Warna ikut status content. Posting KOL bertanda merah jambu bila masih dijanjikan, hijau bila sudah posting.</p>
    </div>
  );
}
