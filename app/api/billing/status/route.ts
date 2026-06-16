import { requireAuthenticatedUser } from "@/app/lib/auth";
import { getBillingPlanStatus } from "@/app/lib/billingPlan";
import { getFreeTrialAiReplyUsage } from "@/app/lib/freeTrialUsage";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const [plan, freeTrialUsage] = await Promise.all([
      getBillingPlanStatus({
        supabase: auth.supabase,
        userId: auth.userId,
      }),
      getFreeTrialAiReplyUsage({
        supabase: auth.supabase,
        userId: auth.userId,
      }),
    ]);

    return Response.json({
      plan,
      freeTrialUsage,
      unlocks: {
        aiReplyLimit: plan.isPaid,
        platformIntegrations: plan.isPaid,
        autoProcessing: plan.isPaid,
        bulkApproval: plan.isPaid,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown billing status error.";

    return Response.json(
      { error: "Failed to load billing status.", detail: message },
      { status: 500 },
    );
  }
}
