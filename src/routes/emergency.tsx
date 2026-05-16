import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useActiveProfile } from "@/lib/storage";
import { Phone, ShieldAlert, Droplet, AlertCircle, Activity } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/emergency")({
  head: () => ({ meta: [{ title: "Emergency Card — MediVault" }] }),
  component: EmergencyPage,
});

function EmergencyPage() {
  const { profile: p } = useActiveProfile();
  return (
    <PageShell title="Emergency" subtitle="Lock-screen card" back="/">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-3xl bg-gradient-to-br from-rose-500 to-red-600 text-white p-6 shadow-glow mb-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-5 w-5" />
          <p className="font-semibold uppercase text-xs tracking-wider">Emergency Info</p>
        </div>
        <p className="text-3xl font-bold">{p.name || "Set name"}</p>
        <p className="text-sm opacity-90">{p.age && `${p.age} yrs`}{p.gender && ` • ${p.gender}`}</p>
        <div className="mt-4 grid gap-2">
          <Row icon={Droplet} label="Blood Group" value={p.bloodGroup} />
          <Row icon={AlertCircle} label="Allergies" value={p.allergies || "None"} />
          <Row icon={Activity} label="Conditions" value={p.chronic || "None"} />
        </div>
      </motion.div>

      {p.emergencyPhone && (
        <a
          href={`tel:${p.emergencyPhone}`}
          className="flex items-center justify-between rounded-3xl bg-card shadow-card p-4 active:scale-[0.98] transition"
        >
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-success text-success-foreground grid place-items-center">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Call emergency contact</p>
              <p className="font-semibold">{p.emergencyName || p.emergencyPhone}</p>
            </div>
          </div>
        </a>
      )}

      {!p.name && (
        <Link to="/profile" className="mt-4 block text-center text-sm text-primary font-medium">
          Set up your profile →
        </Link>
      )}
    </PageShell>
  );
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/15 backdrop-blur px-3 py-2.5">
      <Icon className="h-4 w-4" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] opacity-80 uppercase">{label}</p>
        <p className="font-semibold text-sm truncate">{value || "—"}</p>
      </div>
    </div>
  );
}
