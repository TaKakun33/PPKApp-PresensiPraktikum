// FILE AKMAL (feat/auth-leave-ai) — SRS-14.
// Integrasi AI: menganalisis alasan izin memakai model sentimen LOKAL dari pengajar (folder `ai/`).
// Model berjalan murni di JavaScript di dalam aplikasi: tanpa internet, tanpa API key, tanpa dependency baru.
//
// Aturan:
//  - classifyLeaveReason() TIDAK PERNAH melempar error. Jika AI gagal / alasan tidak terbaca,
//    hasilnya { kategori: null, status: 'gagal' } dan pengajuan izin tetap disimpan tanpa kategori.
//  - Hasil AI hanya informasi pendukung — tidak boleh dipakai untuk menerima/menolak izin.
//  - Label null (komentar kosong / kata tidak dikenali) dianggap GAGAL, bukan "netral" (sesuai ai/README.md).
//
// Catatan model: dilatih dari komentar evaluasi dosen (EDOM), bukan alasan izin praktikum,
// jadi kategorinya (negatif / netral / positif) hanya perkiraan awal.
import model from '../../ai/model-edom.json';
import { createSentimentClassifier } from '../../ai/sentiment.js';

// ─── tipe ─────────────────────────────────────────────────────────────────────

export type AiResult = {
  kategori: string | null;
  status: 'berhasil' | 'gagal';
  /** Alasan teknis singkat (untuk debugging / log), bukan untuk ditampilkan mentah. */
  reason?: string;
};

// ─── pembuatan model ──────────────────────────────────────────────────────────

// Dibuat sekali di luar fungsi supaya tidak dibuat ulang setiap pengajuan izin.
// createSentimentClassifier melempar error jika format model tidak didukung,
// jadi dibungkus try/catch agar aplikasi tidak crash saat dimuat.
let prediksiSentimen: ReturnType<typeof createSentimentClassifier> | null = null;
let galatMemuatModel: string | null = null;

try {
  prediksiSentimen = createSentimentClassifier(model);
} catch (e) {
  galatMemuatModel = e instanceof Error ? e.message : 'Model AI gagal dimuat.';
}

// ─── klasifikasi ──────────────────────────────────────────────────────────────

/** Analisis alasan izin di perangkat. Tidak pernah melempar error. */
export async function classifyLeaveReason(alasan: string): Promise<AiResult> {
  if (!prediksiSentimen) {
    return { kategori: null, status: 'gagal', reason: galatMemuatModel ?? 'Model AI belum siap.' };
  }

  try {
    const prediksi = prediksiSentimen(alasan);

    if (prediksi.label === null) {
      return {
        kategori: null,
        status: 'gagal',
        reason:
          prediksi.status === 'empty_input'
            ? 'Alasan kosong, tidak dapat dianalisis.'
            : 'Tidak ada kata yang dikenali model.',
      };
    }

    return { kategori: prediksi.label, status: 'berhasil' };
  } catch (e) {
    return {
      kategori: null,
      status: 'gagal',
      reason: e instanceof Error ? e.message : 'Analisis AI gagal.',
    };
  }
}
