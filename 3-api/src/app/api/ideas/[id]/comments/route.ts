import { readJson, userRoute } from "@/lib/server/api";
import { addComment } from "@/lib/server/services/ideas";
import { ideaCommentSchema } from "@/lib/validation";

export const POST = userRoute<{ id: string }>(async ({ req, params, user, requestId }) => {
  const { text } = await readJson(req, ideaCommentSchema);
  return addComment(user, params.id, text, requestId);
});
