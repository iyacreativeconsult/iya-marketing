import { requirePageAdmin } from "@/lib/server/session";
import { listTrash, TRASH } from "@/lib/server/services/trash";
import { formatDateTimeMs } from "@/lib/domain/dates";
import { PageHeader } from "@/components/PageHeader";
import { RestoreButton } from "@/components/admin/RestoreButton";

export const metadata = { title: "Tong sampah" };

export default async function TrashPage() {
  const admin = await requirePageAdmin();
  const rows = await listTrash(admin);
  return (
    <div className="space-y-5">
      <PageHeader title="Tong sampah" description="Rekod yang dipadam. Pulihkan jika tersilap padam. Pengguna yang dipadam perlu dicipta semula kerana akses log masuk sudah dibuang." />
      <div className="card overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <thead><tr><th>Jenis</th><th>Rekod</th><th>Dipadam</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted">Tong sampah kosong.</td></tr>}
            {rows.map((r) => (
              <tr key={`${r.entity}-${r.id}`}>
                <td className="text-sm"><span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{TRASH[r.entity].label}</span></td>
                <td className="font-medium">{r.name}</td>
                <td className="text-sm whitespace-nowrap">{formatDateTimeMs(r.deletedAt)}</td>
                <td className="text-right">{r.restorable ? <RestoreButton entity={r.entity} id={r.id} /> : <span className="text-xs text-muted">Cipta semula di Pengguna</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
