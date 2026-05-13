import { Link, useLocation } from "@tanstack/react-router";
import { Home, Clock, FileText, Pill, User } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/timeline", icon: Clock, label: "Timeline" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/medications", icon: Pill, label: "Meds" },
  { to: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 pt-2">
        <div className="glass shadow-card rounded-3xl px-2 py-2 flex items-center justify-between">
          {items.map((it) => {
            const active = pathname === it.to;
            const Icon = it.icon;
            return (
              <Link
                key={it.to}
                to={it.to}
                className="relative flex-1 flex flex-col items-center gap-0.5 py-2 px-1 rounded-2xl"
              >
                {active && (
                  <motion.div
                    layoutId="navPill"
                    className="absolute inset-0 gradient-primary rounded-2xl shadow-glow"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  className={`relative h-5 w-5 ${
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                  strokeWidth={2.2}
                />
                <span
                  className={`relative text-[10px] font-medium ${
                    active ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {it.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
