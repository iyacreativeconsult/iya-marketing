"use client";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { api, ApiError, toApiError } from "@/lib/client/api";
import { ErrorNotice } from "@/components/ErrorNotice";

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "Email atau kata laluan salah.",
  "auth/invalid-email": "Format email tidak sah.",
  "auth/user-disabled": "Akaun ini telah dinyahaktifkan. Hubungi Admin.",
  "auth/too-many-requests": "Terlalu banyak cubaan. Tunggu beberapa minit dan cuba lagi.",
  "auth/network-request-failed": "Tidak dapat hubungi server log masuk. Semak internet.",
};

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = clientAuth();
      let idToken: string;
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        idToken = await cred.user.getIdToken();
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        throw new ApiError(code, FIREBASE_ERRORS[code] ?? `Log masuk gagal (${code || "ralat tidak diketahui"}).`, null);
      }
      try {
        await api("/api/auth/session", { body: { idToken } });
      } finally {
        await signOut(auth).catch(() => undefined); // token client tidak disimpan
      }
      window.location.assign("/");
    } catch (err) {
      setError(toApiError(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="password">Kata laluan</label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="absolute inset-y-0 right-0 px-3 text-muted" onClick={() => setShow((s) => !s)} aria-label={show ? "Sorok kata laluan" : "Tunjuk kata laluan"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <ErrorNotice error={error} />
      <button type="submit" className="btn-primary w-full" disabled={busy || !email || !password}>
        {busy && <LoaderCircle className="size-4 animate-spin" />}
        Log masuk
      </button>
    </form>
  );
}
