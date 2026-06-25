export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export const buttonBaseClass =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-bold shadow-sm transition duration-200 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-slate-950 text-white shadow-slate-950/15 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-950/20 focus-visible:ring-blue-200 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:focus-visible:ring-blue-950",
  secondary:
    "border border-slate-200 bg-white/90 text-slate-800 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-slate-950 focus-visible:ring-blue-100 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-blue-900 dark:hover:bg-blue-950/30 dark:hover:text-white dark:focus-visible:ring-blue-950",
  success:
    "bg-blue-600 text-white shadow-blue-500/20 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 focus-visible:ring-blue-200 dark:bg-blue-400 dark:text-slate-950 dark:hover:bg-blue-300 dark:focus-visible:ring-blue-950",
  warning:
    "border border-amber-200 bg-amber-50 text-amber-800 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 focus-visible:ring-amber-100 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200 dark:hover:bg-amber-950/60 dark:focus-visible:ring-amber-950",
  danger:
    "border border-red-200 bg-white/85 text-red-700 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 focus-visible:ring-red-100 dark:border-red-900/60 dark:bg-slate-950/70 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus-visible:ring-red-950",
  ghost:
    "bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-blue-100 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-blue-950",
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  extraClass = "",
) {
  return `${buttonBaseClass} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${extraClass}`.trim();
}
