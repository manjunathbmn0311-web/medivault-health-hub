import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { FREQUENCY_COUNTS, Medication, uid, useScopedStorage } from "@/lib/storage";
import { Plus, Pill, X, Power, Check, Bell, BellOff, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FAB, Field } from "./timeline";
import { toast } from "sonner";

export const Route = createFileRoute("/medications")({
  head: () => ({ meta: [{ title: "Medications — MediVault" }] }),
  component: MedsPage,
});

const todayKey = () => new Date().toISOString().slice(0, 10);

function MedsPage() {
  const [meds, setMeds] = useScopedStorage<Medication[]>("mv-meds", []);
  const [open, setOpen] = useState(false);
  const [notifyOn, setNotifyOn] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  const active = meds.filter((m) => m.active);
  const past = meds.filter((m) => !m.active);

  // Notification scheduler: every minute, check each active med's times; if
  // current HH:mm matches and slot not yet taken/notified today, ping.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const notified = new Set<string>(); // "medId|date|time"
    const tick = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const day = todayKey();
      meds.forEach((m) => {
        if (!m.active || !m.times?.length) return;
        m.times.forEach((t) => {
          if (t !== hhmm) return;
          const tag = `${m.id}|${day}|${t}`;
          if (notified.has(tag)) return;
          const taken = m.takenLog?.[day]?.includes(t);
          if (taken) return;
          notified.add(tag);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification("Time for your medication", {
                body: `${m.name} ${m.dosage || ""} • ${t}`.trim(),
                tag,
              });
            } catch {}
          }
          toast(`Time to take ${m.name} (${t})`);
        });
      });
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [meds]);

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Notifications aren't supported on this device");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifyOn(perm === "granted");
    if (perm === "granted") toast.success("Notifications enabled");
    else toast.error("Notifications blocked");
  };

  const toggleTaken = (m: Medication, time: string) => {
    const day = todayKey();
    const log = { ...(m.takenLog || {}) };
    const slots = new Set(log[day] || []);
    if (slots.has(time)) slots.delete(time);
    else slots.add(time);
    log[day] = Array.from(slots);
    setMeds(meds.map((x) => (x.id === m.id ? { ...x, takenLog: log } : x)));
  };

  return (
    <PageShell title="Medications" subtitle={`${active.length} active`}>
      {!notifyOn && (
        <button
          onClick={enableNotifications}
          className="mb-4 w-full rounded-2xl bg-card shadow-soft p-3 flex items-center gap-3 text-left"
        >
          <div className="h-10 w-10 rounded-xl gradient-primary text-primary-foreground grid place-items-center">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Enable reminders</p>
            <p className="text-[11px] text-muted-foreground">Get a ping when it's time to take a tablet</p>
          </div>
        </button>
      )}
      {notifyOn && (
        <div className="mb-4 rounded-2xl bg-emerald-500/10 text-emerald-700 p-2.5 flex items-center gap-2 text-xs">
          <Bell className="h-3.5 w-3.5" /> Reminders on for this device
        </div>
      )}

      <Section title="Active" empty="No active medications">
        {active.map((m, i) => (
          <PillCard
            key={m.id}
            m={m}
            i={i}
            onToggle={() =>
              setMeds(
                meds.map((x) =>
                  x.id === m.id
                    ? { ...x, active: false, endDate: todayKey() }
                    : x,
                ),
              )
            }
            onDelete={() => setMeds(meds.filter((x) => x.id !== m.id))}
            onTakenToggle={(t) => toggleTaken(m, t)}
          />
        ))}
      </Section>

      {past.length > 0 && (
        <Section title="Past">
          {past.map((m, i) => (
            <PillCard
              key={m.id}
              m={m}
              i={i}
              onToggle={() =>
                setMeds(
                  meds.map((x) =>
                    x.id === m.id ? { ...x, active: true, endDate: undefined } : x,
                  ),
                )
              }
              onDelete={() => setMeds(meds.filter((x) => x.id !== m.id))}
              onTakenToggle={() => {}}
            />
          ))}
        </Section>
      )}

      <FAB onClick={() => setOpen(true)} />

      <AnimatePresence>
        {open && (
          <AddSheet
            onClose={() => setOpen(false)}
            onSave={(m) => {
              setMeds([{ ...m, id: uid(), active: true, takenLog: {} }, ...meds]);
              setOpen(false);
              if (typeof Notification !== "undefined" && Notification.permission === "default") {
                Notification.requestPermission().then((p) => setNotifyOn(p === "granted"));
              }
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

function PillCard({
  m,
  i,
  onToggle,
  onDelete,
  onTakenToggle,
}: {
  m: Medication;
  i: number;
  onToggle: () => void;
  onDelete: () => void;
  onTakenToggle: (time: string) => void;
}) {
  const day = todayKey();
  const takenToday = useMemo(() => new Set(m.takenLog?.[day] || []), [m.takenLog, day]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: i * 0.04 }}
      className="rounded-3xl bg-card shadow-soft p-4"
    >
      <div className="flex gap-3 items-center">
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
          >
            <Power className="h-3 w-3" /> {m.active ? "Stop" : "Resume"}
          </button>
          <button onClick={onDelete} className="h-8 px-2.5 rounded-xl bg-muted grid place-items-center text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {m.active && m.times && m.times.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
          {m.times.map((t) => {
            const taken = takenToday.has(t);
            return (
              <button
                key={t}
                onClick={() => onTakenToggle(t)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition ${
                  taken
                    ? "bg-emerald-500 text-white shadow-glow"
                    : "bg-muted text-foreground"
                }`}
              >
                {taken ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {t}
                {taken && <span className="opacity-90">· taken</span>}
              </button>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

const DEFAULT_TIMES: Record<number, string[]> = {
  1: ["09:00"],
  2: ["09:00", "21:00"],
  3: ["08:00", "14:00", "20:00"],
  4: ["08:00", "12:00", "16:00", "20:00"],
};

function AddSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (m: Omit<Medication, "id" | "active" | "takenLog">) => void;
}) {
  const freqs = Object.keys(FREQUENCY_COUNTS);
  const [form, setForm] = useState({
    name: "",
    dosage: "",
    frequency: "Once daily",
    startDate: todayKey(),
    endDate: "",
    times: DEFAULT_TIMES[1],
  });

  const count = FREQUENCY_COUNTS[form.frequency] ?? 0;

  const setFrequency = (f: string) => {
    const c = FREQUENCY_COUNTS[f] ?? 0;
    setForm({
      ...form,
      frequency: f,
      times: c > 0 ? DEFAULT_TIMES[c] || Array(c).fill("09:00") : [],
    });
  };

  const updateTime = (idx: number, val: string) => {
    const next = [...form.times];
    next[idx] = val;
    setForm({ ...form, times: next });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto"
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
              <button key={f} onClick={() => setFrequency(f)} className={`px-3 py-1.5 rounded-full text-xs ${form.frequency === f ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>{f}</button>
            ))}
          </div>
        </Field>

        {count > 0 && (
          <Field label={`Time${count > 1 ? "s" : ""} to take (${count})`}>
            <div className="grid grid-cols-2 gap-2">
              {form.times.map((t, idx) => (
                <div key={idx} className="rounded-xl bg-muted px-2.5 py-1.5 flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold w-10">
                    Dose {idx + 1}
                  </span>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => updateTime(idx, e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
              ))}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="End (optional)"><input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
        </div>
        <button
          disabled={!form.name}
          onClick={() => onSave({
            name: form.name,
            dosage: form.dosage,
            frequency: form.frequency,
            startDate: form.startDate,
            endDate: form.endDate || undefined,
            times: form.times,
          })}
          className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow disabled:opacity-50"
        >
          Add medication
        </button>
      </motion.div>
    </motion.div>
  );
}
