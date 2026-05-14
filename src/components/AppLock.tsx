import { useEffect, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, Lock, ShieldCheck, KeyRound } from "lucide-react";

const CRED_KEY = "mv-lock-credId";
const PIN_KEY = "mv-lock-pin";
const SESSION_KEY = "mv-unlocked";

function b64url(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return b64url(buf);
}

const webauthnAvailable = () =>
  typeof window !== "undefined" &&
  !!(window as any).PublicKeyCredential &&
  !!navigator.credentials;

export function AppLock({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hasCred, setHasCred] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [mode, setMode] = useState<"bio" | "pin">("bio");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasCred(!!localStorage.getItem(CRED_KEY));
    setHasPin(!!localStorage.getItem(PIN_KEY));
    if (sessionStorage.getItem(SESSION_KEY) === "1") setUnlocked(true);
    setReady(true);
  }, []);

  const markUnlocked = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setUnlocked(true);
  };

  const enrollBiometric = async () => {
    setError("");
    setBusy(true);
    try {
      if (!webauthnAvailable()) throw new Error("Biometrics not supported on this device");
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "MediVault" },
          user: { id: userId, name: "medivault-user", displayName: "MediVault" },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Setup cancelled");
      localStorage.setItem(CRED_KEY, b64url(cred.rawId));
      setHasCred(true);
      markUnlocked();
    } catch (e: any) {
      setError(e?.message || "Couldn't set up biometrics. Try a PIN instead.");
    } finally {
      setBusy(false);
    }
  };

  const unlockBiometric = async () => {
    setError("");
    setBusy(true);
    try {
      const id = localStorage.getItem(CRED_KEY);
      if (!id) throw new Error("No credential stored");
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: fromB64url(id), type: "public-key" }],
          userVerification: "required",
          timeout: 60000,
        },
      });
      if (!assertion) throw new Error("Authentication failed");
      markUnlocked();
    } catch (e: any) {
      setError(e?.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const setupPin = async () => {
    setError("");
    if (pin.length < 4) return setError("PIN must be at least 4 digits");
    if (pin !== pin2) return setError("PINs don't match");
    const h = await sha(pin);
    localStorage.setItem(PIN_KEY, h);
    setHasPin(true);
    setPin("");
    setPin2("");
    markUnlocked();
  };

  const verifyPin = async () => {
    setError("");
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return setError("No PIN set");
    const h = await sha(pin);
    if (h !== stored) {
      setPin("");
      return setError("Incorrect PIN");
    }
    setPin("");
    markUnlocked();
  };

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  const needsSetup = !hasCred && !hasPin;

  return (
    <>
      {/* Render app behind a blur to hide content while locked */}
      <div className="pointer-events-none blur-xl opacity-40">{children}</div>
      <AnimatePresence>
        <motion.div
          key="lock"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-2xl px-6"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="w-full max-w-sm rounded-3xl bg-card shadow-card p-6 text-center"
          >
            <div className="mx-auto h-16 w-16 rounded-2xl gradient-primary grid place-items-center text-primary-foreground shadow-glow">
              {mode === "bio" ? <Fingerprint className="h-8 w-8" /> : <KeyRound className="h-7 w-7" />}
            </div>
            <h2 className="mt-4 text-xl font-bold">
              {needsSetup ? "Secure MediVault" : "Unlock MediVault"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {needsSetup
                ? "Your records are encrypted on this device. Set up a lock to continue."
                : mode === "bio"
                ? "Use your fingerprint, Face ID, or device passcode."
                : "Enter your PIN to unlock."}
            </p>

            {/* SETUP */}
            {needsSetup && (
              <div className="mt-5 space-y-2">
                {webauthnAvailable() && (
                  <button
                    disabled={busy}
                    onClick={enrollBiometric}
                    className="w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Fingerprint className="h-4 w-4" /> Use device biometrics
                  </button>
                )}
                <div className="rounded-2xl bg-muted p-3 text-left">
                  <p className="text-xs font-medium text-muted-foreground mb-2">…or set a PIN</p>
                  <input
                    inputMode="numeric"
                    type="password"
                    placeholder="New PIN (min 4)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full rounded-xl bg-background px-3 py-2.5 text-sm outline-none mb-2 tracking-widest text-center"
                  />
                  <input
                    inputMode="numeric"
                    type="password"
                    placeholder="Confirm PIN"
                    value={pin2}
                    onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    className="w-full rounded-xl bg-background px-3 py-2.5 text-sm outline-none mb-2 tracking-widest text-center"
                  />
                  <button
                    onClick={setupPin}
                    className="w-full rounded-xl bg-foreground text-background py-2.5 text-sm font-semibold"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            )}

            {/* UNLOCK */}
            {!needsSetup && (
              <div className="mt-5 space-y-3">
                {mode === "bio" && hasCred && (
                  <button
                    disabled={busy}
                    onClick={unlockBiometric}
                    className="w-full rounded-2xl gradient-primary text-primary-foreground py-3.5 font-semibold shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {busy ? "Verifying…" : "Unlock with biometrics"}
                  </button>
                )}
                {mode === "pin" && hasPin && (
                  <div>
                    <input
                      autoFocus
                      inputMode="numeric"
                      type="password"
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      onKeyDown={(e) => e.key === "Enter" && verifyPin()}
                      className="w-full rounded-2xl bg-muted px-3 py-3.5 text-lg outline-none tracking-[0.5em] text-center"
                    />
                    <button
                      onClick={verifyPin}
                      className="mt-2 w-full rounded-2xl gradient-primary text-primary-foreground py-3 font-semibold shadow-glow"
                    >
                      Unlock
                    </button>
                  </div>
                )}
                {hasCred && hasPin && (
                  <button
                    onClick={() => {
                      setError("");
                      setMode(mode === "bio" ? "pin" : "bio");
                    }}
                    className="text-xs text-muted-foreground underline"
                  >
                    Use {mode === "bio" ? "PIN" : "biometrics"} instead
                  </button>
                )}
              </div>
            )}

            {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
            <p className="mt-4 text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Data stays encrypted on this device
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
