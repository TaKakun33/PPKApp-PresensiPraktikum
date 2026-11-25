// FILE MILIK ZHAFRAN (feat/push-notif) — Kotak masuk & state global notifikasi.
// Menggabungkan notifikasi dari Firestore (users/{uid}/notifications) dan push notification
// yang masuk langsung (termasuk tes via Expo Push Tool) agar selalu bisa dilihat & diklik.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from './AuthContext';
import { useNotifikasi, type IncomingNotifPayload } from '../hooks/useNotifikasi';
import {
  apakahNotifKedaluwarsa,
  hapusNotifikasiKedaluwarsa,
  navigasiDariNotif,
  subscribeNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaNotifikasiDibaca,
  type NotifItem,
} from '../services/notificationService';

type NotificationContextValue = {
  notifications: NotifItem[];
  unreadCount: number;
  loading: boolean;
  bukaNotifikasi: (item: NotifItem) => void;
  tandaiSemuaDibaca: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const activeUid = profile?.id ?? null;

  const [firestoreState, setFirestoreState] = useState<{
    uid: string | null;
    items: NotifItem[];
    settled: boolean;
  }>({ uid: null, items: [], settled: true });

  const [localState, setLocalState] = useState<{
    uid: string | null;
    items: NotifItem[];
  }>({ uid: null, items: [] });

  const [nowMs, setNowMs] = useState(() => Date.now());

  // Perbarui patokan waktu tiap jam agar notifikasi biasa yang melewati 3 hari otomatis tersaring.
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // Tangkap notifikasi push yang masuk langsung (foreground / ketukan),
  // berguna terutama saat tes dari Expo Push Tool atau ketika Firestore belum tersinkron.
  const handleNotifMasuk = useCallback(
    (payload: IncomingNotifPayload) => {
      if (!activeUid) return;
      setLocalState((prev) => {
        const base = prev.uid === activeUid ? prev.items : [];
        if (base.some((n) => n.id === payload.id)) return prev;
        const itemBaru: NotifItem = {
          id: payload.id,
          judul: payload.judul,
          isi: payload.isi,
          data: payload.data,
          dibaca: payload.dibaca,
          penting: payload.penting,
          dibuatPada: payload.dibuatPada,
          sumber: 'lokal',
        };
        return { uid: activeUid, items: [itemBaru, ...base].slice(0, 50) };
      });
    },
    [activeUid],
  );

  // Pasang pendaftaran token & listener expo-notifications.
  useNotifikasi(profile, handleNotifMasuk);

  // Berlangganan kotak masuk Firestore saat user login.
  useEffect(() => {
    if (!activeUid) return;

    const unsub = subscribeNotifikasi(
      activeUid,
      (items) => {
        const sekarang = Date.now();
        const aktif: NotifItem[] = [];
        const kedaluwarsaIds: string[] = [];

        items.forEach((item) => {
          if (apakahNotifKedaluwarsa(item, sekarang)) {
            kedaluwarsaIds.push(item.id);
          } else {
            aktif.push(item);
          }
        });

        setFirestoreState({ uid: activeUid, items: aktif, settled: true });
        setNowMs(sekarang);

        // Hapus otomatis notifikasi biasa yang sudah >= 3 hari dari Firestore.
        if (kedaluwarsaIds.length > 0) {
          void hapusNotifikasiKedaluwarsa(activeUid, kedaluwarsaIds);
        }
      },
      () => {
        // Fallback aman jika rules belum di-deploy / offline: tetap tampilkan notifikasi lokal.
        setFirestoreState({ uid: activeUid, items: [], settled: true });
      },
    );

    return () => {
      unsub();
    };
  }, [activeUid]);

  const firestoreItems = useMemo(
    () => (firestoreState.uid === activeUid ? firestoreState.items : []),
    [firestoreState, activeUid],
  );

  const localItems = useMemo(
    () => (localState.uid === activeUid ? localState.items : []),
    [localState, activeUid],
  );

  const loading = Boolean(activeUid) && (firestoreState.uid !== activeUid || !firestoreState.settled);

  // Gabungkan notifikasi Firestore + lokal tanpa duplikat (judul & isi sama dalam rentang 15 detik),
  // sambil menyaring notifikasi biasa yang sudah melewati batas 3 hari.
  const notifications = useMemo(() => {
    const aktifFirestore = firestoreItems.filter((item) => !apakahNotifKedaluwarsa(item, nowMs));
    const uniqueLocal = localItems.filter((loc) => {
      if (apakahNotifKedaluwarsa(loc, nowMs)) return false;
      return !aktifFirestore.some(
        (fs) =>
          fs.judul === loc.judul &&
          fs.isi === loc.isi &&
          Math.abs(fs.dibuatPada.getTime() - loc.dibuatPada.getTime()) < 15_000,
      );
    });
    return [...aktifFirestore, ...uniqueLocal].sort(
      (a, b) => b.dibuatPada.getTime() - a.dibuatPada.getTime(),
    );
  }, [firestoreItems, localItems, nowMs]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.dibaca).length,
    [notifications],
  );

  const bukaNotifikasi = useCallback(
    (item: NotifItem) => {
      if (!profile) return;

      // Tandai dibaca terlebih dahulu (optimistic di state lokal & update ke Firestore).
      if (!item.dibaca) {
        if (item.sumber === 'lokal') {
          setLocalState((prev) => ({
            uid: prev.uid,
            items: prev.items.map((n) => (n.id === item.id ? { ...n, dibaca: true } : n)),
          }));
        } else {
          setFirestoreState((prev) => ({
            ...prev,
            items: prev.items.map((n) => (n.id === item.id ? { ...n, dibaca: true } : n)),
          }));
          void tandaiNotifikasiDibaca(profile.id, item.id);
        }
      }

      // Arahkan ke layar tujuan jika notifikasi membawa data deep link.
      navigasiDariNotif(item.data, profile.role);
    },
    [profile],
  );

  const tandaiSemuaDibaca = useCallback(async () => {
    if (!profile) return;

    setLocalState((prev) => ({
      uid: prev.uid,
      items: prev.items.map((n) => ({ ...n, dibaca: true })),
    }));

    const unreadFirestoreIds = firestoreItems
      .filter((n) => !n.dibaca)
      .map((n) => n.id);

    if (unreadFirestoreIds.length > 0) {
      setFirestoreState((prev) => ({
        ...prev,
        items: prev.items.map((n) => ({ ...n, dibaca: true })),
      }));
      await tandaiSemuaNotifikasiDibaca(profile.id, unreadFirestoreIds);
    }
  }, [profile, firestoreItems]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      bukaNotifikasi,
      tandaiSemuaDibaca,
    }),
    [notifications, unreadCount, loading, bukaNotifikasi, tandaiSemuaDibaca],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationInbox(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotificationInbox harus dipakai di dalam NotificationProvider');
  }
  return ctx;
}
