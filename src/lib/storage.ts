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
};

export type Period = {
  id: string;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
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
