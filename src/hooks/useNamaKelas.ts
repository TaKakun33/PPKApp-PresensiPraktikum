// Peta id kelas -> nama kelas (field `namaKelas` di koleksi `classes`), real-time.
// Dipakai layar yang hanya punya `kelasId` (id dokumen Firestore, mis. "lh2USsMf7h...") supaya yang
// tampil ke pengguna adalah nama kelasnya ("Kelas B"), bukan id acak.
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { subscribeClassesForUser } from '../services/classService';

export type NamaKelas = {
  /** Nama kelas untuk sebuah id. Selama belum termuat: "Memuat kelas..."; kalau kelasnya sudah tidak ada: "Kelas tidak ditemukan". */
  labelKelas: (kelasId: string) => string;
};

export function useNamaKelas(): NamaKelas {
  const { profile } = useAuth();
  const [state, setState] = useState<{ userId: string; map: Record<string, string> } | null>(null);

  const userId = profile?.id;
  const role = profile?.role;
  const kelasKey = (profile?.kelasIds ?? []).join(',');

  useEffect(() => {
    if (!profile) return;
    return subscribeClassesForUser(
      profile,
      (data) =>
        setState({
          userId: profile.id,
          map: Object.fromEntries(data.map((c) => [c.id, c.namaKelas || 'Kelas tanpa nama'])),
        }),
      () => setState({ userId: profile.id, map: {} }),
    );
    // profile berganti objek tiap snapshot; id, peran, dan kelasIds sudah mewakilinya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, kelasKey]);

  return useMemo(() => {
    const aktif = state && state.userId === userId ? state.map : null;
    return {
      labelKelas: (kelasId: string) => {
        if (!aktif) return 'Memuat kelas...';
        return aktif[kelasId] ?? 'Kelas tidak ditemukan';
      },
    };
  }, [state, userId]);
}
