// Deklarasi tipe untuk sentiment.js (file dari pengajar tidak diubah).
// Dipakai TypeScript agar import dari src/services/aiService.ts punya tipe yang jelas.

export type HasilPrediksiSentimen = {
  /** 'negatif' | 'netral' | 'positif', atau null jika komentar kosong / kata tidak dikenali. */
  label: string | null;
  /** 'predicted' | 'unknown_vocabulary' | 'empty_input' */
  status: string;
  scores: number[] | null;
  scoreType: string;
  experimental: boolean;
};

export function createSentimentClassifier(model: object): (text: string) => HasilPrediksiSentimen;
