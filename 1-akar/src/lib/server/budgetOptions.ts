import "server-only";
import { canDeleteExpense, canEditExpense, canRequestDeleteExpense } from "../domain/budget";
import { addDays, monthRange } from "../domain/dates";
import type { Expense, SessionUser } from "../domain/types";
import type { ExpenseOptions } from "@/components/budget/ExpensesPanel";
import { teamMembers } from "./services/budget";
import { listCampaignsInRange } from "./services/campaigns";
import { listCksForScope } from "./services/campaignKols";
import { getMasterLists } from "./services/master";

export function withPerms(user: SessionUser, e: Expense) {
  return { ...e, canEdit: canEditExpense(user, e), canDelete: canDeleteExpense(user, e), canRequestDelete: canRequestDeleteExpense(user, e), canReview: user.role === "admin" && e.status === "Dalam Proses" };
}

export async function expenseOptions(user: SessionUser, teamId: string, month: string, personId?: string): Promise<ExpenseOptions> {
  const { from, to } = monthRange(month);
  const [lists, campaigns, cks, members] = await Promise.all([
    getMasterLists(),
    listCampaignsInRange(addDays(from, -60), addDays(to, 60)),
    listCksForScope(user, teamId),
    user.role === "admin" ? teamMembers(teamId) : Promise.resolve(null),
  ]);
  const owners = members ? (personId ? members.filter((m) => m.id === personId) : members) : null;
  return {
    campaigns: campaigns.filter((c) => c.teamId === teamId && c.status !== "Cancelled").map((c) => ({ id: c.id, name: c.name })),
    categories: lists.expenseCategories,
    paymentMethods: lists.paymentMethods,
    kols: cks
      .filter((k) => k.stage !== "Dropped" && (user.role === "admin" || k.picId === user.id))
      .map((k) => ({ id: k.id, campaignId: k.campaignId, picId: k.picId, label: `${k.kolName} (${k.campaignName})` })),
    owners: owners && owners.length ? owners : null,
  };
}

