import { requirePageAdmin } from "@/lib/server/session";
import { getMasterLists } from "@/lib/server/services/master";
import { MASTER_INFO, MASTER_KEYS } from "@/lib/domain/master";
import { PageHeader } from "@/components/PageHeader";
import { MasterListEditor } from "@/components/settings/MasterListEditor";

export const metadata = { title: "Senarai pilihan" };

export default async function SettingsListsPage() {
  await requirePageAdmin();
  const lists = await getMasterLists();
  return (
    <div className="space-y-5">
      <PageHeader title="Senarai pilihan" description="Semua senarai boleh diubah tanpa ubah kod. Rekod lama tidak terjejas bila pilihan dibuang." />
      <div className="grid gap-4 xl:grid-cols-2">
        {MASTER_KEYS.map((k) => (
          <MasterListEditor key={k} listKey={k} title={MASTER_INFO[k].title} hint={MASTER_INFO[k].hint} items={lists[k]} />
        ))}
      </div>
    </div>
  );
}
