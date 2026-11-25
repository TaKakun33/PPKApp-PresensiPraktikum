// FILE MILIK ZHAFRAN (feat/push-notif) — SRS-34, 36
// Hook yang dipasang di NotificationProvider (_layout.tsx):
//   - Mendaftarkan push token saat user login (SRS-34).
//   - Meneruskan notifikasi yang masuk ke kotak masuk in-app.
//   - Navigasi ke layar yang sesuai saat notifikasi diketuk (SRS-36).

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import type { Profile } from '../lib/types';
import {
  daftarkanPushToken,
  navigasiDariNotif,
  type NotifData,
} from '../services/notificationService';

export type IncomingNotifPayload = {
  id: string;
  judul: string;
  isi: string;
  data: NotifData;
  dibaca: boolean;
  penting: boolean;
  dibuatPada: Date;
};

function ekstrakNotif(
  notification: Notifications.Notification,
  dibaca: boolean,
): IncomingNotifPayload {
  const content = notification.request.content;
  const data = (content.data ?? {}) as NotifData;
  return {
    id: notification.request.identifier || `local-${Date.now()}`,
    judul: content.title || 'Notifikasi',
    isi: content.body || '',
    data,
    dibaca,
    penting: Boolean(data.penting),
    dibuatPada: notification.date ? new Date(notification.date) : new Date(),
  };
}

/**
 * Efek berjalan ulang setiap kali profile.id atau profile.role berubah (login/logout).
 *
 * @param profile      - Profil pengguna yang sedang login, atau null jika belum login.
 * @param onNotifMasuk - Callback opsional untuk menyimpan notifikasi masuk ke kotak masuk.
 */
export function useNotifikasi(
  profile: Profile | null,
  onNotifMasuk?: (payload: IncomingNotifPayload) => void,
): void {
  // Ref untuk cleanup listener agar tidak memory leak.
  const listenerForegroundRef = useRef<Notifications.EventSubscription | null>(null);
  const listenerResponseRef = useRef<Notifications.EventSubscription | null>(null);
  const onNotifMasukRef = useRef(onNotifMasuk);

  useEffect(() => {
    onNotifMasukRef.current = onNotifMasuk;
  }, [onNotifMasuk]);

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
        console.log('[useNotifikasi] Notifikasi diterima (foreground):', notification.request.identifier);
        onNotifMasukRef.current?.(ekstrakNotif(notification, false));
      },
    );

    // SRS-36: Tangani ketukan notifikasi → navigasi ke layar yang sesuai.
    listenerResponseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response: Notifications.NotificationResponse) => {
        const payload = ekstrakNotif(response.notification, true);
        onNotifMasukRef.current?.(payload);
        navigasiDariNotif(payload.data, profile.role);
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
