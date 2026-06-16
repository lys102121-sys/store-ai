export type DashboardTab =
  | "start"
  | "store"
  | "integrations"
  | "answer"
  | "manage";

const tabs = [
  { id: "start", label: "처음 안내" },
  { id: "store", label: "가게 설정" },
  { id: "answer", label: "답변 테스트" },
  { id: "manage", label: "AI 처리함" },
  { id: "integrations", label: "연동 준비" },
] as const satisfies ReadonlyArray<{ id: DashboardTab; label: string }>;

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav
      aria-label="대시보드 탭"
      className="sticky top-3 z-20 rounded-[1.2rem] border border-white/75 bg-white/85 p-1.5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.65)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 dark:ring-white/10"
    >
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto sm:grid sm:grid-cols-5 sm:overflow-visible"
      >
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              onClick={() => onChange(tab.id)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 sm:text-sm dark:focus-visible:ring-indigo-950 ${
                isSelected
                  ? "bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              }`}
              aria-selected={isSelected}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
