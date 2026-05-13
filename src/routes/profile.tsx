import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { useLocalStorage, Profile, DEFAULT_PROFILE } from "@/lib/storage";
import { Field } from "./timeline";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — MediVault" }] }),
  component: ProfilePage,
});

const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["Female", "Male", "Other"];

function ProfilePage() {
  const [profile, setProfile] = useLocalStorage<Profile>("mv-profile", DEFAULT_PROFILE);
  const [draft, setDraft] = useState<Profile>(profile);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <PageShell title="Profile" subtitle="Health information">
      <div className="rounded-3xl bg-card shadow-card p-5">
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
          <ChipInput
            value={draft.allergies}
            onChange={(v) => setDraft({ ...draft, allergies: v })}
            placeholder="Add allergy"
          />
        </Field>
        <Field label="Chronic conditions">
          <ChipInput
            value={draft.chronic}
            onChange={(v) => setDraft({ ...draft, chronic: v })}
            placeholder="Add condition"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Emergency contact"><input value={draft.emergencyName} onChange={(e) => setDraft({ ...draft, emergencyName: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" /></Field>
          <Field label="Phone"><input value={draft.emergencyPhone} onChange={(e) => setDraft({ ...draft, emergencyPhone: e.target.value })} className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none" placeholder="+91…" /></Field>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={save}
          className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow flex items-center justify-center gap-2"
        >
          {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save profile"}
        </motion.button>
      </div>

      <p className="text-[11px] text-center text-muted-foreground mt-4 px-4">
        Your data is stored locally on this device only.
      </p>
    </PageShell>
  );
}
