# Panduan: Sambung Firebase, GitHub dan Vercel

Ikut urutan. Setiap bahagian ada semakan "Pastikan" sebelum ke langkah seterusnya.
Anggaran masa: 45 hingga 60 minit kali pertama.

| Bahagian | Hasil |
|---|---|
| A. Firebase | Projek Firebase dengan Auth, Firestore dan Storage |
| B. Localhost | Sistem berjalan di komputer anda dengan data sebenar |
| C. GitHub | Kod disimpan dalam repo peribadi |
| D. Vercel | Sistem online di internet, deploy automatik setiap kali push |
| E. Kemas kini | Cara hantar perubahan selepas ini |
| F. Keselamatan | Senarai semak wajib |
| G. Masalah biasa | Punca dan penyelesaian |
| H. Kos | Apa yang percuma, apa yang berbayar |

---

## Sebelum mula

Pastikan ada:

- Akaun **Google** (untuk Firebase), **GitHub** dan **Vercel** (daftar Vercel guna akaun GitHub).
- **Node.js 22** (`node -v` dalam terminal). Muat turun di https://nodejs.org jika belum.
- **Git** (`git --version`). Di Mac, jika belum ada, terminal akan tawar pasang.
- Projek `iya-marketing` sudah dibuka dalam VS Code dan `npm install` sudah dijalankan.

---

## A. Firebase

### A1. Cipta projek

1. Buka https://console.firebase.google.com dan klik **Create a project**.
2. Nama: contoh `iya-marketing`. Google Analytics: boleh matikan.
3. Tunggu sehingga siap, kemudian **Continue**.

### A2. Tukar ke pelan Blaze (untuk simpan fail)

Storage (resit, invois, gambar idea, asset) memerlukan pelan **Blaze**.

1. Kiri bawah: **Spark** > **Upgrade** > pilih **Blaze** > daftar kad.
2. Terus set had perbelanjaan: **Set budget alert** (contoh RM 20). Anda akan dapat email jika menghampiri had.

Tanpa Blaze, semua fungsi lain tetap berjalan; hanya muat naik fail akan gagal.

### A3. Authentication

1. Menu kiri: **Build > Authentication > Get started**.
2. Tab **Sign-in method** > **Email/Password** > Enable > Save.
3. Tab **Settings** > **User actions** > **nyahtanda "Enable create (sign-up)"** > Save.
   Ini menghalang orang luar cipta akaun sendiri. Akaun hanya dicipta oleh Admin dalam sistem.

### A4. Firestore Database

1. **Build > Firestore Database > Create database**.
2. Edisi **Standard**. Lokasi: **asia-southeast1 (Singapore)**.
   Lokasi **tidak boleh ditukar** selepas ini.
3. Pilih **Start in production mode** > Create.

### A5. Storage

1. **Build > Storage > Get started**.
2. Lokasi sama: **asia-southeast1**. Pilih **production mode** > Done.
3. Salin nama bucket di bahagian atas, contoh `gs://iya-marketing.firebasestorage.app`.
   Anda perlukan bahagian **selepas** `gs://` sahaja.

### A6. Web app (untuk log masuk)

1. Ikon gear > **Project settings** > tab **General**.
2. Bahagian **Your apps** > ikon **`</>`** (Web).
3. Nama: `iya-web`. **Jangan** tanda Firebase Hosting. Klik Register app.
4. Paparan `firebaseConfig` akan keluar. Salin dua nilai ini ke tempat sementara:
   - `apiKey` (bermula `AIza...`)
   - `appId` (bentuk `1:123456:web:abc...`)

### A7. Service account (kunci server)

1. **Project settings** > tab **Service accounts** > **Generate new private key** > Generate key.
2. Fail JSON dimuat turun, contoh `iya-marketing-firebase-adminsdk-xxxxx.json`.
3. **Simpan di luar folder projek** (contoh folder `Documents/kunci/`).
   Fail ini ialah kunci penuh ke database anda. Jangan hantar di WhatsApp, emel, atau GitHub.

**Pastikan:** Authentication (Email/Password) hidup, Firestore dan Storage di asia-southeast1, dan anda ada `apiKey`, `appId` serta fail JSON.

---

## B. Sambung di localhost

Semua arahan dijalankan dalam terminal VS Code, dalam folder `iya-marketing`.

### B1. Isi `.env.local` secara automatik

```bash
npm run env:setup -- ~/Documents/kunci/iya-marketing-firebase-adminsdk-xxxxx.json
```

Tukar laluan ikut tempat fail JSON anda. Skrip ini mengisi kunci server dengan format yang betul,
menjana `CRON_SECRET`, dan mengisi nilai lalai project ID, auth domain dan storage bucket.

### B2. Isi dua nilai web app

Buka `.env.local` dalam VS Code dan isi:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...        (dari langkah A6)
NEXT_PUBLIC_FIREBASE_APP_ID=1:...:web:...    (dari langkah A6)
```

Semak juga `FIREBASE_STORAGE_BUCKET` sama dengan nama bucket di langkah A5 (tanpa `gs://`). Simpan (Cmd + S).

### B3. Deploy rules keselamatan dan index database

```bash
npm i -g firebase-tools
firebase login
firebase use --add
```

`firebase use --add`: pilih projek anda, kemudian untuk alias taip `default`.

```bash
npm run firebase:deploy
```

Ini memasang peraturan "browser tidak boleh akses database terus" dan index yang diperlukan.
Index mengambil **2 hingga 10 minit** untuk siap dibina. Semak di Firestore > Indexes (status "Enabled").

### B4. Semak sambungan

```bash
npm run check:setup
```

Semua baris mesti **OK**. Setiap GAGAL disertakan cara membetulkannya.
Amaran "Belum ada team / Admin" adalah normal pada kali pertama.

### B5. Cipta team dan Admin pertama

```bash
npm run seed -- --email emel@anda.com --name "Faiz" --password "KataLaluanKuat123"
```

Ini mencipta Team A hingga D dan akaun Admin. Jalankan semula `npm run check:setup`: semua sepatutnya OK.

### B6. Jalankan dan uji

```bash
npm run dev
```

Buka http://localhost:3000 dan log masuk dengan emel dan kata laluan di B5.

Perhatikan: **tiada bar kuning "Mod Demo"**. Ini data sebenar dari Firebase.

### B7. Tetapan awal (dalam sistem, sebagai Admin)

1. **Admin > Tetapan > Senarai pilihan:** semak jenis campaign, platform, kategori perbelanjaan, niche KOL.
2. **Tetapan > Katalog Item:** masukkan produk, menu dan servis, termasuk **nilai kos**.
3. **Tetapan > Outlet:** masukkan kedai dan cawangan.
4. **Pengguna & Team > Team:** tukar nama team jika perlu (contoh "Team Shopee").
5. **Pengguna & Team > Pengguna:** cipta akaun ahli, dan pilih team masing-masing.
6. **Budget > Ringkasan tahunan > pilih team > Isi bajet beberapa bulan.**
7. **Sistem > Log Sistem > Semak kesihatan sistem:** semua `ok: true`.

**Pastikan:** anda boleh log masuk, cipta campaign, muat naik resit (Budget > Perbelanjaan), dan data muncul di Firebase Console > Firestore.

---

## C. GitHub

### C1. Semak fail rahsia tidak ikut

```bash
git init
git status
```

Dalam senarai, **tidak boleh ada** `.env.local` atau fail `...firebase-adminsdk...json`.
Kedua-duanya sudah disekat oleh `.gitignore`. Jika masih nampak, berhenti dan semak semula.

### C2. Hantar ke GitHub (cara paling mudah: VS Code)

1. VS Code, ikon **Source Control** (kiri) > tulis mesej `Versi pertama` > **Commit** (pilih "Yes" jika ditanya stage semua).
2. Klik **Publish Branch** / **Publish to GitHub**.
3. Log masuk GitHub jika diminta. Pilih **Publish to GitHub private repository**.
4. Siap. Buka repo di GitHub untuk semak.

### C2 (alternatif). Melalui terminal

Cipta repo kosong di https://github.com/new (pilih **Private**, jangan tambah README), kemudian:

```bash
git add .
git commit -m "Versi pertama"
git branch -M main
git remote add origin https://github.com/NAMA-ANDA/iya-marketing.git
git push -u origin main
```

### C3. Semak

- Di GitHub, tab **Code**: tiada `.env.local`.
- Tab **Actions**: aliran **CI** berjalan (TypeScript, ujian, build). Tanda hijau bermakna lulus.

---

## D. Vercel

### D1. Import projek

1. https://vercel.com > **Add New... > Project**.
2. Pilih repo `iya-marketing` > **Import**. (Kali pertama, beri Vercel akses ke repo itu.)
3. Framework: **Next.js** (dikesan sendiri). Jangan ubah Build/Output settings.

### D2. Masukkan Environment Variables

Dalam bahagian **Environment Variables** sebelum deploy:

1. Buka `.env.local` dalam VS Code, pilih semua (Cmd + A), salin.
2. Tampal ke ruang **Key** yang pertama. Vercel akan pecahkan kepada 9 pemboleh ubah secara automatik.
3. Semak senarai mengandungi:
   `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`, `CRON_SECRET`.

**Jangan** tambah `DEMO_MODE`. Mod Demo memang tidak boleh aktif di Vercel.

### D3. Deploy

Klik **Deploy**. Tunggu 1 hingga 3 minit. Bila siap, klik pautan projek (contoh `iya-marketing.vercel.app`).

### D4. Semak selepas deploy

1. Log masuk dengan akaun Admin yang sama (database sama dengan localhost).
2. **Sistem > Log Sistem > Semak kesihatan sistem:** `ok: true`, `region: sin1`, dan `commit` menunjukkan kod commit.
3. Vercel > projek > **Settings > Cron Jobs:** ada `/api/cron/campaign-status` (setiap hari 00:05 waktu Malaysia).
4. Firebase Console > **Authentication > Settings > Authorized domains** > Add domain > masukkan domain Vercel anda (disyorkan).

### D5. Domain sendiri (pilihan)

1. Vercel > **Settings > Domains** > masukkan domain (contoh `marketing.domainanda.com`).
2. Ikut arahan DNS yang dipaparkan (biasanya satu rekod CNAME di tempat domain dibeli).
3. Tambah domain yang sama di Firebase > Authentication > Authorized domains.

**Pastikan:** sistem boleh dibuka dari telefon melalui pautan Vercel, dan log masuk berjaya.

---

## E. Kemas kini selepas ini

### Setiap kali kod berubah

1. Uji di localhost (`npm run dev`).
2. Jalankan `npm run check` (TypeScript + ujian).
3. VS Code > Source Control > Commit > **Sync / Push**.
4. Vercel deploy sendiri dalam 1 hingga 3 minit. Status di Vercel > **Deployments**.

Jika deploy baru bermasalah: Vercel > Deployments > pilih deploy yang sebelum ini > **...** > **Promote to Production**. Sistem kembali ke versi lama dalam beberapa saat.

### Bila `firestore.rules`, `storage.rules` atau `firestore.indexes.json` berubah

```bash
npm run firebase:deploy
```

### Bila menukar env (contoh kunci baru)

Kemas kini di `.env.local` **dan** Vercel > Settings > Environment Variables, kemudian Vercel > Deployments > deploy terkini > **Redeploy**.
Nilai `NEXT_PUBLIC_*` hanya berkesan selepas redeploy.

---

## F. Senarai semak keselamatan

- [ ] Repo GitHub **Private**.
- [ ] `.env.local` dan fail JSON service account **tiada** dalam GitHub.
- [ ] Fail JSON service account disimpan di luar folder projek, dan tidak dikongsi.
- [ ] Authentication > "Enable create (sign-up)" **dimatikan**.
- [ ] `npm run firebase:deploy` sudah dijalankan (browser tidak boleh akses database terus).
- [ ] Budget alert Google Cloud sudah diset.
- [ ] Pengesahan 2 langkah (2FA) dihidupkan pada akaun Google, GitHub dan Vercel.
- [ ] Kata laluan Admin kuat, dan tidak dikongsi. Setiap ahli ada akaun sendiri.

**Jika kunci service account terbocor:** Firebase > Project settings > Service accounts > Manage service account permissions > padam kunci lama > jana kunci baru > `npm run env:setup` semula > kemas kini `FIREBASE_PRIVATE_KEY` di Vercel > Redeploy.

---

## G. Masalah biasa

| Gejala | Punca | Penyelesaian |
|---|---|---|
| `check:setup`: private key GAGAL | Format kunci rosak semasa salin | `npm run env:setup -- /laluan/fail.json` semula |
| `check:setup`: Firestore GAGAL "NOT_FOUND" | Database belum dicipta | Langkah A4 |
| `check:setup`: Storage bucket tidak wujud | Storage belum diaktifkan atau nama salah | Langkah A5, semak `FIREBASE_STORAGE_BUCKET` |
| Log masuk: "Email atau kata laluan salah" | Akaun belum wujud | `npm run seed` (Admin) atau cipta di Admin > Pengguna |
| Log masuk: "Akaun ini belum didaftarkan dalam sistem" | Ada di Authentication tapi tiada profil | Cipta semula melalui Admin > Pengguna, atau `npm run seed` untuk Admin |
| Halaman gagal, log sebut `requires an index` | Index belum siap | `npm run firebase:deploy`, tunggu 10 minit |
| Vercel: halaman log masuk "Tetapan server belum lengkap" | Env tiada di Vercel | Langkah D2, kemudian Redeploy. Vercel > Logs sebut nama env yang tiada |
| Vercel: "NEXT_PUBLIC_FIREBASE_* belum diisi" | Env client ditambah selepas deploy | Redeploy |
| Muat naik fail gagal | Pelan Spark, atau bucket salah | Langkah A2 dan A5 |
| Cron tidak jalan | `CRON_SECRET` tiada di Vercel | Tambah dan Redeploy. Uji manual di Log Sistem |
| GitHub Actions merah | Ralat TypeScript/ujian/build | Klik tanda merah untuk lihat baris ralat, betulkan, push semula |

Setiap ralat dalam sistem memaparkan **kod rujukan**. Cari kod itu di **Sistem > Log Sistem** atau Vercel > projek > **Logs**.

---

## H. Kos

| Perkhidmatan | Anggaran untuk 5 hingga 10 pengguna |
|---|---|
| Firebase Authentication | Percuma (email/password) |
| Firestore | Biasanya dalam kuota percuma harian (50,000 bacaan, 20,000 tulisan) |
| Storage | Lokasi Singapura tiada kuota percuma. Untuk resit dan gambar, biasanya beberapa sen sebulan. Budget alert melindungi anda |
| Vercel **Hobby** | Percuma, tetapi syarat Vercel: untuk kegunaan peribadi / bukan komersial |
| Vercel **Pro** | Berbayar setiap ahli. Diperlukan untuk kegunaan perniagaan mengikut syarat Vercel |
| GitHub (repo peribadi) | Percuma |

Harga boleh berubah; semak halaman harga Firebase dan Vercel sebelum guna untuk syarikat.
