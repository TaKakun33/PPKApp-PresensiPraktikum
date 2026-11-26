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
| 4 | `labs` | Ruangan lab praktikum: Lab B, C, D, dan AP |
| 5 | `classes` | Kelas A–E per praktikum, asisten pengampu (maks. 2), dan pesertanya |
| 5a | `classes/{id}/peserta` | Nama dan NIM praktikan, terpisah untuk setiap kelas |
| 6 | `sessions` | Jadwal sesi praktikum per kelas |
| 7 | `labBookings` | Pemakaian lab per tanggal dan jam, agar lab tidak bentrok |
| 8 | `sessionCodes` | Kode presensi rahasia setiap sesi yang dibuka |
| 9 | `attendances` | Catatan kehadiran praktikan per sesi |
| 10 | `leaveRequests` | Pengajuan izin praktikan per sesi |

Jam sesi tidak disimpan sebagai koleksi karena nilainya tetap: lima slot masing-masing tepat
2 jam (08.00–10.00, 10.10–12.10, 13.00–15.00, 15.40–17.40, 18.15–20.15 WIB). Daftar ini ada di
`src/lib/constants.ts` (`SLOT_WAKTU`) dan dicek ulang oleh `firestore.rules`.

## Penjelasan per koleksi

### 1. `users`: profil pengguna
- **Fungsi:** menyimpan identitas setiap akun yang login. Field `role` menentukan menu yang
  tampil, yaitu menu praktikan atau menu asisten.
- **ID dokumen:** UID dari Firebase Authentication.
- **Field:** `nama`, `email`, `role` (`praktikan`/`asisten`), `nim` (praktikan saja), `kelasIds`
  (daftar kelas yang diikuti praktikan), `createdAt`.
- **Ditulis oleh:** pengguna sendiri saat registrasi. Pengguna hanya boleh mengubah namanya.
  Asisten hanya boleh menambah atau mengurangi `kelasIds` praktikan untuk kelas yang dia ampu.

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

### 4. `labs`: ruangan lab
- **Fungsi:** daftar ruangan yang boleh dipakai sesi. Form Tambah Sesi menampilkannya sebagai
  dropdown **Ruangan Lab**, jadi ruangan tidak lagi diketik bebas.
- **ID dokumen:** kode lab aktif, yaitu `B`, `C`, `D`, `AP`.
- **Field:** `kode`, `nama` (mis. `Lab B`), `kapasitas`, `lat` (angka, -90 sampai 90),
  `lng` (angka, -180 sampai 180), `radiusMeter` (angka, 10 sampai 200 meter),
  `diperbaruiOleh` (UID Firebase Authentication), dan `diperbaruiPada` (timestamp server
  Firestore). Field lokasi dan audit dapat belum ada sebelum lokasi pertama kali disimpan.
- **Ditulis oleh:** admin membuat dokumen lewat Firebase Console (lihat bagian *Setup admin*).
  Asisten dapat memperbarui hanya field lokasi dan audit melalui aplikasi; rules menolak praktikan,
  perubahan `kode`/`nama`/`kapasitas`, pembuatan dokumen, dan penghapusan. Semua pengguna yang
  login tetap dapat membaca dokumen lab.

### 5. `classes`: kelas praktikum
- **Fungsi:** mengelompokkan praktikan ke dalam Kelas A–E untuk sebuah praktikum. Kelas menjadi
  dasar pembuatan sesi, presensi, dan rekap.
- **ID dokumen:** `{praktikumId}_{kode}`, misalnya `praktikum-ppk_A`. Karena ID-nya tetap, satu
  praktikum hanya bisa punya satu Kelas A, satu Kelas B, dan seterusnya.
- **Field:** `namaKelas` dan `kode` (`A`–`E`), `praktikum`, `praktikumId`, `asistenId` (pembuat),
  `asistenIds` (asisten pengampu, **maksimal 2**), `pesertaIds` (UID praktikan peserta).
- **Ditulis oleh:** asisten. Asisten pertama membuat kelas. Asisten kedua yang memilih
  praktikum dan kelas yang sama otomatis bergabung sebagai *partner*. Asisten ketiga ditolak
  server. Partner bisa keluar selama masih ada satu asisten lain.

### 5a. `classes/{id}/peserta`: nama praktikan per kelas
- **Fungsi:** daftar nama dan NIM praktikan yang terpisah untuk setiap kelas, sehingga isi
  setiap kelas bisa dibaca langsung di Firebase Console.
- **ID dokumen:** UID praktikan.
- **Field:** `nama`, `nim`, `ditambahkanPada`.
- **Ditulis oleh:** asisten pengampu saat menambah atau mengeluarkan peserta, dalam satu batch
  bersama `pesertaIds`. Isinya harus sama dengan profil praktikan.

### 6. `sessions`: sesi praktikum
- **Fungsi:** jadwal pertemuan sebuah kelas. Status sesi mengatur kapan presensi dan izin
  bisa dilakukan.
- **ID dokumen:** dibuat otomatis.
- **Field:** `kelasId`, `praktikum`, `asistenId` (pembuat sesi), `tanggal`, `slot` (1–5),
  `waktuMulai`, `waktuSelesai`, `labKode`, `ruangan` (nama lab), `status`
  (`belum_dibuka` → `dibuka` → `ditutup`), `openedAt`, `closedAt`.
- **Ditulis oleh:** asisten pengampu kelas, baik pembuat maupun partner. Keduanya mendengarkan
  dokumen yang sama, sehingga saat satu asisten membuka sesi, layar partnernya ikut berubah.
  Status hanya bisa maju satu langkah, jadwal hanya bisa diubah selama sesi belum dibuka, dan
  sesi hanya bisa dibuka pada jam yang dibooking (dicek dengan waktu server).

### 7. `labBookings`: pemakaian lab
- **Fungsi:** mencatat lab yang sudah dipakai pada tanggal dan jam tertentu. Dipakai untuk
  menolak sesi yang bentrok di lab yang sama dan untuk menonaktifkan jam yang sudah dibooking
  di form.
- **ID dokumen:** `{labKode}_{tanggal}_{slot}`, misalnya `A_2026-11-23_2`. Karena ID-nya tetap,
  satu lab hanya bisa dibooking satu sesi pada jam yang sama.
- **Field:** `sessionId`, `kelasId`, `labKode`, `tanggal`, `slot`.
- **Ditulis oleh:** asisten pengampu, selalu dalam satu batch bersama dokumen sesinya (dibuat,
  dipindah, atau dihapus bersama sesi).

### 8. `sessionCodes`: kode presensi
- **Fungsi:** menyimpan kode 5 karakter yang diumumkan asisten di kelas. Kode disimpan
  terpisah dari `sessions` agar praktikan tidak bisa membacanya langsung dari database.
- **ID dokumen:** sama dengan ID sesi.
- **Field:** `sessionId`, `asistenId` (yang membuka sesi), `kode`, `createdAt`.
- **Ditulis oleh:** asisten pengampu saat membuka sesi. Kode tidak bisa diubah atau dihapus.

### 9. `attendances`: presensi
- **Fungsi:** bukti kehadiran praktikan pada suatu sesi. Data ini menjadi sumber rekap
  kehadiran dan riwayat praktikan.
- **ID dokumen:** `{sessionId}_{uid}`. Karena ID-nya tetap, satu praktikan hanya bisa punya
  satu presensi per sesi.
- **Field:** `sessionId`, `kelasId`, `userId`, `nama`, `nim`, `waktuHadir` (waktu server),
  `kode` (presensi mandiri) atau `manual` + `dicatatOleh` (presensi oleh asisten).
- **Ditulis oleh:** praktikan dengan kode yang benar, atau asisten pengampu, dan hanya
  selama sesi berstatus `dibuka`.

### 10. `leaveRequests`: izin
- **Fungsi:** pengajuan izin tidak hadir beserta keputusan asisten. Hasil klasifikasi AI
  disimpan sebagai informasi pendukung dan tidak menentukan keputusan.
- **ID dokumen:** `{sessionId}_{uid}`, sehingga satu praktikan hanya punya satu izin per sesi.
- **Field:** `sessionId`, `kelasId`, `asistenId`, `praktikum`, `userId`, `nama`, `nim`, `alasan`,
  `kategoriAI`, `aiStatus`, `status` (`menunggu`/`diterima`/`ditolak`), `catatanAsisten`,
  `createdAt`.
- **Ditulis oleh:** praktikan (mengajukan, mengajukan ulang setelah ditolak, membatalkan) dan
  asisten pengampu kelas (menerima atau menolak).

## Pemetaan evaluasi Sprint 2

| # | Evaluasi | Penyelesaian |
|---|---|---|
| 1 | NoSQL → SQL | Asprak mengizinkan tetap NoSQL asalkan setiap koleksi dijelaskan (dokumen ini) |
| 2 | Lab A, B, C, D, AP punya tabel | Koleksi `labs` |
| 3 | Sesi tepat 2 jam | Jam dipilih dari 5 slot tetap 2 jam; rules menolak jam lain |
| 4 | Maks. 2 asisten per kelas | `classes.asistenIds`; rules hanya mengizinkan bergabung jika pengampu baru 1 |
| 5 | Kelas A–E punya tabel | `classes` dengan `kode` A–E dan ID `{praktikumId}_{kode}` (unik per praktikum) |
| 6 | Jadwal praktikan tidak bentrok | Dicek aplikasi saat membuat/mengubah sesi dan saat menambah peserta (lewat `labBookings` + `classes`) |
| 7 | Lab tidak bentrok | `labBookings/{lab}_{tanggal}_{slot}`: dokumen yang sudah ada tidak bisa dibuat lagi |
| 8 | Partner asisten konsisten | Sesi milik kelas; kedua pengampu membaca dan mengubah dokumen sesi yang sama secara real-time |
| 9 | Rekap pakai dropdown | Dropdown "Sesi / Kelas" di layar Rekap |
| 10 | Izin pilih kelas dulu | Kelas wajib dipilih sebelum sesi dan alasan |
| 11 | Buka sesi hanya di jam booking | Dicek aplikasi dan rules (`request.time` di antara jam mulai dan selesai WIB) |
| 12 | Praktikan terpisah per kelas | Subkoleksi `classes/{id}/peserta` |
| 13 | Tambah praktikan lebih mudah | Cari berdasarkan awalan NIM atau nama, lalu tekan Tambah |
| 14 | Jam yang sudah dibooking tidak bisa dipilih | Form membaca `labBookings` dan menonaktifkan jam yang terpakai atau sudah lewat |
| 15 | Dropdown kelas dan ruangan lab | Form sesi: dropdown Kelas, Ruangan Lab, dan Jam |

## Catatan desain

- **Data disalin, bukan di-JOIN.** `nama` dan `nim` ikut disimpan di `attendances`,
  `leaveRequests`, dan `classes/{id}/peserta` supaya daftar bisa ditampilkan tanpa membaca
  `users` satu per satu.
- **ID dokumen dipakai sebagai pengganti *unique constraint*.** Contohnya `nimIndex/{nim}`,
  `classes/{praktikumId}_{kode}`, `labBookings/{lab}_{tanggal}_{slot}`,
  `attendances/{sessionId}_{uid}`, dan `leaveRequests/{sessionId}_{uid}`.
- **Bentrok jadwal praktikan dicek aplikasi.** Rules Firestore tidak bisa menjalankan query,
  jadi pengecekan peserta yang mengikuti dua kelas pada jam yang sama dilakukan aplikasi
  sebelum menyimpan.
- **Koleksi lain ditolak.** Aturan default di `firestore.rules` menolak baca dan tulis ke
  koleksi yang tidak terdaftar di atas.

## Setup admin (sekali, oleh pemilik project Firebase)

1. **Deploy rules dan indeks:** `firebase deploy --only firestore` dari root repo (memakai
   `firebase.json`). Indeks `users (role, nim)` dan `users (role, nama)` dibutuhkan untuk
   pencarian praktikan. Cara lain: tempel isi `firestore.rules` di Console → Firestore → Rules,
   dan buat dua indeks itu di Console → Firestore → Indexes.
2. **Isi koleksi `labs`** di Console → Firestore → *Start collection* `labs`, dengan empat dokumen aktif:

   | ID dokumen | `kode` (string) | `nama` (string) | `kapasitas` (number) |
   |---|---|---|---|
   | `B` | `B` | `Lab B` | 40 |
   | `C` | `C` | `Lab C` | 40 |
   | `D` | `D` | `Lab D` | 40 |
   | `AP` | `AP` | `Lab AP` | 40 |

3. **Data lama:** kelas yang dibuat sebelum perubahan ini (nama bebas, satu asisten) dan sesi
   tanpa lab tetap terbaca, tetapi tidak bisa diberi partner atau diubah jadwalnya. Untuk data
   uji, sebaiknya hapus kelas dan sesi lama, lalu buat ulang lewat aplikasi.
