import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Period, uid, useLocalStorage } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { Plus, X, Droplet } from "lucide-react";
import { addDays, addMonths, differenceInDays, endOfMonth, format, isSameDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { Field } from "./timeline";

export const Route = createFileRoute("/menstrual")({
  head: () => ({ meta: [{ title: "Cycle — MediVault" }] }),
  component: MenstrualPage,
});

function MenstrualPage() {
  const [periods, setPeriods] = useLocalStorage<Period[]>("mv-periods", []);
  const [month, setMonth] = useState(new Date());
  const [open, setOpen] = useState(false);

  const sorted = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const last = sorted[0];
  const avgCycle = useMemo(() => {
    if (sorted.length < 2) return 28;
    const diffs = sorted.slice(0, 5).map((p, i, arr) => i < arr.length - 1 ? differenceInDays(new Date(p.startDate), new Date(arr[i + 1].startDate)) : 0).filter(Boolean);
    return diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 28;
  }, [sorted]);
  const avgFlow = useMemo(() => {
    const ds = sorted.filter((p) => p.endDate).map((p) => differenceInDays(new Date(p.endDate!), new Date(p.startDate)) + 1).filter((n) => n > 0);
    return ds.length ? Math.round(ds.reduce((a, b) => a + b, 0) / ds.length) : 0;
  }, [sorted]);
  const avgPads = useMemo(() => {
    const ps = sorted.map((p) => p.padsPerDay).filter((n): n is number => typeof n === "number" && n > 0);
    return ps.length ? Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 10) / 10 : 0;
  }, [sorted]);
  const nextPredicted = last ? addDays(new Date(last.startDate), avgCycle) : null;

  const isPeriodDay = (d: Date) => periods.some((p) => {
    const s = new Date(p.startDate);
    const e = p.endDate ? new Date(p.endDate) : addDays(s, 4);
    return d >= s && d <= e;
  });

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfMonth(month);
    const arr: Date[] = [];
    let cur = start;
    while (cur <= end || arr.length % 7 !== 0) {
      arr.push(cur);
      cur = addDays(cur, 1);
    }
    return arr;
  }, [month]);

  return (
    <PageShell title="Cycle" subtitle="Menstrual tracking" back="/">
      <div className="rounded-3xl gradient-primary text-primary-foreground p-5 shadow-glow mb-4">
        <p className="text-xs opacity-80">Average cycle</p>
        <p className="text-3xl font-bold">{avgCycle} <span className="text-base font-medium opacity-80">days</span></p>
        {last && (
          <p className="text-sm opacity-90 mt-1">Last period: {format(new Date(last.startDate), "dd MMM")}</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
            <p className="text-[10px] opacity-80">Avg flow</p>
            <p className="font-semibold text-sm">{avgFlow ? `${avgFlow} days` : "—"}</p>
          </div>
          <div className="rounded-2xl bg-white/15 backdrop-blur px-3 py-2">
            <p className="text-[10px] opacity-80">Avg pads/day</p>
            <p className="font-semibold text-sm">{avgPads || "—"}</p>
          </div>
        </div>
        {nextPredicted && (
          <div className="mt-3 rounded-2xl bg-white/15 backdrop-blur px-3 py-2 text-sm">
            Next predicted: <strong>{format(nextPredicted, "dd MMM yyyy")}</strong>
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-card shadow-soft p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setMonth(subMonths(month, 1))} className="h-8 w-8 rounded-full bg-muted">‹</button>
          <p className="font-semibold">{format(month, "MMMM yyyy")}</p>
          <button onClick={() => setMonth(addMonths(month, 1))} className="h-8 w-8 rounded-full bg-muted">›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const period = isPeriodDay(d);
            const today = isSameDay(d, new Date());
            const inMonth = d.getMonth() === month.getMonth();
            const predicted = nextPredicted && isSameDay(d, nextPredicted);
            return (
              <motion.div
                key={d.toISOString()}
                whileTap={{ scale: 0.9 }}
                className={`aspect-square grid place-items-center text-xs rounded-xl ${
                  period ? "gradient-primary text-primary-foreground font-semibold" :
                  predicted ? "border-2 border-dashed border-primary text-primary" :
                  today ? "bg-accent text-accent-foreground font-semibold" :
                  inMonth ? "text-foreground" : "text-muted-foreground/40"
                }`}
              >
                {d.getDate()}
              </motion.div>
            );
          })}
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-2 px-1">History</h2>
      <div className="grid gap-2">
        <AnimatePresence>
          {sorted.map((p, i) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }} className="rounded-2xl bg-card shadow-soft p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl gradient-primary grid place-items-center text-primary-foreground"><Droplet className="h-4 w-4" /></div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{format(new Date(p.startDate), "dd MMM yyyy")}</p>
                {p.symptoms && <p className="text-xs text-muted-foreground">{p.symptoms}</p>}
              </div>
              <button onClick={() => setPeriods(periods.filter((x) => x.id !== p.id))} className="h-8 w-8 rounded-xl bg-muted grid place-items-center text-destructive"><X className="h-3.5 w-3.5" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
        {sorted.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No entries yet</p>}
      </div>

      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen(true)} className="fixed bottom-24 right-5 z-30 h-14 w-14 rounded-2xl gradient-primary shadow-glow grid place-items-center text-primary-foreground">
        <Plus className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && <AddPeriod onClose={() => setOpen(false)} onSave={(p) => { setPeriods([{ ...p, id: uid() }, ...periods]); setOpen(false); }} />}
      </AnimatePresence>
    </PageShell>
  );
}

function AddPeriod({ onClose, onSave }: { onClose: () => void; onSave: (p: Omit<Period, "id">) => void }) {
  const [form, setForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    symptoms: "",
    notes: "",
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end" onClick={onClose}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 280 }} className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Log period</h3>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted grid place-items-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="End"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
        </div>
        <Field label="Symptoms"><input value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" placeholder="cramps, fatigue…" /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none resize-none" /></Field>
        <button onClick={() => onSave({ ...form, endDate: form.endDate || undefined })} className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow">Save</button>
      </motion.div>
    </motion.div>
  );
}
