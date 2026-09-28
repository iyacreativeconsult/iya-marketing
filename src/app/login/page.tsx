import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { isAppError } from "@/lib/server/errors";
import { log } from "@/lib/server/logger";
import { APP_SUBTITLE } from "@/lib/config";
import { LoginForm } from "./LoginForm";
import { isDemo } from "@/lib/demo-mode";

export const metadata = { title: "Log masuk" };

export default async function LoginPage() {
  if (isDemo()) redirect("/");
  let configError: string | null = null;
  try {
    if (await getSessionUser()) redirect("/");
  } catch (e) {
    if (isAppError(e) && e.code === "CONFIG") {
      configError = "Tetapan server belum lengkap. Semak terminal (localhost) atau Vercel Logs untuk nama env yang tiada.";
      log("error", "CONFIG", { detail: String(e.internal) });
    } else {
      throw e; // termasuk redirect()
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-br from-brand-50 via-white to-brand-100 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-5xl font-extrabold text-brand-500">iya</p>
          <p className="mt-1 text-xs font-medium tracking-[0.25em] text-muted">CREATIVE</p>
          <p className="mt-4 text-sm text-muted">{APP_SUBTITLE}</p>
        </div>
        <div className="card p-6 shadow-sm">
          <h1 className="mb-5 text-lg font-bold">Log masuk</h1>
          {configError ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{configError}</p>
          ) : (
            <LoginForm />
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted">Akaun baru dicipta oleh Admin. Lupa kata laluan? Hubungi Admin.</p>
      </div>
    </main>
  );
}
