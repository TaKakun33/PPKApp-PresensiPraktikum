// Layanan payload QR presensi (SRS-26).
// Mengemas dan mem-parsing payload "sessionId:kode" yang digunakan untuk QR presensi.

/** Parsi payload QR "sessionId:kode" -> { sessionId, kode }. */
export function parsingPayloadQR(payload: string): { sessionId: string; kode: string } | null {
  const titikDua = payload.indexOf(':');
  if (titikDua <= 0) return null;
  const sessionId = payload.slice(0, titikDua);
  const kode = payload.slice(titikDua + 1);
  if (!sessionId || !kode) return null;
  return { sessionId, kode };
}

/** Buat string payload QR dari sessionId dan kode. */
export function buatPayloadQR(sessionId: string, kode: string): string {
  return `${sessionId}:${kode}`;
}
