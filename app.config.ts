// FILE AKMAL (feat/peta-lab) — SRS-31. Konfigurasi dinamis Expo, melengkapi app.json (bukan menggantikan).
// Expo menjalankan file ini dengan `config` = isi app.json, lalu memakai nilai yang dikembalikan.
// Tujuan: Google Maps API key TIDAK ditulis di repo. Key dibaca dari variabel lingkungan
// GOOGLE_MAPS_API_KEY:
//   - lokal      : taruh di file `.env` (sudah di-ignore Git; lihat .gitignore)
//   - EAS Build  : `eas env:create` (lihat panduan di PR), karena `.env` tidak ikut ter-upload ke cloud
// Plugin expo-location ditambahkan di sini hanya jika belum ada di app.json, supaya tidak ganda
// ketika anggota lain (Damar/Naufal) juga memasang expo-location.
import type { ConfigContext, ExpoConfig } from 'expo/config';

const IZIN_LOKASI = 'Aplikasi memakai lokasimu untuk menampilkan posisimu di peta lab dan memvalidasi presensi.';

function sudahAda(plugins: ExpoConfig['plugins'], nama: string): boolean {
  return (plugins ?? []).some((p) => (Array.isArray(p) ? p[0] : p) === nama);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // Tidak menggagalkan build: fitur lain tetap jalan, tetapi peta Android tampil kosong tanpa key.
    console.warn('[app.config] GOOGLE_MAPS_API_KEY belum diisi: peta Android tidak akan memuat tile.');
  }

  const plugins = [...(config.plugins ?? [])];
  if (!sudahAda(plugins, 'expo-location')) {
    plugins.push(['expo-location', { locationWhenInUsePermission: IZIN_LOKASI }]);
  }

  return {
    ...config,
    name: config.name ?? 'PPKApp-PresensiPraktikum',
    slug: config.slug ?? 'PPKApp-PresensiPraktikum',
    plugins,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey },
      },
    },
  };
};
