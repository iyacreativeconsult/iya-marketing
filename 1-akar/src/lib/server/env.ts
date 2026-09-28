import "server-only";
import { z } from "zod";
import { AppError } from "./errors";

const schema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().includes("BEGIN PRIVATE KEY", { message: "format private key salah" }),
  CRON_SECRET: z.string().min(32, "minimum 32 aksara"),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof schema>;
let cached: ServerEnv | null = null;

/**
 * Semak env server sekali sahaja. Jika ada yang tiada, mesej ralat akan
 * menyebut nama env yang tepat (lihat terminal atau Vercel Logs).
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new AppError("CONFIG", undefined, { internal: `Env tidak lengkap -> ${problems}. Semak .env.local atau Vercel > Settings > Environment Variables.` });
  }
  cached = { ...parsed.data, FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  return cached;
}

/** Senarai env yang tiada (untuk /api/health). Tidak dedahkan nilai. */
export function missingEnv(): string[] {
  const keys = [
    ...Object.keys(schema.shape).filter((k) => k !== "FIREBASE_STORAGE_BUCKET"),
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  return keys.filter((k) => !process.env[k]);
}
