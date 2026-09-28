import type { AuditEntry } from "@/lib/domain/types";
import { formatDateTimeMs } from "@/lib/domain/dates";

const ACTION_LABEL: Record<string, string> = {
  create: "Dicipta",
  update: "Dikemas kini",
  update_reapproval: "Dikemas kini, perlu kelulusan semula",
  delete: "Dipadam",
  submit: "Dihantar untuk kelulusan",
  withdraw: "Ditarik balik ke draf",
  approve: "Diluluskan",
  request_changes: "Admin minta ubah",
  schedule: "Ditanda Scheduled",
  start: "Bermula",
  complete: "Selesai",
  cancel: "Dibatalkan",
  login: "Log masuk",
  comment: "Komen",
  perf_record: "Prestasi dikemas kini",
  to_script: "Mula skrip",
  to_production: "Mula produksi",
  to_editing: "Mula suntingan",
  submit_review: "Dihantar untuk semakan",
  revise: "Minta revisi",
  publish: "Published",
  archive: "Diarkib",
  idea_in_production: "Idea masuk produksi",
  idea_published: "Idea published",
  asset_submit: "Asset dihantar untuk semakan",
  asset_approve: "Asset diluluskan",
  asset_revise: "Asset perlu revisi",
  asset_archive: "Asset diarkib",
  asset_unarchive: "Asset diaktifkan semula",
  idea_approve: "Idea diluluskan",
  idea_reject: "Idea ditolak",
  idea_reopen: "Idea dibuka semula",
  idea_to_bank: "Dimasukkan ke Content Bank",
  idea_to_campaign: "Dijadikan campaign",
  delete_request: "Mohon padam",
  delete_approve: "Permohonan padam diluluskan",
  delete_reject: "Permohonan padam ditolak",
  restore: "Dipulihkan dari Tong sampah",
  topup_request: "Mohon tambahan bajet",
  topup_approve: "Tambahan bajet diluluskan",
  topup_reject: "Tambahan bajet ditolak",
  topup_cancel: "Permohonan tambahan ditarik balik",
  resubmit: "Dihantar semula",
  verify: "Disahkan Admin",
  reject: "Ditolak Admin",
  set_budget: "Bajet ditetapkan",
  upload: "Fail dimuat naik",
  update_bank: "Maklumat bank dikemas kini",
  assign: "KOL ditambah ke campaign",
  contact: "Sudah dihubungi",
  negotiate: "Dalam rundingan",
  confirm: "Disahkan (fee setuju)",
  brief_sent: "Brief dihantar",
  product_sent: "Produk dihantar",
  content_received: "Content diterima",
  content_approved: "Content diluluskan",
  request_revision: "Minta revisi",
  posted: "Sudah posting",
  paid: "Semua bayaran selesai",
  drop: "KOL digugurkan",
  payment_create: "Permintaan bayaran",
  payment_update: "Bayaran dikemas kini",
  payment_process: "Bayaran diproses",
  payment_pay: "Bayaran dibuat",
  payment_cancel: "Bayaran dibatalkan",
  logout: "Log keluar",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nama",
  type: "Jenis",
  teamId: "Team",
  startDate: "Tarikh mula",
  endDate: "Tarikh tamat",
  platforms: "Platform",
  products: "Produk",
  objective: "Objektif",
  plannedBudgetSen: "Bajet (sen)",
  notes: "Nota",
  role: "Peranan",
  teamIds: "Team",
  active: "Aktif",
  password: "Kata laluan",
  color: "Warna",
  feeSen: "Fee (sen)",
  deliverables: "Deliverable",
  postingDueDate: "Tarikh posting",
  amountSen: "Jumlah (sen)",
  description: "Keterangan",
  category: "Kategori",
  date: "Tarikh",
  vendor: "Vendor",
  receipt: "Resit",
  invoice: "Invois",
  accounts: "Akaun",
  rateSen: "Rate (sen)",
  status: "Status",
  ownerTeamId: "Team pemilik",
  kind: "Jenis",
  campaignId: "Campaign",
  realName: "Nama sebenar",
  niche: "Niche",
};

function label(o: object): string {
  const r = o as Record<string, unknown>;
  if (r.username) return `${r.platform ?? ""} @${r.username}`.trim();
  if (r.name) return String(r.name);
  return JSON.stringify(o);
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === "object" ? label(x) : String(x))).join(", ") || "-";
  if (typeof v === "object") return label(v);
  return String(v);
}

export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted">Belum ada rekod.</p>;
  return (
    <ol className="space-y-4">
      {entries.map((e) => (
        <li key={e.id} className="relative border-l-2 border-brand-100 pl-4">
          <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-brand-400" />
          <p className="text-sm font-semibold">
            {ACTION_LABEL[e.action] ?? e.action}
            {e.from && e.to && <span className="font-normal text-muted"> ({e.from} → {e.to})</span>}
          </p>
          <p className="text-xs text-muted">{e.actorName}, {formatDateTimeMs(e.at)}</p>
          {e.note && <p className="mt-1 text-sm whitespace-pre-wrap">{e.note}</p>}
          {e.changes && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {Object.entries(e.changes).map(([k, ch]) => (
                <li key={k}>
                  {FIELD_LABEL[k] ?? k}: {show(ch.from)} → {show(ch.to)}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
