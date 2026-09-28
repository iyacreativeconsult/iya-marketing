# Deploy tanpa komputer: Firebase Console + GitHub web + Vercel

Semua langkah dibuat melalui **browser sahaja**. Tiada VS Code, terminal atau `npm` diperlukan.
Projek Firebase anda: **marketing-system-221fa**.

| Bahagian | Di mana |
|---|---|
| 1. Sediakan Firebase | Firebase Console |
| 2. Muat naik kod ke GitHub (3 kumpulan) | github.com |
| 3. Deploy ke Vercel | vercel.com |
| 4. Cipta Admin pertama | Firebase Console |
| 5. Log masuk dan tetapan awal | Sistem anda |
| 6. Kemas kini selepas ini | github.com |

---

## 1. Sediakan Firebase (https://console.firebase.google.com)

Pilih projek **marketing-system-221fa**, kemudian semak satu persatu:

### 1a. Pelan Blaze
Kiri bawah: jika tertulis **Spark**, klik **Upgrade > Blaze**, daftar kad, dan set **budget alert** (contoh RM 20).
Diperlukan untuk simpan fail (resit, gambar, asset).

### 1b. Authentication
1. **Build > Authentication > Get started**.
2. **Sign-in method > Email/Password > Enable > Save**.
3. **Settings > User actions** > nyahtanda **Enable create (sign-up)** > Save.

### 1c. Firestore Database
1. **Build > Firestore Database > Create database** > lokasi **asia-southeast1 (Singapore)** > **production mode**.
2. Tab **Rules**: padam semua, tampal kod di bawah, klik **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Ini bermaksud browser tidak boleh baca atau tulis database secara terus. Semua akses melalui server sistem, yang menyemak peranan dan team.

3. Tab **Indexes > Composite > Create index**. Cipta 5 index ini (Query scope: **Collection**):

| Collection ID | Medan 1 | Medan 2 |
|---|---|---|
| `campaigns` | `deleted` Ascending | `endDate` Ascending |
| `audit_logs` | `entityId` Ascending | `at` Descending |
| `audit_logs` | `requestId` Ascending | `at` Descending |
| `error_logs` | `requestId` Ascending | `at` Descending |
| `expenses` | `month` Ascending | `teamId` Ascending |

Status akan jadi **Building**, kemudian **Enabled** selepas beberapa minit.

### 1d. Storage
1. **Build > Storage > Get started** > lokasi **asia-southeast1** > production mode.
2. Tab **Rules**: tampal dan **Publish**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### 1e. Kunci server (service account)
1. Ikon gear > **Project settings > Service accounts > Generate new private key**.
2. Fail JSON dimuat turun. **Simpan di tempat selamat di luar komputer ini**, contoh Google Drive peribadi atau pengurus kata laluan, kerana PC akan direset.
   Fail ini ialah kunci penuh ke database. Jangan kongsi.

---

## 2. Muat naik kod ke GitHub

### 2a. Cipta repo
1. https://github.com/new
2. Repository name: `iya-marketing`. Pilih **Private**. **Jangan** tanda "Add a README".
3. Klik **Create repository**.
4. Di halaman repo kosong, klik pautan **uploading an existing file**.

### 2b. Tunjuk fail tersembunyi di Mac
Dalam Finder, tekan **Cmd + Shift + .** (titik). Fail seperti `.gitignore` dan folder `.github` akan kelihatan.
Tanpa langkah ini, fail penting itu tidak akan dimuat naik.

### 2c. Muat naik 3 kumpulan
GitHub hanya menerima **100 fail setiap kali**, jadi kod dipecahkan kepada 3 folder dalam `upload-github.zip`. Unzip dahulu.

Untuk **setiap** folder `1-akar`, `2-halaman`, `3-api`, ikut urutan:

1. Buka folder itu dalam Finder.
2. **Cmd + A** untuk pilih semua isi di dalamnya (bukan folder itu sendiri).
3. Seret ke kotak **"Drag files here"** di GitHub.
4. Tunggu sehingga semua fail selesai dimuat naik (bar biru hilang).
5. Di bawah, tulis mesej (contoh `Kumpulan 1`) dan klik **Commit changes**.
6. Untuk kumpulan seterusnya: di halaman repo, klik **Add file > Upload files**, dan ulang langkah 1 hingga 5.

### 2d. Semak
Di halaman utama repo, mesti nampak: `.github`, `scripts`, `src`, `tests`, `package.json`, `.gitignore`, `.nvmrc`, `vercel.json` dan lain-lain.
Buka `src/app` dan pastikan ada folder `(app)` dan `api`.

Tab **Actions** akan menjalankan semakan automatik (TypeScript, ujian, build). Tanda hijau bermakna kod lengkap.
Jika merah dengan ralat "Cannot find module", ada kumpulan yang belum dimuat naik sepenuhnya.

---

## 3. Deploy ke Vercel (https://vercel.com)

1. Daftar atau log masuk **dengan akaun GitHub**.
2. **Add New... > Project** > pilih repo `iya-marketing` > **Import**.
   (Kali pertama: klik "Adjust GitHub App Permissions" dan beri akses kepada repo ini.)
3. Framework Preset: **Next.js** (automatik). Jangan ubah tetapan lain.
4. Buka **Environment Variables** dan tambah 9 pemboleh ubah ini satu persatu (Key dan Value):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyAjMJq6Zo4n38A5cd3ZReOsGf6fBFddzIM` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `marketing-system-221fa.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `marketing-system-221fa` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:270215036184:web:92846445de00c4e20a726d` |
| `FIREBASE_STORAGE_BUCKET` | `marketing-system-221fa.firebasestorage.app` |
| `FIREBASE_PROJECT_ID` | `marketing-system-221fa` |
| `FIREBASE_CLIENT_EMAIL` | nilai `client_email` dalam fail JSON (1e) |
| `FIREBASE_PRIVATE_KEY` | nilai `private_key` dalam fail JSON (lihat cara di bawah) |
| `CRON_SECRET` | rentetan rawak **sekurang-kurangnya 32 aksara**, huruf dan nombor sahaja |

**Cara salin `private_key`:**
1. Buka fail JSON dengan TextEdit (klik kanan > Open With > TextEdit).
2. Cari `"private_key": "-----BEGIN PRIVATE KEY-----\n...`.
3. Salin **semua di antara tanda petik**, bermula `-----BEGIN PRIVATE KEY-----` dan berakhir `-----END PRIVATE KEY-----\n`.
4. Tampal sebagai Value. Jangan sertakan tanda petik di hujung. Biarkan `\n` seperti asal.

**Cara buat `CRON_SECRET`:** guna penjana kata laluan (contoh cadangan kata laluan kuat dari Safari atau pengurus kata laluan) dengan panjang 40 aksara, tanpa simbol.

5. Klik **Deploy**. Tunggu 1 hingga 3 minit sehingga keluar "Congratulations".
6. Klik **Continue to Dashboard** dan salin pautan sistem (contoh `iya-marketing.vercel.app`).

---

## 4. Cipta Admin pertama (Firebase Console)

Sistem hanya membenarkan akaun yang dicipta Admin. Admin pertama dicipta secara manual sekali sahaja.

### 4a. Akaun log masuk
1. **Authentication > Users > Add user**.
2. Masukkan emel anda dan kata laluan kuat (minimum 10 aksara, ada huruf dan nombor) > **Add user**.
3. Salin **User UID** baris itu (kod panjang seperti `Xy12Ab...`).

### 4b. Profil Admin
1. **Firestore Database > Data > Start collection**.
2. Collection ID: `users` > Next.
3. Document ID: **tampal User UID** dari 4a (jangan klik Auto-ID).
4. Tambah 5 medan ini. Ejaan mesti **tepat**, termasuk huruf kecil dan besar:

| Field | Type | Value |
|---|---|---|
| `name` | string | Faiz |
| `email` | string | emel yang sama di 4a |
| `role` | string | `admin` |
| `teamIds` | array | (biarkan kosong) |
| `active` | boolean | `true` |

5. Klik **Save**.

---

## 5. Log masuk dan tetapan awal

1. Buka pautan Vercel anda, dan log masuk dengan emel dan kata laluan di 4a.
2. **Admin > Sistem > Log Sistem > Semak kesihatan sistem**: mesti `ok: true` dan `region: sin1`.
3. **Admin > Pengguna & Team > Team**: tambah team (contoh Team A, Team B, Team C, Team D).
4. **Admin > Tetapan > Katalog Item**: masukkan produk, menu, servis dan nilai kos.
5. **Admin > Tetapan > Outlet**: masukkan kedai dan cawangan.
6. **Admin > Pengguna & Team > Pengguna**: cipta akaun ahli, dan pilih team masing-masing.
7. **Budget > Ringkasan tahunan** > pilih team > **Isi bajet beberapa bulan**.
8. Firebase > **Authentication > Settings > Authorized domains** > Add domain > tampal domain Vercel anda (disyorkan).

---

## 6. Kemas kini selepas ini (tanpa PC)

**Bila saya beri fail kemas kini (zip):**
1. Unzip, dan buka folder `iya-marketing` di dalamnya.
2. Di repo GitHub: **Add file > Upload files**.
3. Pilih semua isi folder (Cmd + A, dengan fail tersembunyi kelihatan), dan seret ke GitHub.
   Fail dengan laluan yang sama akan **diganti**; fail lain tidak terusik.
4. **Commit changes**. Vercel deploy sendiri dalam 1 hingga 3 minit.

**Ubah satu fail kecil:** buka fail di GitHub > ikon pensel > ubah > **Commit changes**.

**Jika deploy baru bermasalah:** Vercel > **Deployments** > pilih deploy sebelumnya yang berfungsi > **...** > **Promote to Production**.

---

## Masalah biasa

| Gejala | Penyelesaian |
|---|---|
| Halaman log masuk: "Tetapan server belum lengkap" | Env di Vercel tiada atau salah. Vercel > projek > **Logs** sebut nama env. Betulkan di Settings > Environment Variables, kemudian Deployments > **Redeploy** |
| "NEXT_PUBLIC_FIREBASE_* belum diisi" | Tambah env NEXT_PUBLIC di Vercel, kemudian **Redeploy** |
| "Email atau kata laluan salah" | Semak akaun di Authentication > Users |
| "Akaun ini belum didaftarkan dalam sistem" | Document ID di `users` tidak sama dengan User UID, atau medan salah eja (langkah 4b) |
| "Akaun ini tidak aktif" | Medan `active` mesti jenis **boolean** `true`, bukan string |
| Menu Admin tiada selepas log masuk | Medan `role` mesti tepat `admin` (huruf kecil) |
| Halaman gagal, Log Sistem sebut `requires an index` | Index di langkah 1c belum Enabled, atau ada yang tertinggal. Mesej ralat itu juga mengandungi pautan terus untuk mencipta index |
| Muat naik fail gagal | Pelan Blaze (1a) dan Storage (1d) belum siap, atau `FIREBASE_STORAGE_BUCKET` salah |
| GitHub Actions merah "Cannot find module" | Ada kumpulan fail belum dimuat naik. Ulang langkah 2c untuk kumpulan itu |
| Private key ditolak ("format private key salah") | Salin semula `private_key` penuh dari fail JSON (langkah 3) |

Setiap ralat dalam sistem ada **kod rujukan**. Cari kod itu di **Admin > Sistem > Log Sistem**, atau di Vercel > **Logs**.
