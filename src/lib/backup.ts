/**
 * Offline backup, restore, and PDF export.
 *
 * Backup format (.medbackup):
 *   JSON { v:1, salt, iv, alg:"AES-GCM", iterations, payload (base64 ciphertext) }
 * Plaintext payload = JSON { exportedAt, app:"MediVault", data: { [localStorageKey]: string } }
 *
 * Only keys with the "mv-" prefix are exported, so we capture all per-profile
 * scoped data plus profile registry and app settings without touching unrelated
 * storage. Image/PDF reports are already serialized as data URLs in storage,
 * so they round-trip naturally.
 */
import jsPDF from "jspdf";
import {
  Profile,
  ProfileRecord,
  TimelineEntry,
  Report,
  Medication,
} from "./storage";

const PREFIX = "mv-";
const MAGIC = "MEDVAULT-BACKUP-V1";

// ----- helpers -----
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const fromB64 = (b64: string) => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function collectAppData(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(PREFIX)) {
      const v = localStorage.getItem(k);
      if (v != null) out[k] = v;
    }
  }
  return out;
}

// ----- BACKUP -----
export async function createBackup(password: string): Promise<Blob> {
  if (!password || password.length < 4) throw new Error("Password too short");
  const data = collectAppData();
  const payload = JSON.stringify({
    magic: MAGIC,
    exportedAt: new Date().toISOString(),
    app: "MediVault",
    data,
  });

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 150_000;
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(payload),
  );

  const file = {
    v: 1,
    app: "MediVault",
    alg: "AES-GCM",
    kdf: "PBKDF2-SHA256",
    iterations,
    salt: toB64(salt),
    iv: toB64(iv),
    payload: toB64(ciphertext),
  };
  return new Blob([JSON.stringify(file)], { type: "application/octet-stream" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function suggestBackupName() {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10);
  return `medivault-${stamp}.medbackup`;
}

// ----- RESTORE -----
export async function restoreBackup(
  file: File,
  password: string,
  mode: "replace" | "merge" = "replace",
): Promise<{ keysRestored: number }> {
  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Not a valid .medbackup file");
  }
  if (!parsed || parsed.alg !== "AES-GCM" || !parsed.payload || !parsed.salt || !parsed.iv) {
    throw new Error("Backup file is corrupted or unsupported");
  }
  const salt = fromB64(parsed.salt);
  const iv = fromB64(parsed.iv);
  const cipher = fromB64(parsed.payload);
  const key = await deriveKey(password, salt, parsed.iterations || 150_000);

  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, cipher);
  } catch {
    throw new Error("Wrong password or file tampered with");
  }
  const payload = JSON.parse(dec.decode(plain));
  if (payload.magic !== MAGIC) throw new Error("Backup payload invalid");
  const data: Record<string, string> = payload.data || {};

  if (mode === "replace") {
    // Clear only our namespace.
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toDelete.push(k);
    }
    toDelete.forEach((k) => localStorage.removeItem(k));
  }

  let n = 0;
  for (const [k, v] of Object.entries(data)) {
    if (!k.startsWith(PREFIX)) continue;
    localStorage.setItem(k, v);
    n++;
  }
  return { keysRestored: n };
}

// ----- PDF EXPORT -----
type PdfBundle = {
  profile: ProfileRecord | Profile;
  timeline: TimelineEntry[];
  meds: Medication[];
  reports: Report[];
};

export async function generateMedicalPDF(b: PdfBundle): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  const ensure = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const line = (s: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(s, W - M * 2) as string[];
    ensure(wrapped.length * (size + 2));
    doc.text(wrapped, M, y);
    y += wrapped.length * (size + 2);
  };
  const hr = () => {
    ensure(10);
    doc.setDrawColor(200);
    doc.line(M, y, W - M, y);
    y += 10;
  };
  const section = (title: string) => {
    ensure(28);
    y += 6;
    doc.setFillColor(238, 242, 255);
    doc.rect(M, y - 14, W - M * 2, 22, "F");
    doc.setTextColor(40, 40, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, M + 8, y);
    doc.setTextColor(0, 0, 0);
    y += 14;
  };

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Medical Summary", M, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toLocaleString()}`, M, y);
  doc.setTextColor(0);
  y += 14;
  hr();

  // Patient
  section("Patient Details");
  const p = b.profile as any;
  line(`Name: ${p.name || "—"}`, 11, true);
  line(`Age: ${p.age || "—"}    Gender: ${p.gender || "—"}    Blood: ${p.bloodGroup || "—"}`);
  line(`Allergies: ${p.allergies || "None"}`);
  line(`Chronic conditions: ${p.chronic || "None"}`);
  line(`Emergency: ${p.emergencyName || "—"} (${p.emergencyPhone || "—"})`);

  // Medications
  section("Current Medications");
  const active = b.meds.filter((m) => m.active);
  if (active.length === 0) line("None recorded.");
  active.forEach((m) => {
    line(`• ${m.name} — ${m.dosage || ""} ${m.frequency ? `(${m.frequency})` : ""}`.trim(), 11, true);
    if (m.startDate) line(`   Since ${m.startDate}${m.endDate ? ` → ${m.endDate}` : ""}`, 10);
  });

  // Past meds
  const past = b.meds.filter((m) => !m.active);
  if (past.length > 0) {
    section("Past Medications");
    past.forEach((m) => {
      line(`• ${m.name} ${m.dosage ? `— ${m.dosage}` : ""}`.trim());
    });
  }

  // Timeline
  section("Medical History Timeline");
  const sorted = [...b.timeline].sort((a, z) => z.date.localeCompare(a.date));
  if (sorted.length === 0) line("No entries recorded.");
  sorted.forEach((t) => {
    line(`${t.date} — ${t.type.toUpperCase()}: ${t.title}`, 11, true);
    if (t.hospital || t.doctor)
      line(`   ${[t.hospital, t.doctor].filter(Boolean).join(" · ")}${t.doctorPhone ? ` · ${t.doctorPhone}` : ""}`, 10);
    if (t.details) line(`   ${t.details}`, 10);
  });

  // Reports
  if (b.reports.length > 0) {
    section("Uploaded Reports");
    b.reports.forEach((r) => {
      line(`• ${r.name} — ${r.category} (${r.date})`);
    });

    // Image attachments
    const images = b.reports.filter((r) => r.mimeType.startsWith("image/"));
    for (const r of images) {
      doc.addPage();
      y = M;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`${r.name}`, M, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`${r.category} · ${r.date}`, M, y + 10);
      doc.setTextColor(0);
      y += 24;
      try {
        const fmt = r.mimeType.includes("png") ? "PNG" : "JPEG";
        const maxW = W - M * 2;
        const maxH = H - y - M;
        doc.addImage(r.dataUrl, fmt, M, y, maxW, maxH, undefined, "FAST");
      } catch {
        doc.text("(could not embed image)", M, y);
      }
    }
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`MediVault · Page ${i} of ${pages}`, W - M, H - 20, { align: "right" });
  }

  return doc.output("blob");
}
