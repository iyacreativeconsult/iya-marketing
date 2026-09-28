# iya Creative: Marketing Management System

Modul siap:

- **Fasa 1:** log masuk, pengguna dan team, Sesi Aktif, Marketing Calendar, Campaign dengan kelulusan, Dashboard, audit log, Log Sistem.
- **Fasa 2, Budget:** bajet bulanan setiap team, rekod perbelanjaan dengan resit, semakan Admin, Bajet / Digunakan / Komited / Baki. Team hanya nampak team sendiri.
- **Fasa 3, KOL:** database KOL dengan pautan media sosial, KOL dalam campaign, checklist posting, URL posting, bayaran KOL yang masuk automatik ke bajet.
- **Fasa 4, Tetapan:** Katalog Item (Produk, Menu F&B, Servis dengan nilai kos), Outlet, dan senarai yang boleh diubah Admin: jenis campaign, platform, kategori perbelanjaan, kaedah bayaran, niche KOL, kategori item, jenis outlet.
- **Fasa 5, kerjasama fleksibel:** campaign berbilang item dan outlet; 8 jenis kerjasama KOL (dine-in, seeding ke rumah, paid post, barter, affiliate, live/event, ambassador, whitelisting); barang/makanan diberi (in-kind) dengan nilai automatik; kos kerjasama penuh; bajet ikut saluran; kos sebenar setiap campaign.

- **Bajet ikut person:** setiap person dalam team ada bajet bulanan sendiri (asas + carry forward + tambahan diluluskan). Bajet team = jumlah semua person. Tiada rentas bajet. Person mohon tambahan, Admin lulus. Carry forward dikawal Admin. Person hanya nampak bajet sendiri.

- **Idea Hub:** kongsi idea, komen, vote (Terbaru / Popular). Admin lulus atau tolak. Idea diluluskan boleh dimasukkan ke Content Bank atau dijadikan draf campaign.
- **Content Bank:** hook, huraian, jenis content (UGC, EGC, Testimonial...), funnel, audience, produk, platform, rujukan. Tapis ikut semua medan.

- **Content (Fasa 5):**
  - **Produksi:** papan kanban Idea → Script → Production → Editing → Review → Approved → Scheduled → Published → Arkib. Admin luluskan atau minta revisi. Publish perlukan URL posting.
  - **Guna idea ini:** dari Content Bank terus jadi content (kiraan diguna +1, idea asal jadi "Dalam produksi", kemudian "Published" bila content published).
  - **Content Calendar:** tarikh publish content dan posting KOL dalam satu calendar.
  - **Content Library:** fail (gambar/PDF) atau pautan (Google Drive, TikTok, Canva), hak guna (milik sendiri, KOL organik, KOL boleh iklan, berlesen), tarikh tamat hak guna dengan amaran 14 hari.

- **Reports (Fasa 6):**
  - **Isi prestasi** pada hari ke-1, ke-7 dan ke-30 selepas posting, terus dalam halaman content dan halaman KOL (views, likes, komen, share, save, klik, order, jualan).
  - **Ringkasan:** views, engagement dan ER, kos dan CPM (Admin), jualan dan ROAS, content terbaik, KOL paling berbaloi, ikut platform, perbelanjaan ikut saluran.
  - **Laporan Campaign, KOL (ranking CPM/CPE/ROAS) dan Content (ikut jenis content)**, untuk bulan, suku tahun atau tahun, dengan **muat turun CSV** untuk Excel / Google Sheets.
  - **Prestasi belum diisi:** senarai posting yang sudah tiba titik semakan.
  - Kos hanya dipaparkan kepada Admin; ahli nampak kos KOL di mana dia PIC sahaja.

Belum dibina: modul Ads (akaun iklan, import CSV Ads Manager), senarai vendor (akaun, kempen, import CSV prestasi), senarai vendor, dan laporan (Fasa 6 dan 7).

Stack: Next.js 16, React 19, TypeScript 5.9, Tailwind v4, Firebase (Auth + Firestore), deploy di Vercel.

---

## Mula guna: urutan untuk Admin

1. **Tetapan > Senarai pilihan**: semak jenis campaign, platform, kategori perbelanjaan dan niche. Tambah atau buang ikut keperluan.
2. **Tetapan > Katalog Item**: masukkan produk, menu dan servis, termasuk **nilai kos** (untuk kira nilai barang diberi kepada KOL).
3. **Tetapan > Outlet**: masukkan kedai / cawangan.
4. **Team** dan **Pengguna**: cipta akaun ahli team.
5. **Budget > Ringkasan tahunan > pilih team > Isi bajet beberapa bulan**: contoh RM 5,000 seorang, Oktober hingga Disember, untuk semua person sekali gus.
6. **Carry forward** (jika mahu): klik petak bulan > butang "Guna baki bulan lepas" pada person itu > Simpan.
7. **Budget > Permohonan tambahan**: lulus atau tolak permohonan person.

Struktur menu Budget:
- **Ringkasan tahunan**: 12 bulan dalam satu halaman. Person nampak kad bulan sendiri; Admin nampak jadual team x bulan atau person x bulan. Klik bulan untuk butiran.
- **Perbelanjaan**: senarai, catat, semak dan sahkan perbelanjaan ikut bulan, team, person dan status.
- **Permohonan tambahan**: mohon (person) dan lulus/tolak (Admin), dengan sejarah.

**Admin dan team:** Admin nampak semua team tanpa perlu jadi ahli. Tambah Admin ke sesuatu team hanya jika Admin juga ada bajet sendiri dalam team itu.

Membuang pilihan dari senarai tidak menjejaskan rekod lama yang sudah menggunakannya.

> **Sambung Firebase dan deploy:** ikut [PANDUAN-DEPLOY.md](PANDUAN-DEPLOY.md) (dengan komputer), atau [PANDUAN-TANPA-PC.md](PANDUAN-TANPA-PC.md) (browser sahaja: Firebase Console, GitHub web, Vercel).

## 0. Cuba dulu tanpa Firebase (Mod Demo)

Tak perlu Firebase, tak perlu `.env.local`, tak perlu log masuk.

```bash
npm install
npm run demo
```

Buka http://localhost:3000. Sistem terus masuk sebagai Admin dengan data contoh (4 team, 8 campaign).

- Bar kuning di atas: **Guna sebagai** untuk tukar pengguna dan uji kebenaran.
  - Aisyah (Admin): semua akses, boleh lulus campaign.
  - Ali (Team A): ahli satu team.
  - Siti (Team B dan C): ahli dua team, boleh tukar Sesi Aktif.
- Semua fungsi boleh dicuba: cipta, ubah, hantar, lulus, batal, padam, pengguna, team dan Log Sistem.
- Data disimpan dalam memori sahaja dan **hilang bila server dihentikan** (Ctrl + C).
- Mod Demo tidak boleh aktif di Vercel atau `npm start`, walaupun `DEMO_MODE` diset.

Bila sedia guna data sebenar, ikut bahagian 1 dan 2 di bawah, kemudian guna `npm run dev`.

## 1. Sediakan Firebase (sekali sahaja)

1. Buka https://console.firebase.google.com dan klik **Add project**.
2. **Build > Authentication > Get started**, kemudian hidupkan **Email/Password**.
3. **Authentication > Settings > User actions**: nyahtanda **Enable create (sign-up)**.
   Ini menghalang orang luar cipta akaun sendiri. Akaun hanya dicipta oleh Admin dalam sistem.
4. **Build > Firestore Database > Create database**.
   Pilih **Production mode** dan lokasi **asia-southeast1 (Singapore)**.
5. **Project settings > General > Your apps > Web (`</>`)**, daftar app.
   Salin `apiKey`, `authDomain`, `projectId` dan `appId`.
6. **Project settings > Service accounts > Generate new private key**.
   Fail JSON dimuat turun. Jangan kongsi dan jangan commit fail ini.
7. **Build > Storage > Get started** (untuk resit, invois dan bukti bayaran).
   Projek baru perlukan pelan **Blaze** untuk Storage. Penggunaan kecil masih dalam kuota percuma, tetapi kad perlu didaftarkan.
   Salin nama bucket (contoh `nama-projek.firebasestorage.app`) ke `FIREBASE_STORAGE_BUCKET`.
   Tanpa ini, semua fungsi lain berjalan; hanya muat naik fail akan gagal dengan mesej yang jelas.
8. Pasang Firebase CLI, kemudian deploy rules dan index dari folder projek:

   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # pilih projek Firebase tadi
   firebase deploy --only firestore,storage
   ```

   Index Firestore ambil beberapa minit untuk siap dibina.

## 2. Jalankan di localhost (VS Code)

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

Isi `.env.local`:

| Env | Dari mana |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Langkah 5 |
| `FIREBASE_PROJECT_ID` | `project_id` dalam fail JSON |
| `FIREBASE_CLIENT_EMAIL` | `client_email` dalam fail JSON |
| `FIREBASE_PRIVATE_KEY` | `private_key` dalam fail JSON. Tampal dalam tanda petik, dengan `\n` kekal. |
| `CRON_SECRET` | Rentetan rawak 32+ aksara, contoh `openssl rand -hex 32` |
| `FIREBASE_STORAGE_BUCKET` | Langkah 7 |

Cipta Team A hingga D dan akaun Admin pertama:

```bash
npm run seed -- --email emailanda@contoh.com --name "Nama Anda" --password "KataLaluan123"
```

Mulakan server:

```bash
npm run dev
```

Buka http://localhost:3000 dan log masuk.

Selepas ini, semua pengguna lain dicipta dari **Admin > Pengguna**.

## 3. Deploy ke Vercel

1. Push projek ke GitHub. Pastikan `.env.local` tidak ikut; `.gitignore` sudah menyekatnya.
2. Di Vercel: **Add New > Project**, import repo.
3. **Settings > Environment Variables**: masukkan semua env dari `.env.local` untuk Production dan Preview.
4. Klik **Deploy**.

Selepas deploy:

- **Cron**: `vercel.json` menjadualkan kemas kini status campaign setiap hari jam 00:05 waktu Malaysia. Vercel menghantar `CRON_SECRET` secara automatik. Semak di **Settings > Cron Jobs**.
- **Region**: server berjalan di Singapore (`sin1`), dekat dengan Firestore, supaya lebih laju.
- **Domain sendiri**: tambah di Vercel > Domains. Kemudian tambah domain yang sama di Firebase > Authentication > Settings > Authorized domains.

Setiap kali push ke GitHub, Vercel deploy semula secara automatik.

## 4. Arahan berguna

| Arahan | Fungsi |
|---|---|
| `npm run demo` | Mod Demo: tanpa Firebase dan log masuk, data contoh dalam memori |
| `npm run dev` | Server localhost dengan Firebase sebenar |
| `npm run check` | Semakan TypeScript + ujian. Jalankan sebelum push. |
| `npm test` | Ujian peraturan campaign, bajet, KOL, bayaran, tarikh, wang dan sesi |
| `npm run build` | Build production (sama seperti Vercel) |
| `npm run seed -- ...` | Cipta team awal dan Admin |
| `npm run env:setup -- fail.json` | Isi `.env.local` dari fail service account |
| `npm run check:setup` | Semak sambungan Firebase (env, Firestore, Auth, Storage, Admin) |
| `npm run firebase:deploy` | Pasang rules keselamatan dan index Firestore |

**Debug dalam VS Code**: tab Run and Debug, pilih **Debug server (API & halaman)**. Letak breakpoint dalam mana-mana fail di `src/lib/server/` atau `src/app/api/`.

---

## 5. Troubleshooting

### Cara guna kod rujukan

Setiap ralat di skrin menunjukkan **Kod rujukan** (12 aksara, contoh `a1b2c3d4e5f6`).

1. Minta pengguna beri kod itu.
2. Buka **Admin > Log Sistem**, tampal kod dalam carian.
   - Tab **Audit** tunjuk apa yang berjaya disimpan dalam permintaan itu.
   - Tab **Ralat server** tunjuk ralat 500 dengan mesej dan stack penuh.
3. Jika tiada dalam Log Sistem, cari kod yang sama di terminal (localhost) atau **Vercel > Logs**.

Setiap permintaan API dilog sebagai satu baris JSON dengan `requestId`, `route`, `status`, `ms` dan `userId`.

Halaman yang gagal dimuat pula menunjukkan kod `digest`. Cari kod itu di terminal atau Vercel Logs.

**Semak kesihatan sistem** (Admin > Log Sistem) menunjukkan env yang tiada, sambungan Firestore, tarikh semasa waktu Malaysia dan versi deploy.

### Masalah biasa

| Gejala | Punca | Penyelesaian |
|---|---|---|
| Login papar "Tetapan server belum lengkap" | Env server tiada atau salah | Terminal atau Vercel Logs menyebut nama env yang tepat (`Env tidak lengkap -> ...`) |
| "NEXT_PUBLIC_FIREBASE_* belum diisi" | Env client tiada | Isi `.env.local`, kemudian **restart** `npm run dev`. Di Vercel, deploy semula. |
| "Failed to parse private key" | Format `FIREBASE_PRIVATE_KEY` salah | Tampal nilai penuh dalam tanda petik, termasuk `-----BEGIN` dan `\n` |
| "Akaun ini belum didaftarkan dalam sistem" | Ada akaun Auth tetapi tiada profil `users` | Cipta melalui Admin > Pengguna, atau jalankan `npm run seed` |
| Halaman gagal, log sebut `FAILED_PRECONDITION` / `requires an index` | Index Firestore belum dibuat | `firebase deploy --only firestore`, tunggu 2 hingga 5 minit |
| "Rekod ini telah diubah oleh orang lain" | Dua orang ubah rekod yang sama | Muat semula halaman dan buat semula perubahan |
| Campaign tidak jadi Ongoing | Status mesti **Scheduled** dahulu, atau cron belum jalan | Tandakan Scheduled. Untuk uji segera, klik "Jalankan kemas kini status campaign" di Log Sistem. |
| Terkeluar sendiri | Sesi tamat (5 hari), log keluar di peranti lain, atau Admin tukar kata laluan / nyahaktif akaun | Log masuk semula |
| Log masuk berjaya tapi terus kembali ke /login di `npm start` (http) | Cookie `secure` tidak dihantar melalui http dalam sesetengah browser | Guna `npm run dev` untuk localhost |
| Muat naik fail papar "Storan fail belum diset" | `FIREBASE_STORAGE_BUCKET` tiada | Ikut langkah 7, isi env, restart server |
| Muat naik ditolak "Jenis fail tidak dibenarkan" | Fail bukan JPG/PNG/WEBP/PDF sebenar (contoh HEIC dari iPhone) | Tukar ke JPG. Di iPhone: Settings > Camera > Formats > Most Compatible |
| Butang Sahkan perbelanjaan gagal "Resit belum dimuat naik" | Admin hanya boleh sahkan perbelanjaan yang ada resit | Minta team ubah rekod dan lampirkan resit |
| "Pilih PIC dari ahli team" | Admin tambah KOL tanpa pilih PIC, atau team tiada ahli | Pilih PIC (fee KOL ditolak dari bajet person itu) |
| Perbelanjaan ditanda merah "melebihi baki" | Jumlah melebihi baki boleh guna person itu | Person mohon tambahan bajet, atau Admin semak dan sahkan |
| Person tidak nampak bajet | Admin belum tetapkan bajet person untuk bulan itu | Budget > team > isi Asas > Simpan |
| Fee KOL tidak boleh diubah | Fee dikunci selepas Confirmed untuk ahli team | Admin boleh ubah |
| "Permintaan ditolak (cross-site)" | Permintaan datang dari domain lain | Pastikan halaman dan API dibuka dari domain yang sama |

---

## 6. Keselamatan

- **Browser tidak boleh akses Firestore secara terus.** `firestore.rules` tolak semua. Semua data melalui API server yang semak peranan dan team.
- **Sesi**: cookie `httpOnly`, `secure`, `sameSite=strict`. Disahkan dengan Firebase setiap permintaan, termasuk semakan token yang dibatalkan. Profil dibaca terus dari Firestore, jadi nyahaktif akaun berkuat kuasa serta-merta.
- **Token Firebase** disimpan dalam memori sahaja semasa log masuk, kemudian dibuang.
- **Log keluar** membatalkan semua sesi pengguna itu di semua peranti.
- **CSRF**: permintaan POST/PATCH/DELETE mesti datang dari origin yang sama.
- **Header**: CSP dengan nonce, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- **Input**: semua disahkan dengan zod di server (`src/lib/validation.ts`), dengan had saiz badan permintaan.
- **Konflik serentak**: setiap rekod ada `version`; perubahan ditolak jika rekod sudah diubah orang lain.
- **Audit**: setiap perubahan ditulis dalam transaksi yang sama dengan datanya.
- **Padam lembut**: rekod ditanda `deleted`, tidak dibuang. Boleh dipulihkan di Firestore.
- **Admin tidak boleh kunci diri sendiri**: tidak boleh buang peranan Admin atau nyahaktif akaun sendiri.
- **Cron** dilindungi `CRON_SECRET` dengan perbandingan masa-tetap.
- **Kewangan diasingkan ikut person**: bajet, perbelanjaan, fee KOL (ikut PIC), bayaran dan fail hanya boleh dilihat oleh Admin dan person pemiliknya, termasuk daripada rakan se-team. Ahli tidak boleh rekod perbelanjaan atas bajet orang lain atau ubah bajet sendiri. Semua disemak di server setiap permintaan. Rekod team lain dipulangkan sebagai "tidak dijumpai", jadi kewujudannya pun tidak didedahkan. Fee KOL dalam senarai dikongsi disorok (`Disorok`) untuk team lain.
- **Fail**: jenis disahkan dengan membaca isi sebenar fail (bukan nama fail), maksimum 4 MB, disimpan dalam folder team, dan hanya boleh dibuka oleh Admin dan team pemilik.
- **Pautan media sosial dan URL posting** hanya menerima `http://` atau `https://`, supaya pautan berbahaya tidak boleh disimpan.
- **Maklumat bank KOL** disimpan dalam koleksi berasingan dan tidak pernah ditulis dalam audit log.
- **Alamat rumah KOL** (seeding), barang diberi dan kos kerjasama hanya dipaparkan kepada Admin dan team yang menguruskan KOL itu.
- **Bayaran KOL** hanya boleh ditanda Paid oleh Admin dengan bukti bayaran. Rekod perbelanjaan dicipta dalam transaksi yang sama, jadi bajet tidak boleh terlepas.

---

## 7. Struktur kod

```
src/
  proxy.ts                     Redirect ke /login + CSP nonce
  app/
    login/                     Halaman log masuk
    (app)/                     Semua halaman selepas log masuk
      page.tsx                 Dashboard
      calendar/                Marketing Calendar
      campaigns/               Senarai, tambah, butiran, ubah
      admin/                   Pengguna, Team, Log Sistem
    api/                       Semua endpoint (nipis; logik dalam lib/server)
  lib/
    config.ts                  Produk, zon masa, tempoh sesi: ubah di sini
    validation.ts              Semua schema input (zod)
    domain/                    Peraturan murni, tiada database (ada ujian)
      campaign.ts              SIAPA boleh buat APA dan status ke MANA
    server/
      api.ts                   Pembalut semua API: requestId, origin, sesi, ralat, log
      session.ts               Sesi dan Sesi Aktif
      audit.ts                 Audit log
      errors.ts                Kod ralat dan mesej
      services/                Akses database + semakan kebenaran
  components/                  UI
tests/                         Ujian (npm test)
scripts/seed.ts                Data awal
```

### Di mana nak cari bila ada masalah

| Soalan | Fail |
|---|---|
| Kenapa butang X tak keluar / status tak boleh tukar? | `src/lib/domain/campaign.ts`, `src/lib/domain/kol.ts` |
| Kenapa baki bajet begini? Siapa boleh lihat bajet? | `src/lib/domain/budget.ts` |
| Nilai awal senarai Tetapan | `src/lib/domain/master.ts` |
| "Tiada dalam senarai Tetapan" | Pilihan itu sudah dibuang di Tetapan. Tambah semula, atau pilih yang lain |
| Kenapa input ditolak? | `src/lib/validation.ts` |
| Kenapa pengguna tak boleh akses? | `src/lib/server/session.ts`, `src/lib/domain/session.ts` |
| Apa yang sebenarnya disimpan? | `src/lib/server/services/*.ts` |
| Mesej ralat | `src/lib/server/errors.ts` |

### Tambah modul baru (Fasa 2 dan seterusnya)

Ikut corak yang sama:

1. Peraturan dalam `lib/domain/`, dengan ujian dalam `tests/`.
2. Schema input dalam `lib/validation.ts`.
3. Service dalam `lib/server/services/`. Semak kebenaran di sini, guna transaksi, dan panggil `writeAudit`.
4. Route dalam `app/api/` guna `userRoute` atau `adminRoute`.
5. Halaman dalam `app/(app)/`. Buka menu dengan menambah `href` pada item dalam `components/AppShell.tsx`.
6. Tambah index baru dalam `firestore.indexes.json` jika query perlukannya.
