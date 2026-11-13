# Task: Redesign UI/UX Aplikasi Praktikum Presensi (Mobile-First)

Tolong lakukan refactoring UI/UX pada aplikasi ini dengan mengikuti spesifikasi desain di bawah ini.

## Aturan Utama untuk Agent (PENTING)
1. **Eksplorasi Codebase Dulu:** Cek struktur file, konfigurasi styling (CSS/Tailwind), routing, halaman Login, Jadwal, Presensi, Izin, Riwayat, dan komponen Bottom Navigation yang ada saat ini.
2. **Jangan Rusak Logic Eksisting:** Pertahankan seluruh state, autentikasi, pemisahan role (`Praktikan` vs `Asisten`), penyimpanan data, serta model analisis AI lokal pada halaman Izin.

---

## 1. Sistem Warna Global (Palet "Apple Modern")
Perbarui variabel warna / konfigurasi tema global menggunakan 4 warna utama ini:
- **Background Utama & Card Surface (`#F5F5F7`):** Gunakan untuk background halaman/body, background card statistik, card daftar jadwal, dan background input field.
- **Teks Utama & Kontras Tinggi (`#1D1D1F`):** Gunakan untuk judul halaman (H1/H2), nama user, angka statistik, dan tombol kontras gelap.
- **Teks Sekunder / Muted (`#AAAAAA`):** Gunakan untuk subjudul, label kecil, placeholder input, keterangan waktu/ruangan, dan ikon bottom navigation yang tidak aktif.
- **Primary Accent (`#007AFF`):** Gunakan untuk hero banner biru, kartu persentase kehadiran, tombol utama, badge status aktif, dan indikator tab navigasi bawah yang sedang aktif.
- **Pure White (`#FFFFFF`):** Gunakan untuk container sheet utama pada halaman Login, kartu form Izin, dan bar navigasi bawah.

---

## 2. Redesign Halaman Login (Model Overlapping Card Mobile-First)
Ubah layout halaman Login menjadi bergaya mobile-first card bertumpuk (overlapping bottom sheet) dengan detail berikut:
- **Header Area (Bagian Atas):**
  - Beri background warna aksen `#007AFF` (atau blok header berwarna dengan sudut atas membulat).
  - Tampilkan ikon centang di dalam kotak membulat, label kecil uppercase `"PRAKTIKUM PRESENSI"`, judul besar `"Masuk ke ruang praktikumu."`, dan subteks `"Kelola jadwal, presensi, dan pengajuan izin dalam satu tempat."`.
- **Form Container (Overlapping White Sheet):**
  - Buat container putih (`#FFFFFF`) di bawah header dengan sudut atas membulat besar (`border-radius: 28px` / `rounded-t-3xl`) yang sedikit menumpuk (overlap) ke atas area header.
- **Komponen di Dalam Form Login:**
  - **Role Switcher:** Pertahankan segmented control / tab pill untuk memilih role **`Praktikan`** dan **`Asisten`** di bagian atas form.
  - **Input Email Kampus:** Gunakan style borderless filled input dengan background `#F5F5F7`, sudut membulat (`rounded-2xl`), dan placeholder/default value seperti `praktikan@kampus.ac.id`.
  - **Input Password dengan Split Eye Button:** Gunakan background `#F5F5F7` (`rounded-2xl`). Di sisi kanan input password, buat tombol ikon mata (show/hide password) yang dipisahkan oleh garis vertikal putih tipis (`border-l-2 border-white`) persis seperti desain split-input modern.
  - **Tombol Submit:** Buat tombol berbentuk pill penuh (`rounded-full`) dengan background `#007AFF` atau `#1D1D1F` dan teks putih dinamis sesuai role: `"Masuk sebagai Praktikan"` atau `"Masuk sebagai Asisten"`.
  - **Footer Login:** Pertahankan teks bantuan `"Akun demo terisi otomatis. Pilih role untuk melihat tampilan yang berbeda."` dan copyright `"© 2025 Laboratorium Praktikum"` dengan warna `#AAAAAA`.

---

## 3. Halaman Baru / Redesign: Home Page (Dashboard Praktikan)
Buat atau sesuaikan halaman **Home** sebagai landing page utama setelah user berhasil login:
- **Top Header Profil:**
  - Sisi kiri: Teks sapaan `"Selamat pagi, praktikan"` (warna `#AAAAAA`, ukuran kecil) dan di bawahnya nama user yang sedang login (misal `"Nadia Putri"` atau mengambil nama user dari state login saat ini) dengan font besar, tebal, warna `#1D1D1F`.
  - Sisi kanan: Avatar kotak membulat (`rounded-2xl`) berlatar biru sangat muda dengan teks inisial user berwarna `#007AFF` (misal `"NP"`) dan titik notifikasi merah kecil di pojok kanan atasnya.
- **Hero Banner Biru:**
  - Card berlatar `#007AFF`, sudut membulat besar (`rounded-3xl`), teks putih, dengan hiasan ilustrasi ikon bintang/sparkle semi-transparan di sisi kanan.
  - Isi teks: Label uppercase tanggal hari ini (contoh: `"SELASA, 18 MARET 2025"`), judul besar `"Siap untuk praktikum hari ini?"`, dan subteks jadwal terdekat (contoh: `"Pemrograman Dasar · 08:00 – 10:00"` atau status jadwal aktif).
- **Grid 3 Kartu Ringkasan Statistik:**
  - Buat grid 3 kolom sejajar (`grid-cols-3 gap-3`).
  - Setiap card memiliki background `#F5F5F7`, sudut membulat (`rounded-2xl`), dan padding yang rapi:
    1. **Card 1:** Ikon centang hijau di atas, angka tebal (contoh `"92%"`), label `"Kehadiran"` (`#AAAAAA`).
    2. **Card 2:** Ikon kalender ungu/biru di atas, angka tebal (contoh `"3"`), label `"Jadwal aktif"` (`#AAAAAA`).
    3. **Card 3:** Ikon dokumen kuning/oranye di atas, angka tebal (contoh `"1"`), label `"Izin diproses"` (`#AAAAAA`).
- **Section "Jadwal terdekat":**
  - Header section: Judul `"Jadwal terdekat"` (`#1D1D1F`, bold) di kiri, dan tombol link `"Lihat semua"` (`#007AFF`) di kanan yang mengarahkan ke tab/halaman Jadwal.
  - Daftar Card Jadwal: Setiap item berlatar `#F5F5F7` (`rounded-2xl`) dengan layout horizontal:
    - Sisi kiri: Hari 3 huruf uppercase (`"SEN"`), tanggal angka besar (`"18"`), dan bulan 3 huruf (`"MAR"`).
    - Pembatas tengah: Garis vertikal tebal (`w-1 rounded-full`) berwarna `#007AFF` / ungu-biru.
    - Sisi kanan: Nama mata praktikum bold (`"Pemrograman Dasar"`), waktu & ruangan (`"08:00 – 10:00 · Lab Komputasi 1"` warna `#AAAAAA`), serta nama asisten bold (`"Raka Pratama"`).
    - Jika user belum memiliki jadwal, tampilkan fallback/empty state yang rapi.

---

## 4. Halaman Izin / Perizinan (Pertahankan Model Eksisting + Sesuaikan Tone Warna)
**JANGAN UBAH struktur layout dan fitur yang sudah ada di halaman Izin saat ini.** Cukup sesuaikan palet warnanya dengan Apple Modern:
- Pertahankan header atas dengan judul `"Izin"` dan tombol `"Keluar"` di kanan atas (jika ada pada layout eksisting).
- Pertahankan judul `"Ajukan Izin"` (`#1D1D1F`) dan deskripsi `"Pilih sesi yang tidak bisa kamu ikuti, lalu tuliskan alasannya. Asisten yang akan memutuskan."` (`#AAAAAA`).
- Pertahankan container card putih berborder halus yang berisi:
  - Field **Pilih sesi** (termasuk kotak info `"Kamu belum terdaftar di kelas mana pun. Hubungi asisten pengampu."` jika belum ada kelas).
  - Textarea **Alasan ketidakhadiran** dengan placeholder `"Contoh: Sakit dan sudah ada surat dokter."` dan counter `"0/300 karakter (minimal 10)"`.
  - Kotak informasi AI lokal dengan ikon sparkle: `"Alasanmu dianalisis oleh model AI di perangkatmu (tidak dikirim ke internet) untuk menentukan kategori. AI hanya memberi informasi pendukung dan tidak menentukan izin diterima atau ditolak."`.
  - Tombol submit pill penuh **`"Kirim Pengajuan"`** dengan warna gelap `#1D1D1F` (atau `#007AFF`).
- Pertahankan section **`"Pengajuan Saya (0)"`** di bagian bawah form.

---

## 5. Halaman Riwayat & Bottom Navigation Bar (5 Tab)
- **Update Bottom Navigation Bar menjadi 5 Tab:**
  - Tambahkan tab **Home** di urutan paling kiri sehingga urutannya menjadi:
    1. **Home** (ikon rumah)
    2. **Jadwal** (ikon kalender)
    3. **Presensi** (ikon centang dalam lingkaran/kotak)
    4. **Izin** (ikon dokumen)
    5. **Riwayat** (ikon jam/riwayat)
  - Tab yang sedang aktif menggunakan warna `#007AFF` (ikon dan teks), sedangkan tab tidak aktif menggunakan warna `#AAAAAA`.
- **Penyesuaian Halaman Riwayat:**
  - Tambahkan label kecil `"ACTIVITY LOG"` (`#AAAAAA`), judul besar `"Riwayat"` (`#1D1D1F`), dan subteks `"Pantau semua aktivitas presensi dan pengajuan izinmu."`.
  - Buat segmented tab switcher: **`Presensi`** | **`Perizinan`** dengan latar `#F5F5F7` dan tab aktif putih `#FFFFFF`.
  - Tambahkan banner biru (`#007AFF`, `rounded-2xl`) yang menampilkan kotak ikon centang putih di kiri, angka besar `"92%"`, dan teks `"tingkat kehadiran semester ini"`.
  - Di bawahnya, tampilkan section `"Presensi terbaru"` (beserta jumlah catatan di kanan, misal `"3 catatan"`) yang berisi list item presensi dengan ikon centang di kiri, nama mata praktikum & timestamp (`"11 Mar 2025 · 08:02"`), serta badge status di kanan (`"Hadir"` berlatar biru muda teks `#007AFF`, atau `"Terlambat"` berlatar abu-abu `#F5F5F7` teks `#1D1D1F`).
  - Tetap pertahankan tampilan empty state (`"Belum Ada Riwayat"`) apabila belum ada data sama sekali.