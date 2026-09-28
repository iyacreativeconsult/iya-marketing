import "server-only";
import { getMasterLists } from "./master";
import { listItems, listOutlets } from "./catalog";

/** Pilihan untuk borang campaign dan penapis calendar (item/outlet aktif sahaja). */
export async function campaignOptions() {
  const [lists, items, outlets] = await Promise.all([getMasterLists(), listItems(), listOutlets()]);
  return {
    types: lists.campaignTypes,
    platforms: lists.platforms,
    items: items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name, kind: i.kind })),
    outlets: outlets.filter((o) => o.active).map((o) => ({ id: o.id, name: o.name })),
  };
}

/** Nama untuk semua item/outlet (termasuk tidak aktif) untuk paparan rekod lama. */
export async function nameMaps() {
  const [items, outlets] = await Promise.all([listItems(), listOutlets()]);
  return { itemName: new Map(items.map((i) => [i.id, i.name])), outletName: new Map(outlets.map((o) => [o.id, o.name])) };
}

/** Pilihan untuk Idea Hub dan Content Bank. */
export async function contentOptions() {
  const [lists, items] = await Promise.all([getMasterLists(), listItems()]);
  return {
    ideaTypes: lists.ideaTypes,
    contentTypes: lists.contentTypes,
    platforms: lists.platforms,
    campaignTypes: lists.campaignTypes,
    items: items.filter((i) => i.active).map((i) => ({ id: i.id, name: i.name })),
  };
}
