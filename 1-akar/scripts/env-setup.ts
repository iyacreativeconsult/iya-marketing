/**
 * Isi .env.local dari fail JSON service account Firebase (elak salah format private key).
 *
 *   npm run env:setup -- ~/Downloads/nama-projek-firebase-adminsdk-xxxxx.json
 *
 * Yang diisi automatik: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
 * CRON_SECRET (rawak), dan nilai lalai NEXT_PUBLIC_FIREBASE_PROJECT_ID / AUTH_DOMAIN /
 * FIREBASE_STORAGE_BUCKET jika masih kosong. Nilai sedia ada tidak ditindih kecuali kunci server.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("\nGuna: npm run env:setup -- /laluan/ke/fail-service-account.json\n");
  process.exit(1);
}
const path = resolve(file.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
if (!existsSync(path)) {
  console.error(`\n[env] Fail tidak dijumpai: ${path}\n`);
  process.exit(1);
}

let sa: { project_id?: string; client_email?: string; private_key?: string; type?: string };
try {
  sa = JSON.parse(readFileSync(path, "utf8"));
} catch {
  console.error("\n[env] Fail itu bukan JSON yang sah.\n");
  process.exit(1);
}
if (sa.type !== "service_account" || !sa.project_id || !sa.client_email || !sa.private_key) {
  console.error("\n[env] Ini bukan fail service account Firebase. Muat turun dari Project settings > Service accounts > Generate new private key.\n");
  process.exit(1);
}

const target = resolve(".env.local");
const source = existsSync(target) ? readFileSync(target, "utf8") : existsSync(".env.example") ? readFileSync(".env.example", "utf8") : "";
const lines = source.split("\n");
const get = (k: string) => {
  const l = lines.find((x) => x.startsWith(`${k}=`));
  return l ? l.slice(k.length + 1).replace(/^"|"$/g, "") : "";
};
const set = (k: string, v: string, overwrite: boolean) => {
  if (!overwrite && get(k)) return;
  const line = `${k}=${v}`;
  const i = lines.findIndex((x) => x.startsWith(`${k}=`));
  if (i >= 0) lines[i] = line;
  else lines.push(line);
};

const pid = sa.project_id;
set("FIREBASE_PROJECT_ID", pid, true);
set("FIREBASE_CLIENT_EMAIL", sa.client_email, true);
set("FIREBASE_PRIVATE_KEY", `"${sa.private_key.replace(/\n/g, "\\n")}"`, true);
set("NEXT_PUBLIC_FIREBASE_PROJECT_ID", pid, false);
set("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", `${pid}.firebaseapp.com`, false);
set("FIREBASE_STORAGE_BUCKET", `${pid}.firebasestorage.app`, false);
set("CRON_SECRET", randomBytes(32).toString("hex"), false);

writeFileSync(target, lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n", { mode: 0o600 });
console.log(`\n[env] .env.local dikemas kini untuk projek "${pid}".`);

const missing = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_APP_ID"].filter((k) => !get(k));
if (missing.length) {
  console.log("\n[env] Masih perlu diisi sendiri (Firebase Console > Project settings > General > Your apps > Web app):");
  for (const k of missing) console.log(`       - ${k}`);
}
if (path.startsWith(resolve("."))) {
  console.log("\n[env] AMARAN: fail JSON berada dalam folder projek. Pindahkan ke luar folder ini supaya tidak termasuk dalam GitHub.");
}
console.log("\n[env] Seterusnya: npm run check:setup\n");
