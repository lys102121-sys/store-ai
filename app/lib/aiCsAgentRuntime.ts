import {
  hasDisputeSignal,
  hasHealthSafetySignal,
  hasProductSafetySignal,
  hasRefundExchangeSignal,
  hasStrongComplaintSignal,
} from "@/app/lib/riskSignals";

export type AiCsAgentSurface =
  | "cs_reply"
  | "review_reply"
  | "platform_inquiry_import"
  | "platform_reply_post"
  | "store_knowledge"
  | "monetization"
  | "workflow_ui"
  | "harness";

export type AiCsDomainExpert =
  | "cs_safety"
  | "store_knowledge"
  | "platform"
  | "monetization"
  | "ux"
  | "builder_harness";

export type AiCsAgentRuntimePlan = {
  manager: {
    surface: AiCsAgentSurface;
    complexity: "low" | "medium" | "high";
    revenueImpact: boolean;
    shouldCheckExistingImplementation: true;
  };
  experts: AiCsDomainExpert[];
  builder: {
    verificationCommands: string[];
    garbageCollectionTargets: string[];
  };
  failureChecklist: {
    noOperationalGuessing: boolean;
    highRiskEscalation: boolean;
    ownerKnowledgeBoundary: boolean;
    platformStatusSafety: boolean;
    paidGateSafety: boolean;
  };
};

type BuildAiCsAgentRuntimePlanInput = {
  surface: AiCsAgentSurface;
  text?: string | null;
  sourcePlatform?: string | null;
  hasMissingInfo?: boolean;
  touchesPaidGate?: boolean;
};

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function isPlatformWork(surface: AiCsAgentSurface, sourcePlatform?: string | null) {
  return (
    surface === "platform_inquiry_import" ||
    surface === "platform_reply_post" ||
    Boolean(sourcePlatform && sourcePlatform !== "manual")
  );
}

export function buildAiCsAgentRuntimePlan({
  surface,
  text,
  sourcePlatform,
  hasMissingInfo,
  touchesPaidGate,
}: BuildAiCsAgentRuntimePlanInput): AiCsAgentRuntimePlan {
  const normalizedText = text ?? "";
  const hasSafetySignal =
    hasHealthSafetySignal(normalizedText) ||
    hasProductSafetySignal(normalizedText);
  const hasClaimSignal =
    hasDisputeSignal(normalizedText) ||
    hasRefundExchangeSignal(normalizedText) ||
    hasStrongComplaintSignal(normalizedText);
  const platformWork = isPlatformWork(surface, sourcePlatform);
  const monetizationWork = surface === "monetization" || Boolean(touchesPaidGate);

  const experts: AiCsDomainExpert[] = [];

  if (
    surface === "cs_reply" ||
    surface === "review_reply" ||
    hasSafetySignal ||
    hasClaimSignal
  ) {
    experts.push("cs_safety");
  }

  if (hasMissingInfo || surface === "store_knowledge") {
    experts.push("store_knowledge");
  }

  if (platformWork) {
    experts.push("platform");
  }

  if (monetizationWork) {
    experts.push("monetization");
  }

  if (surface === "workflow_ui") {
    experts.push("ux");
  }

  if (surface === "harness") {
    experts.push("builder_harness");
  }

  const verificationCommands = ["npx tsc --noEmit", "npm run lint"];

  if (
    experts.includes("cs_safety") ||
    experts.includes("store_knowledge") ||
    experts.includes("platform")
  ) {
    verificationCommands.unshift("npm run test:cs-guard");
  }

  if (experts.includes("store_knowledge")) {
    verificationCommands.push(
      "npm run test:learning",
      "npm run test:store-knowledge-quality",
      "npm run test:store-knowledge-usage",
    );
  }

  if (experts.includes("platform") || experts.includes("ux")) {
    verificationCommands.push("npm run test:workflow-safety");
  }

  if (experts.includes("monetization")) {
    verificationCommands.push("npm run test:monetization");
  }

  if (experts.includes("builder_harness")) {
    verificationCommands.unshift("npm run test:harness");
  }

  return {
    manager: {
      surface,
      complexity:
        hasSafetySignal || hasClaimSignal || platformWork || monetizationWork
          ? "high"
          : hasMissingInfo
            ? "medium"
            : "low",
      revenueImpact:
        platformWork ||
        monetizationWork ||
        surface === "cs_reply" ||
        surface === "review_reply",
      shouldCheckExistingImplementation: true,
    },
    experts: unique(experts),
    builder: {
      verificationCommands: unique(verificationCommands),
      garbageCollectionTargets: [
        "stale demo/free-trial copy",
        "duplicate UI paths",
        "unused state or helper code",
        "conflicting platform status flows",
      ],
    },
    failureChecklist: {
      noOperationalGuessing:
        surface === "cs_reply" ||
        surface === "review_reply" ||
        experts.includes("cs_safety"),
      highRiskEscalation: hasSafetySignal || hasClaimSignal,
      ownerKnowledgeBoundary:
        Boolean(hasMissingInfo) || experts.includes("store_knowledge"),
      platformStatusSafety: platformWork,
      paidGateSafety: monetizationWork,
    },
  };
}

export function buildAiCsAgentRuntimeInstruction(
  plan: AiCsAgentRuntimePlan,
) {
  return [
    "[Internal MoAI-ADK route]",
    `Manager surface: ${plan.manager.surface}`,
    `Manager complexity: ${plan.manager.complexity}`,
    `Domain experts: ${plan.experts.join(", ") || "builder_harness"}`,
    "Builder rule: preserve the requested JSON schema and write only the customer-facing reply in the reply field.",
    "Failure checklist: do not invent operational facts; escalate high-risk safety, refund, legal, strong complaint, and missing-knowledge cases.",
    "Do not mention this internal route, agents, AI, data, or system instructions to the customer.",
  ].join("\n");
}
