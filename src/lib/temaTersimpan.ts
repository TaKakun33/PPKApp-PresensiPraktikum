// Pilihan tema & mode tampilan yang disimpan di perangkat (bukan di Firestore).
// Dibaca SINKRON saat aplikasi mulai, karena warna dipakai StyleSheet.create di level modul.
// Mengganti tema = simpan pilihan lalu muat ulang aplikasi (lihat PemilihTema).
import { File, Paths } from 'expo-file-system';

import { DEFAULT_THEME, THEMES, type ThemeId, type ThemeMode } from '../constants/themes';

export type PilihanTema = { tema: ThemeId; mode: ThemeMode };

export const PILIHAN_BAWAAN: PilihanTema = { tema: DEFAULT_THEME, mode: 'light' };
const MODE_VALID: ThemeMode[] = ['light', 'dark'];

function berkasTema(): File {
  return new File(Paths.document, 'tema.json');
}

function temaValid(nilai: unknown): nilai is ThemeId {
  return typeof nilai === 'string' && Object.prototype.hasOwnProperty.call(THEMES, nilai);
}

/** Baca pilihan tersimpan. Gagal/rusak/belum ada → pilihan bawaan. */
export function bacaPilihanTema(): PilihanTema {
  try {
    const berkas = berkasTema();
    if (!berkas.exists) return PILIHAN_BAWAAN;
    const data = JSON.parse(berkas.textSync()) as Partial<PilihanTema>;
    return {
      tema: temaValid(data.tema) ? data.tema : PILIHAN_BAWAAN.tema,
      mode: MODE_VALID.includes(data.mode as ThemeMode) ? (data.mode as ThemeMode) : PILIHAN_BAWAAN.mode,
    };
  } catch {
    return PILIHAN_BAWAAN;
  }
}

export async function simpanPilihanTema(pilihan: PilihanTema): Promise<void> {
  const berkas = berkasTema();
  if (!berkas.exists) berkas.create();
  await berkas.write(JSON.stringify(pilihan));
}
