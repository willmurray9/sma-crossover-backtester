import { NavLink } from "@/components/NavLink";

export function ModeTabs() {
  const baseClasses = "px-3 py-1.5 rounded border text-xs font-mono transition-colors";
  const inactiveClasses = "border-border text-muted-foreground hover:text-foreground";
  const activeClasses = "bg-primary text-primary-foreground border-primary";

  return (
    <div className="flex items-center gap-2">
      <NavLink to="/" end className={`${baseClasses} ${inactiveClasses}`} activeClassName={activeClasses}>
        Single Ticker
      </NavLink>
      <NavLink to="/portfolio" className={`${baseClasses} ${inactiveClasses}`} activeClassName={activeClasses}>
        Portfolio
      </NavLink>
    </div>
  );
}
