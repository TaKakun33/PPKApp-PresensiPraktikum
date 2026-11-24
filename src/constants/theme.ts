import type { TextStyle, ViewStyle } from 'react-native';

// Palet 60-30-10 "Mist / Aubergine / Citron" + Ink untuk teks (Ink tidak dihitung).
//   60% neutral : Mist      -> latar, ruang kosong
//   30% brand   : Aubergine -> tab bar, header/kartu hero, kartu & opsi aktif, tautan
//   10% accent  : Citron    -> SATU aksi utama per layar, progres
//   text        : Ink       -> teks dan ikon
// Citron sangat terang: hanya dipakai sebagai LATAR dengan teks Ink (onPrimary),
// tidak pernah sebagai warna teks/garis di atas latar terang (kontras 1.2:1).
// Semua pasangan teks/latar lolos kontras WCAG AA (>= 4.5:1).
const palette = {
  mist: '#F1EFF4',
  aubergine: '#3E2A47',
  aubergineLight: '#CDBFD4',
  aubergineTint: '#E8E1EC',
  citron: '#D8E84A',
  ink: '#241B29',
  white: '#FFFFFF',
  gray200: '#E3DFE8',
  gray300: '#C9C3D0',
  gray500: '#6C6472',
  gray600: '#5E5664',
} as const;

export const colors = {
  // 10% - aksen (selalu dengan teks onPrimary)
  primary: palette.citron,
  onPrimary: palette.ink,
  // 30% - brand
  secondary: palette.aubergine,
  tint: palette.aubergineTint,
  tabInactive: palette.aubergineLight,
  // 60% - neutral
  bg: palette.mist,
  card: palette.white,
  surface: palette.mist,
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
  overlay: 'rgba(36, 27, 41, 0.48)',
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
