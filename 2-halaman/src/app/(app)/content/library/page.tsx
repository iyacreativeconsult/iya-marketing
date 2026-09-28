import Link from "next/link";
import { CircleCheck, Clock, ExternalLink, FileText, Search, TimerOff, TriangleAlert } from "lucide-react";
import { requirePageUser } from "@/lib/server/session";
import { listAssets } from "@/lib/server/services/assets";
import { productionOptions } from "@/lib/server/services/contentOptions";
import { canUseForAds, isUsable, rightsState } from "@/lib/domain/content";
import { ASSET_STATUSES, USAGE_RIGHTS } from "@/lib/domain/types";
import { formatDateMs, todayMYT } from "@/lib/domain/dates";
import { detectPlatform } from "@/lib/domain/links";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { AssetForm } from "@/components/content/AssetForm";

export const metadata = { title: "Content Library" };

type SP = { q?: string; kind?: string; platform?: string; item?: string; rights?: string; status?: string; use?: string };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const [all, options] = await Promise.all([listAssets(), productionOptions(user)]);
  const today = todayMYT();
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status ?? "active";
  const rows = all.filter(
    (a) =>
      (status === "all" || (status === "active" ? a.status !== "Archived" : a.status === status)) &&
      (!sp.kind || sp.kind === "all" || a.kind === sp.kind) &&
      (!sp.platform || sp.platform === "all" || a.platform === sp.platform) &&
      (!sp.item || sp.item === "all" || a.itemIds.includes(sp.item)) &&
      (!sp.rights || sp.rights === "all" || a.usageRights === sp.rights) &&
      (!sp.use || sp.use === "all" || (sp.use === "usable" ? isUsable(a, today) : sp.use === "ads" ? canUseForAds(a, today) : sp.use === "soon" ? rightsState(a, today) === "soon" : rightsState(a, today) === "expired")) &&
      (!q || a.name.toLowerCase().includes(q) || a.creator.toLowerCase().includes(q)),
  );
  const filtered = Object.keys(sp).length > 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Content Library" description="Content sebenar yang sudah dihasilkan: video, gambar, poster, raw footage, caption. Dengan hak guna dan tarikh tamat." />
      <AssetForm options={options} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/content/library?use=usable"><StatCard icon={CircleCheck} label="Boleh diguna" value={all.filter((a) => isUsable(a, today)).length} tone="green" /></Link>
        <Link href="/content/library?status=Review"><StatCard icon={Clock} label="Menunggu semakan" value={all.filter((a) => a.status === "Review").length} tone="amber" /></Link>
        <Link href="/content/library?use=soon"><StatCard icon={TriangleAlert} label="Hak guna tamat dalam 14 hari" value={all.filter((a) => rightsState(a, today) === "soon").length} tone="amber" /></Link>
        <Link href="/content/library?use=expired"><StatCard icon={TimerOff} label="Hak guna sudah tamat" value={all.filter((a) => rightsState(a, today) === "expired").length} tone="red" /></Link>
      </div>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(5,140px)_auto]">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Cari nama / pencipta" className="input" aria-label="Cari" />
        <select name="kind" defaultValue={sp.kind ?? "all"} className="input" aria-label="Jenis"><option value="all">Semua jenis</option>{options.assetKinds.map((k) => <option key={k}>{k}</option>)}</select>
        <select name="platform" defaultValue={sp.platform ?? "all"} className="input" aria-label="Platform"><option value="all">Semua platform</option>{options.platforms.map((k) => <option key={k}>{k}</option>)}</select>
        <select name="item" defaultValue={sp.item ?? "all"} className="input" aria-label="Produk"><option value="all">Semua produk</option>{options.items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        <select name="use" defaultValue={sp.use ?? "all"} className="input" aria-label="Kegunaan"><option value="all">Semua</option><option value="usable">Boleh diguna</option><option value="ads">Boleh untuk iklan</option><option value="soon">Hampir tamat</option><option value="expired">Sudah tamat</option></select>
        <select name="status" defaultValue={status} className="input" aria-label="Status"><option value="active">Kecuali arkib</option><option value="all">Semua</option>{ASSET_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <div className="flex gap-2"><button className="btn-secondary"><Search className="size-4" /> Tapis</button>{filtered && <Link href="/content/library" className="btn-secondary">Reset</Link>}</div>
      </form>

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">Tiada asset.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((a) => {
            const rs = rightsState(a, today);
            return (
              <Link key={a.id} href={`/content/library/${a.id}`} className="card overflow-hidden transition-colors hover:border-brand-300">
                {a.file?.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${a.file.id}`} alt="" className="aspect-video w-full object-cover" loading="lazy" />
                ) : (
                  <div className="grid aspect-video place-items-center bg-brand-50 text-brand-600">
                    {a.url ? <span className="flex flex-col items-center gap-1 text-xs"><ExternalLink className="size-6" /> {detectPlatform(a.url)}</span> : <FileText className="size-6" />}
                  </div>
                )}
                <div className="space-y-1 p-3">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted">{[a.kind, a.platform, a.creator].filter(Boolean).join(" · ")}</p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.status === "Approved" ? "bg-emerald-50 text-emerald-800" : a.status === "Review" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600"}`}>{a.status}</span>
                    <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800">{a.usageRights}</span>
                    {rs === "expired" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Tamat {formatDateMs(a.rightsUntil)}</span>}
                    {rs === "soon" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Tamat {formatDateMs(a.rightsUntil)}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted">Hak guna: {USAGE_RIGHTS.join(" · ")}. &quot;KOL - organik sahaja&quot; tidak boleh digunakan untuk iklan berbayar.</p>
    </div>
  );
}
