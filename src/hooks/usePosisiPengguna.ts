// FILE AKMAL (feat/peta-lab) — SRS-31, SRS-33.
// Posisi perangkat untuk marker pengguna di peta, lengkap dengan kondisi perangkatnya:
// izin ditolak, GPS mati, lokasi belum didapat, atau error lain. Tidak pernah melempar error ke layar:
// semua kondisi dikembalikan sebagai `status` supaya peta tetap tampil tanpa marker pengguna.
// Hook ini hanya membaca lokasi; validasi radius presensi ada di fitur presensi (Damar), bukan di sini.
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { Koordinat } from '../utils/aktivitasLab';

export type PosisiPengguna = Koordinat & { akurasiMeter: number | null };

export type StatusLokasi =
  | { jenis: 'memeriksa' }
  | { jenis: 'mencari' }
  | { jenis: 'tidak_didapat' }
  | { jenis: 'siap'; posisi: PosisiPengguna }
  | { jenis: 'izin_ditolak'; bisaMinta: boolean }
  | { jenis: 'gps_mati' }
  | { jenis: 'error'; pesan: string };

/** Seberapa sering status GPS dicek ulang selama layar aktif (GPS bisa dimatikan dari panel notifikasi). */
const CEK_GPS_MS = 8000;
const PEMBARUAN_MS = 2000;
const JARAK_MINIMAL_M = 3;
const LOKASI_TERAKHIR_MAKS_UMUR_MS = 60_000;
/** Batas menunggu posisi pertama; lewat dari ini status menjadi `tidak_didapat` (pelacakan tetap berjalan). */
const BATAS_CARI_MS = 20_000;

function keKoordinat(loc: Location.LocationObject): PosisiPengguna {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    akurasiMeter: typeof loc.coords.accuracy === 'number' ? loc.coords.accuracy : null,
  };
}

/**
 * @param aktif  true selama layar peta terlihat. Saat false, pelacakan dihentikan (hemat baterai).
 */
export function usePosisiPengguna(aktif: boolean) {
  const [status, setStatusState] = useState<StatusLokasi>({ jenis: 'memeriksa' });
  // Cermin `status` untuk dibaca di dalam callback asinkron tanpa membuat effect dipasang ulang.
  const statusRef = useRef<StatusLokasi>(status);
  const setStatus = useCallback((baru: StatusLokasi) => {
    statusRef.current = baru;
    setStatusState(baru);
  }, []);
  const langganan = useRef<Location.LocationSubscription | null>(null);
  // Nomor putaran: callback dari putaran lama (sudah dibatalkan) diabaikan.
  const putaran = useRef(0);
  const batasCari = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hentikan = useCallback(() => {
    putaran.current += 1;
    if (batasCari.current) clearTimeout(batasCari.current);
    batasCari.current = null;
    langganan.current?.remove();
    langganan.current = null;
  }, []);

  const mulai = useCallback(
    async (mintaIzin: boolean) => {
      hentikan();
      const saya = putaran.current;
      const masihBerlaku = () => putaran.current === saya;

      try {
        let izin = await Location.getForegroundPermissionsAsync();
        if (!masihBerlaku()) return;
        if (!izin.granted && mintaIzin && izin.canAskAgain) {
          izin = await Location.requestForegroundPermissionsAsync();
          if (!masihBerlaku()) return;
        }
        if (!izin.granted) {
          setStatus({ jenis: 'izin_ditolak', bisaMinta: izin.canAskAgain });
          return;
        }

        if (!(await Location.hasServicesEnabledAsync())) {
          if (masihBerlaku()) setStatus({ jenis: 'gps_mati' });
          return;
        }

        setStatus({ jenis: 'mencari' });
        // Posisi tak kunjung didapat (mis. di dalam gedung): beri tahu pengguna, tetapi biarkan pelacakan
        // berjalan sehingga status otomatis menjadi `siap` begitu posisi akhirnya didapat.
        batasCari.current = setTimeout(() => {
          if (masihBerlaku() && statusRef.current.jenis === 'mencari') setStatus({ jenis: 'tidak_didapat' });
        }, BATAS_CARI_MS);

        // Tampilkan posisi terakhir yang diketahui lebih dulu supaya marker cepat muncul.
        const terakhir = await Location.getLastKnownPositionAsync({
          maxAge: LOKASI_TERAKHIR_MAKS_UMUR_MS,
        }).catch(() => null);
        if (!masihBerlaku()) return;
        if (terakhir) setStatus({ jenis: 'siap', posisi: keKoordinat(terakhir) });

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: PEMBARUAN_MS,
            distanceInterval: JARAK_MINIMAL_M,
          },
          (loc) => {
            if (masihBerlaku()) setStatus({ jenis: 'siap', posisi: keKoordinat(loc) });
          },
        );
        if (!masihBerlaku()) {
          sub.remove();
          return;
        }
        langganan.current = sub;
      } catch {
        if (masihBerlaku()) {
          setStatus({ jenis: 'error', pesan: 'Lokasi perangkat belum bisa dibaca. Coba lagi.' });
        }
      }
    },
    [hentikan, setStatus],
  );

  // Mulai saat layar aktif, hentikan saat tidak aktif / dilepas.
  // Pemanggilan `mulai` bersifat asinkron: setState terjadi setelah await, bukan sinkron di dalam effect.
  useEffect(() => {
    if (!aktif) return;
    void mulai(true);
    return hentikan;
  }, [aktif, mulai, hentikan]);

  // Pengguna kembali dari pengaturan (mengaktifkan izin / GPS): periksa ulang tanpa memunculkan dialog baru.
  useEffect(() => {
    if (!aktif) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void mulai(false);
    });
    return () => sub.remove();
  }, [aktif, mulai]);

  // GPS yang dimatikan saat pelacakan berjalan tidak selalu memunculkan error: cek berkala.
  useEffect(() => {
    if (!aktif) return;
    const timer = setInterval(() => {
      Location.hasServicesEnabledAsync()
        .then((nyala) => {
          const jenis = statusRef.current.jenis;
          if (!nyala && (jenis === 'siap' || jenis === 'mencari' || jenis === 'tidak_didapat')) {
            hentikan();
            setStatus({ jenis: 'gps_mati' });
          } else if (nyala && jenis === 'gps_mati') {
            void mulai(false); // GPS dinyalakan kembali: lanjutkan pelacakan.
          }
        })
        .catch(() => {});
    }, CEK_GPS_MS);
    return () => clearInterval(timer);
  }, [aktif, mulai, hentikan, setStatus]);

  return {
    status,
    /** Minta izin (jika masih bisa) lalu mulai melacak. */
    mintaIzin: useCallback(() => mulai(true), [mulai]),
    /** Periksa ulang kondisi perangkat tanpa dialog izin. */
    cobaLagi: useCallback(() => mulai(false), [mulai]),
  };
}
