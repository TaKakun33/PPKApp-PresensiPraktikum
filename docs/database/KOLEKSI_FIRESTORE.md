# Struktur Data — Cloud Firestore (NoSQL)

Aplikasi memakai **Cloud Firestore**, yaitu basis data NoSQL berbasis dokumen. Data disimpan
dalam **koleksi** (setara "tabel"), dan setiap koleksi berisi **dokumen** (setara "baris") berupa
pasangan field–nilai. Firestore tidak memakai relasi atau JOIN. Penghubung antardata hanya
berupa field yang menyimpan ID dokumen lain (misalnya `kelasId`).

Keamanan dan validasi data ditegakkan di server lewat [`firestore.rules`](../../firestore.rules).
Klien tidak bisa menulis data yang melanggar aturan tersebut.

## Ringkasan koleksi

| No | Koleksi | Fungsi singkat |
|---|---|---|
| 1 | `users` | Profil setiap akun (praktikan dan asisten) |
| 2 | `allowedAssistants` | Daftar email yang boleh mendaftar sebagai asisten |
| 3 | `nimIndex` | Penjamin NIM tidak dipakai dua akun |
| 4 | `classes` | Data kelas praktikum dan daftar pesertanya |
| 5 | `sessions` | Jadwal sesi praktikum per kelas |
| 6 | `sessionCodes` | Kode presensi rahasia setiap sesi yang dibuka |
| 7 | `attendances` | Catatan kehadiran praktikan per sesi |
| 8 | `leaveRequests` | Pengajuan izin praktikan per sesi |

## Penjelasan per koleksi

### 1. `users`: profil pengguna
- **Fungsi:** menyimpan identitas setiap akun yang login. Field `role` menentukan menu yang
  tampil, yaitu menu praktikan atau menu asisten.
- **ID dokumen:** UID dari Firebase Authentication.
- **Field:** `nama`, `email`, `role` (`praktikan`/`asisten`), `nim` (praktikan saja), `kelasIds`
  (daftar kelas yang diikuti praktikan), `createdAt`.
- **Ditulis oleh:** pengguna sendiri saat registrasi. Pengguna hanya boleh mengubah namanya.
  Asisten hanya boleh menambah atau mengurangi `kelasIds` praktikan.

### 2. `allowedAssistants`: email asisten yang diizinkan
- **Fungsi:** mencegah sembarang orang mendaftar sebagai asisten. Registrasi asisten ditolak
  jika emailnya tidak ada di koleksi ini.
- **ID dokumen:** email dalam huruf kecil, misalnya `asisten1@gmail.com`.
- **Field:** bebas, karena yang dicek hanya keberadaan dokumennya.
- **Ditulis oleh:** admin lewat Firebase Console. Aplikasi tidak bisa menulis koleksi ini.

### 3. `nimIndex`: keunikan NIM
- **Fungsi:** menjamin satu NIM hanya dimiliki satu akun. Firestore tidak punya *unique
  constraint*, jadi NIM dijadikan ID dokumen. Dokumen dengan ID yang sama tidak bisa dibuat
  dua kali.
- **ID dokumen:** NIM.
- **Field:** `uid` (pemilik NIM).
- **Ditulis oleh:** praktikan saat registrasi, dalam satu batch bersama dokumen `users`.
  Setelah itu dokumen tidak bisa diubah atau dibaca dari aplikasi.

### 4. `classes`: kelas praktikum
- **Fungsi:** mengelompokkan praktikan ke dalam kelas yang diampu asisten. Kelas menjadi dasar
  pembuatan sesi, presensi, dan rekap.
- **ID dokumen:** dibuat otomatis.
- **Field:** `namaKelas`, `praktikum`, `asistenId` (asisten pengampu), `pesertaIds` (UID
  praktikan peserta).
- **Ditulis oleh:** asisten pengampu (membuat, mengubah, menghapus, serta menambah atau
  mengeluarkan peserta).

### 5. `sessions`: sesi praktikum
- **Fungsi:** jadwal pertemuan sebuah kelas. Status sesi mengatur kapan presensi dan izin
  bisa dilakukan.
- **ID dokumen:** dibuat otomatis.
- **Field:** `kelasId`, `praktikum`, `asistenId`, `tanggal`, `waktuMulai`, `waktuSelesai`,
  `ruangan`, `status` (`belum_dibuka` → `dibuka` → `ditutup`), `openedAt`, `closedAt`.
- **Ditulis oleh:** asisten pengampu. Status hanya bisa maju satu langkah, dan jadwal hanya
  bisa diubah selama sesi belum dibuka.

### 6. `sessionCodes`: kode presensi
- **Fungsi:** menyimpan kode 5 karakter yang diumumkan asisten di kelas. Kode disimpan
  terpisah dari `sessions` agar praktikan tidak bisa membacanya langsung dari database.
- **ID dokumen:** sama dengan ID sesi.
- **Field:** `sessionId`, `asistenId`, `kode`, `createdAt`.
- **Ditulis oleh:** asisten saat membuka sesi. Kode tidak bisa diubah atau dihapus.

### 7. `attendances`: presensi
- **Fungsi:** bukti kehadiran praktikan pada suatu sesi. Data ini menjadi sumber rekap
  kehadiran dan riwayat praktikan.
- **ID dokumen:** `{sessionId}_{uid}`. Karena ID-nya tetap, satu praktikan hanya bisa punya
  satu presensi per sesi.
- **Field:** `sessionId`, `kelasId`, `userId`, `nama`, `nim`, `waktuHadir` (waktu server),
  `kode` (presensi mandiri) atau `manual` + `dicatatOleh` (presensi oleh asisten).
- **Ditulis oleh:** praktikan dengan kode yang benar, atau asisten pengampu, dan hanya
  selama sesi berstatus `dibuka`.

### 8. `leaveRequests`: izin
- **Fungsi:** pengajuan izin tidak hadir beserta keputusan asisten. Hasil klasifikasi AI
  disimpan sebagai informasi pendukung dan tidak menentukan keputusan.
- **ID dokumen:** `{sessionId}_{uid}`, sehingga satu praktikan hanya punya satu izin per sesi.
- **Field:** `sessionId`, `kelasId`, `asistenId`, `praktikum`, `userId`, `nama`, `nim`, `alasan`,
  `kategoriAI`, `aiStatus`, `status` (`menunggu`/`diterima`/`ditolak`), `catatanAsisten`,
  `createdAt`.
- **Ditulis oleh:** praktikan (mengajukan, mengajukan ulang setelah ditolak, membatalkan) dan
  asisten pengampu (menerima atau menolak).

## Catatan desain

- **Data disalin, bukan di-JOIN.** `nama` dan `nim` ikut disimpan di `attendances` dan
  `leaveRequests` supaya rekap bisa ditampilkan tanpa membaca `users` satu per satu.
- **ID dokumen dipakai sebagai pengganti *unique constraint*.** Contohnya `nimIndex/{nim}`,
  `attendances/{sessionId}_{uid}`, dan `leaveRequests/{sessionId}_{uid}`.
- **Koleksi lain ditolak.** Aturan default di `firestore.rules` menolak baca dan tulis ke
  koleksi yang tidak terdaftar di atas.
