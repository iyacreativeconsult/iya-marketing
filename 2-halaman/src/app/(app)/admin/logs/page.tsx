import Link from "next/link";
import { Search } from "lucide-react";
import { requirePageAdmin } from "@/lib/server/session";
import { listAuditLogs, listErrorLogs } from "@/lib/server/services/logs";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";
import { SystemTools } from "@/components/admin/SystemTools";

export const metadata = { title: "Log Sistem" };

type SP = { type?: string; requestId?: string; entityId?: string };

export default async function LogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAdmin();
  const sp = await searchParams;
  const type = sp.type === "error" ? "error" : "audit";
  const requestId = sp.requestId?.trim().slice(0, 32) || undefined;
  const entityId = sp.entityId?.trim().slice(0, 64) || undefined;

  const audit = type === "audit" ? await listAuditLogs({ requestId, entityId, limit: 150 }) : [];
  const errors = type === "error" ? await listErrorLogs({ requestId, limit: 100 }) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Log Sistem" description="Cari ikut kod rujukan yang pengguna nampak di skrin untuk kesan apa berlaku." />

      <SystemTools />

      <div className="flex gap-2">
        <Link href="/admin/logs?type=audit" className={type === "audit" ? "btn-primary" : "btn-secondary"}>Audit (siapa buat apa)</Link>
        <Link href="/admin/logs?type=error" className={type === "error" ? "btn-primary" : "btn-secondary"}>Ralat server</Link>
      </div>

      <form method="get" className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="type" value={type} />
        <input name="requestId" defaultValue={requestId ?? ""} placeholder="Kod rujukan (requestId)" className="input font-mono" aria-label="Kod rujukan" />
        {type === "audit" ? (
          <input name="entityId" defaultValue={entityId ?? ""} placeholder="ID rekod (contoh ID campaign)" className="input font-mono" aria-label="ID rekod" />
        ) : (
          <span />
        )}
        <button className="btn-secondary"><Search className="size-4" /> Cari</button>
      </form>

      {type === "audit" ? (
        <div className="card overflow-x-auto">
          <table className="table-base min-w-[900px]">
            <thead>
              <tr><th>Masa</th><th>Oleh</th><th>Tindakan</th><th>Rekod</th><th>Status</th><th>Nota / perubahan</th><th>Kod rujukan</th></tr>
            </thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted">Tiada rekod.</td></tr>}
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap">{formatDateTimeMs(a.at)}</td>
                  <td>{a.actorName}</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td className="text-xs">
                    {a.entity}
                    <br />
                    {a.entity === "campaign" ? (
                      <Link href={`/campaigns/${a.entityId}`} className="font-mono text-brand-600">{a.entityId}</Link>
                    ) : (
                      <span className="font-mono">{a.entityId}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-xs">{a.from || a.to ? `${a.from ?? "-"} → ${a.to ?? "-"}` : ""}</td>
                  <td className="max-w-80 text-xs">
                    {a.note}
                    {a.changes && <pre className="mt-1 whitespace-pre-wrap text-muted">{Object.entries(a.changes).map(([k, v]) => `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}`).join("\n")}</pre>}
                  </td>
                  <td><Link href={`/admin/logs?type=audit&requestId=${a.requestId}`} className="font-mono text-xs text-brand-600">{a.requestId}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.length === 0 && <p className="card p-6 text-center text-sm text-muted">Tiada ralat server direkodkan.</p>}
          {errors.map((e) => (
            <details key={e.id} className="card p-4">
              <summary className="cursor-pointer text-sm">
                <span className="font-mono text-brand-600">{e.requestId}</span> <span className="text-muted">{formatDateTimeMs(e.at)}</span>{" "}
                <span className="font-semibold">{e.method} {e.route}</span> <span className="font-mono text-xs">{e.code}</span>
                <span className="mt-1 block text-red-800">{e.message}</span>
              </summary>
              <p className="mt-3 text-xs text-muted">Pengguna: <span className="font-mono">{e.userId ?? "-"}</span></p>
              {e.stack && <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs">{e.stack}</pre>}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
