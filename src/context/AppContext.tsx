// FILE MILIK PM - store bersama. Semua layar WAJIB membaca dari sini,
// jangan membuat state sendiri untuk sesi/presensi/pengguna.
// Butuh field atau action baru? Minta ke PM.
import React, { createContext, ReactNode, useContext, useState } from 'react';

import { ALL_USERS, INITIAL_ATTENDANCES, INITIAL_SESSIONS, PRAKTIKAN } from '../data/dummy';
import type {
  ActionResult,
  Attendance,
  CheckInResult,
  HistoryItem,
  RecapItem,
  Session,
  User,
} from '../data/types';

type AppContextValue = {
  // ---- state ----
  currentUser: User;
  sessions: Session[];
  attendances: Attendance[];

  // ---- action ----
  setCurrentUser: (user: User) => void; // dipakai layar pilih peran / ganti peran
  openSession: (sessionId: string) => ActionResult; // Belum Dibuka -> Dibuka
  closeSession: (sessionId: string) => ActionResult; // Dibuka -> Ditutup
  checkIn: (sessionId: string) => CheckInResult; // presensi oleh currentUser

  // ---- selector ----
  getVisibleSessions: () => Session[]; // sesi sesuai kelas praktikan / kelas diampu asisten
  getSessionById: (sessionId: string) => Session | undefined;
  hasCheckedIn: (sessionId: string, userId?: string) => boolean; // default: currentUser
  getRecap: (sessionId: string) => RecapItem[]; // praktikan yang sudah presensi (urut waktu)
  getHistory: (userId?: string) => HistoryItem[]; // riwayat kehadiran (terbaru dulu), default: currentUser
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // currentUser dummy tetap (praktikan p1) sampai pengguna memilih peran.
  // Dengan begini semua layar bisa dikerjakan tanpa menunggu branch peran dimerge.
  const [currentUser, setCurrentUser] = useState<User>(PRAKTIKAN[0]);
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [attendances, setAttendances] = useState<Attendance[]>(INITIAL_ATTENDANCES);

  // ---------- action ----------
  const openSession = (sessionId: string): ActionResult => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (s.status === 'Dibuka') return { ok: false, message: 'Sesi sudah dibuka.' };
    if (s.status === 'Ditutup') {
      return { ok: false, message: 'Sesi yang sudah ditutup tidak dapat dibuka kembali.' };
    }
    setSessions((prev) => prev.map((x) => (x.id === sessionId ? { ...x, status: 'Dibuka' } : x)));
    return { ok: true, message: `${s.praktikum} berhasil dibuka.` };
  };

  const closeSession = (sessionId: string): ActionResult => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (s.status !== 'Dibuka') return { ok: false, message: 'Hanya sesi yang sedang dibuka yang bisa ditutup.' };
    setSessions((prev) => prev.map((x) => (x.id === sessionId ? { ...x, status: 'Ditutup' } : x)));
    return { ok: true, message: `${s.praktikum} berhasil ditutup.` };
  };

  const checkIn = (sessionId: string): CheckInResult => {
    if (currentUser.role !== 'praktikan') {
      return { ok: false, message: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (s.status === 'Belum Dibuka') return { ok: false, message: 'Sesi belum dibuka oleh asisten.' };
    if (s.status === 'Ditutup') return { ok: false, message: 'Sesi sudah ditutup.' };
    if (attendances.some((a) => a.sessionId === sessionId && a.userId === currentUser.id)) {
      return { ok: false, message: 'Kamu sudah presensi pada sesi ini.' };
    }
    const attendance: Attendance = {
      id: `att-${Date.now()}`,
      sessionId,
      userId: currentUser.id,
      waktuHadir: new Date().toISOString(), // jam perangkat saat presensi berhasil
    };
    setAttendances((prev) => [...prev, attendance]);
    return { ok: true, attendance };
  };

  // ---------- selector ----------
  const getVisibleSessions = (): Session[] => {
    if (currentUser.role === 'praktikan') {
      return sessions.filter((s) => s.kelas === currentUser.kelas);
    }
    return sessions.filter((s) => (currentUser.kelasDiampu ?? []).includes(s.kelas));
  };

  const getSessionById = (sessionId: string) => sessions.find((s) => s.id === sessionId);

  const hasCheckedIn = (sessionId: string, userId: string = currentUser.id) =>
    attendances.some((a) => a.sessionId === sessionId && a.userId === userId);

  const getRecap = (sessionId: string): RecapItem[] =>
    attendances
      .filter((a) => a.sessionId === sessionId)
      .map((a) => ({ attendance: a, user: ALL_USERS.find((u) => u.id === a.userId) as User }))
      .filter((item) => item.user !== undefined)
      .sort((a, b) => a.attendance.waktuHadir.localeCompare(b.attendance.waktuHadir));

  const getHistory = (userId: string = currentUser.id): HistoryItem[] =>
    attendances
      .filter((a) => a.userId === userId)
      .map((a) => ({ attendance: a, session: sessions.find((s) => s.id === a.sessionId) as Session }))
      .filter((item) => item.session !== undefined)
      .sort((a, b) => b.attendance.waktuHadir.localeCompare(a.attendance.waktuHadir));

  const value: AppContextValue = {
    currentUser,
    sessions,
    attendances,
    setCurrentUser,
    openSession,
    closeSession,
    checkIn,
    getVisibleSessions,
    getSessionById,
    hasCheckedIn,
    getRecap,
    getHistory,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp harus dipakai di dalam <AppProvider>');
  return ctx;
}
