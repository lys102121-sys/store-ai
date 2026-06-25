export type DashboardTab =
  | "start"
  | "store"
  | "integrations"
  | "answer"
  | "manage";

const tabs = [
  { id: "start", label: "시작하기" },
  { id: "store", label: "가게 설정" },
  { id: "integrations", label: "플랫폼 연동" },
  { id: "answer", label: "답변 작성" },
  { id: "manage", label: "운영 관리" },
] as const satisfies ReadonlyArray<{ id: DashboardTab; label: string }>;

type DashboardTabsProps = {
  activeTab: DashboardTab;
  onChange: (tab: DashboardTab) => void;
};

export function DashboardTabs({ activeTab, onChange }: DashboardTabsProps) {
  return (
    <nav
      aria-label="대시보드 탭"
      className="sticky top-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
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
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 sm:text-sm dark:focus-visible:ring-blue-950 ${
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
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
