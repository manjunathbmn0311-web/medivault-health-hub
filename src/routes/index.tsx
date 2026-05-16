import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { useScopedStorage, useActiveProfile, TimelineEntry, Report, Medication } from "@/lib/storage";
import { Activity, AlertCircle, Droplet, Phone, User, FileText, Pill, Clock, Calendar, QrCode, ShieldAlert, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediVault — Your medical history, in your pocket" },
      { name: "description", content: "Securely store and share your complete medical history with doctors in seconds." },
    ],
  }),
  component: Home,
});

function Stat({ icon: Icon, label, value, tone = "primary" }: any) {
  return (
    <div className="rounded-2xl bg-card shadow-soft p-3 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl grid place-items-center bg-${tone}/10 text-${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

function Home() {
  const { profile } = useActiveProfile();
  const [timeline] = useLocalStorage<TimelineEntry[]>("mv-timeline", []);
  const [reports] = useLocalStorage<Report[]>("mv-reports", []);
  const [meds] = useLocalStorage<Medication[]>("mv-meds", []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const quick = [
    { to: "/timeline", icon: Clock, label: "Add entry", color: "from-sky-400 to-cyan-500" },
    { to: "/reports", icon: FileText, label: "Upload report", color: "from-violet-400 to-fuchsia-500" },
    { to: "/medications", icon: Pill, label: "Medications", color: "from-emerald-400 to-teal-500" },
    { to: "/menstrual", icon: Calendar, label: "Cycle", color: "from-pink-400 to-rose-500" },
  ];

  return (
    <PageShell hideNav={false}>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-5"
      >
        <div>
          <p className="text-xs text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.name ? profile.name.split(" ")[0] : "Welcome"} 👋
          </h1>
        </div>
        <Link to="/profile" className="h-11 w-11 rounded-2xl gradient-primary shadow-glow grid place-items-center text-primary-foreground">
          <User className="h-5 w-5" />
        </Link>
      </motion.header>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow mb-5"
      >
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs opacity-80">Health Profile</p>
              <p className="text-lg font-semibold">{profile.name || "Set up your profile"}</p>
            </div>
            <Link to="/profile" className="text-xs glass !bg-white/15 px-3 py-1.5 rounded-full border-white/20">
              Edit
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
              <Droplet className="h-4 w-4 opacity-90" />
              <p className="text-[10px] opacity-80 mt-1">Blood</p>
              <p className="font-semibold text-sm">{profile.bloodGroup || "—"}</p>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
              <AlertCircle className="h-4 w-4 opacity-90" />
              <p className="text-[10px] opacity-80 mt-1">Allergies</p>
              <p className="font-semibold text-sm truncate">{profile.allergies || "None"}</p>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur p-3">
              <Activity className="h-4 w-4 opacity-90" />
              <p className="text-[10px] opacity-80 mt-1">Chronic</p>
              <p className="font-semibold text-sm truncate">{profile.chronic || "None"}</p>
            </div>
          </div>
          <Link
            to="/emergency"
            className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 backdrop-blur px-4 py-3 active:scale-[0.98] transition"
          >
            <span className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4" /> Emergency Card
            </span>
            <Phone className="h-4 w-4" />
          </Link>
        </div>
      </motion.div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Reports", v: reports.length, Icon: FileText, to: "/reports" as const },
          { label: "Entries", v: timeline.length, Icon: Clock, to: "/timeline" as const },
          { label: "Meds", v: meds.filter((m) => m.active).length, Icon: Pill, to: "/medications" as const },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
          >
            <Link
              to={s.to}
              className="block rounded-2xl bg-card shadow-soft p-3 text-center active:scale-[0.97] transition"
            >
              <s.Icon className="h-4 w-4 mx-auto text-primary" />
              <p className="text-xl font-bold mt-1">{s.v}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold mb-2 px-1 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {quick.map((q, i) => (
          <motion.div
            key={q.to}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Link
              to={q.to}
              className="block rounded-3xl bg-card shadow-card p-4 active:scale-[0.97] transition"
            >
              <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${q.color} grid place-items-center text-white shadow-soft`}>
                <q.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 font-semibold text-sm">{q.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent uploads */}
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold">Recent reports</h2>
        <Link to="/reports" className="text-xs text-primary font-medium">See all</Link>
      </div>
      {reports.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-soft p-6 text-center text-sm text-muted-foreground">
          <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
          No reports yet. Upload your first.
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
          {reports.slice(-6).reverse().map((r) => (
            <a
              key={r.id}
              href={r.dataUrl}
              target="_blank"
              rel="noreferrer"
              download={r.name}
              className="shrink-0 w-32 rounded-2xl bg-card shadow-soft overflow-hidden active:scale-95 transition"
            >
              <div className="h-24 bg-muted grid place-items-center">
                {r.mimeType.startsWith("image/") ? (
                  <img src={r.dataUrl} alt={r.name} className="h-full w-full object-cover" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.category}</p>
              </div>
            </a>
          ))}
        </div>
      )}

      <Link
        to="/doctor"
        className="mt-5 flex items-center justify-between rounded-3xl glass shadow-card p-4 active:scale-[0.98] transition"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl gradient-primary grid place-items-center text-primary-foreground">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Doctor Mode</p>
            <p className="text-xs text-muted-foreground">30-second medical summary</p>
          </div>
        </div>
        <ChevronRight />
      </Link>
    </PageShell>
  );
}

function ChevronRight() {
  return (
    <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
