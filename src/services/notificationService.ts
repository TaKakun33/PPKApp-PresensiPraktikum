// FILE MILIK ZHAFRAN (feat/push-notif) — SRS-34, 35, 36
// Registrasi token push notifikasi ke Firestore dan pengiriman push notification.
// Pola error handling mengikuti serviceUtils.ts (createAppError & withTimeout).

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { router } from 'expo-router';

import { auth, db } from '../lib/firebase';
import type { Profile } from '../lib/types';

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
  namaDevice: string;
  email: string;
  diperbaruiPada: ReturnType<typeof serverTimestamp>;
};

/** Ambil nama perangkat yang mudah dibaca untuk identifikasi dokumen pushTokens di Firestore. */
function ambilNamaDevice(): string {
  const deviceName = Device.deviceName?.trim();
  const modelName = Device.modelName?.trim();
  const brand = Device.brand?.trim();

  if (deviceName && modelName) {
    const lowerDevice = deviceName.toLowerCase();
    const lowerModel = modelName.toLowerCase();
    if (lowerModel.includes(lowerDevice)) return modelName.slice(0, 150);
    if (lowerDevice.includes(lowerModel)) return deviceName.slice(0, 150);
    return `${deviceName} (${modelName})`.slice(0, 150);
  }
  if (deviceName) return deviceName.slice(0, 150);
  if (brand && modelName) {
    if (modelName.toLowerCase().startsWith(brand.toLowerCase())) {
      return modelName.slice(0, 150);
    }
    return `${brand} ${modelName}`.slice(0, 150);
  }
  if (modelName) return modelName.slice(0, 150);
  if (brand) return brand.slice(0, 150);
  return 'Perangkat tidak diketahui';
}

/** Masa simpan notifikasi biasa sebelum dihapus otomatis (3 hari). */
export const RETENSI_NOTIF_HARI = 3;
export const RETENSI_NOTIF_MS = RETENSI_NOTIF_HARI * 24 * 60 * 60 * 1000;

/** Data notifikasi untuk deep link. Harus sama dengan yang dicek di useNotifikasi & NotificationsScreen. */
export type NotifData = {
  layar?: 'detail-sesi' | 'izin' | 'jadwal';
  id?: string;
  /** Tandai sebagai notifikasi penting dari asisten (tidak dihapus otomatis setelah 3 hari). */
  penting?: boolean;
};

/** Item riwayat notifikasi untuk kotak masuk (inbox) pengguna. */
export type NotifItem = {
  id: string;
  judul: string;
  isi: string;
  data: NotifData;
  dibaca: boolean;
  /** Jika true, notifikasi penting dari asisten tidak akan dihapus otomatis setelah 3 hari. */
  penting: boolean;
  dibuatPada: Date;
  sumber: 'firestore' | 'lokal';
};

/** True jika notifikasi biasa (bukan penting) sudah melewati batas simpan 3 hari. */
export function apakahNotifKedaluwarsa(
  item: Pick<NotifItem, 'penting' | 'dibuatPada'>,
  sekarangMs: number = Date.now(),
): boolean {
  if (item.penting) return false;
  return sekarangMs - item.dibuatPada.getTime() >= RETENSI_NOTIF_MS;
}

/**
 * Navigasi ke layar yang sesuai berdasarkan data notifikasi.
 * Dipakai saat notifikasi sistem diketuk (useNotifikasi) maupun saat item di kotak masuk diklik.
 */
export function navigasiDariNotif(data: NotifData | undefined, role: Profile['role']): boolean {
  if (!data?.layar) return false;

  switch (data.layar) {
    case 'detail-sesi':
      if (data.id) {
        router.push(`/session/${data.id}` as never);
        return true;
      }
      return false;
    case 'izin':
      router.push(role === 'asisten' ? '/asisten/izin' : '/praktikan/izin');
      return true;
    case 'jadwal':
      router.push(role === 'asisten' ? '/asisten/jadwal' : '/praktikan/jadwal');
      return true;
    default:
      return false;
  }
}

// ─── REGISTRASI TOKEN — SRS-34 ────────────────────────────────────────────────

/**
 * Minta izin notifikasi dan simpan push token ke Firestore (`pushTokens/{uid}`).
 * - Hanya berjalan di perangkat nyata (bukan emulator/Expo Go).
 * - Jika izin ditolak atau token gagal: kembalikan null, TIDAK melempar error.
 *   Aplikasi tetap berjalan (K7 / SRS-36).
 * @returns push token jika berhasil, null jika gagal/ditolak.
 */
export async function daftarkanPushToken(
  uid: string,
  email?: string,
): Promise<string | null> {
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

  const emailTersimpan = (email?.trim() || auth.currentUser?.email?.trim() || '').slice(0, 254);
  if (!emailTersimpan) {
    console.warn('[Notifikasi] Email pengguna tidak tersedia; pendaftaran push token dilewati.');
    return null;
  }

  const namaDevice = ambilNamaDevice();

  // Simpan token ke Firestore: pushTokens/{uid}.
  try {
    await setDoc(doc(db, 'pushTokens', uid), {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      namaDevice,
      email: emailTersimpan,
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

  // Simpan riwayat notifikasi ke kotak masuk Firestore: users/{uid}/notifications.
  // Gagal simpan riwayat tidak boleh membatalkan pengiriman push notification.
  const penting = Boolean(data?.penting);
  await Promise.all(
    userIds.map((uid) =>
      addDoc(collection(db, 'users', uid, 'notifications'), {
        judul,
        isi,
        data: data ?? {},
        dibaca: false,
        penting,
        dibuatPada: serverTimestamp(),
      }).catch((e) => {
        console.warn('[Notifikasi] Gagal menyimpan riwayat notifikasi ke Firestore:', e);
      }),
    ),
  );

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

// ─── KOTAK MASUK NOTIFIKASI (INBOX) ───────────────────────────────────────────

function toDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date();
}

/**
 * Subscribe real-time ke kotak masuk notifikasi pengguna (`users/{uid}/notifications`).
 * Jika Firestore rules belum aktif atau error, panggilan tetap aman (tidak crash).
 */
export function subscribeNotifikasi(
  uid: string,
  onData: (items: NotifItem[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('dibuatPada', 'desc'),
    limit(50),
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: NotifItem[] = snap.docs.map((d) => {
        const raw = d.data() as {
          judul?: string;
          isi?: string;
          data?: NotifData;
          dibaca?: boolean;
          penting?: boolean;
          dibuatPada?: unknown;
        };
        const data = raw.data ?? {};
        return {
          id: d.id,
          judul: raw.judul ?? 'Notifikasi',
          isi: raw.isi ?? '',
          data,
          dibaca: Boolean(raw.dibaca),
          penting: Boolean(raw.penting ?? data.penting),
          dibuatPada: toDate(raw.dibuatPada),
          sumber: 'firestore',
        };
      });
      onData(items);
    },
    (err) => {
      console.warn('[Notifikasi] Gagal berlangganan kotak masuk Firestore:', err);
      onError?.(err);
    },
  );
}

/** Tandai satu notifikasi Firestore sebagai sudah dibaca. */
export async function tandaiNotifikasiDibaca(uid: string, notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { dibaca: true });
  } catch (e) {
    console.warn('[Notifikasi] Gagal menandai notifikasi dibaca:', e);
  }
}

/** Tandai semua notifikasi Firestore yang belum dibaca sebagai sudah dibaca. */
export async function tandaiSemuaNotifikasiDibaca(uid: string, notifIds: string[]): Promise<void> {
  if (notifIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.update(doc(db, 'users', uid, 'notifications', id), { dibaca: true });
    });
    await batch.commit();
  } catch (e) {
    console.warn('[Notifikasi] Gagal menandai semua notifikasi dibaca:', e);
  }
}

/**
 * Hapus otomatis notifikasi biasa (bukan penting) di Firestore yang usianya sudah >= 3 hari.
 * Notifikasi penting dari asisten (`penting: true`) tidak pernah dihapus.
 */
export async function hapusNotifikasiKedaluwarsa(uid: string, notifIds: string[]): Promise<void> {
  if (notifIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.delete(doc(db, 'users', uid, 'notifications', id));
    });
    await batch.commit();
  } catch (e) {
    console.warn('[Notifikasi] Gagal menghapus notifikasi kedaluwarsa:', e);
  }
}
