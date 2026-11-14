// Deklarasi tipe untuk ai/sentiment.js (file dari pengajar, tidak diubah).
// Ditaruh di src/ agar folder ai/ tetap berisi persis isi paket model-edom.zip.
declare module '*/ai/sentiment.js' {
  export type HasilPrediksiSentimen = {
    /** 'negatif' | 'netral' | 'positif', atau null jika teks kosong / kata tidak dikenali. */
    label: string | null;
    /** 'predicted' | 'unknown_vocabulary' | 'empty_input' */
    status: string;
    scores: number[] | null;
    scoreType: string;
    experimental: boolean;
  };

  export function createSentimentClassifier(model: object): (text: string) => HasilPrediksiSentimen;
}
