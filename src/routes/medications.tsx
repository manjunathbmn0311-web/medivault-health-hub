import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { Medication, uid, useLocalStorage } from "@/lib/storage";
import { Plus, Pill, X, Power } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { FAB, Field } from "./timeline";

export const Route = createFileRoute("/medications")({
  head: () => ({ meta: [{ title: "Medications — MediVault" }] }),
  component: MedsPage,
});

function MedsPage() {
  const [meds, setMeds] = useScopedStorage<Medication[]>("mv-meds", []);
  const [open, setOpen] = useState(false);

  const active = meds.filter((m) => m.active);
  const past = meds.filter((m) => !m.active);

  return (
    <PageShell title="Medications" subtitle={`${active.length} active`}>
      <Section title="Active" empty="No active medications">
        {active.map((m, i) => (
          <PillCard key={m.id} m={m} i={i} onToggle={() => setMeds(meds.map((x) => (x.id === m.id ? { ...x, active: false, endDate: new Date().toISOString().slice(0, 10) } : x)))} onDelete={() => setMeds(meds.filter((x) => x.id !== m.id))} />
        ))}
      </Section>

      {past.length > 0 && (
        <Section title="Past">
          {past.map((m, i) => (
            <PillCard key={m.id} m={m} i={i} onToggle={() => setMeds(meds.map((x) => (x.id === m.id ? { ...x, active: true, endDate: undefined } : x)))} onDelete={() => setMeds(meds.filter((x) => x.id !== m.id))} />
          ))}
        </Section>
      )}

      <FAB onClick={() => setOpen(true)} />

      <AnimatePresence>
        {open && (
          <AddSheet
            onClose={() => setOpen(false)}
            onSave={(m) => {
              setMeds([{ ...m, id: uid(), active: true }, ...meds]);
              setOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}

function Section({ title, empty, children }: any) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold mb-2 px-1">{title}</h2>
      {arr.length === 0 && empty ? (
        <div className="rounded-2xl bg-card shadow-soft p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="grid gap-3">{children}</div>
      )}
    </section>
  );
}

function PillCard({ m, i, onToggle, onDelete }: { m: Medication; i: number; onToggle: () => void; onDelete: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: i * 0.04 }}
      className="rounded-3xl bg-card shadow-soft p-4 flex gap-3 items-center"
    >
      <div className={`h-12 w-12 rounded-2xl grid place-items-center ${m.active ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        <Pill className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{m.name}</p>
        <p className="text-xs text-muted-foreground">{m.dosage} • {m.frequency}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          From {format(new Date(m.startDate), "dd MMM yyyy")}
          {m.endDate && ` → ${format(new Date(m.endDate), "dd MMM yyyy")}`}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={onToggle}
          className={`h-8 px-2.5 rounded-xl text-[10px] font-semibold flex items-center gap-1 ${m.active ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}
          aria-label={m.active ? "Stop" : "Resume"}
        >
          <Power className="h-3 w-3" /> {m.active ? "Stop" : "Resume"}
        </button>
        <button onClick={onDelete} className="h-8 px-2.5 rounded-xl bg-muted grid place-items-center text-destructive">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function AddSheet({ onClose, onSave }: { onClose: () => void; onSave: (m: Omit<Medication, "id" | "active">) => void }) {
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    frequency: "Once daily",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  });
  const freqs = ["Once daily", "Twice daily", "Thrice daily", "Weekly", "As needed"];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">New medication</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
        </div>
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" placeholder="e.g. Metformin" />
        </Field>
        <Field label="Dosage">
          <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" placeholder="e.g. 500mg" />
        </Field>
        <Field label="Frequency">
          <div className="flex flex-wrap gap-2">
            {freqs.map((f) => (
              <button key={f} onClick={() => setForm({ ...form, frequency: f })} className={`px-3 py-1.5 rounded-full text-xs ${form.frequency === f ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>{f}</button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="End (optional)"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
        </div>
        <button disabled={!form.name} onClick={() => onSave({ ...form, endDate: form.endDate || undefined })} className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow disabled:opacity-50">
          Add medication
        </button>
      </motion.div>
    </motion.div>
  );
}
