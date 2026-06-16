import type { SupabaseClient } from "@supabase/supabase-js";

import { getBillingPlanStatus } from "@/app/lib/billingPlan";
import {
  FREE_TRIAL_AI_REPLY_LIMIT,
  FREE_TRIAL_LIMIT_REACHED_MESSAGE,
} from "@/app/lib/freeTrialLimits";

type ReplyUsageRow = {
  reply: string | null;
  external_id?: string | null;
};

type ReplyUsageTable = "cs_messages" | "reviews";

export type FreeTrialAiReplyUsage = {
  used: number;
  limit: number;
  remaining: number;
};

export type FreeTrialAiReplyCapacity = {
  allowed: boolean;
  requestedReplies: number;
  usage: FreeTrialAiReplyUsage;
  isPaidPlan: boolean;
};

function isDemoExternalId(externalId: string | null | undefined) {
  return externalId?.trim().startsWith("mock-") ?? false;
}

function isCountedAiReply(row: ReplyUsageRow) {
  return Boolean(row.reply?.trim()) && !isDemoExternalId(row.external_id);
}

async function countTableReplies({
  supabase,
  userId,
  table,
}: {
  supabase: SupabaseClient;
  userId: string;
  table: ReplyUsageTable;
}) {
  const primary = await supabase
    .from(table)
    .select("reply, external_id")
    .eq("user_id", userId)
    .not("reply", "is", null);
  let rows = primary.data as ReplyUsageRow[] | null;
  let error = primary.error;

  if (error && /external_id/i.test(error.message)) {
    const fallback = await supabase
      .from(table)
      .select("reply")
      .eq("user_id", userId)
      .not("reply", "is", null);

    rows = fallback.data as ReplyUsageRow[] | null;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (rows ?? []).filter(isCountedAiReply).length;
}

export async function getFreeTrialAiReplyUsage({
  supabase,
  userId,
}: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<FreeTrialAiReplyUsage> {
  const [csReplyCount, reviewReplyCount] = await Promise.all([
    countTableReplies({ supabase, userId, table: "cs_messages" }),
    countTableReplies({ supabase, userId, table: "reviews" }),
  ]);
  const used = csReplyCount + reviewReplyCount;

  return {
    used,
    limit: FREE_TRIAL_AI_REPLY_LIMIT,
    remaining: Math.max(0, FREE_TRIAL_AI_REPLY_LIMIT - used),
  };
}

export async function checkFreeTrialAiReplyCapacity({
  supabase,
  userId,
  requestedReplies = 1,
}: {
  supabase: SupabaseClient;
  userId: string;
  requestedReplies?: number;
}): Promise<FreeTrialAiReplyCapacity> {
  const plan = await getBillingPlanStatus({ supabase, userId });

  if (plan.isPaid) {
    return {
      allowed: true,
      requestedReplies,
      usage: {
        used: 0,
        limit: FREE_TRIAL_AI_REPLY_LIMIT,
        remaining: FREE_TRIAL_AI_REPLY_LIMIT,
      },
      isPaidPlan: true,
    };
  }

  const usage = await getFreeTrialAiReplyUsage({ supabase, userId });
  const allowed = usage.remaining >= requestedReplies;

  return {
    allowed,
    requestedReplies,
    usage,
    isPaidPlan: false,
  };
}

export function createFreeTrialLimitResponse({
  requestedReplies,
  usage,
}: {
  requestedReplies: number;
  usage: FreeTrialAiReplyUsage;
}) {
  return Response.json(
    {
      error: FREE_TRIAL_LIMIT_REACHED_MESSAGE,
      free_trial_limit_reached: true,
      requested_replies: requestedReplies,
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
    },
    { status: 402 },
  );
}
