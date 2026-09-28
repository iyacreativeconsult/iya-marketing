import { userRoute } from "@/lib/server/api";
import { toggleVote } from "@/lib/server/services/ideas";

export const POST = userRoute<{ id: string }>(async ({ params, user }) => toggleVote(user, params.id));
