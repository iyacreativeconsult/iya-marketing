import { userRoute } from "@/lib/server/api";
import { readFileForUser } from "@/lib/server/services/files";

/** Papar fail. Hanya Admin dan ahli team pemilik fail. */
export const GET = userRoute<{ id: string }>(async ({ params, user }) => {
  const f = await readFileForUser(user, params.id);
  return new Response(new Uint8Array(f.data), {
    headers: {
      "Content-Type": f.type,
      "Content-Length": String(f.data.length),
      "Content-Disposition": `inline; filename="${f.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
