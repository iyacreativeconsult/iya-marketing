import { requirePageAdmin } from "@/lib/server/session";
import { getMasterLists } from "@/lib/server/services/master";
import { listOutlets } from "@/lib/server/services/catalog";
import { PageHeader } from "@/components/PageHeader";
import { OutletsAdmin } from "@/components/settings/CatalogAdmin";

export const metadata = { title: "Outlet" };

export default async function SettingsOutletsPage() {
  await requirePageAdmin();
  const [outlets, lists] = await Promise.all([listOutlets(), getMasterLists()]);
  return (
    <div className="space-y-5">
      <PageHeader title="Outlet" description="Kedai, cawangan dan lokasi. Digunakan dalam campaign dan review kedai (dine-in)." />
      <OutletsAdmin outlets={outlets.filter((o) => !o.deleted)} kinds={lists.outletKinds} />
    </div>
  );
}
