/**
 * Sediakan data awal: Team A-D dan akaun Admin pertama.
 *
 *   npm run seed -- --email admin@contoh.com --name "Nama Admin" --password "KataLaluan123"
 *
 * Selamat dijalankan lebih dari sekali: team yang wujud tidak ditindih,
 * dan akaun Admin yang wujud hanya dikemas kini.
 */
import { parseArgs } from "node:util";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, password: { type: "string" } },
});

function need(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`\n[seed] ${key} tiada dalam .env.local\n`);
    process.exit(1);
  }
  return v;
}

if (!values.email || !values.name) {
  console.error('\nGuna: npm run seed -- --email admin@contoh.com --name "Nama Admin" --password "KataLaluan123"\n');
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: need("FIREBASE_PROJECT_ID"),
    clientEmail: need("FIREBASE_CLIENT_EMAIL"),
    privateKey: need("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();
const auth = getAuth();

const TEAMS = [
  { id: "team-a", name: "Team A", color: "#EC5A7E" },
  { id: "team-b", name: "Team B", color: "#8B5CF6" },
  { id: "team-c", name: "Team C", color: "#10B981" },
  { id: "team-d", name: "Team D", color: "#F59E0B" },
];

async function main() {
  for (const t of TEAMS) {
    const ref = db.collection("teams").doc(t.id);
    if ((await ref.get()).exists) {
      console.log(`[seed] ${t.name} sudah wujud, dilangkau`);
      continue;
    }
    await ref.set({ name: t.name, color: t.color, createdAt: FieldValue.serverTimestamp(), createdBy: "seed" });
    console.log(`[seed] ${t.name} dicipta`);
  }

  const email = values.email!.trim().toLowerCase();
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    await auth.updateUser(uid, { displayName: values.name, disabled: false, ...(values.password ? { password: values.password } : {}) });
    console.log(`[seed] Akaun Auth ${email} sudah wujud, dikemas kini`);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
    if (!values.password || values.password.length < 10) {
      console.error("\n[seed] --password wajib (minimum 10 aksara) untuk akaun baru\n");
      process.exit(1);
    }
    uid = (await auth.createUser({ email, password: values.password, displayName: values.name })).uid;
    console.log(`[seed] Akaun Auth ${email} dicipta`);
  }

  await db.collection("users").doc(uid).set(
    {
      name: values.name,
      email,
      role: "admin",
      // Admin nampak semua team tanpa perlu jadi ahli. Tambah Admin ke team hanya jika dia juga ada bajet sendiri.
      teamIds: [],
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "seed",
    },
    { merge: true },
  );
  await db.collection("audit_logs").add({
    actorId: "system",
    actorName: "Seed script",
    action: "seed_admin",
    entity: "user",
    entityId: uid,
    teamId: null,
    from: null,
    to: null,
    note: email,
    changes: null,
    requestId: "seed",
    at: FieldValue.serverTimestamp(),
  });
  console.log(`\n[seed] Selesai. Log masuk dengan ${email}\n`);
}

main().catch((e) => {
  console.error("\n[seed] GAGAL:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});
