// FILE AKMAL (feat/auth-leave-ai) — SRS-11. Bantu layar form agar field yang sedang diisi
// tidak tertutup keyboard HP.
//
// Latar belakang: di Android modern (edge-to-edge) sistem tidak lagi me-resize jendela saat keyboard
// muncul. KeyboardAvoidingView mengecilkan area layar, lalu hook ini menggulir ScrollView ke field
// yang sedang difokus.
import { useRef, type ComponentRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';

// ─── konstanta ────────────────────────────────────────────────────────────────

// Jeda agar area layar sudah mengecil (keyboard selesai muncul) sebelum menggulir.
const JEDA_SCROLL_MS = 250;
// Jarak kosong di atas field setelah digulir.
const JARAK_ATAS = 24;

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useScrollKeFieldFokus() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const posisiForm = useRef(0);
  const posisiField = useRef<Record<string, number>>({});

  /** Pasang di View pembungkus semua field (anak langsung dari isi ScrollView). */
  const saatLayoutForm = (e: LayoutChangeEvent) => {
    posisiForm.current = e.nativeEvent.layout.y;
  };

  /** Pasang di View pembungkus tiap field, dengan nama field. */
  const saatLayoutField = (nama: string) => (e: LayoutChangeEvent) => {
    posisiField.current[nama] = e.nativeEvent.layout.y;
  };

  /** Panggil dari onFocus milik TextInput. */
  const fokusKe = (nama: string) => {
    const y = posisiForm.current + (posisiField.current[nama] ?? 0) - JARAK_ATAS;
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(y, 0), animated: true }), JEDA_SCROLL_MS);
  };

  return { scrollRef, saatLayoutForm, saatLayoutField, fokusKe };
}
