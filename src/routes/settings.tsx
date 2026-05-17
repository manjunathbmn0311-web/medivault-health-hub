import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Upload, FileText, Lock, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createBackup,
  downloadBlob,
  generateMedicalPDF,
  restoreBackup,
  suggestBackupName,
  PatientBundle,
} from "@/lib/backup";
import {
  Medication,
  ProfileRecord,
  Report,
  TimelineEntry,
  useActiveProfile,
} from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Backup & Export — MediVault" }] }),
  component: SettingsPage,
});

type Busy = null | "backup" | "restore" | "pdf";

/** Read a JSON array from localStorage; gracefully fall back to []. */
function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Build a PatientBundle for every saved profile by reading their scoped keys. */
function gatherAllPatients(profiles: ProfileRecord[]): PatientBundle[] {
  return profiles.map((p) => ({
    profile: p,
    timeline: readJSON<TimelineEntry[]>(`mv-timeline::${p.id}`, []),
    meds: readJSON<Medication[]>(`mv-meds::${p.id}`, []),
    reports: readJSON<Report[]>(`mv-reports::${p.id}`, []),
  }));
}

function SettingsPage() {
  const { profiles } = useActiveProfile();

  const [busy, setBusy] = useState<Busy>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [restorePwd, setRestorePwd] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const totalReports = useMemo(
    () => gatherAllPatients(profiles).reduce((n, p) => n + p.reports.length, 0),
    [profiles],
  );

  const onBackup = async () => {
    if (pwd && pwd.length < 4) return toast.error("Use at least 4 characters or leave blank");
    if (pwd !== pwd2) return toast.error("Passwords don't match");
    setBusy("backup");
    setStatus(null);
    try {
      const blob = await createBackup(pwd);
      downloadBlob(blob, suggestBackupName());
      setStatus({
        ok: true,
        text: pwd
          ? "Encrypted backup saved to Downloads. Keep the password safe."
          : "Backup saved to Downloads.",
      });
      setPwd("");
      setPwd2("");
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || "Backup failed" });
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (!restoreFile) return toast.error("Choose your backup file");
    setBusy("restore");
    setStatus(null);
    try {
      const { keysRestored } = await restoreBackup(restoreFile, restorePwd, mode);
      setStatus({ ok: true, text: `Restored ${keysRestored} item groups. Reloading…` });
      setRestoreFile(null);
      setRestorePwd("");
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || "Restore failed" });
    } finally {
      setBusy(null);
    }
  };

  const onPdf = async () => {
    setBusy("pdf");
    setStatus(null);
    try {
      const patients = gatherAllPatients(profiles);
      if (patients.length === 0) throw new Error("No profiles to export");
      const blob = await generateMedicalPDF(patients);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `medivault-all-patients-${stamp}.pdf`);
      setStatus({
        ok: true,
        text: `PDF generated for ${patients.length} patient${patients.length > 1 ? "s" : ""}.`,
      });
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || "PDF failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell title="Backup & Export" subtitle="Your data, on your device">
      {/* Backup */}
      <section className="rounded-3xl bg-card shadow-card p-5 mb-4">
        <Header icon={Download} title="Backup data" desc="One file with every profile and every report." />
        <p className="text-[11px] text-muted-foreground mb-3 inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> Password is optional. Leave blank for a plain backup.
        </p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Password (optional)"
          className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none mb-2"
        />
        <input
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none mb-3"
        />
        <ActionBtn onClick={onBackup} loading={busy === "backup"} icon={Download} label="Create backup file" />
      </section>

      {/* Restore */}
      <section className="rounded-3xl bg-card shadow-card p-5 mb-4">
        <Header icon={Upload} title="Restore backup" desc="Pick the backup file you saved earlier." />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl bg-muted px-3 py-3 text-sm text-left mb-2 truncate"
        >
          {restoreFile ? restoreFile.name : "Tap to choose backup file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="*/*"
          hidden
          onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="password"
          value={restorePwd}
          onChange={(e) => setRestorePwd(e.target.value)}
          placeholder="Password (only if backup was encrypted)"
          className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none mb-3"
        />
        <div className="flex gap-2 mb-3">
          {(["replace", "merge"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-xl py-2 text-xs font-medium ${
                mode === m ? "gradient-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {m === "replace" ? "Replace all" : "Merge with existing"}
            </button>
          ))}
        </div>
        <ActionBtn onClick={onRestore} loading={busy === "restore"} icon={ShieldCheck} label="Restore backup" />
      </section>

      {/* PDF */}
      <section className="rounded-3xl bg-card shadow-card p-5 mb-4">
        <Header
          icon={FileText}
          title="Medical summary PDF"
          desc={`All ${profiles.length} profile${profiles.length > 1 ? "s" : ""} · ${totalReports} report${totalReports === 1 ? "" : "s"} (4 per page).`}
        />
        <ActionBtn onClick={onPdf} loading={busy === "pdf"} icon={FileText} label="Generate PDF (all patients)" />
      </section>

      {status && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-3 text-sm flex items-start gap-2 ${
            status.ok ? "bg-emerald-500/10 text-emerald-700" : "bg-destructive/10 text-destructive"
          }`}
        >
          {status.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{status.text}</span>
        </motion.div>
      )}

      <p className="text-[11px] text-center text-muted-foreground mt-4 px-4">
        Everything stays on your device. No cloud, no login.
      </p>
    </PageShell>
  );
}

function Header({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="h-10 w-10 rounded-2xl gradient-primary text-primary-foreground grid place-items-center shadow-glow shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick,
  loading,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  icon: any;
  label: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      disabled={loading}
      onClick={onClick}
      className="w-full rounded-2xl gradient-primary text-primary-foreground py-3 font-semibold shadow-glow inline-flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </motion.button>
  );
}
