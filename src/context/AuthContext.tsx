// FILE MILIK PM — Firebase Auth + profil dari Firestore.
// Ekspor: AuthProvider (bungkus di _layout.tsx), useAuth() (dipakai semua layar).
// Struktur dokumen Firestore koleksi "users":
//   { nama: string, email: string, role: "asisten"|"praktikan", nim?: string, kelasIds?: string[] }
// Dokumen dibuat MANUAL oleh admin di Firestore Console, bukan saat register.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
} from "@react-native-firebase/auth";
import { doc, getDoc } from "@react-native-firebase/firestore";
import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { auth, db } from "../app/firebase";
import type { Profile } from "../app/types";

type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; profile: Profile };

type AuthContextValue = {
  state: AuthState;
  // Shortcut helpers — aman dipanggil kapanpun (tidak perlu cek state dulu).
  profile: Profile | null;
  role: Profile["role"] | null;
  loading: boolean;
  authError: string | null;
  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ status: "unauthenticated" });
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        if (!snap.exists()) {
          // Dokumen belum ada di Firestore — logout agar tidak terjebak di state aneh.
          await fbSignOut(auth);
          setAuthError("Profil pengguna belum terdaftar di database. Hubungi admin.");
          setState({ status: "unauthenticated" });
          return;
        }

        const data = snap.data() as Omit<Profile, "id">;
        if (data.role !== "asisten" && data.role !== "praktikan") {
          await fbSignOut(auth);
          setAuthError("Peran akun tidak valid. Hubungi admin.");
          setState({ status: "unauthenticated" });
          return;
        }

        setAuthError(null);
        setState({
          status: "authenticated",
          profile: { id: firebaseUser.uid, ...data },
        });
      } catch {
        // Gagal ambil profil (misal: offline / permission denied) → kembali ke unauthenticated.
        setAuthError("Gagal memuat profil pengguna. Periksa koneksi internet kamu.");
        setState({ status: "unauthenticated" });
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    // Lempar error ke pemanggil — layar login yang menangani pesan.
    await signInWithEmailAndPassword(auth, email, password);
    // State diperbarui otomatis oleh onAuthStateChanged di atas.
  };

  const signOut = async () => {
    setAuthError(null);
    await fbSignOut(auth);
    // State diperbarui otomatis oleh onAuthStateChanged di atas.
  };

  const value: AuthContextValue = {
    state,
    profile: state.status === "authenticated" ? state.profile : null,
    role: state.status === "authenticated" ? state.profile.role : null,
    loading: state.status === "loading",
    authError,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}