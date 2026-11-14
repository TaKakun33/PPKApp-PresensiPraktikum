// FILE AKMAL (feat/auth-leave-ai) — SRS-11 & SRS-12. Sebelumnya stub PM.
// Firebase Auth + profil real-time dari Firestore (`users/{uid}`).
// Ekspor: AuthProvider (dibungkus di _layout.tsx), useAuth() (dipakai semua layar).
// Dokumen profil: { nama, email, role: "asisten"|"praktikan", nim?, kelasIds?, createdAt }.
//
// Perubahan dari stub PM:
//  - Ada register() (profil dibuat saat registrasi, bukan manual oleh admin).
//  - Profil dibaca lewat listener (bukan sekali), jadi perubahan kelasIds langsung terbawa.
//  - Pengguna yang baru mendaftar tidak lagi dikeluarkan karena profilnya belum sempat tertulis.
//  - Offline tidak langsung dianggap "profil hilang": data cache dipakai, ada batas waktu 10 detik.
import { onAuthStateChanged } from '@react-native-firebase/auth';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { auth } from '../lib/firebase';
import type { Profile } from '../lib/types';
import {
  getAuthErrorMessage,
  isRegistering,
  registerUser,
  signInUser,
  signOutUser,
  subscribeProfile,
  type RegisterInput,
} from '../services/authService';

type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; profile: Profile };

type AuthContextValue = {
  state: AuthState;
  // Shortcut helpers — aman dipanggil kapan pun (tidak perlu cek state dulu).
  profile: Profile | null;
  role: Profile['role'] | null;
  loading: boolean;
  authError: string | null;
  // Actions. Error dilempar ke pemanggil; layar yang menampilkan pesannya.
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Batas tunggu profil pertama kali (jika offline dan belum ada cache).
const PROFILE_TIMEOUT_MS = 10000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const stopProfile = () => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      clearTimer();
    };
    // Gagal memuat profil: keluarkan pengguna dengan pesan jelas (supaya tidak terjebak di state aneh).
    const failProfile = (message: string) => {
      stopProfile();
      setAuthError(message);
      setState({ status: 'unauthenticated' });
      signOutUser().catch(() => {});
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      stopProfile();

      if (!firebaseUser) {
        setState({ status: 'unauthenticated' });
        return;
      }

      setState({ status: 'loading' });

      // Saat registrasi, proses registrasi punya batas waktunya sendiri.
      if (!isRegistering()) {
        timer = setTimeout(
          () => failProfile('Profil belum bisa dimuat. Periksa koneksi internet lalu masuk lagi.'),
          PROFILE_TIMEOUT_MS,
        );
      }

      unsubscribeProfile = subscribeProfile(
        firebaseUser.uid,
        (snap) => {
          if (!snap.exists) {
            if (isRegistering()) return; // profil sedang ditulis oleh register()
            if (snap.fromCache) return; // mungkin hanya belum sampai dari server; timer yang menjaga
            failProfile('Profil pengguna belum terdaftar di database. Hubungi admin.');
            return;
          }

          const data = snap.data;
          if (!data || (data.role !== 'asisten' && data.role !== 'praktikan')) {
            failProfile('Peran akun tidak valid. Hubungi admin.');
            return;
          }

          clearTimer();
          setAuthError(null);
          setState({ status: 'authenticated', profile: { id: firebaseUser.uid, ...data } });
        },
        (err) => failProfile(getAuthErrorMessage(err, 'Gagal memuat profil pengguna.')),
      );
    });

    return () => {
      unsubscribeAuth();
      stopProfile();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    await signInUser(email, password);
    // State diperbarui otomatis oleh onAuthStateChanged.
  };

  const register = async (input: RegisterInput) => {
    setAuthError(null);
    await registerUser(input);
    // State menjadi "authenticated" otomatis begitu dokumen profil terbaca.
  };

  const signOut = async () => {
    setAuthError(null);
    await signOutUser();
  };

  const value: AuthContextValue = {
    state,
    profile: state.status === 'authenticated' ? state.profile : null,
    role: state.status === 'authenticated' ? state.profile.role : null,
    loading: state.status === 'loading',
    authError,
    signIn,
    register,
    signOut,
    clearAuthError: () => setAuthError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
