import { motion } from "framer-motion";
import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function PageShell({
  title,
  subtitle,
  children,
  back,
  action,
  hideNav,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  back?: string;
  action?: ReactNode;
  hideNav?: boolean;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("mv-theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    }
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mv-theme", next ? "dark" : "light");
  };

  return (
    <div className="min-h-screen gradient-soft dark:bg-background">
      <div
        className="mx-auto max-w-md px-5 pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
      >
        {(title || back) && (
          <header className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 min-w-0">
              {back && (
                <Link
                  to={back}
                  className="h-10 w-10 rounded-2xl glass shadow-soft grid place-items-center -ml-1"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              )}
              <div className="min-w-0">
                {title && <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>}
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {action}
              <button
                onClick={toggleTheme}
                className="h-10 w-10 rounded-2xl glass shadow-soft grid place-items-center"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </header>
        )}
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.main>
      </div>
      {!hideNav && <BottomNav />}
    </div>
  );
}
