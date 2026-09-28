import { adminRoute, readJson } from "@/lib/server/api";
import { saveOutlet } from "@/lib/server/services/catalog";
import { outletInputSchema, withVersion } from "@/lib/validation";
import { deleteCatalogDoc } from "@/lib/server/services/catalog";

export const PATCH = adminRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { version, data } = await readJson(req, withVersion(outletInputSchema));
  return saveOutlet(user, params.id, version, data, requestId);
});

export const DELETE = adminRoute<{ id: string }>(async ({ params, user, requestId }) => deleteCatalogDoc(user, "outlet", params.id, requestId));
