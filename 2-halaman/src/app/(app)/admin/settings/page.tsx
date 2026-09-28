import { requirePageAdmin } from "@/lib/server/session";
import { getMasterLists } from "@/lib/server/services/master";
import { listItems } from "@/lib/server/services/catalog";
import { PageHeader } from "@/components/PageHeader";
import { ItemsAdmin } from "@/components/settings/CatalogAdmin";

export const metadata = { title: "Katalog Item" };

export default async function SettingsItemsPage() {
  await requirePageAdmin();
  const [items, lists] = await Promise.all([listItems(), getMasterLists()]);
  return (
    <div className="space-y-5">
      <PageHeader title="Katalog Item" description="Produk, menu F&B dan servis. Nilai kos digunakan untuk kira nilai barang yang diberi kepada KOL." />
      <ItemsAdmin items={items.filter((i) => !i.deleted)} categories={lists.itemCategories} />
    </div>
  );
}
