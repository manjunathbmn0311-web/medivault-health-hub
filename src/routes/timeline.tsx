import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { TimelineEntry, uid, useLocalStorage } from "@/lib/storage";
import { Plus, Stethoscope, Pill, Scissors, FileText, Activity, X, Building2, Calendar, Phone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";

export const Route = createFileRoute("/timeline")({
  head: () => ({ meta: [{ title: "Medical Timeline — MediVault" }] }),
  component: TimelinePage,
});

const TYPE_META: Record<TimelineEntry["type"], { label: string; icon: any; color: string }> = {
  symptom: { label: "Symptom", icon: Activity, color: "from-amber-400 to-orange-500" },
  diagnosis: { label: "Diagnosis", icon: Stethoscope, color: "from-sky-400 to-cyan-500" },
  medication: { label: "Medication", icon: Pill, color: "from-emerald-400 to-teal-500" },
  surgery: { label: "Surgery", icon: Scissors, color: "from-rose-400 to-pink-500" },
  note: { label: "Note", icon: FileText, color: "from-violet-400 to-fuchsia-500" },
};

function TimelinePage() {
  const [entries, setEntries] = useLocalStorage<TimelineEntry[]>("mv-timeline", []);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<TimelineEntry | null>(null);

  const sorted = useMemo(
    () =>
      [...entries]
        .filter((e) => (filter === "all" ? true : e.type === filter))
        .filter((e) =>
          q
            ? (e.title + " " + (e.hospital ?? "") + " " + (e.doctor ?? "") + " " + (e.details ?? ""))
                .toLowerCase()
                .includes(q.toLowerCase())
            : true
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [entries, filter, q]
  );

  return (
    <PageShell title="Timeline" subtitle="Your medical history">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search entries…"
        className="w-full rounded-2xl bg-card shadow-soft px-4 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
      />
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
        {["all", ...Object.keys(TYPE_META)].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === k ? "gradient-primary text-primary-foreground shadow-soft" : "bg-card text-muted-foreground"
            }`}
          >
            {k === "all" ? "All" : TYPE_META[k as TimelineEntry["type"]].label}
          </button>
        ))}
      </div>

      <div className="mt-5 relative">
        {sorted.length > 0 && (
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
        )}
        <AnimatePresence>
          {sorted.map((e, i) => {
            const meta = TYPE_META[e.type];
            const Icon = meta.icon;
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.04 }}
                className="relative pl-12 pb-4"
              >
                <div className={`absolute left-0 top-1 h-10 w-10 rounded-2xl bg-gradient-to-br ${meta.color} grid place-items-center text-white shadow-soft`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="rounded-2xl bg-card shadow-soft p-4 active:scale-[0.99] transition">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {format(new Date(e.date), "dd MMM yyyy")}
                    </p>
                  </div>
                  <p className="font-semibold mt-1">{e.title}</p>
                  {(e.hospital || e.doctor) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Building2 className="h-3 w-3" /> {[e.hospital, e.doctor].filter(Boolean).join(" • ")}
                    </p>
                  )}
                  {e.details && <p className="text-sm text-foreground/80 mt-2">{e.details}</p>}
                  <button
                    onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}
                    className="mt-2 text-[11px] text-destructive font-medium"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sorted.length === 0 && (
          <div className="rounded-2xl bg-card shadow-soft p-8 text-center text-sm text-muted-foreground">
            No entries yet. Tap + to add your first.
          </div>
        )}
      </div>

      <FAB onClick={() => setOpen(true)} />

      <AnimatePresence>
        {open && (
          <EntrySheet
            onClose={() => setOpen(false)}
            onSave={(entry) => {
              setEntries([{ ...entry, id: uid() }, ...entries]);
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}

export function FAB({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-2xl gradient-primary shadow-glow grid place-items-center text-primary-foreground"
    >
      <Plus className="h-6 w-6" />
    </motion.button>
  );
}

function EntrySheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (e: Omit<TimelineEntry, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<TimelineEntry, "id">>({
    date: new Date().toISOString().slice(0, 10),
    type: "diagnosis",
    title: "",
    hospital: "",
    doctor: "",
    details: "",
  });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="w-full max-w-md bg-background rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">New entry</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-3">
          {Object.entries(TYPE_META).map(([k, v]) => {
            const I = v.icon;
            const active = form.type === k;
            return (
              <button
                key={k}
                onClick={() => setForm({ ...form, type: k as TimelineEntry["type"] })}
                className={`rounded-2xl p-2 text-[10px] flex flex-col items-center gap-1 transition ${
                  active ? "gradient-primary text-primary-foreground shadow-soft" : "bg-muted text-muted-foreground"
                }`}
              >
                <I className="h-4 w-4" />
                {v.label}
              </button>
            );
          })}
        </div>
        <Field label="Title">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30"
            placeholder="e.g. Hypertension"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Hospital">
            <input
              value={form.hospital}
              onChange={(e) => setForm({ ...form, hospital: e.target.value })}
              className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none"
            />
          </Field>
          <Field label="Doctor">
            <input
              value={form.doctor}
              onChange={(e) => setForm({ ...form, doctor: e.target.value })}
              className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none"
            />
          </Field>
        </div>
        <Field label="Details">
          <textarea
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })}
            rows={3}
            className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none resize-none"
          />
        </Field>
        <button
          disabled={!form.title}
          onClick={() => onSave(form)}
          className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow disabled:opacity-50"
        >
          Save entry
        </button>
      </motion.div>
    </motion.div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-xs text-muted-foreground font-medium ml-1">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
