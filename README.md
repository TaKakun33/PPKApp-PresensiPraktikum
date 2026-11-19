# PPKApp - Presensi Praktikum

Aplikasi mobile berbasis React Native (Expo) untuk mendemonstrasikan alur praktikum dari dua sudut pandang: **asisten** dan **praktikan**.

![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_Firestore-FFCA28?logo=firebase&logoColor=black)
![Status](https://img.shields.io/badge/status-Sprint_2-orange)

---

## Daftar Isi

- [Deskripsi Project](#deskripsi-project)
- [Spesifikasi Kebutuhan (SRS)](#spesifikasi-kebutuhan-srs)
  - [Sprint 1](#sprint-1-srs-01--srs-10)
  - [Sprint 2](#sprint-2-srs-11--srs-25)
- [Pembagian Tugas](#pembagian-tugas)
  - [Sprint 1](#sprint-1-1)
  - [Sprint 2](#sprint-2-1)
- [Teknologi](#teknologi)
- [Struktur Folder](#struktur-folder)
- [Ketergantungan & Solusi Paralel](#ketergantungan--solusi-paralel)
- [Aturan Tim](#aturan-tim)


---

## Deskripsi Project

Kegiatan praktikum membutuhkan pencatatan kehadiran yang mudah digunakan oleh praktikan dan asisten. PPKApp menjawab kebutuhan tersebut dalam satu aplikasi dengan dua peran:

- **Asisten** melihat jadwal, membuka sesi ketika praktikum dimulai, memantau kehadiran, mengelola kelas dan sesi, serta memutuskan pengajuan izin.
- **Praktikan** mengetahui jadwal dan detail sesi, melakukan presensi, mengajukan izin, serta melihat riwayat kehadiran dan status izinnya.

### Alur utama

**Alur presensi:**
```
Asisten login → membuka sesi dan membagikan kode presensi
  → Praktikan login, memasukkan kode, lalu presensi
  → data tersimpan di Firestore → Asisten melihat rekap real-time → Asisten menutup sesi
```

**Alur izin:**
```
Praktikan login → mengajukan izin → model sentimen lokal mengklasifikasikan alasan
  → Asisten memeriksa dan memutuskan → Praktikan melihat status
```

### Status sesi

```
Belum Dibuka → Dibuka → Ditutup
```

### Status izin

```
Menunggu → Diterima / Ditolak
```

---

## Spesifikasi Kebutuhan (SRS)

Seluruh kebutuhan berprioritas **Must** karena merupakan syarat dari deskripsi tugas.

### Sprint 1 (SRS-01 – SRS-10)

| Kode | Modul | Kebutuhan | Penanggung Jawab |
|---|---|---|---|
| SRS-01 | Peran & identitas | Pengguna memilih peran (Asisten / Praktikan) dan identitas lewat form. Tombol lanjut aktif hanya jika pilihan lengkap; jika belum, tampil pesan validasi. | Aqiatillah Rezi Zhafran |
| SRS-02 | Peran & identitas | Navigasi menyesuaikan peran, dan pengguna dapat berganti peran atau identitas dari dalam aplikasi. | Aqiatillah Rezi Zhafran |
| SRS-03 | Jadwal & detail | Daftar sesi menampilkan nama praktikum, kelas, waktu, dan status (badge berwarna). Sesi disaring sesuai kelas praktikan atau pengampu asisten. Jika kosong, tampil empty state. | Hadrian Shandhy Yudha |
| SRS-04 | Jadwal & detail | Menekan sesi membuka layar detail berisi praktikum, kelas, tanggal, waktu, ruangan, asisten, dan status. | Hadrian Shandhy Yudha |
| SRS-05 | Presensi | Praktikan dapat presensi hanya saat sesi Dibuka. Sistem mencatat waktu hadir dan menampilkan Bottom Sheet berisi nama sesi dan waktu hadir sebagai umpan balik. | Damar Ilham Adhitama |
| SRS-06 | Presensi | Presensi ganda pada sesi yang sama ditolak dengan pesan jelas. Tombol presensi nonaktif beserta alasannya saat sesi belum dibuka atau sudah ditutup. Setelah presensi, tampil status "Sudah hadir". | Damar Ilham Adhitama |
| SRS-07 | Riwayat | Praktikan melihat riwayat kehadirannya sendiri (sesi, kelas, waktu hadir). Jika belum pernah presensi, tampil empty state. | Damar Ilham Adhitama |
| SRS-08 | Kelola sesi | Asisten dapat membuka sesi (Belum Dibuka) dan menutup sesi (Dibuka) melalui Modal konfirmasi. Tombol aksi menyesuaikan status sesi. | Naufal Rayan Attallah |
| SRS-09 | Kelola sesi | Setelah buka atau tutup sesi, status berubah di semua tampilan terkait dan muncul umpan balik berhasil. | Naufal Rayan Attallah |
| SRS-10 | Rekap | Asisten melihat daftar praktikan yang sudah presensi (nama, NIM, waktu) beserta jumlahnya. Rekap ter-update setiap ada presensi baru. Jika kosong, tampil empty state atau info sesi belum dibuka. | Naufal Rayan Attallah |

### Sprint 2 (SRS-11 – SRS-25)

| Kode | Modul | Kebutuhan | Penanggung Jawab |
|---|---|---|---|
| SRS-11 | Autentikasi | Registrasi (nama, email, password, peran, NIM untuk praktikan), login, dan logout lewat Firebase Auth. Profil dan peran disimpan di Firestore. Input tidak valid dan kegagalan autentikasi menampilkan pesan jelas. | Akmal Kafli Anan |
| SRS-12 | Autentikasi | Belum login diarahkan ke Login; navigasi (Stack/Tab) menyesuaikan peran; sesi login bertahan setelah aplikasi ditutup. | Akmal Kafli Anan |
| SRS-13 | Pengajuan izin | Praktikan memilih sesi dan mengisi alasan. Pengajuan disimpan di Firestore berstatus Menunggu dan dapat dipantau. | Akmal Kafli Anan |
| SRS-14 | Integrasi AI | Alasan dikirim ke API AI; kategori ditampilkan dan disimpan bersama pengajuan. Jika AI gagal, izin tetap tersimpan tanpa kategori. | Akmal Kafli Anan |
| SRS-15 | Data praktikum | Asisten dapat tambah, lihat, ubah, hapus kelas dan peserta kelas. | Hadrian Shandhy Yudha |
| SRS-16 | Data praktikum | Asisten dapat tambah, ubah, hapus sesi dan jadwal (praktikum, kelas, tanggal, waktu, ruangan). | Hadrian Shandhy Yudha |
| SRS-17 | Jadwal | Daftar sesi real-time dengan badge status, disaring sesuai kelas praktikan atau pengampu asisten. Ada state loading, kosong, dan error. | Hadrian Shandhy Yudha |
| SRS-18 | Detail sesi | Layar detail sesi ter-update real-time tanpa restart. | Hadrian Shandhy Yudha |
| SRS-19 | Presensi | Praktikan presensi hanya saat sesi Dibuka. Data tersimpan per praktikan per sesi; presensi ganda ditolak. Bottom Sheet sukses tetap ada. | Damar Ilham Adhitama |
| SRS-20 | Presensi | Tombol presensi nonaktif beserta alasannya saat sesi belum dibuka atau ditutup; status "Sudah hadir" mengikuti data Firestore. | Damar Ilham Adhitama |
| SRS-21 | Riwayat | Praktikan melihat riwayat kehadiran dan status izinnya sendiri. Jika kosong, tampil empty state. | Damar Ilham Adhitama |
| SRS-22 | Keamanan | Firebase Security Rules membatasi akses dan perubahan data sesuai identitas dan peran. | Damar Ilham Adhitama |
| SRS-23 | Kelola sesi | Asisten membuka dan menutup sesi lewat Modal konfirmasi; status tersimpan dan berubah real-time di semua tampilan. | Naufal Rayan Attallah |
| SRS-24 | Rekap | Daftar praktikan yang sudah presensi (nama, NIM, waktu) beserta jumlah, ter-update otomatis. Jika kosong, tampil empty state. | Naufal Rayan Attallah |
| SRS-25 | Pemeriksaan izin | Asisten melihat pengajuan beserta alasan dan hasil klasifikasi AI, lalu menerima atau menolak. Keputusan terlihat oleh praktikan. | Naufal Rayan Attallah |

### Aturan bisnis

- Presensi hanya valid saat sesi **Dibuka**.
- Satu praktikan hanya boleh **satu presensi per sesi**.
- Waktu hadir diambil dari **server** saat presensi berhasil.
- Sesi yang sudah **Ditutup** tidak dapat dibuka kembali.
- Hanya **asisten** yang dapat mengelola data praktikum dan memutuskan izin.
- Hasil AI **tidak boleh** menerima atau menolak izin secara otomatis.

---

## Pembagian Tugas

Setiap anggota hanya mengedit file miliknya sendiri. Satu fitur dikerjakan di satu branch.

### Sprint 1

| Anggota | Peran | SRS | Cakupan | File | Branch |
|---|---|---|---|---|---|
| Akmal Kafli Anan | Project Manager | - | Fondasi proyek, store bersama, data dummy, repo, workflow, penanganan konflik, dan merge | `src/context/`, `src/data/`, `src/constants/`, `src/utils/`, `src/app/_layout.tsx` | `main` |
| Aqiatillah Rezi Zhafran | Programmer | SRS-01, SRS-02 | Form pilih peran dan identitas dengan validasi, navigasi Stack dan Bottom Tab per peran, tombol ganti peran | `RoleSelectScreen.tsx`, `src/app/praktikan/_layout.tsx`, `src/app/asisten/_layout.tsx` | `feat/role-navigation` |
| Hadrian Shandhy Yudha | Programmer | SRS-03, SRS-04 | Daftar jadwal dengan `SessionCard` dan `StatusBadge`, penyaringan sesi per pengguna, empty state, layar detail sesi | `ScheduleScreen.tsx`, `SessionDetailScreen.tsx`, `SessionCard.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | `feat/schedule-detail` |
| Damar Ilham Adhitama | Programmer | SRS-05, SRS-06, SRS-07 | Layar presensi, validasi presensi ganda, pencatatan waktu, Bottom Sheet sukses, status "Sudah hadir", layar riwayat dengan empty state | `CheckInScreen.tsx`, `HistoryScreen.tsx`, `SuccessBottomSheet.tsx` | `feat/student-checkin-history` |
| Naufal Rayan Attallah | Programmer | SRS-08, SRS-09, SRS-10 | Tombol buka dan tutup sesi dengan Modal konfirmasi, umpan balik berhasil, layar rekap daftar hadir yang ter-update otomatis | `ManageSessionScreen.tsx`, `RecapScreen.tsx`, `ConfirmModal.tsx` | `feat/assistant-session-recap` |

File layar berada di `src/screens/` dan komponen di `src/components/`.

### Sprint 2

| Anggota | Peran | SRS | Cakupan | File | Branch |
|---|---|---|---|---|---|
| Aqiatillah Rezi Zhafran | Project Manager | - | Konfigurasi Firebase, kontrak data Firestore, stub `useAuth()` dan service, komponen `LoadingState` & `ErrorState`, data awal, repo GitHub, review PR, merge, Security Rules final, G-form | `firebase.js`, `.env`, skema koleksi, `useAuth()` stub, `LoadingState.js`, `ErrorState.js` | `main` |
| Akmal Kafli Anan | Programmer | SRS-11, 12, 13, 14 | Registrasi, login, logout, navigasi per peran, form pengajuan izin, dan integrasi API AI | `LoginScreen.js`, `RegisterScreen.js`, `LeaveRequestScreen.js`, `AuthContext.js`, `authService.js`, `leaveService.js`, `aiService.js`, folder `navigation/` | `feat/auth-leave-ai` |
| Hadrian Shandhy Yudha | Programmer | SRS-15, 16, 17, 18 | CRUD kelas, peserta, dan sesi; jadwal dan detail sesi real-time dengan empty dan error state | `ScheduleScreen.js`, `SessionDetailScreen.js`, `ManageClassScreen.js`, `SessionFormScreen.js`, `SessionCard.js`, `classService.js`, `sessionService.js` | `feat/class-session-crud` |
| Damar Ilham Adhitama | Programmer | SRS-19, 20, 21, 22 | Presensi Firestore dengan cegah ganda, status tombol real-time, Bottom Sheet sukses, riwayat kehadiran dan izin, serta Security Rules | `CheckInScreen.js`, `HistoryScreen.js`, `SuccessBottomSheet.js`, `attendanceService.js`, `historyService.js`, `firestore.rules` | `feat/checkin-history-rules` |
| Naufal Rayan Attallah | Programmer | SRS-23, 24, 25 | Buka dan tutup sesi dengan Modal konfirmasi, rekap real-time, dan pemeriksaan izin oleh asisten | `ManageSessionScreen.js`, `RecapScreen.js`, `LeaveReviewScreen.js`, `ConfirmModal.js`, `sessionStatusService.js`, `recapService.js`, `leaveReviewService.js` | `feat/session-recap-review` |

File layar berada di `src/screens/`, komponen di `src/components/`, dan akses data di `src/services/`.

> [!NOTE]
> Semua layar tidak memanggil Firestore atau API AI secara langsung; akses data hanya lewat file **service** milik masing-masing.

**Urutan merge paling aman:** `Akmal → Hadrian → Naufal → Damar`
_(Urutan ini hanya untuk penggabungan; pengerjaan kode tetap berjalan bersamaan.)_

---

## Teknologi

| Kebutuhan | Teknologi |
|---|---|
| Framework | React Native 0.88 dengan [Expo](https://expo.dev) SDK 58 |
| Bahasa | TypeScript |
| Navigasi | [Expo Router](https://docs.expo.dev/router/introduction) (Stack dan Bottom Tab) |
| Autentikasi | [Firebase Authentication](https://firebase.google.com/docs/auth) via `@react-native-firebase/auth` |
| Database | [Cloud Firestore](https://firebase.google.com/docs/firestore) via `@react-native-firebase/firestore` (real-time listener) |
| State | React Context dan `useState` |
| Tata letak | Flexbox (`StyleSheet`) |
| Tipografi | Plus Jakarta Sans via `@expo-google-fonts/plus-jakarta-sans` |
| Konfirmasi & umpan balik | `Modal` bawaan React Native dan bottom sheet kustom |
| Klasifikasi izin | Model sentimen EDOM lokal (`ai/sentiment.js` + `ai/model-edom.json`), tanpa API key dan tanpa internet |
| Build | EAS Build dengan `expo-dev-client` (development build) |

---

## Struktur Folder

Folder utama di root project:

```
PPKApp-PresensiPraktikum/
├── ai/                   # Model sentimen EDOM untuk klasifikasi alasan izin
├── assets/               # Ikon, splash screen, dan gambar
├── plugins/
│   └── withFirebaseBom.js # Plugin Expo untuk Firebase BOM Android
├── src/                  # Kode aplikasi (rincian di bawah)
├── .env.example          # Contoh variabel lingkungan
├── .gitignore            # Daftar file yang tidak di-commit
├── app.json              # Konfigurasi Expo
├── eas.json              # Konfigurasi EAS Build
├── eslint.config.js      # Konfigurasi ESLint
├── expo-env.d.ts         # Tipe lingkungan Expo
├── firestore.rules       # Security Rules Firestore
├── google-services.json  # Konfigurasi Firebase Android
├── LICENSE               # Lisensi project
├── package-lock.json     # Lockfile dependency
├── package.json          # Dependency dan script npm
├── tsconfig.json         # Konfigurasi TypeScript
└── README.md
```

> Folder hasil build/cache seperti `.expo/`, `dist/`, dan `node_modules/` tidak ditampilkan.

Isi folder `src/`:

```
src/
├── app/                  # Route Expo Router (file route tipis)
│   ├── _layout.tsx       # Root layout + provider state
│   ├── index.tsx         # Gerbang awal / redirect sesuai sesi login
│   ├── login.tsx         # Login
│   ├── register.tsx      # Registrasi
│   ├── profile.tsx       # Profil pengguna
│   ├── kelas.tsx         # Kelola kelas dan peserta
│   ├── session-form.tsx  # Form tambah / ubah sesi
│   ├── presensi-manual.tsx # Presensi manual oleh asisten
│   ├── session/[id].tsx  # Detail sesi
│   ├── praktikan/        # Tab praktikan: Home, Jadwal, Presensi, Riwayat, Izin
│   └── asisten/          # Tab asisten: Jadwal, Kelola, Rekap, Izin
├── screens/              # Isi layar
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   ├── HomeScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── ScheduleScreen.tsx
│   ├── SessionDetailScreen.tsx
│   ├── SessionFormScreen.tsx
│   ├── ManageClassScreen.tsx
│   ├── ManageSessionScreen.tsx
│   ├── CheckInScreen.tsx
│   ├── ManualAttendanceScreen.tsx
│   ├── HistoryScreen.tsx
│   ├── LeaveRequestScreen.tsx
│   ├── LeaveReviewScreen.tsx
│   └── RecapScreen.tsx
├── components/           # Komponen yang dipakai ulang
│   ├── StatusBadge       # Badge status sesi (Belum Dibuka / Dibuka / Ditutup)
│   ├── EmptyState        # Tampilan kosong generik
│   ├── LoadingState      # Indikator loading
│   ├── ErrorState        # Tampilan error
│   ├── Card              # Kartu pembungkus konten
│   ├── PrimaryButton     # Tombol utama
│   ├── ScreenHeader      # Header layar
│   ├── SessionCard       # Kartu ringkasan sesi
│   ├── ConfirmModal      # Modal konfirmasi
│   ├── SuccessBottomSheet # Bottom sheet umpan balik sukses
│   └── FloatingTabBar    # Tab bar mengambang
├── context/              # Store bersama (AuthContext.tsx)
├── navigation/           # Konfigurasi navigator per peran
│   ├── AuthLoadingGate   # Gerbang loading autentikasi
│   ├── RoleGuard         # Penjaga akses sesuai peran
│   ├── RoleTabs          # Bottom tab per peran
│   ├── tabConfig         # Konfigurasi tab
│   ├── LogoutButton      # Tombol logout
│   └── ProfileButton     # Tombol menuju profil
├── hooks/                # Custom hook (useNamaKelas, useScrollKeFieldFokus)
├── lib/                  # Konfigurasi inti
│   ├── firebase.ts       # Inisialisasi Firebase
│   ├── constants.ts      # Konstanta bersama (status, peran)
│   └── types.ts          # Tipe data
├── constants/            # Warna dan tema tampilan
│   ├── colors.ts
│   └── theme.ts
├── types/                # Deklarasi tipe tambahan (sentiment-js.d.ts)
├── utils/                # Helper format waktu, kode presensi, dan rekap
│   ├── format.ts
│   ├── kodePresensi.ts
│   └── rekap.ts
└── services/             # Lapisan akses data ke Firestore & model AI
    ├── authService.ts
    ├── classService.ts
    ├── sessionService.ts
    ├── attendanceService.ts
    ├── historyService.ts
    ├── leaveService.ts
    ├── aiService.ts
    └── serviceUtils.ts
```

Folder `ai/` berada di root project dan berisi model klasifikasi sentimen alasan izin yang berjalan di perangkat:

```
ai/
├── model-edom.json       # Data model sentimen (positif / netral / negatif)
├── sentiment.js          # Fungsi prediksi sentimen
├── requirements.txt      # Dependency Python untuk pelatihan model
└── README.md             # Panduan penggunaan model di React Native
```

### Skema koleksi Firestore (Sprint 2)

| Koleksi | Deskripsi |
|---|---|
| `users` | Profil pengguna: `nama`, `email`, `role`, `nim` (praktikan), `kelasIds` (praktikan) |
| `classes` | Kelas: `namaKelas`, `praktikum`, `asistenId`, `pesertaIds[]` |
| `sessions` | Sesi praktikum: `praktikum`, `kelasId`, `asistenId`, `tanggal`, `waktuMulai`, `waktuSelesai`, `ruangan`, `status` |
| `attendances` | Presensi per praktikan per sesi: `sessionId`, `kelasId`, `userId`, `nama`, `nim`, `waktuHadir`, `kode`, `manual`, `dicatatOleh`. ID dokumen `{sessionId}_{uid}` |
| `leaveRequests` | Pengajuan izin: `sessionId`, `kelasId`, `asistenId`, `praktikum`, `userId`, `nama`, `nim`, `alasan`, `kategoriAI`, `aiStatus`, `status`, `catatanAsisten`. ID dokumen `{sessionId}_{uid}` |
| `allowedAssistants` | Daftar email asisten yang diizinkan registrasi. ID dokumen = email huruf kecil |
| `sessionCodes` | Kode presensi unik per sesi; hanya dibaca asisten dan dicocokkan Security Rules saat praktikan presensi |

---

## Ketergantungan & Solusi Paralel

| Ketergantungan | SRS Terkait | Solusi |
|---|---|---|
| Semua fitur butuh pengguna login | SRS-11 dan SRS-15 s/d 25 | `AuthContext` menyediakan profil, dan `RoleGuard` membatasi akses sesuai peran |
| Presensi butuh sesi yang sudah dibuka | SRS-19 dan SRS-23 | Status sesi dan kode unik di `sessionCodes` diperiksa lagi oleh Security Rules saat presensi |
| Rekap dan pemeriksaan izin butuh data | SRS-24, 25 dan SRS-13, 19 | Data diisi lewat aplikasi asisten atau Firebase Console untuk pengujian |
| Daftar sesi dipakai banyak layar | SRS-13, 17, 23 | Semua layar memakai `subscribeSessions` di `sessionService` |
| Security Rules bisa memblokir fitur | SRS-22 dan semua | Rules final ada di `firestore.rules` dan seluruh alur diuji ulang |
| Status harus konsisten di semua tampilan | SRS-17, 18, 23, 24 | Semua layar membaca Firestore lewat listener, tanpa state salinan sendiri |

---

## Aturan Tim

1. **Satu orang hanya mengedit file miliknya sendiri.**
2. Skema, konstanta, dan konfigurasi hanya diubah PM; kebutuhan field atau fungsi baru disampaikan ke PM.
3. Tidak ada yang memasang dependency baru sendiri.
4. Satu fitur satu branch; push ke branch sendiri, **bukan** `main`.
5. Commit message jelas dengan head dan body, tanpa co-author.
6. File `.env` dan kunci API **tidak pernah** di-commit.
7. Setiap listener Firestore di-unsubscribe saat layar ditutup, dan setiap pemanggilan Firestore memakai `try/catch` dengan pesan ramah.
8. Terkendala lebih dari satu hari: segera lapor ke PM.

---

