export type CsLearningTrend =
  | "improving"
  | "stable"
  | "needs_attention"
  | "insufficient_data";

export type CsReplyCorrectionMetricRow = {
  source_id: string;
  case_type: string;
  sanitized_ai_reply: string;
  sanitized_owner_reply: string;
  updated_at: string;
};

export type CsLearningCorrectionType = {
  caseType: string;
  label: string;
  count: number;
};

export type CsLearningMetrics = {
  generatedReplies30d: number;
  correctedReplies30d: number;
  correctionRate30d: number;
  recentCorrectionRate7d: number;
  previousCorrectionRate7d: number;
  averageChangePercent: number;
  trend: CsLearningTrend;
  topCorrectionTypes: CsLearningCorrectionType[];
};

const CASE_TYPE_LABELS: Record<string, string> = {
  safety_harm: "안전·건강",
  repeat_issue: "반복 문제",
  service_breakdown: "처리 중단",
  cancellation_refund: "취소·환불",
  request_mismatch: "요청 불일치",
  quality_issue: "품질 문제",
  progress_status: "진행 상태",
  change_request: "변경 요청",
  information_request: "정보 문의",
};

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((Math.min(part, total) / total) * 1000) / 10;
}

function normalizeForDistance(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 1000);
}

function editDistance(leftValue: string, rightValue: string) {
  const left = normalizeForDistance(leftValue);
  const right = normalizeForDistance(rightValue);

  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[right.length];
}

export function calculateReplyChangePercent(aiReply: string, ownerReply: string) {
  const normalizedAiReply = normalizeForDistance(aiReply);
  const normalizedOwnerReply = normalizeForDistance(ownerReply);
  const longestLength = Math.max(
    normalizedAiReply.length,
    normalizedOwnerReply.length,
  );

  if (longestLength === 0) return 0;

  return Math.round(
    (editDistance(normalizedAiReply, normalizedOwnerReply) / longestLength) *
      100,
  );
}

export function createEmptyCsLearningMetrics(): CsLearningMetrics {
  return {
    generatedReplies30d: 0,
    correctedReplies30d: 0,
    correctionRate30d: 0,
    recentCorrectionRate7d: 0,
    previousCorrectionRate7d: 0,
    averageChangePercent: 0,
    trend: "insufficient_data",
    topCorrectionTypes: [],
  };
}

export function buildCsLearningMetrics({
  generatedReplies30d,
  generatedRepliesRecent7d,
  generatedRepliesPrevious7d,
  corrections,
  now = new Date(),
}: {
  generatedReplies30d: number;
  generatedRepliesRecent7d: number;
  generatedRepliesPrevious7d: number;
  corrections: CsReplyCorrectionMetricRow[];
  now?: Date;
}): CsLearningMetrics {
  const recentBoundary = new Date(now);
  recentBoundary.setDate(recentBoundary.getDate() - 7);
  const previousBoundary = new Date(now);
  previousBoundary.setDate(previousBoundary.getDate() - 14);

  const recentCorrections = corrections.filter(
    (correction) => new Date(correction.updated_at) >= recentBoundary,
  );
  const previousCorrections = corrections.filter((correction) => {
    const updatedAt = new Date(correction.updated_at);
    return updatedAt >= previousBoundary && updatedAt < recentBoundary;
  });
  const recentCorrectionRate7d = percentage(
    recentCorrections.length,
    generatedRepliesRecent7d,
  );
  const previousCorrectionRate7d = percentage(
    previousCorrections.length,
    generatedRepliesPrevious7d,
  );
  let trend: CsLearningTrend = "insufficient_data";

  if (generatedRepliesRecent7d >= 5 && generatedRepliesPrevious7d >= 5) {
    const rateDifference = recentCorrectionRate7d - previousCorrectionRate7d;
    trend =
      rateDifference <= -5
        ? "improving"
        : rateDifference >= 5
          ? "needs_attention"
          : "stable";
  }

  const correctionTypeCounts = corrections.reduce<Record<string, number>>(
    (counts, correction) => {
      counts[correction.case_type] = (counts[correction.case_type] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const averageChangePercent =
    corrections.length === 0
      ? 0
      : Math.round(
          corrections.reduce(
            (total, correction) =>
              total +
              calculateReplyChangePercent(
                correction.sanitized_ai_reply,
                correction.sanitized_owner_reply,
              ),
            0,
          ) / corrections.length,
        );

  return {
    generatedReplies30d,
    correctedReplies30d: corrections.length,
    correctionRate30d: percentage(corrections.length, generatedReplies30d),
    recentCorrectionRate7d,
    previousCorrectionRate7d,
    averageChangePercent,
    trend,
    topCorrectionTypes: Object.entries(correctionTypeCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([caseType, count]) => ({
        caseType,
        label: CASE_TYPE_LABELS[caseType] ?? "기타 문의",
        count,
      })),
  };
}
