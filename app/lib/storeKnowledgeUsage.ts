export type StoreKnowledgeUsageKnowledgeItem = {
  id: string;
};

export type StoreKnowledgeUsageMessage = {
  id: number | string;
  customerMessage: string;
  reply: string;
  status: string;
  sourcePlatform: string;
  createdAt: string;
  usedKnowledgeItems: StoreKnowledgeUsageKnowledgeItem[];
};

export type StoreKnowledgeUsageItem = {
  id: number | string;
  customerMessage: string;
  reply: string;
  status: string;
  sourcePlatform: string;
  createdAt: string;
};

export function buildStoreKnowledgeUsageMap(
  messages: StoreKnowledgeUsageMessage[],
  limit = 3,
) {
  const usageMap: Record<string, StoreKnowledgeUsageItem[]> = {};

  [...messages]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .forEach((message) => {
      const usedKnowledgeIds = [
        ...new Set(
          message.usedKnowledgeItems
            .map((item) => item.id)
            .filter((id) => id.trim().length > 0),
        ),
      ];

      usedKnowledgeIds.forEach((knowledgeId) => {
        const currentUsages = usageMap[knowledgeId] ?? [];

        if (currentUsages.length >= limit) return;

        usageMap[knowledgeId] = [
          ...currentUsages,
          {
            id: message.id,
            customerMessage: message.customerMessage,
            reply: message.reply,
            status: message.status,
            sourcePlatform: message.sourcePlatform,
            createdAt: message.createdAt,
          },
        ];
      });
    });

  return usageMap;
}
