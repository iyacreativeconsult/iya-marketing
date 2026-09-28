import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { AppError } from "../server/errors";
import { getFirestore, FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { serverEnv } from "../server/env";
import { isDemo } from "../demo-mode";
import { demoAuth, demoDb } from "./demo";

export { FieldValue, Timestamp };

let app: App | null = null;
let db: Firestore | null = null;

/** Firebase Admin dimulakan secara lazy (hanya bila diperlukan), bukan semasa build. */
function adminApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  const env = serverEnv();
  app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    }),
  });
  return app;
}

// Disimpan pada globalThis: semasa `npm run dev`, modul dimuat semula (hot reload) tetapi
// instance Firestore kekal, dan settings() hanya boleh dipanggil sekali.
const g = globalThis as unknown as { __iyaFirestore?: Firestore };

export function adminDb(): Firestore {
  if (isDemo()) return demoDb() as unknown as Firestore;
  if (db) return db;
  if (g.__iyaFirestore) return (db = g.__iyaFirestore);
  db = getFirestore(adminApp());
  db.settings({ ignoreUndefinedProperties: true });
  g.__iyaFirestore = db;
  return db;
}

export function adminAuth() {
  if (isDemo()) return demoAuth as unknown as ReturnType<typeof getAuth>;
  return getAuth(adminApp());
}

/** Tukar Firestore Timestamp kepada ISO string untuk dihantar ke browser. */
export function toIso(v: unknown): string | null {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return null;
}

/** Bucket Firebase Storage untuk resit dan bukti bayaran. */
export function adminBucket() {
  const name = serverEnv().FIREBASE_STORAGE_BUCKET;
  if (!name) {
    throw new AppError("CONFIG", "Storan fail belum diset. Hubungi Admin sistem.", {
      internal: "FIREBASE_STORAGE_BUCKET tiada dalam env. Firebase Console > Storage > salin nama bucket (contoh projek.firebasestorage.app).",
    });
  }
  return getStorage(adminApp()).bucket(name);
}
