/**
 * Offline backup, restore, and PDF export.
 *
 * Backup file: plain JSON (.json extension). Contains everything under the
 * "mv-" localStorage namespace. If a password is supplied, the inner data
 * blob is encrypted with AES-GCM (PBKDF2-SHA256). Empty password = plain
 * backup, so users who don't want a password can still restore easily.
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
const MAGIC = "MEDVAULT-BACKUP";

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
  const data = collectAppData();
  const inner = JSON.stringify({
    exportedAt: new Date().toISOString(),
    app: "MediVault",
    data,
  });

  let file: any;
  if (password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = 150_000;
    const key = await deriveKey(password, salt, iterations);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      enc.encode(inner),
    );
    file = {
      magic: MAGIC,
      v: 2,
      encrypted: true,
      alg: "AES-GCM",
      kdf: "PBKDF2-SHA256",
      iterations,
      salt: toB64(salt),
      iv: toB64(iv),
      payload: toB64(ciphertext),
    };
  } else {
    file = {
      magic: MAGIC,
      v: 2,
      encrypted: false,
      payload: inner,
    };
  }
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
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
  return `medivault-backup-${stamp}.json`;
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
    throw new Error("This file isn't a valid MediVault backup");
  }
  // Accept both v2 (current) and legacy v1 files.
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file isn't a valid MediVault backup");
  }

  let innerText: string;

  // v2 plain
  if (parsed.encrypted === false && typeof parsed.payload === "string") {
    innerText = parsed.payload;
  } else if (parsed.payload && parsed.salt && parsed.iv) {
    // encrypted (v1 or v2)
    if (!password) throw new Error("This backup is password protected");
    try {
      const salt = fromB64(parsed.salt);
      const iv = fromB64(parsed.iv);
      const cipher = fromB64(parsed.payload);
      const key = await deriveKey(password, salt, parsed.iterations || 150_000);
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv as BufferSource },
        key,
        cipher,
      );
      innerText = dec.decode(plain);
    } catch {
      throw new Error("Wrong password, or the file is damaged");
    }
  } else {
    throw new Error("Unrecognised backup format");
  }

  let payload: any;
  try {
    payload = JSON.parse(innerText);
  } catch {
    throw new Error("Backup contents are corrupted");
  }
  const data: Record<string, string> = payload.data || {};
  if (!data || typeof data !== "object") throw new Error("Backup has no data");

  if (mode === "replace") {
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
    localStorage.setItem(k, String(v));
    n++;
  }
  return { keysRestored: n };
}

// ----- PDF EXPORT (multi-patient) -----
export type PatientBundle = {
  profile: ProfileRecord | (Profile & { id?: string; relation?: string });
  timeline: TimelineEntry[];
  meds: Medication[];
  reports: Report[];
};

/**
 * Build a complete PDF containing every patient.
 * - 1 page per patient with their details, meds and timeline
 * - Reports for that patient are appended, 4 per page in a 2×2 grid
 */
export async function generateMedicalPDF(patients: PatientBundle[]): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;

  let first = true;

  for (const p of patients) {
    if (!first) doc.addPage();
    first = false;
    renderPatientPage(doc, p, W, H, M);
    renderReportPages(doc, p, W, H, M);
  }

  // Footer page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(140);
    doc.text(`MediVault · Page ${i} of ${pages}`, W - M, H - 18, { align: "right" });
  }

  return doc.output("blob");
}

function renderPatientPage(
  doc: jsPDF,
  b: PatientBundle,
  W: number,
  H: number,
  M: number,
) {
  let y = M;
  const p = b.profile as any;

  // Header band
  doc.setFillColor(238, 242, 255);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(40, 40, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(p.name || "Unnamed patient", M, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${p.relation || "Self"}  ·  Generated ${new Date().toLocaleDateString()}`,
    M,
    50,
  );
  doc.setTextColor(0);
  y = 90;

  const writeLine = (s: string, size = 10.5, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(s, W - M * 2) as string[];
    if (y + wrapped.length * (size + 2) > H - M) return; // single-page patient summary
    doc.text(wrapped, M, y);
    y += wrapped.length * (size + 2);
  };

  const sectionTitle = (t: string) => {
    if (y + 26 > H - M) return;
    y += 8;
    doc.setFillColor(245, 247, 252);
    doc.rect(M, y - 12, W - M * 2, 20, "F");
    doc.setTextColor(40, 40, 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(t, M + 6, y + 2);
    doc.setTextColor(0);
    y += 14;
  };

  sectionTitle("Patient details");
  writeLine(
    `Age: ${p.age || "—"}    Gender: ${p.gender || "—"}    Blood: ${p.bloodGroup || "—"}`,
  );
  writeLine(`Allergies: ${p.allergies || "None"}`);
  writeLine(`Chronic: ${p.chronic || "None"}`);
  writeLine(`Emergency: ${p.emergencyName || "—"} (${p.emergencyPhone || "—"})`);

  sectionTitle("Current medications");
  const active = b.meds.filter((m) => m.active);
  if (active.length === 0) writeLine("None recorded.");
  active.slice(0, 12).forEach((m) => {
    const times = m.times?.length ? ` @ ${m.times.join(", ")}` : "";
    writeLine(
      `• ${m.name} — ${m.dosage || ""} ${m.frequency ? `(${m.frequency})` : ""}${times}`.trim(),
      10.5,
      true,
    );
  });

  sectionTitle("Medical history");
  const sorted = [...b.timeline].sort((a, z) => z.date.localeCompare(a.date));
  if (sorted.length === 0) writeLine("No entries recorded.");
  sorted.slice(0, 14).forEach((t) => {
    writeLine(`${t.date} — ${t.type.toUpperCase()}: ${t.title}`, 10, true);
    const meta = [t.hospital, t.doctor].filter(Boolean).join(" · ");
    if (meta || t.doctorPhone)
      writeLine(`   ${meta}${t.doctorPhone ? ` · ${t.doctorPhone}` : ""}`, 9.5);
  });

  if (b.reports.length > 0) {
    sectionTitle(`Reports (${b.reports.length}) — see next page${b.reports.length > 4 ? "s" : ""}`);
  }
}

function renderReportPages(
  doc: jsPDF,
  b: PatientBundle,
  W: number,
  H: number,
  M: number,
) {
  const reports = b.reports;
  if (reports.length === 0) return;

  // 2×2 grid per page = 4 reports per page
  const cols = 2;
  const rows = 2;
  const headerH = 36;
  const gridH = H - headerH - M;
  const cellW = (W - M * 2 - 12) / cols;
  const cellH = (gridH - 12) / rows;

  const patientName = (b.profile as any).name || "Unnamed patient";

  for (let i = 0; i < reports.length; i += 4) {
    doc.addPage();
    // small header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 90);
    doc.text(`${patientName} — Reports`, M, 26);
    doc.setTextColor(0);

    for (let j = 0; j < 4 && i + j < reports.length; j++) {
      const r = reports[i + j];
      const cx = j % cols;
      const cy = Math.floor(j / cols);
      const x = M + cx * (cellW + 12);
      const y = headerH + cy * (cellH + 12);

      // Cell border
      doc.setDrawColor(220);
      doc.roundedRect(x, y, cellW, cellH, 6, 6);

      // Label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      const title = doc.splitTextToSize(r.name, cellW - 12) as string[];
      doc.text(title.slice(0, 1), x + 6, y + 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(110);
      doc.text(`${r.category} · ${r.date}`, x + 6, y + 26);
      doc.setTextColor(0);

      const imgX = x + 6;
      const imgY = y + 32;
      const imgW = cellW - 12;
      const imgH = cellH - 38;

      if (r.mimeType.startsWith("image/")) {
        try {
          const fmt = r.mimeType.includes("png") ? "PNG" : "JPEG";
          doc.addImage(r.dataUrl, fmt, imgX, imgY, imgW, imgH, undefined, "FAST");
        } catch {
          doc.setFontSize(9);
          doc.text("(could not embed image)", imgX, imgY + 14);
        }
      } else {
        doc.setFillColor(245, 247, 252);
        doc.rect(imgX, imgY, imgW, imgH, "F");
        doc.setTextColor(120);
        doc.setFontSize(10);
        doc.text("PDF / file", imgX + imgW / 2, imgY + imgH / 2, { align: "center" });
        doc.setTextColor(0);
      }
    }
  }
}
