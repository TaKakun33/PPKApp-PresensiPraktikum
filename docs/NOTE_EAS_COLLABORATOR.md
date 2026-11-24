# Catatan Setup EAS Build (Mode Collaborator)

Panduan singkat konfigurasi **Expo Application Services (EAS)** untuk project `PPKApp-PresensiPraktikum` ketika menggunakan skema **invite collaborator** (masing-masing login memakai akun Expo sendiri, namun build ke satu project EAS yang sama).

---

## 1. Untuk Pemilik Project (Owner)

1. Buka dashboard Expo di https://expo.dev lalu pilih **Organization / Account** tempat project `PPKApp-PresensiPraktikum` berada (sesuai field `owner` di `app.json`).
2. Masuk ke menu **Access / Members** → **Invite Member** → masukkan email atau username Expo anggota tim.
3. Berikan role minimal **Developer** (atau **Admin**) agar collaborator dapat menjalankan `eas build` dan melihat log build.
4. Pastikan konfigurasi berikut sudah sinkron dan di-push ke Git:
   - `app.json` → `expo.owner` dan `expo.extra.eas.projectId`
   - `src/services/notificationService.ts` → `projectId` pada pemanggilan `Notifications.getExpoPushTokenAsync`

---

## 2. Untuk yang Di-invite (Collaborator)

1. **Terima undangan** dari email atau notifikasi di https://expo.dev.
2. **Pull branch terbaru** dari Git.
   - **Jangan** ubah `owner` maupun `extra.eas.projectId` di `app.json`.
   - **Jangan** jalankan `eas init` (karena project sudah terhubung).
3. **Install EAS CLI dan login menggunakan akun Expo masing-masing:**
   ```bash
   npm install -g eas-cli
   eas login
   eas whoami
   ```
4. **Verifikasi akses project:**
   ```bash
   eas project:info
   ```
   Jika akses sudah aktif, output akan menampilkan `fullName` dan `ID` yang sama dengan `app.json`.
5. **Pastikan file konfigurasi lokal tersedia di root project:**
   - `google-services.json` (dipakai oleh `app.json` → `android.googleServicesFile`)
   - `.env` (salin dari `.env.example` dan lengkapi nilainya)
6. **Install dependencies dan jalankan build Android:**
   ```bash
   npm install
   eas build -p android --profile development
   ```
   > Ganti `--profile development` dengan `--profile preview` jika ingin membuat APK standalone tanpa perlu menjalankan Metro server.

---

## 3. Troubleshooting & Aturan Penting

### Error `Install dependencies` (`Missing: @emnapi/core` / `@emnapi/runtime`)
Server EAS Build menjalankan `npm ci --include=dev` menggunakan **npm 10.9.9**. Jika di laptop lokal menggunakan **Node 24 / npm 11** dan baru saja menambah/mengubah package lewat `npm install`, sinkronkan dulu `package-lock.json` sebelum menjalankan `eas build`:

```bash
npx --yes npm@10.9.9 install --package-lock-only
```

Commit perubahan `package-lock.json` agar semua anggota tim dan server EAS memakai lockfile yang sama.

### Android Keystore / Credentials
Android Keystore dikelola otomatis oleh EAS di cloud, sehingga collaborator **tidak perlu** menyalin file `.keystore` secara manual antar laptop.

### Keamanan File Firebase Admin SDK (`*-firebase-adminsdk-*.json`)
File kredensial Firebase Admin SDK (contoh: `praktikumppk-app-firebase-adminsdk-*.json`, yang dipakai untuk upload **FCM V1 Service Account Key** di Expo/EAS) **sengaja tidak di-push ke Git** dan sudah diblokir oleh `.gitignore` (`*-firebase-adminsdk-*.json`) karena berisi *private key* rahasia yang akan menyebabkan **credential leak** jika masuk ke repository.

- **Jangan pernah** force-add (`git add -f`) atau commit file tersebut ke Git.
- Jika teman tim membutuhkan file tersebut (misalnya untuk konfigurasi FCM V1 di dashboard Expo/EAS), kirimkan secara pribadi lewat jalur aman (DM/chat privat), **bukan** lewat GitHub.

