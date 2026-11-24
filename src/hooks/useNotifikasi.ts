// FILE MILIK ZHAFRAN (feat/push-notif) — SRS-34, 36
// Hook yang dipasang di _layout.tsx:
//   - Mendaftarkan push token saat user login (SRS-34).
//   - Navigasi ke layar yang sesuai saat notifikasi diketuk (SRS-36).

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import type { Profile } from '../lib/types';
import { daftarkanPushToken, type NotifData } from '../services/notificationService';

// ─── NAVIGASI DARI NOTIFIKASI (SRS-36) ────────────────────────────────────────

/**
 * Navigasi ke layar yang sesuai berdasarkan data notifikasi.
 * Mengikuti pola routing Expo Router yang sudah ada di project.
 * - detail-sesi : app/session/[id].tsx
 * - izin        : app/asisten/izin.tsx atau app/praktikan/izin.tsx
 * - jadwal      : app/asisten/jadwal.tsx atau app/praktikan/jadwal.tsx
 */
function navigasiDariNotif(data: NotifData, role: Profile['role']): void {
  if (!data?.layar) return;

  switch (data.layar) {
    case 'detail-sesi':
      if (data.id) router.push(`/session/${data.id}` as never);
      break;
    case 'izin':
      router.push(role === 'asisten' ? '/asisten/izin' : '/praktikan/izin');
      break;
    case 'jadwal':
      router.push(role === 'asisten' ? '/asisten/jadwal' : '/praktikan/jadwal');
      break;
    default:
      break;
  }
}

// ─── HOOK UTAMA ────────────────────────────────────────────────────────────────

/**
 * Pasang di _layout.tsx setelah AuthProvider.
 * Efek berjalan ulang setiap kali profile.id atau profile.role berubah (login/logout).
 *
 * @param profile - Profil pengguna yang sedang login, atau null jika belum login.
 */
export function useNotifikasi(profile: Profile | null): void {
  // Ref untuk cleanup listener agar tidak memory leak.
  const listenerForegroundRef = useRef<Notifications.EventSubscription | null>(null);
  const listenerResponseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Tidak ada user yang login: tidak perlu mendaftar atau memasang listener.
    if (!profile) {
      listenerForegroundRef.current?.remove();
      listenerResponseRef.current?.remove();
      return;
    }

    // SRS-34: Daftarkan token saat user login.
    // Error sudah ditangani di dalam fungsi (tidak perlu catch di sini).
    daftarkanPushToken(profile.id);

    // SRS-36: Tangani notifikasi yang masuk saat app di foreground.
    // setNotificationHandler di notificationService.ts sudah mengurus tampilannya.
    listenerForegroundRef.current = Notifications.addNotificationReceivedListener(
      (notification: Notifications.Notification) => {
        // Hanya log untuk debug; tampilan sudah diatur oleh setNotificationHandler.
        console.log('[useNotifikasi] Notifikasi diterima (foreground):', notification.request.identifier);
      },
    );

    // SRS-36: Tangani ketukan notifikasi → navigasi ke layar yang sesuai.
    listenerResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as NotifData;
        navigasiDariNotif(data, profile.role);
      },
    );

    return () => {
      // Cleanup saat logout atau profile berubah.
      listenerForegroundRef.current?.remove();
      listenerResponseRef.current?.remove();
    };
    // Re-run hanya jika user ganti (id) atau role berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);
}
