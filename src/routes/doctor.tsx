import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Medication, Period, Report, TimelineEntry, uid, useActiveProfile, useLocalStorage } from "@/lib/storage";
import { QRCodeSVG } from "qrcode.react";
import { Activity, AlertCircle, Droplet, FileText, Pill, Plus, Scissors, Stethoscope, Trash2, CalendarHeart } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/doctor")({
  head: () => ({ meta: [{ title: "Doctor Mode — MediVault" }] }),
  component: DoctorPage,
});

function DoctorPage() {
  const { profile } = useActiveProfile();
  const [timeline, setTimeline] = useScopedStorage<TimelineEntry[]>("mv-timeline", []);
  const [reports] = useScopedStorage<Report[]>("mv-reports", []);
  const [meds] = useScopedStorage<Medication[]>("mv-meds", []);
  const [periods] = useScopedStorage<Period[]>("mv-periods", []);

  const menstrual = useMemo(() => {
    const sorted = [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (sorted.length === 0) return null;
    const cycles = sorted.slice(0, 6).map((p, i, a) => i < a.length - 1 ? differenceInDays(new Date(p.startDate), new Date(a[i + 1].startDate)) : 0).filter(Boolean);
    const avgCycle = cycles.length ? Math.round(cycles.reduce((x, y) => x + y, 0) / cycles.length) : null;
    const flows = sorted.filter((p) => p.endDate).map((p) => differenceInDays(new Date(p.endDate!), new Date(p.startDate)) + 1).filter((n) => n > 0);
    const avgFlow = flows.length ? Math.round(flows.reduce((x, y) => x + y, 0) / flows.length) : null;
    const pads = sorted.map((p) => p.padsPerDay).filter((n): n is number => typeof n === "number" && n > 0);
    const avgPads = pads.length ? Math.round((pads.reduce((x, y) => x + y, 0) / pads.length) * 10) / 10 : null;
    return { avgCycle, avgFlow, avgPads, last: sorted[0] };
  }, [periods]);

  const surgeries = timeline.filter((t) => t.type === "surgery").sort((a, b) => b.date.localeCompare(a.date));
  const diagnoses = timeline.filter((t) => t.type === "diagnosis").slice(0, 3);
  const recentReports = [...reports].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const summary = JSON.stringify({
    name: profile.name, blood: profile.bloodGroup, allergies: profile.allergies,
    chronic: profile.chronic, meds: meds.filter((m) => m.active).map((m) => `${m.name} ${m.dosage}`),
    diagnoses: diagnoses.map((d) => d.title),
  });

  return (
    <PageShell title="Doctor Mode" subtitle="30-second medical summary" back="/">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl gradient-primary text-primary-foreground p-5 shadow-glow mb-4"
      >
        <p className="text-xs opacity-80">Patient</p>
        <p className="text-2xl font-bold">{profile.name || "Unknown"}</p>
        <p className="text-sm opacity-90">{profile.age && `${profile.age} yrs`}{profile.gender && ` • ${profile.gender}`}</p>
        <div className="mt-4 flex gap-2">
          <Pill2 icon={Droplet} label="Blood" value={profile.bloodGroup} />
          <Pill2 icon={AlertCircle} label="Allergies" value={profile.allergies || "None"} />
        </div>
      </motion.div>

      <Block title="Chronic & Conditions" icon={Activity}>
        <p className="text-sm">{profile.chronic || "None reported"}</p>
        {diagnoses.length > 0 && (
          <ul className="mt-2 space-y-1">
            {diagnoses.map((d) => <li key={d.id} className="text-sm flex justify-between"><span>• {d.title}</span><span className="text-xs text-muted-foreground">{format(new Date(d.date), "MMM yy")}</span></li>)}
          </ul>
        )}
      </Block>

      <Block title="Current medications" icon={Pill}>
        {meds.filter((m) => m.active).length === 0 ? <p className="text-sm text-muted-foreground">None</p> :
          <ul className="space-y-1.5">
            {meds.filter((m) => m.active).map((m) => (
              <li key={m.id} className="text-sm flex justify-between"><span className="font-medium">{m.name}</span><span className="text-xs text-muted-foreground">{m.dosage} • {m.frequency}</span></li>
            ))}
          </ul>
        }
      </Block>

      <Block title="Past surgical history" icon={Scissors}>
        <SurgeryEditor
          surgeries={surgeries}
          onAdd={(title, date) =>
            setTimeline([
              { id: uid(), type: "surgery", title, date },
              ...timeline,
            ])
          }
          onRemove={(id) => setTimeline(timeline.filter((t) => t.id !== id))}
        />
      </Block>

      {menstrual && (
        <Block title="Menstrual history" icon={CalendarHeart}>
          <div className="grid grid-cols-3 gap-2">
            <Stat3 label="Avg cycle" value={menstrual.avgCycle ? `${menstrual.avgCycle}d` : "—"} />
            <Stat3 label="Avg flow" value={menstrual.avgFlow ? `${menstrual.avgFlow}d` : "—"} />
            <Stat3 label="Avg pads/day" value={menstrual.avgPads ? String(menstrual.avgPads) : "—"} />
          </div>
          {menstrual.last && (
            <p className="text-xs text-muted-foreground mt-2">Last period: {format(new Date(menstrual.last.startDate), "dd MMM yyyy")}</p>
          )}
        </Block>
      )}

      <Block title="Recent reports" icon={FileText}>
        {recentReports.length === 0 ? <p className="text-sm text-muted-foreground">None</p> :
          <div className="grid grid-cols-4 gap-2">
            {recentReports.map((r) => (
              <a key={r.id} href={r.dataUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-muted aspect-square overflow-hidden grid place-items-center">
                {r.mimeType.startsWith("image/") ? <img src={r.dataUrl} className="h-full w-full object-cover" alt={r.name} /> : <FileText className="h-6 w-6 text-muted-foreground" />}
              </a>
            ))}
          </div>
        }
      </Block>

      <Block title="Health QR" icon={Stethoscope}>
        <div className="grid place-items-center p-4">
          <div className="bg-white p-3 rounded-2xl">
            <QRCodeSVG value={summary} size={140} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">Scan to view summary</p>
        </div>
      </Block>
    </PageShell>
  );
}

function Pill2({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-2xl bg-white/15 backdrop-blur p-3 flex-1 min-w-0">
      <Icon className="h-4 w-4 opacity-90" />
      <p className="text-[10px] opacity-80 mt-1">{label}</p>
      <p className="font-semibold text-sm truncate">{value || "—"}</p>
    </div>
  );
}

function Block({ title, icon: Icon, children }: any) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl bg-card shadow-soft p-4 mb-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
      </h3>
      {children}
    </motion.section>
  );
}

function Stat3({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-0.5">{value}</p>
    </div>
  );
}

function SurgeryEditor({
  surgeries,
  onAdd,
  onRemove,
}: {
  surgeries: TimelineEntry[];
  onAdd: (title: string, date: string) => void;
  onRemove: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const submit = () => {
    if (!title.trim()) return;
    onAdd(title.trim(), date);
    setTitle("");
  };
  return (
    <div>
      {surgeries.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-2">No surgeries recorded.</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          <AnimatePresence>
            {surgeries.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(s.date), "dd MMM yyyy")}</p>
                </div>
                <button
                  onClick={() => onRemove(s.id)}
                  aria-label="Remove"
                  className="h-8 w-8 shrink-0 rounded-lg bg-background grid place-items-center text-muted-foreground active:scale-90 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder="Surgery name"
          className="flex-1 min-w-0 rounded-xl bg-muted px-3 py-2 text-sm outline-none"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl bg-muted px-2 py-2 text-xs outline-none"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add surgery"
          className="h-10 w-10 shrink-0 rounded-xl gradient-primary text-primary-foreground grid place-items-center shadow-soft active:scale-90 transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
