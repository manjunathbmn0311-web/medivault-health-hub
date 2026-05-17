import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

export type Profile = {
  name: string;
  age: string;
  gender: string;
  bloodGroup: string;
  allergies: string;
  chronic: string;
  emergencyName: string;
  emergencyPhone: string;
};

export type TimelineEntry = {
  id: string;
  date: string;
  type: "symptom" | "diagnosis" | "medication" | "surgery" | "note";
  title: string;
  hospital?: string;
  doctor?: string;
  doctorPhone?: string;
  details?: string;
};

export type Report = {
  id: string;
  name: string;
  category: string;
  date: string;
  dataUrl: string;
  mimeType: string;
};

export type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  /** Times of day (HH:mm) the medication should be taken. */
  times?: string[];
  /** Map of YYYY-MM-DD → list of HH:mm slots already taken that day. */
  takenLog?: Record<string, string[]>;
};

export const FREQUENCY_COUNTS: Record<string, number> = {
  "Once daily": 1,
  "Twice daily": 2,
  "Thrice daily": 3,
  "Four times daily": 4,
  Weekly: 1,
  "As needed": 0,
};

export type Period = {
  id: string;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
  padsPerDay?: number;
  symptoms?: string;
  notes?: string;
};

export const DEFAULT_PROFILE: Profile = {
  name: "",
  age: "",
  gender: "",
  bloodGroup: "",
  allergies: "",
  chronic: "",
  emergencyName: "",
  emergencyPhone: "",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export type ProfileRecord = Profile & { id: string; relation: string };

export const RELATIONS = [
  "Self",
  "Spouse",
  "Wife",
  "Husband",
  "Partner",
  "Son",
  "Daughter",
  "Child",
  "Mom",
  "Dad",
  "Parent",
  "Brother",
  "Sister",
  "Sibling",
  "Grandfather",
  "Grandmother",
  "Grandparent",
  "Grandson",
  "Granddaughter",
  "Uncle",
  "Aunt",
  "Cousin",
  "Nephew",
  "Niece",
  "Father-in-law",
  "Mother-in-law",
  "Friend",
  "Other",
];

/**
 * Per-profile scoped storage. Key becomes `${prefix}::${activeId}` so each
 * family member has their own isolated data set. When activeId changes the
 * hook reloads the value from localStorage for the new profile.
 */
export function useScopedStorage<T>(prefix: string, initial: T) {
  const { activeId } = useActiveProfile();
  const key = activeId ? `${prefix}::${activeId}` : prefix;
  const loadedKeyRef = useRef<string>(key);
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : initial;
    } catch {
      return initial;
    }
  });
  // When key (profile) changes, synchronously reload from storage for the new key
  // and mark the loaded key. This avoids the next write effect overwriting the
  // new profile's data with the previous profile's in-memory value.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadedKeyRef.current === key) return;
    try {
      const v = localStorage.getItem(key);
      setValue(v ? (JSON.parse(v) as T) : initial);
    } catch {
      setValue(initial);
    }
    loadedKeyRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // Persist only when value belongs to the currently loaded key.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loadedKeyRef.current !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue] as const;
}

export const makeProfile = (relation = "Self"): ProfileRecord => ({
  ...DEFAULT_PROFILE,
  id: uid(),
  relation,
});

export function useActiveProfile() {
  const [profiles, setProfiles] = useLocalStorage<ProfileRecord[]>("mv-profiles", []);
  const [activeId, setActiveId] = useLocalStorage<string>("mv-active-profile", "");

  useEffect(() => {
    if (profiles.length === 0) {
      let seed: ProfileRecord;
      try {
        const legacy = localStorage.getItem("mv-profile");
        const base = legacy ? (JSON.parse(legacy) as Profile) : DEFAULT_PROFILE;
        seed = { ...DEFAULT_PROFILE, ...base, id: uid(), relation: "Self" };
      } catch {
        seed = makeProfile("Self");
      }
      setProfiles([seed]);
      setActiveId(seed.id);
    } else if (!profiles.find((p) => p.id === activeId)) {
      setActiveId(profiles[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile =
    profiles.find((p) => p.id === activeId) ??
    profiles[0] ?? { ...DEFAULT_PROFILE, id: "", relation: "Self" };

  return { profiles, setProfiles, activeId, setActiveId, profile };
}
