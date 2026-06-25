export type AnswerMode = "cs" | "review" | "batch_review";

const answerModes = [
  {
    id: "cs",
    label: "문의 답변",
    description:
      "처음 테스트할 때는 여기부터 시작하세요. 모르는 정보는 확인 필요로 분리합니다.",
  },
  {
    id: "review",
    label: "리뷰 답글",
    description:
      "좋은 리뷰와 아쉬운 리뷰에 맞춰 사장님 말투로 답글을 만듭니다.",
  },
  {
    id: "batch_review",
    label: "리뷰 일괄",
    description:
      "리뷰가 많이 쌓였을 때 줄바꿈으로 붙여넣고 한 번에 초안을 만듭니다.",
  },
] as const satisfies ReadonlyArray<{
  id: AnswerMode;
  label: string;
  description: string;
}>;

type AnswerModeSelectorProps = {
  isVisible: boolean;
  selectedMode: AnswerMode;
  onChange: (mode: AnswerMode) => void;
};

export function AnswerModeSelector({
  isVisible,
  selectedMode,
  onChange,
}: AnswerModeSelectorProps) {
  const selectedDescription = answerModes.find(
    (item) => item.id === selectedMode,
  )?.description;

  if (!isVisible) return null;

  return (
    <section className="order-[29] rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          어떤 답변을 만들까요?
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          업무를 선택하고 고객이 남긴 내용을 그대로 붙여넣으세요.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="답변 작성 유형"
        className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-950"
      >
        {answerModes.map((item) => {
          const isSelected = selectedMode === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              onClick={() => onChange(item.id)}
              className={`min-h-11 rounded-lg px-2 py-2 text-center text-xs font-semibold transition sm:text-sm ${
                isSelected
                  ? "bg-white text-blue-700 shadow-sm dark:bg-zinc-800 dark:text-blue-300"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
              aria-selected={isSelected}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {selectedDescription}
      </p>
    </section>
  );
}
