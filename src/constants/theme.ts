import type { TextStyle, ViewStyle } from 'react-native';

// Palet 60-30-10 "Porcelain / Graphite / Coral" + Ink untuk teks.
//   60% base   : Porcelain -> latar layar
//   30% brand  : Graphite  -> tab bar, header, kartu gelap (hero)
//   10% accent : Coral     -> tombol utama, badge, progres, item terpilih (sebagai LATAR)
//   text       : Ink       -> teks isi dan ikon
// Aturan coral:
//   - teks di atas coral selalu Ink (onPrimary, 5.7:1); teks putih gagal (3.0:1)
//   - coral sebagai teks/ikon di latar terang pakai primaryText #C8304F (4.8:1)
// Semua pasangan teks/latar lolos kontras WCAG AA (>= 4.5:1).
const palette = {
  porcelain: '#F4F4F0',
  graphite: '#2E3135',
  graphiteLight: '#B4B8BE',
  graphiteTint: '#E4E5E7',
  coral: '#FF5A7A',
  coralDeep: '#C8304F',
  coralTint: '#FFECEF',
  ink: '#1B1C1E',
  white: '#FFFFFF',
  gray200: '#E2E2DC',
  gray300: '#C8C8C0',
  gray500: '#6A6D71',
  gray600: '#5C5F63',
} as const;

export const colors = {
  // 10% - aksen
  primary: palette.coral,
  primaryText: palette.coralDeep,
  primaryTint: palette.coralTint,
  onPrimary: palette.ink,
  // 30% - brand
  secondary: palette.graphite,
  tint: palette.graphiteTint,
  tabInactive: palette.graphiteLight,
  // 60% - base
  bg: palette.porcelain,
  card: palette.white,
  surface: palette.porcelain,
  border: palette.gray200,
  dashed: palette.gray300,
  white: palette.white,
  // Teks & ikon
  text: palette.ink,
  textSecondary: palette.gray600,
  placeholder: palette.gray500,
  // Semantik
  success: '#17744A',
  successTint: '#E6F4EC',
  warning: '#8A5A12',
  warningTint: '#FBF1DC',
  danger: '#B42323',
  dangerTint: '#FBE9E9',
  dangerBorder: '#F5C7C7',
  overlay: 'rgba(27, 28, 30, 0.48)',
} as const;

export const radius = {
  pill: 999,
  card: 22,
  input: 18,
  icon: 12,
} as const;

export const layout = {
  screenPadding: 20,
  tabBarSpace: 120,
} as const;

export const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const text: Record<
  'screenTitle' | 'sectionTitle' | 'body' | 'bodyStrong' | 'caption' | 'button' | 'tab',
  TextStyle
> = {
  screenTitle: { fontSize: 18, fontFamily: font.extraBold, color: colors.text },
  sectionTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  body: { fontSize: 13, lineHeight: 19, fontFamily: font.medium, color: colors.textSecondary },
  bodyStrong: { fontSize: 13, lineHeight: 19, fontFamily: font.semibold, color: colors.text },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: font.medium, color: colors.textSecondary },
  button: {
    fontSize: 14,
    fontFamily: font.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.white,
  },
  tab: { fontSize: 11, fontFamily: font.semibold },
};

export const status = {
  success: { bg: colors.successTint, text: colors.success },
  warning: { bg: colors.warningTint, text: colors.warning },
  danger: { bg: colors.dangerTint, text: colors.danger },
  neutral: { bg: colors.surface, text: colors.textSecondary },
  info: { bg: colors.tint, text: colors.secondary },
  active: { bg: colors.primary, text: colors.onPrimary },
} as const;

export const shadow: Record<'floating', ViewStyle> = {
  floating: {
    shadowColor: colors.secondary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
};
