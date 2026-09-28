"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Campaign, Team } from "@/lib/domain/types";
import { CAMPAIGN_STATUSES } from "@/lib/domain/types";
import { typeColor } from "@/lib/domain/campaign";
import type { CampaignOptions } from "./CampaignForm";
import { addDays, formatDateMs, formatMonthMs, shiftMonth } from "@/lib/domain/dates";
import { StatusBadge, TypeBadge } from "./badges";

const WEEKDAYS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
const MAX_PER_DAY = 3;

interface Props {
  month: string;
  gridStart: string;
  gridEnd: string;
  today: string;
  campaigns: Campaign[];
  teams: Team[];
  options: CampaignOptions;
  canCreate: boolean;
}

export function CalendarView({ month, gridStart, gridEnd, today, campaigns, teams, options, canCreate }: Props) {
  const [team, setTeam] = useState("all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("active");
  const [platform, setPlatform] = useState("all");
  const [item, setItem] = useState("all");
  const [outlet, setOutlet] = useState("all");
  const [q, setQ] = useState("");

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const filtered = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          (team === "all" || c.teamId === team) &&
          (type === "all" || c.type === type) &&
          (status === "all" || (status === "active" ? c.status !== "Cancelled" : c.status === status)) &&
          (platform === "all" || c.platforms.includes(platform)) &&
          (item === "all" || c.itemIds.includes(item)) &&
          (outlet === "all" || c.outletIds.includes(outlet)) &&
          (q.trim() === "" || c.name.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [campaigns, team, type, status, platform, item, outlet, q],
  );

  const days: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const onDay = (d: string) => filtered.filter((c) => c.startDate <= d && c.endDate >= d);
  const inMonth = filtered.filter((c) => c.endDate >= `${month}-01` && c.startDate <= `${month}-31`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${shiftMonth(month, -1)}`} className="btn-secondary px-2.5" aria-label="Bulan sebelum">
            <ChevronLeft className="size-4" />
          </Link>
          <h1 className="min-w-44 text-center text-xl font-bold">{formatMonthMs(month)}</h1>
          <Link href={`/calendar?m=${shiftMonth(month, 1)}`} className="btn-secondary px-2.5" aria-label="Bulan seterusnya">
            <ChevronRight className="size-4" />
          </Link>
          <Link href="/calendar" className="btn-secondary">Hari ini</Link>
        </div>
        {canCreate && (
          <Link href="/campaigns/new" className="btn-primary">
            <Plus className="size-4" /> Tambah Campaign
          </Link>
        )}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7">
        <input className="input" placeholder="Cari nama campaign" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari" />
        <Select label="Team" value={team} onChange={setTeam} options={[["all", "Semua Team"], ...teams.map((t) => [t.id, t.name] as [string, string])]} />
        <Select label="Jenis" value={type} onChange={setType} options={[["all", "Semua Jenis"], ...options.types.map((t) => [t, t] as [string, string])]} />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[["active", "Semua kecuali Cancelled"], ["all", "Semua Status"], ...CAMPAIGN_STATUSES.map((s) => [s, s] as [string, string])]}
        />
        <Select label="Platform" value={platform} onChange={setPlatform} options={[["all", "Semua Platform"], ...options.platforms.map((p) => [p, p] as [string, string])]} />
        <Select label="Item" value={item} onChange={setItem} options={[["all", "Semua Item"], ...options.items.map((i) => [i.id, i.name] as [string, string])]} />
        <Select label="Outlet" value={outlet} onChange={setOutlet} options={[["all", "Semua Outlet"], ...options.outlets.map((o) => [o.id, o.name] as [string, string])]} />
      </div>

      {/* Grid bulan: tablet dan desktop */}
      <div className="card hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-brand-50 text-center text-xs font-semibold text-muted">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const items = onDay(d);
            const outside = !d.startsWith(month);
            return (
              <div key={d} className={`min-h-32 border-line p-1.5 ${i % 7 !== 6 ? "border-r" : ""} ${i < days.length - 7 ? "border-b" : ""} ${outside ? "bg-stone-50/60" : ""}`}>
                <p className={`mb-1 text-xs font-semibold ${d === today ? "inline-grid size-6 place-items-center rounded-full bg-brand-500 text-white" : outside ? "text-muted/60" : "text-muted"}`}>
                  {Number(d.slice(8))}
                </p>
                <div className="space-y-1">
                  {items.slice(0, MAX_PER_DAY).map((c) => {
                    const col = typeColor(c.type);
                    const isStart = c.startDate === d || i % 7 === 0;
                    return (
                      <Link
                        key={c.id}
                        href={`/campaigns/${c.id}`}
                        title={`${c.name} (${teamById.get(c.teamId)?.name ?? ""}, ${c.status})`}
                        className={`block truncate rounded-md px-1.5 py-1 text-[11px] leading-tight ${col.bg} ${col.text} ${c.status === "Cancelled" ? "line-through opacity-60" : ""} ${isStart ? "font-semibold" : "opacity-70"}`}
                      >
                        {isStart ? c.name : `↳ ${c.name}`}
                        {isStart && <span className="block truncate font-normal opacity-80">{teamById.get(c.teamId)?.name}</span>}
                      </Link>
                    );
                  })}
                  {items.length > MAX_PER_DAY && <p className="px-1 text-[11px] text-muted">+{items.length - MAX_PER_DAY} lagi</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Senarai: telefon */}
      <div className="space-y-2 md:hidden">
        {inMonth.length === 0 && <p className="card p-5 text-sm text-muted">Tiada campaign bulan ini.</p>}
        {inMonth.map((c) => (
          <Link key={c.id} href={`/campaigns/${c.id}`} className="card block p-4">
            <p className="font-semibold">{c.name}</p>
            <p className="mt-1 text-sm text-muted">
              {formatDateMs(c.startDate)} hingga {formatDateMs(c.endDate)}, {teamById.get(c.teamId)?.name}
            </p>
            <div className="mt-2 flex gap-2">
              <TypeBadge type={c.type} />
              <StatusBadge status={c.status} />
            </div>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {options.types.map((t) => (
          <TypeBadge key={t} type={t} />
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
