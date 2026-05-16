import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/PageShell";
import { Report, uid, useLocalStorage } from "@/lib/storage";
import { Upload, FileText, Image as ImageIcon, X, Camera, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — MediVault" }] }),
  component: ReportsPage,
});

const CATEGORIES = ["Lab", "X-Ray", "Scan", "Prescription", "Other"];

function ReportsPage() {
  const [reports, setReports] = useScopedStorage<Report[]>("mv-reports", []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [drag, setDrag] = useState(false);
  const [pending, setPending] = useState<{ name: string; mimeType: string; dataUrl: string } | null>(null);
  const [pendingCat, setPendingCat] = useState("Lab");

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const f = files[0];
    if (f.size > 8 * 1024 * 1024) {
      toast.error("File too large (max 8 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPending({ name: f.name, mimeType: f.type || "application/octet-stream", dataUrl: reader.result as string });
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsDataURL(f);
  };

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => (cat === "all" ? true : r.category === cat))
        .filter((r) => (q ? r.name.toLowerCase().includes(q.toLowerCase()) : true))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [reports, cat, q]
  );

  return (
    <PageShell title="Reports" subtitle={`${reports.length} files`}>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reports…"
          className="w-full rounded-2xl bg-card shadow-soft pl-10 pr-3 py-3 text-sm outline-none focus:ring-2 ring-primary/30"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5 mb-4">
        {["all", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              cat === c ? "gradient-primary text-primary-foreground shadow-soft" : "bg-card text-muted-foreground"
            }`}
          >
            {c === "all" ? "All" : c}
          </button>
        ))}
      </div>

      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        animate={{ scale: drag ? 1.02 : 1 }}
        className={`rounded-3xl border-2 border-dashed p-5 text-center mb-4 transition ${
          drag ? "border-primary bg-primary/5" : "border-border bg-card/50"
        }`}
      >
        <div className="h-12 w-12 mx-auto rounded-2xl gradient-primary grid place-items-center text-primary-foreground shadow-glow">
          <Upload className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-semibold">Upload a report</p>
        <p className="text-xs text-muted-foreground">Image, PDF, X-ray, prescription</p>
        <div className="mt-3 flex gap-2 justify-center">
          <label className="cursor-pointer rounded-xl bg-primary text-primary-foreground text-xs font-medium px-3 py-2 flex items-center gap-1 active:scale-95 transition">
            <ImageIcon className="h-3.5 w-3.5" /> Choose file
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
          <label className="cursor-pointer rounded-xl bg-card shadow-soft text-xs font-medium px-3 py-2 flex items-center gap-1 active:scale-95 transition">
            <Camera className="h-3.5 w-3.5" /> Camera
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
          </label>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <AnimatePresence>
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl bg-card shadow-soft overflow-hidden group"
            >
              <div className="h-32 bg-muted grid place-items-center relative">
                {r.mimeType.startsWith("image/") ? (
                  <img src={r.dataUrl} alt={r.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
                    <p className="text-[10px] mt-1 text-muted-foreground">PDF</p>
                  </div>
                )}
                <button
                  onClick={() => setReports(reports.filter((x) => x.id !== r.id))}
                  className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur grid place-items-center"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold truncate">{r.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{r.category}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(r.date), "dd MMM")}</span>
                </div>
                <a
                  href={r.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block text-center text-[11px] font-medium text-primary"
                >
                  Open
                </a>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl bg-card shadow-soft p-8 text-center text-sm text-muted-foreground">
          No reports match.
        </div>
      )}

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-end"
            onClick={() => setPending(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="w-full max-w-md mx-auto bg-background rounded-t-3xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-lg mb-2">Categorize report</h3>
              <p className="text-xs text-muted-foreground mb-3 truncate">{pending.name}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPendingCat(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      pendingCat === c ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setReports([
                    {
                      id: uid(),
                      name: pending.name,
                      mimeType: pending.mimeType,
                      dataUrl: pending.dataUrl,
                      category: pendingCat,
                      date: new Date().toISOString().slice(0, 10),
                    },
                    ...reports,
                  ]);
                  setPending(null);
                  toast.success("Report saved");
                }}
                className="w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow"
              >
                Save report
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
