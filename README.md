# PPKApp - Presensi Praktikum

Aplikasi mobile berbasis React Native (Expo) untuk mendemonstrasikan alur praktikum dari dua sudut pandang: **asisten** dan **praktikan**.

![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo_SDK-58-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/status-Sprint_1-blue)

---

## Daftar Isi

- [Deskripsi Project](#deskripsi-project)
- [Spesifikasi Kebutuhan (SRS)](#spesifikasi-kebutuhan-srs)
- [Pembagian Tugas](#pembagian-tugas)
- [Teknologi](#teknologi)

---

## Deskripsi Project

Kegiatan praktikum membutuhkan pencatatan kehadiran yang mudah digunakan oleh praktikan dan asisten. PPKApp menjawab kebutuhan tersebut dalam satu aplikasi dengan dua peran:

- **Asisten** melihat jadwal, membuka sesi ketika praktikum dimulai, memantau kehadiran, dan menutup sesi setelah selesai.
- **Praktikan** mengetahui jadwal dan detail sesi, melakukan presensi, serta melihat riwayat kehadirannya.

### Alur utama

```
Asisten membuka sesi → Praktikan presensi → Asisten melihat rekap → Asisten menutup sesi
```

Status sesi mengikuti alur satu arah:

```
Belum Dibuka → Dibuka → Ditutup
```

---

## Spesifikasi Kebutuhan (SRS)

Seluruh kebutuhan berprioritas **Must** karena merupakan syarat dari deskripsi tugas.

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

### Aturan bisnis

- Presensi hanya valid saat sesi **Dibuka**.
- Satu praktikan hanya boleh **satu presensi per sesi**.
- Waktu hadir diambil dari **jam perangkat** saat presensi berhasil.
- Sesi yang sudah **Ditutup** tidak dapat dibuka kembali.

---

## Pembagian Tugas

Setiap anggota hanya mengedit file miliknya sendiri. Satu fitur dikerjakan di satu branch.

| Anggota | Peran | SRS | Cakupan | File | Branch |
|---|---|---|---|---|---|
| Akmal Kafli Anan | Project Manager | - | Fondasi proyek, store bersama, data dummy, repo, workflow, penanganan konflik, dan merge | `src/context/`, `src/data/`, `src/constants/`, `src/utils/`, `src/app/_layout.tsx` | `main` |
| Aqiatillah Rezi Zhafran | Programmer | SRS-01, SRS-02 | Form pilih peran dan identitas dengan validasi, navigasi Stack dan Bottom Tab per peran, tombol ganti peran | `RoleSelectScreen.tsx`, `src/app/praktikan/_layout.tsx`, `src/app/asisten/_layout.tsx` | `feat/role-navigation` |
| Hadrian Shandhy Yudha | Programmer | SRS-03, SRS-04 | Daftar jadwal dengan `SessionCard` dan `StatusBadge`, penyaringan sesi per pengguna, empty state, layar detail sesi | `ScheduleScreen.tsx`, `SessionDetailScreen.tsx`, `SessionCard.tsx`, `StatusBadge.tsx`, `EmptyState.tsx` | `feat/schedule-detail` |
| Damar Ilham Adhitama | Programmer | SRS-05, SRS-06, SRS-07 | Layar presensi, validasi presensi ganda, pencatatan waktu, Bottom Sheet sukses, status "Sudah hadir", layar riwayat dengan empty state | `CheckInScreen.tsx`, `HistoryScreen.tsx`, `SuccessBottomSheet.tsx` | `feat/student-checkin-history` |
| Naufal Rayan Attallah | Programmer | SRS-08, SRS-09, SRS-10 | Tombol buka dan tutup sesi dengan Modal konfirmasi, umpan balik berhasil, layar rekap daftar hadir yang ter-update otomatis | `ManageSessionScreen.tsx`, `RecapScreen.tsx`, `ConfirmModal.tsx` | `feat/assistant-session-recap` |

File layar berada di `src/screens/` dan komponen di `src/components/`.

---

## Teknologi

| Kebutuhan | Teknologi |
|---|---|
| Framework | React Native dengan [Expo](https://expo.dev) SDK 58 |
| Bahasa | TypeScript |
| Navigasi | [Expo Router](https://docs.expo.dev/router/introduction) (Stack dan Bottom Tab) |
| State | React Context dan `useState` |
| Tata letak | Flexbox (`StyleSheet`) |
| Konfirmasi dan umpan balik | `Modal` bawaan React Native |
| Build | EAS Build (development build) |

---

## Struktur Folder

```
src/
├── app/                  # Route Expo Router (file route tipis)
│   ├── _layout.tsx       # Root layout + provider state
│   ├── index.tsx         # Pilih peran dan identitas
│   ├── session/[id].tsx  # Detail sesi
│   ├── praktikan/        # Tab praktikan: Jadwal, Presensi, Riwayat
│   └── asisten/          # Tab asisten: Jadwal, Kelola Sesi, Rekap
├── screens/              # Isi layar
├── components/           # Komponen yang dipakai ulang
├── context/              # Store bersama (AppContext)
├── data/                 # Tipe data dan data dummy
├── constants/            # Warna dan konstanta tampilan
└── utils/                # Helper format waktu
```
