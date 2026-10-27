// FILE MILIK PM - store bersama. Semua layar WAJIB membaca dari sini,
// jangan membuat state sendiri untuk sesi/presensi/pengguna.
// Butuh field atau action baru? Minta ke PM.
import React, { createContext, ReactNode, useContext, useState } from 'react';

import {
  INITIAL_ATTENDANCES,
  INITIAL_SESSIONS,
  KELAS,
  MODUL,
  PENDAFTARAN,
  PENGGUNA,
  PENUGASAN,
  PRAKTIKAN,
  PRAKTIKUM,
  RUANGAN,
  TAHUN_AJARAN,
} from '../data/dummy';
import type {
  ActionResult,
  Attendance,
  CheckInResult,
  HistoryItem,
  Kelas,
  KelasInfo,
  RecapItem,
  Session,
  SessionData,
  SessionStatus,
  User,
} from '../data/types';
import { formatRentangWaktu, formatTanggal } from '../utils/format';

// Bandingkan waktu sebagai ANGKA, bukan string: ISO dengan offset berbeda
// ('+07:00' vs 'Z') salah urut kalau dibandingkan sebagai teks.
const ms = (iso: string) => Date.parse(iso);

// Urutan prioritas status: sesi yang sedang dibuka tampil paling atas.
const STATUS_ORDER: Record<SessionStatus, number> = { dibuka: 0, belum_dibuka: 1, ditutup: 2 };

// ID tahun ajaran yang sedang aktif.
const aktifIds = new Set(TAHUN_AJARAN.filter((t) => t.isAktif).map((t) => t.id));

// Gabungkan data mentah sesi dengan data master -> bentuk siap tampil.
// (Nanti saat pakai database, bagian ini diganti hasil join/endpoint API.)
function toSession(d: SessionData): Session {
  const kelas = KELAS.find((k) => k.id === d.kelasId);
  const modul = MODUL.find((m) => m.id === d.modulId);
  const prak = PRAKTIKUM.find((p) => p.id === kelas?.praktikumId);
  return {
    ...d,
    praktikum: `${prak?.nama ?? 'Praktikum'} - Modul ${modul?.nomor ?? '?'}`,
    judulModul: modul?.judul ?? '-',
    kelas: kelas?.kode ?? '-',
    ruangan: RUANGAN.find((r) => r.id === d.ruanganId)?.nama ?? '-',
    tanggal: formatTanggal(d.startAt),
    waktu: formatRentangWaktu(d.startAt, d.endAt),
    asistenNama: PENGGUNA.find((u) => u.id === d.asistenId)?.nama ?? '-',
  };
}

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
  getVisibleSessions: () => Session[]; // sesi di kelas praktikan terdaftar / sesi yang diampu asisten (asistenId)
  getKelasSaya: () => KelasInfo[]; // kelas pengguna aktif (Pendaftaran / Penugasan)
  getSessionById: (sessionId: string) => Session | undefined;
  hasCheckedIn: (sessionId: string, userId?: string) => boolean; // default: currentUser
  getRecap: (sessionId: string) => RecapItem[]; // praktikan yang sudah presensi (urut waktu)
  getHistory: (userId?: string) => HistoryItem[]; // riwayat kehadiran (terbaru dulu), default: currentUser
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // currentUser dummy tetap (praktikan u6 (Andi)) sampai pengguna memilih peran.
  // Dengan begini semua layar bisa dikerjakan tanpa menunggu branch peran dimerge.
  const [currentUser, setCurrentUser] = useState<User>(PRAKTIKAN[0]);
  const [sessionData, setSessionData] = useState<SessionData[]>(INITIAL_SESSIONS);
  // Urut berdasarkan waktu mulai.
  const sessions: Session[] = [...sessionData]
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || ms(a.startAt) - ms(b.startAt))
    .map(toSession);
  const [attendances, setAttendances] = useState<Attendance[]>(INITIAL_ATTENDANCES);

  // ---------- action ----------
  // Praktikan terdaftar di kelas lewat Pendaftaran (bisa lebih dari satu kelas).
  const terdaftar = (kelasId: string) =>
    PENDAFTARAN.some((p) => p.userId === currentUser.id && p.kelasId === kelasId);

  // Hanya asisten pengampu (asistenId) yang boleh membuka/menutup sesi.
  const bukanPengampu = (s: Session) => currentUser.role !== 'asisten' || s.asistenId !== currentUser.id;

  const openSession = (sessionId: string): ActionResult => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (bukanPengampu(s)) return { ok: false, message: 'Hanya asisten pengampu yang dapat membuka sesi ini.' };
    if (s.status === 'dibuka') return { ok: false, message: 'Sesi sudah dibuka.' };
    if (s.status === 'ditutup') {
      return { ok: false, message: 'Sesi yang sudah ditutup tidak dapat dibuka kembali.' };
    }
    const openedAt = new Date().toISOString();
    setSessionData((prev) =>
      prev.map((x) => (x.id === sessionId ? { ...x, status: 'dibuka', openedAt } : x)),
    );
    return { ok: true, message: `${s.praktikum} berhasil dibuka.` };
  };

  const closeSession = (sessionId: string): ActionResult => {
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (bukanPengampu(s)) return { ok: false, message: 'Hanya asisten pengampu yang dapat menutup sesi ini.' };
    if (s.status !== 'dibuka') return { ok: false, message: 'Hanya sesi yang sedang dibuka yang bisa ditutup.' };
    const closedAt = new Date().toISOString();
    setSessionData((prev) =>
      prev.map((x) => (x.id === sessionId ? { ...x, status: 'ditutup', closedAt } : x)),
    );
    return { ok: true, message: `${s.praktikum} berhasil ditutup.` };
  };

  const checkIn = (sessionId: string): CheckInResult => {
    if (currentUser.role !== 'praktikan') {
      return { ok: false, message: 'Hanya praktikan yang dapat melakukan presensi.' };
    }
    const s = sessions.find((x) => x.id === sessionId);
    if (!s) return { ok: false, message: 'Sesi tidak ditemukan.' };
    if (!terdaftar(s.kelasId)) return { ok: false, message: 'Sesi ini bukan untuk kelasmu.' };
    if (s.status === 'belum_dibuka') return { ok: false, message: 'Sesi belum dibuka oleh asisten.' };
    if (s.status === 'ditutup') return { ok: false, message: 'Sesi sudah ditutup.' };
    if (attendances.some((a) => a.sessionId === sessionId && a.userId === currentUser.id)) {
      return { ok: false, message: 'Kamu sudah presensi pada sesi ini.' };
    }
    const attendance: Attendance = {
      id: `att-${sessionId}-${currentUser.id}`, // unik per (sesi, praktikan)
      sessionId,
      userId: currentUser.id,
      waktuHadir: new Date().toISOString(), // jam perangkat saat presensi berhasil
    };
    setAttendances((prev) => [...prev, attendance]);
    return { ok: true, attendance };
  };

  // ---------- selector ----------
  // Praktikan: sesi di kelas yang diikuti. Asisten: sesi yang diampunya (asistenId).
  const getVisibleSessions = (): Session[] =>
    currentUser.role === 'praktikan'
      ? sessions.filter((s) => terdaftar(s.kelasId))
      : sessions.filter((s) => s.asistenId === currentUser.id);

  // Hanya kelas di tahun ajaran aktif (kelas tahun lalu tidak ikut tampil).
  const getKelasSaya = (): KelasInfo[] =>
    (currentUser.role === 'praktikan' ? PENDAFTARAN : PENUGASAN)
      .filter((r) => r.userId === currentUser.id)
      .map((r) => KELAS.find((k) => k.id === r.kelasId))
      .filter((k): k is Kelas => k !== undefined && aktifIds.has(k.tahunAjaranId))
      .map((k) => ({ ...k, praktikum: PRAKTIKUM.find((p) => p.id === k.praktikumId)?.nama ?? '-' }));

  const getSessionById = (sessionId: string) => sessions.find((s) => s.id === sessionId);

  const hasCheckedIn = (sessionId: string, userId: string = currentUser.id) =>
    attendances.some((a) => a.sessionId === sessionId && a.userId === userId);

  const getRecap = (sessionId: string): RecapItem[] =>
    attendances
      .filter((a) => a.sessionId === sessionId)
      .map((a) => ({ attendance: a, user: PRAKTIKAN.find((u) => u.id === a.userId) }))
      .filter((item): item is RecapItem => item.user !== undefined)
      .sort((a, b) => ms(a.attendance.waktuHadir) - ms(b.attendance.waktuHadir));

  const getHistory = (userId: string = currentUser.id): HistoryItem[] =>
    attendances
      .filter((a) => a.userId === userId)
      .map((a) => ({ attendance: a, session: sessions.find((s) => s.id === a.sessionId) }))
      .filter((item): item is HistoryItem => item.session !== undefined)
      .sort((a, b) => ms(b.attendance.waktuHadir) - ms(a.attendance.waktuHadir));

  const value: AppContextValue = {
    currentUser,
    sessions,
    attendances,
    setCurrentUser,
    openSession,
    closeSession,
    checkIn,
    getVisibleSessions,
    getKelasSaya,
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
