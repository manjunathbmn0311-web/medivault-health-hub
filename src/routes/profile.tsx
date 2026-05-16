import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import {
  ProfileRecord,
  RELATIONS,
  makeProfile,
  useActiveProfile,
} from "@/lib/storage";
import { Field } from "./timeline";
import { useEffect, useState } from "react";
import { Check, Plus, Trash2, UserPlus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — MediVault" }] }),
  component: ProfilePage,
});

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Female", "Male", "Other"];

function ProfilePage() {
  const { profiles, setProfiles, activeId, setActiveId, profile } = useActiveProfile();
  const [draft, setDraft] = useState<ProfileRecord>(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const save = () => {
    setProfiles(profiles.map((p) => (p.id === draft.id ? draft : p)));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addMember = () => {
    const p = makeProfile("Other");
    setProfiles([...profiles, p]);
    setActiveId(p.id);
  };

  const removeMember = (id: string) => {
    if (profiles.length <= 1) return;
    const next = profiles.filter((p) => p.id !== id);
    setProfiles(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  if (!draft?.id) return <PageShell title="Profile" subtitle="Health information">{null}</PageShell>;

  return (
    <PageShell title="Profile" subtitle="Health information">
      {/* Family accounts switcher */}
      <div className="rounded-3xl bg-card shadow-card p-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Family accounts</p>
          <button
            onClick={addMember}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            <UserPlus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {profiles.map((p) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium min-w-[84px] text-left ${
                  isActive
                    ? "gradient-primary text-primary-foreground shadow-glow"
                    : "bg-muted"
                }`}
              >
                <span className="block truncate max-w-[110px]">
                  {p.name || p.relation || "Unnamed"}
                </span>
                <span className="block text-[10px] opacity-70">{p.relation}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl bg-card shadow-card p-5">
        <Field label="Relation">
          <div className="flex flex-wrap gap-1.5">
            {RELATIONS.map((r) => (
              <button
                key={r}
                onClick={() => setDraft({ ...draft, relation: r })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  draft.relation === r
                    ? "gradient-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Full name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Age"><input value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="Gender">
            <div className="flex gap-1">
              {GENDERS.map((g) => (
                <button key={g} onClick={() => setDraft({ ...draft, gender: g })} className={`flex-1 px-2 py-2 rounded-xl text-xs ${draft.gender === g ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>{g}</button>
              ))}
            </div>
          </Field>
        </div>
        <Field label="Blood group">
          <div className="flex flex-wrap gap-2">
            {BLOOD.map((b) => (
              <button key={b} onClick={() => setDraft({ ...draft, bloodGroup: b })} className={`px-3 py-1.5 rounded-full text-xs font-medium ${draft.bloodGroup === b ? "gradient-primary text-primary-foreground" : "bg-muted"}`}>{b}</button>
            ))}
          </div>
        </Field>
        <Field label="Allergies">
          <ChipInput value={draft.allergies} onChange={(v) => setDraft({ ...draft, allergies: v })} placeholder="Add allergy" />
        </Field>
        <Field label="Chronic conditions">
          <ChipInput value={draft.chronic} onChange={(v) => setDraft({ ...draft, chronic: v })} placeholder="Add condition" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Emergency contact"><input value={draft.emergencyName} onChange={(e) => setDraft({ ...draft, emergencyName: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="Phone"><input value={draft.emergencyPhone} onChange={(e) => setDraft({ ...draft, emergencyPhone: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" placeholder="+91…" /></Field>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={save} className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow flex items-center justify-center gap-2">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save profile"}
        </motion.button>

        {profiles.length > 1 && (
          <button
            onClick={() => removeMember(draft.id)}
            className="mt-3 w-full rounded-2xl bg-destructive/10 text-destructive py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Remove this account
          </button>
        )}
      </div>

      <p className="text-[11px] text-center text-muted-foreground mt-4 px-4">
        Each account's data stays on this device. Switch accounts anytime above.
      </p>
    </PageShell>
  );
}

function ChipInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const items = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) { setDraft(""); return; }
    onChange([...items, v].join(", "));
    setDraft("");
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i).join(", "));
  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-sm outline-none"
        />
        <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={add} aria-label="Add" className="h-10 w-10 shrink-0 rounded-xl gradient-primary text-primary-foreground grid place-items-center shadow-soft">
          <Plus className="h-4 w-4" />
        </motion.button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <AnimatePresence>
            {items.map((it, i) => (
              <motion.span key={it} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-accent text-accent-foreground text-xs">
                {it}
                <button onClick={() => remove(i)} className="h-5 w-5 rounded-full bg-background/40 grid place-items-center" aria-label={`Remove ${it}`}>
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
