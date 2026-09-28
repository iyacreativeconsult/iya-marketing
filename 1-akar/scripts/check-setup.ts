/**
 * Semak sambungan Firebase sebelum guna / deploy.
 *
 *   npm run check:setup
 *
 * Menyemak: env lengkap, private key sah, Firestore, Authentication, Storage,
 * dan sama ada team serta Admin pertama sudah dicipta.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let failed = 0;
const ok = (msg: string) => console.log(`  OK      ${msg}`);
const bad = (msg: string, fix?: string) => {
  failed++;
  console.log(`  GAGAL   ${msg}${fix ? `\n          -> ${fix}` : ""}`);
};
const warn = (msg: string, fix?: string) => console.log(`  AMARAN  ${msg}${fix ? `\n          -> ${fix}` : ""}`);

async function step(name: string, fn: () => Promise<void>, fix: string) {
  try {
    await fn();
  } catch (e) {
    bad(`${name}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`, fix);
  }
}

async function main() {
  console.log("\n1. Pemboleh ubah persekitaran (.env.local)");
  const need = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "CRON_SECRET",
    "FIREBASE_STORAGE_BUCKET",
  ];
  for (const k of need) {
    if (process.env[k]) ok(k);
    else bad(`${k} tiada`, k.startsWith("NEXT_PUBLIC") ? "Salin dari Firebase Console > Project settings > Your apps (Web)" : "Jalankan: npm run env:setup -- /laluan/service-account.json");
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith("AIza")) warn("NEXT_PUBLIC_FIREBASE_API_KEY biasanya bermula dengan AIza", "Semak semula nilai apiKey");
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== process.env.FIREBASE_PROJECT_ID) {
    bad("Project ID client dan server berbeza", "Pastikan web app dan service account dari projek Firebase yang sama");
  }
  if ((process.env.CRON_SECRET ?? "").length < 32) bad("CRON_SECRET kurang dari 32 aksara", "Jalankan semula npm run env:setup, atau: openssl rand -hex 32");
  if (failed) return;

  const key = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY")) {
    bad("Format FIREBASE_PRIVATE_KEY salah", "Jalankan: npm run env:setup -- /laluan/service-account.json");
    return;
  }
  const app = initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: key }) });

  console.log("\n2. Firestore");
  await step("Sambungan Firestore", async () => {
    const db = getFirestore(app);
    const teams = await db.collection("teams").get();
    ok(`Firestore boleh dibaca (${teams.size} team)`);
    if (teams.size === 0) warn("Belum ada team", 'Jalankan: npm run seed -- --email emel@anda.com --name "Nama" --password "KataLaluan123"');
    const admins = await db.collection("users").where("role", "==", "admin").get();
    if (admins.size === 0) warn("Belum ada akaun Admin", "Jalankan npm run seed (seperti di atas)");
    else ok(`${admins.size} akaun Admin`);
  }, "Firestore > Create database (asia-southeast1). Semak service account dari projek yang betul.");

  console.log("\n3. Authentication");
  await step("Authentication", async () => {
    await getAuth(app).listUsers(1);
    ok("Firebase Authentication boleh diakses");
  }, "Authentication > Get started, dan hidupkan Email/Password");

  console.log("\n4. Storage (resit, invois, gambar, asset)");
  await step("Storage", async () => {
    const [exists] = await getStorage(app).bucket(process.env.FIREBASE_STORAGE_BUCKET).exists();
    if (exists) ok(`Bucket ${process.env.FIREBASE_STORAGE_BUCKET} wujud`);
    else bad(`Bucket ${process.env.FIREBASE_STORAGE_BUCKET} tidak wujud`, "Storage > Get started (perlu pelan Blaze), kemudian salin nama bucket ke FIREBASE_STORAGE_BUCKET");
  }, "Storage > Get started (perlu pelan Blaze). Semak nama bucket.");
}

main()
  .catch((e) => bad(String(e)))
  .finally(() => {
    console.log(failed ? `\n${failed} perkara perlu dibetulkan.\n` : "\nSemua sedia. Seterusnya: npm run dev\n");
    process.exit(failed ? 1 : 0);
  });
