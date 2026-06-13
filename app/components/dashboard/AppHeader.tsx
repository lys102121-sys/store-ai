import {
  buttonBaseClass,
  buttonClass,
  buttonSizeClasses,
} from "@/app/lib/uiClasses";

const feedbackHref = "https://forms.gle/MSZhwmfmZB1gdTGV7";

type AppHeaderProps = {
  isAuthenticated: boolean;
  storeName: string;
  authLoading: boolean;
  authActionLoading: boolean;
  authError: string;
  onLogin: () => void;
  onLogout: () => void;
};

export function AppHeader({
  isAuthenticated,
  storeName,
  authLoading,
  authActionLoading,
  authError,
  onLogin,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="rounded-[1.5rem] border border-white/70 bg-white/80 p-3 shadow-[0_24px_90px_-55px_rgba(15,23,42,0.6)] ring-1 ring-slate-950/[0.03] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/70 dark:ring-white/10 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-400 text-sm font-black text-white shadow-lg shadow-indigo-500/20">
            AI
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black tracking-tight text-slate-950 dark:text-white">
              Store AI CS
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
              {isAuthenticated
                ? `${storeName ? `${storeName} · ` : ""}AI 직원 대기 중`
                : "내 가게 전용 AI CS 직원"}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onLogout}
              disabled={authLoading || authActionLoading}
              className={buttonClass("secondary", "sm", "rounded-lg")}
            >
              {authActionLoading ? "처리 중..." : "로그아웃"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              disabled={authLoading || authActionLoading}
              className={`${buttonBaseClass} ${buttonSizeClasses.sm} rounded-lg bg-gradient-to-r from-yellow-300 to-amber-300 font-bold text-slate-950 shadow-md shadow-amber-300/25 hover:-translate-y-0.5 focus-visible:ring-amber-200`}
            >
              {authActionLoading ? "연결 중..." : "카카오 로그인"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
        <p className="min-w-0 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <span className="mr-2 inline-flex rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
            Beta
          </span>
          현재는 답변을 확인한 뒤 복사해 플랫폼에 등록합니다.
        </p>
        <a
          href={feedbackHref}
          className="shrink-0 text-xs font-bold text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-300"
        >
          피드백
        </a>
      </div>

      {authError ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300">
          {authError}
        </p>
      ) : null}
    </header>
  );
}
