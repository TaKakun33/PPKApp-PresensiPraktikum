// Lembar pemilih tema: mode tampilan (Terang / Gelap) + 8 tema warna.
// Lembar ini (termasuk contoh layar di atasnya) langsung memakai warna pilihan, jadi perubahan
// terlihat sebelum diterapkan. Saat Terapkan, pilihan disimpan di perangkat lalu aplikasi dimuat
// ulang agar semua layar ikut memakai warna baru.
import Ionicons from '@expo/vector-icons/Ionicons';
import { reloadAppAsync } from 'expo';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { font, pilihanTema, radius } from '../constants/theme';
import { THEMES, type ThemeColors, type ThemeId, type ThemeMode } from '../constants/themes';
import { simpanPilihanTema } from '../lib/temaTersimpan';

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MODE: { value: ThemeMode; label: string; icon: 'sunny-outline' | 'moon-outline' }[] = [
  { value: 'light', label: 'Terang', icon: 'sunny-outline' },
  { value: 'dark', label: 'Gelap', icon: 'moon-outline' },
];

const DAFTAR_TEMA = Object.keys(THEMES) as ThemeId[];

export default function PemilihTema({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [tema, setTema] = useState<ThemeId>(pilihanTema.tema);
  const [mode, setMode] = useState<ThemeMode>(pilihanTema.mode);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [daftarTerbuka, setDaftarTerbuka] = useState(false);

  // Warna pilihan saat ini (belum diterapkan) — dipakai seluruh lembar sebagai pratinjau.
  const c = THEMES[tema][mode];
  const s = useMemo(() => buatGaya(c), [c]);
  const berubah = tema !== pilihanTema.tema || mode !== pilihanTema.mode;

  const tutup = () => {
    if (menyimpan) return;
    setTema(pilihanTema.tema);
    setMode(pilihanTema.mode);
    setGalat(null);
    setDaftarTerbuka(false);
    onClose();
  };

  const terapkan = async () => {
    if (!berubah) {
      onClose();
      return;
    }
    setMenyimpan(true);
    setGalat(null);
    try {
      await simpanPilihanTema({ tema, mode });
      await reloadAppAsync('Ganti tema');
    } catch {
      setMenyimpan(false);
      setGalat('Tema gagal disimpan. Tutup lalu buka kembali aplikasi, kemudian coba lagi.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={tutup}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={tutup} accessibilityLabel="Tutup pemilih tema" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.handle} />
        <View style={styles.judulBaris}>
          <Text style={s.title} accessibilityRole="header">
            Tampilan
          </Text>
          <Pressable onPress={tutup} hitSlop={10} accessibilityRole="button" accessibilityLabel="Batal">
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>
        </View>

        {/* Tata letak tetap (tidak ikut di-scroll); hanya daftar tema yang punya gulir sendiri. */}
        <View style={styles.isi}>
          {/* Contoh layar dengan warna pilihan */}
          <View style={s.mock} accessibilityLabel="Pratinjau tema">
            <View style={styles.mockHeader}>
              <View style={s.mockAvatar}>
                <Text style={s.mockAvatarTeks}>B</Text>
              </View>
              <View style={styles.flex}>
                <Text style={s.mockSapaan}>Selamat siang</Text>
                <Text style={s.mockNama}>Bima</Text>
              </View>
              <View style={s.mockIkon}>
                <Ionicons name="notifications-outline" size={14} color={c.text} />
              </View>
            </View>
            <View style={s.mockHero}>
              <Text style={s.mockHeroJudul}>Siap untuk praktikum hari ini?</Text>
              <Text style={s.mockHeroSub}>Praktikum PPK • 10.10 – 12.10</Text>
              <View style={s.mockHeroTombol}>
                <Text style={s.mockHeroTombolTeks}>Lihat detail jadwal</Text>
              </View>
            </View>
            <View style={s.mockKartu}>
              <View style={s.mockBadge}>
                <Text style={s.mockBadgeTeks}>Dibuka</Text>
              </View>
              <Text style={s.mockKartuTeks}>Lab C • Asisten1</Text>
              <View style={s.mockPrimer}>
                <Text style={s.mockPrimerTeks}>Presensi</Text>
              </View>
            </View>
            <View style={s.mockTab}>
              {(['home', 'calendar-outline', 'map-outline', 'checkbox-outline'] as const).map((ikon, i) => (
                <View key={ikon} style={i === 0 ? s.mockTabAktif : styles.mockTabItem}>
                  <Ionicons name={ikon} size={14} color={i === 0 ? c.onHighlight : c.tabInactive} />
                </View>
              ))}
            </View>
          </View>

          <Text style={s.label}>Mode</Text>
          <View style={s.segmen}>
            {MODE.map((m) => {
              const aktif = m.value === mode;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  style={[styles.segmenItem, aktif && s.segmenAktif]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: aktif }}
                  accessibilityLabel={`Mode ${m.label}`}
                >
                  <Ionicons name={m.icon} size={16} color={aktif ? c.onPrimary : c.text} />
                  <Text style={[s.segmenTeks, aktif && { color: c.onPrimary }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.label}>Tema warna</Text>
          <Pressable
            onPress={() => setDaftarTerbuka((v) => !v)}
            style={[s.dropdown, daftarTerbuka && s.dropdownTerbuka]}
            accessibilityRole="button"
            accessibilityState={{ expanded: daftarTerbuka }}
            accessibilityLabel={`Tema warna: ${THEMES[tema].name}. Ketuk untuk ganti.`}
          >
            <Swatch w={c} />
            <View style={styles.kartuTeks}>
              <Text style={s.kartuNama} numberOfLines={1}>
                {THEMES[tema].name}
              </Text>
              <Text style={s.caption} numberOfLines={1}>
                {THEMES[tema].mood}
              </Text>
            </View>
            <Ionicons name={daftarTerbuka ? 'chevron-up' : 'chevron-down'} size={20} color={c.textSecondary} />
          </Pressable>
          {daftarTerbuka ? (
            // Daftar punya gulir sendiri; tingginya menyusut bila layar pendek, bagian lain tetap.
            <ScrollView style={[s.daftar, styles.daftarMenyusut]} nestedScrollEnabled showsVerticalScrollIndicator>
              {DAFTAR_TEMA.map((id, i) => {
                const aktif = id === tema;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      setTema(id);
                      setDaftarTerbuka(false);
                    }}
                    style={({ pressed }) => [
                      styles.opsi,
                      i > 0 && s.opsiGaris,
                      (aktif || pressed) && { backgroundColor: c.primaryTint },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: aktif }}
                    accessibilityLabel={`Tema ${THEMES[id].name}`}
                  >
                    <Swatch w={THEMES[id][mode]} kecil />
                    <Text style={[s.opsiTeks, aktif && { color: c.primaryText }]} numberOfLines={1}>
                      {THEMES[id].name}
                    </Text>
                    {aktif ? <Ionicons name="checkmark" size={18} color={c.primaryText} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {galat ? <Text style={[s.caption, { color: c.danger }]}>{galat}</Text> : null}
        {berubah ? <Text style={s.caption}>Aplikasi dimuat ulang sebentar untuk menerapkan tema.</Text> : null}
        <Pressable
          onPress={() => void terapkan()}
          disabled={menyimpan}
          style={({ pressed }) => [s.tombol, (pressed || menyimpan) && styles.tombolDitekan]}
          accessibilityRole="button"
          accessibilityState={{ disabled: menyimpan, busy: menyimpan }}
        >
          {menyimpan ? <ActivityIndicator color={c.onPrimary} /> : null}
          <Text style={s.tombolTeks}>{menyimpan ? 'Menerapkan…' : berubah ? 'Terapkan' : 'Tutup'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

/** Contoh 3 warna inti sebuah tema: latar, brand, aksen. */
function Swatch({ w, kecil = false }: { w: ThemeColors; kecil?: boolean }) {
  return (
    <View style={[styles.pratinjau, kecil && styles.pratinjauKecil, { backgroundColor: w.bg, borderColor: w.border }]}>
      <View style={[styles.pratinjauBrand, kecil && styles.pratinjauBrandKecil, { backgroundColor: w.secondary }]} />
      <View style={[styles.pratinjauAksen, kecil && styles.pratinjauAksenKecil, { backgroundColor: w.primary }]} />
    </View>
  );
}

// Gaya yang bergantung pada warna pilihan (dibuat ulang setiap tema/mode berganti).
function buatGaya(c: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      maxHeight: '90%',
      backgroundColor: c.card,
      borderTopLeftRadius: radius.card,
      borderTopRightRadius: radius.card,
      paddingHorizontal: 20,
      paddingTop: 10,
      gap: 10,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: c.border,
      marginBottom: 4,
    },
    title: { fontSize: 18, fontFamily: font.extraBold, color: c.heading },
    label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginTop: 4 },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: font.medium, color: c.textSecondary },

    mock: { borderRadius: radius.input, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, padding: 12, gap: 10 },
    mockAvatar: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
    mockAvatarTeks: { fontSize: 12, fontFamily: font.extraBold, color: c.secondaryText },
    mockSapaan: { fontSize: 10, fontFamily: font.medium, color: c.textSecondary },
    mockNama: { fontSize: 13, fontFamily: font.extraBold, color: c.heading },
    mockIkon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    mockHero: { borderRadius: 14, backgroundColor: c.secondary, padding: 12, gap: 4 },
    mockHeroJudul: { fontSize: 13, fontFamily: font.extraBold, color: c.onSecondary },
    mockHeroSub: { fontSize: 10, fontFamily: font.medium, color: c.onSecondary, opacity: 0.85 },
    mockHeroTombol: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: c.highlightOnBrand },
    mockHeroTombolTeks: { fontSize: 10, fontFamily: font.bold, color: c.onHighlight },
    mockKartu: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 10 },
    mockBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: c.successTint },
    mockBadgeTeks: { fontSize: 10, fontFamily: font.bold, color: c.success },
    mockKartuTeks: { flex: 1, fontSize: 11, fontFamily: font.semibold, color: c.text },
    mockPrimer: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: c.primary },
    mockPrimerTeks: { fontSize: 10, fontFamily: font.bold, color: c.onPrimary },
    mockTab: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderRadius: radius.pill, backgroundColor: c.secondary, padding: 5 },
    mockTabAktif: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: c.highlightOnBrand },

    segmen: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: radius.input, backgroundColor: c.surface },
    segmenAktif: { backgroundColor: c.primary },
    segmenTeks: { fontSize: 13, fontFamily: font.semibold, color: c.text },

    dropdown: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.input, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.card },
    dropdownTerbuka: { borderColor: c.primaryText },
    daftar: { maxHeight: 264, borderRadius: radius.input, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: 'hidden' },
    opsiGaris: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    opsiTeks: { flex: 1, fontSize: 13, fontFamily: font.semibold, color: c.text },
    kartuNama: { fontSize: 14, fontFamily: font.bold, color: c.text },

    tombol: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: radius.input, backgroundColor: c.primary },
    tombolTeks: { fontSize: 14, fontFamily: font.bold, color: c.onPrimary },
  });
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  judulBaris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  isi: { flexShrink: 1, gap: 8, paddingBottom: 4 },
  daftarMenyusut: { flexShrink: 1 },
  flex: { flex: 1 },
  mockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mockTabItem: { paddingHorizontal: 14, paddingVertical: 6 },
  segmenItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.icon },
  pratinjau: { width: 56, height: 40, borderRadius: 10, borderWidth: 1, overflow: 'hidden', justifyContent: 'flex-end' },
  pratinjauBrand: { height: 14 },
  pratinjauAksen: { position: 'absolute', top: 7, left: 8, width: 18, height: 10, borderRadius: 5 },
  pratinjauKecil: { width: 36, height: 26, borderRadius: 7 },
  pratinjauBrandKecil: { height: 9 },
  pratinjauAksenKecil: { top: 5, left: 5, width: 12, height: 7, borderRadius: 4 },
  opsi: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  kartuTeks: { flex: 1, gap: 2 },
  tombolDitekan: { opacity: 0.85 },
});
