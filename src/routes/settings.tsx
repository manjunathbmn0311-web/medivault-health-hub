import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Upload, FileText, Lock, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createBackup,
  downloadBlob,
  generateMedicalPDF,
  restoreBackup,
  suggestBackupName,
} from "@/lib/backup";
import {
  Medication,
  Report,
  TimelineEntry,
  useActiveProfile,
  useScopedStorage,
} from "@/lib/storage";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Backup & Export — MediVault" }] }),
  component: SettingsPage,
});

type Busy = null | "backup" | "restore" | "pdf";

function SettingsPage() {
  const { profile } = useActiveProfile();
  const [timeline] = useScopedStorage<TimelineEntry[]>("mv-timeline", []);
  const [meds] = useScopedStorage<Medication[]>("mv-meds", []);
  const [reports] = useScopedStorage<Report[]>("mv-reports", []);

  const [busy, setBusy] = useState<Busy>(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [restorePwd, setRestorePwd] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("replace");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const onBackup = async () => {
    if (pwd.length < 6) return toast.error("Use at least 6 characters");
    if (pwd !== pwd2) return toast.error("Passwords don't match");
    setBusy("backup");
    setStatus(null);
    try {
      const blob = await createBackup(pwd);
      downloadBlob(blob, suggestBackupName());
      setStatus({ ok: true, text: "Backup saved to your downloads. Move it somewhere safe." });
      setPwd("");
      setPwd2("");
    } catch (e: any) {
      setStatus({ ok: false, text: e.message || "Backup failed" });
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    if (!restoreFile) return toast.error("Choose a .medbackup file");
    if (!restorePwd) return toast.error("Enter the backup password");
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
      const blob = await generateMedicalPDF({ profile, timeline, meds, reports });
      const name = `medical-summary-${(profile.name || "patient").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      downloadBlob(blob, name);
      setStatus({ ok: true, text: "PDF summary generated." });
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
        <Header icon={Download} title="Backup data" desc="Encrypted .medbackup file with everything." />
        <p className="text-[11px] text-muted-foreground mb-3 inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> AES-256-GCM, PBKDF2 password key.
        </p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Create backup password"
          className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none mb-2"
        />
        <input
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="Confirm password"
          className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none mb-3"
        />
        <ActionBtn onClick={onBackup} loading={busy === "backup"} icon={Download} label="Create encrypted backup" />
      </section>

      {/* Restore */}
      <section className="rounded-3xl bg-card shadow-card p-5 mb-4">
        <Header icon={Upload} title="Restore backup" desc="Choose a .medbackup file from this device." />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-xl bg-muted px-3 py-3 text-sm text-left mb-2 truncate"
        >
          {restoreFile ? restoreFile.name : "Tap to choose .medbackup file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".medbackup,application/octet-stream,application/json"
          hidden
          onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
        />
        <input
          type="password"
          value={restorePwd}
          onChange={(e) => setRestorePwd(e.target.value)}
          placeholder="Backup password"
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
        <ActionBtn onClick={onRestore} loading={busy === "restore"} icon={ShieldCheck} label="Decrypt & restore" />
      </section>

      {/* PDF */}
      <section className="rounded-3xl bg-card shadow-card p-5 mb-4">
        <Header icon={FileText} title="Medical summary PDF" desc="Doctor-friendly, printable. Active profile only." />
        <ActionBtn onClick={onPdf} loading={busy === "pdf"} icon={FileText} label="Generate PDF" />
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
        Everything stays on your device. No cloud, no login. Keep your backup password safe — without it the file cannot be opened.
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
