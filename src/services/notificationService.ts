// FILE MILIK ZHAFRAN (feat/push-notif) — SRS-34, 35, 36
// Registrasi token push notifikasi ke Firestore dan pengiriman push notification.
// Pola error handling mengikuti serviceUtils.ts (createAppError & withTimeout).

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@react-native-firebase/firestore';

import { db } from '../lib/firebase';

// ─── KONFIGURASI FOREGROUND ────────────────────────────────────────────────────
// Tampilkan notifikasi meski aplikasi sedang aktif di layar (SRS-35).

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── TIPE ─────────────────────────────────────────────────────────────────────

/** Dokumen di koleksi pushTokens/{uid}. */
export type PushTokenDoc = {
  token: string;
  platform: 'android' | 'ios';
  diperbaruiPada: ReturnType<typeof serverTimestamp>;
};

/** Data notifikasi untuk deep link. Harus sama dengan yang dicek di useNotifikasi. */
export type NotifData = {
  layar?: 'detail-sesi' | 'izin' | 'jadwal';
  id?: string;
};

// ─── REGISTRASI TOKEN — SRS-34 ────────────────────────────────────────────────

/**
 * Minta izin notifikasi dan simpan push token ke Firestore (`pushTokens/{uid}`).
 * - Hanya berjalan di perangkat nyata (bukan emulator/Expo Go).
 * - Jika izin ditolak atau token gagal: kembalikan null, TIDAK melempar error.
 *   Aplikasi tetap berjalan (K7 / SRS-36).
 * @returns push token jika berhasil, null jika gagal/ditolak.
 */
export async function daftarkanPushToken(uid: string): Promise<string | null> {
  // Push notification hanya berfungsi di perangkat fisik nyata.
  if (!Device.isDevice) {
    console.warn('[Notifikasi] Push notification hanya berjalan di perangkat nyata, bukan emulator.');
    return null;
  }

  // Cek & minta izin notifikasi.
  const { status: statusSekarang } = await Notifications.getPermissionsAsync();
  let statusAkhir = statusSekarang;

  if (statusSekarang !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    statusAkhir = status;
  }

  // Izin ditolak: catat peringatan, jangan crash (SRS-36 / K7).
  if (statusAkhir !== 'granted') {
    console.warn('[Notifikasi] Izin notifikasi ditolak pengguna. Fitur notifikasi tidak aktif.');
    return null;
  }

  // Dapatkan Expo push token.
  let token: string;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const result = await Notifications.getExpoPushTokenAsync({ projectId });
    token = result.data;
  } catch (e) {
    console.error('[Notifikasi] Gagal mendapatkan push token:', e);
    return null; // Gagal ambil token: aplikasi tetap jalan (SRS-36).
  }

  // Simpan token ke Firestore: pushTokens/{uid}.
  try {
    await setDoc(doc(db, 'pushTokens', uid), {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      diperbaruiPada: serverTimestamp(),
    } satisfies PushTokenDoc);
  } catch (e) {
    // Gagal simpan: token tidak terdaftar, notif tidak akan diterima.
    // Tapi aplikasi tetap berjalan (SRS-36).
    console.error('[Notifikasi] Gagal menyimpan token ke Firestore:', e);
    return null;
  }

  console.log('[Notifikasi] Token berhasil didaftarkan:', token);
  return token;
}

// ─── PENGIRIMAN NOTIFIKASI — SRS-35 ───────────────────────────────────────────

/**
 * Kirim push notification ke beberapa pengguna (berdasarkan uid).
 * - Ambil token dari koleksi `pushTokens`.
 * - Hanya uid yang punya token yang menerima notifikasi.
 * - Gagal mengirim: dicatat di console, TIDAK melempar error
 *   (agar tidak mengganggu alur utama seperti buka sesi atau keputusan izin).
 *
 * @param userIds - Daftar uid penerima.
 * @param judul   - Judul notifikasi.
 * @param isi     - Isi/body notifikasi.
 * @param data    - Data deep link (layar tujuan + id).
 */
export async function kirimNotifikasi(
  userIds: string[],
  judul: string,
  isi: string,
  data?: NotifData,
): Promise<void> {
  if (userIds.length === 0) return;

  // Ambil token dari Firestore. Firestore `in` query max 30 item, pecah jika lebih.
  const tokens: string[] = [];
  const potongan: string[][] = [];
  for (let i = 0; i < userIds.length; i += 30) {
    potongan.push(userIds.slice(i, i + 30));
  }

  for (const ids of potongan) {
    try {
      const snap = await getDocs(
        query(collection(db, 'pushTokens'), where('__name__', 'in', ids)),
      );
      snap.docs.forEach((d) => {
        const tokenData = d.data() as Partial<PushTokenDoc>;
        if (tokenData.token) tokens.push(tokenData.token);
      });
    } catch (e) {
      console.error('[Notifikasi] Gagal mengambil token dari Firestore:', e);
      return; // Batalkan pengiriman jika token tidak bisa diambil.
    }
  }

  if (tokens.length === 0) return; // Tidak ada penerima yang terdaftar.

  // Kirim ke Expo Push Notification Service.
  // Docs: https://docs.expo.dev/push-notifications/sending-notifications/
  const messages = tokens.map((token) => ({
    to: token,
    title: judul,
    body: isi,
    data: data ?? {},
    sound: 'default' as const,
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const teks = await response.text();
      console.error('[Notifikasi] Expo Push API error:', response.status, teks);
    }
  } catch (e) {
    // Jaringan bermasalah: notif tidak terkirim, tapi fitur utama tetap jalan.
    console.error('[Notifikasi] Gagal mengirim ke Expo Push API:', e);
  }
}
