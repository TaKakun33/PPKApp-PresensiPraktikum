// FILE AKMAL (feat/auth-leave-ai) — SRS-14.
// Integrasi AI: menganalisis SENTIMEN ALASAN IZIN (positif / netral / negatif) memakai model EDOM dari pengajar.
// Berjalan lokal di perangkat (JavaScript murni): tanpa internet, tanpa API key, tanpa dependency baru.
//
// Sesuai petunjuk pengajar (Model EDOM.md), isi paket model-edom.zip diletakkan APA ADANYA di folder `ai/`:
//   ai/model-edom.json, ai/sentiment.js, ai/README.md, ai/requirements.txt  — tidak diubah.
//
// Catatan jujur: model EDOM dilatih dari komentar evaluasi dosen, bukan alasan izin, sehingga hasilnya hanya
// perkiraan kasar. Karena itu hasil AI HANYA informasi pendukung dan tidak pernah dipakai untuk
// menerima/menolak izin.
//
// Aturan:
//  - classifyLeaveReason() TIDAK PERNAH melempar error. Jika AI gagal / alasan tidak terbaca,
//    hasilnya { kategori: null, status: 'gagal' } dan pengajuan izin tetap disimpan tanpa kategori.
//  - Alasan yang tidak terbaca TIDAK dianggap "netral".
import model from '../../ai/model-edom.json';
import { createSentimentClassifier } from '../../ai/sentiment.js';

// ─── kategori ─────────────────────────────────────────────────────────────────

/** Harus sama dengan daftar `kategoriAI` di firestore.rules dan `labels` di ai/model-edom.json. */
export const KATEGORI_IZIN = ['positif', 'netral', 'negatif'] as const;
export type KategoriIzin = (typeof KATEGORI_IZIN)[number];

const KATEGORI_LABEL: Record<KategoriIzin, string> = {
  positif: 'Positif',
  netral: 'Netral',
  negatif: 'Negatif',
};

/** Label ramah untuk ditampilkan. Nilai tak dikenal / null → "tidak tersedia". */
export function labelKategori(kategori: string | null | undefined): string {
  if (!kategori) return 'tidak tersedia';
  // Data lama (sebelum model sentimen) bisa berisi kategori lain: tampilkan apa adanya.
  return (KATEGORI_LABEL as Record<string, string>)[kategori] ?? kategori;
}

// ─── tipe ─────────────────────────────────────────────────────────────────────

export type AiResult = {
  kategori: string | null;
  status: 'berhasil' | 'gagal';
  /** Alasan teknis singkat (untuk debugging / log), bukan untuk ditampilkan mentah. */
  reason?: string;
};

// ─── pembuatan model ──────────────────────────────────────────────────────────

// Dibuat sekali di luar fungsi supaya tidak dibuat ulang setiap pengajuan izin.
// createSentimentClassifier melempar error jika format model tidak didukung, jadi dibungkus try/catch
// agar aplikasi tidak crash saat dimuat.
let klasifikasi: ReturnType<typeof createSentimentClassifier> | null = null;
let galatMemuatModel: string | null = null;

try {
  klasifikasi = createSentimentClassifier(model);
} catch (e) {
  galatMemuatModel = e instanceof Error ? e.message : 'Model AI gagal dimuat.';
}

// ─── klasifikasi ──────────────────────────────────────────────────────────────

const ALASAN_GAGAL: Record<string, string> = {
  empty_input: 'Alasan kosong, tidak dapat dianalisis.',
  unknown_vocabulary: 'Tidak ada kata yang dikenali model.',
};

/** Analisis alasan izin di perangkat. Tidak pernah melempar error. */
export async function classifyLeaveReason(alasan: string): Promise<AiResult> {
  if (!klasifikasi) {
    return { kategori: null, status: 'gagal', reason: galatMemuatModel ?? 'Model AI belum siap.' };
  }

  try {
    const hasil = klasifikasi(alasan);

    if (hasil.label === null) {
      return { kategori: null, status: 'gagal', reason: ALASAN_GAGAL[hasil.status] ?? 'Alasan tidak dapat dianalisis.' };
    }
    // Pengaman: hanya kategori yang diizinkan Security Rules yang boleh disimpan.
    if (!(KATEGORI_IZIN as readonly string[]).includes(hasil.label)) {
      return { kategori: null, status: 'gagal', reason: 'Kategori dari model tidak dikenali.' };
    }

    return { kategori: hasil.label, status: 'berhasil' };
  } catch (e) {
    return {
      kategori: null,
      status: 'gagal',
      reason: e instanceof Error ? e.message : 'Analisis AI gagal.',
    };
  }
}
