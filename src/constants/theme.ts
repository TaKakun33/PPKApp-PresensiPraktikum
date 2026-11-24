import type { TextStyle, ViewStyle } from 'react-native';

// Palet 60-30-10 monokromatik lavender (hue ~250deg) + warna semantik.
//   60% netral    : bg, card, surface, border  -> abu bersemburat lavender
//   30% sekunder  : indigo-plum gelap          -> teks, tab bar, kartu hero, ikon
//   10% primer    : lavender                   -> tombol utama, state aktif/terpilih, tautan
// Warning (amber) adalah komplementer ungu, jadi tetap menonjol sebagai status.
// Semua pasangan teks/latar lolos kontras WCAG AA (>= 4.5:1).
const palette = {
  lavender600: '#6A4FC4', // lavender tua: cukup gelap untuk teks putih (5.9:1)
  lavender300: '#C9C0F0', // lavender muda: sorotan di atas latar gelap
  lavender50: '#F0EDFC',
  plum900: '#241F45',
  plum100: '#E9E5F8',
  gray0: '#FFFFFF',
  gray50: '#F7F6FB',
  gray200: '#E7E5EF',
  gray300: '#CBC7D9',
  gray500: '#6B6880',
  gray600: '#5E5A72',
} as const;

export const colors = {
  // 10% - aksen
  primary: palette.lavender600,
  primarySoft: palette.lavender300,
  primaryTint: palette.lavender50,
  // 30% - sekunder
  secondary: palette.plum900,
  tint: palette.plum100,
  tabInactive: palette.lavender300,
  // 60% - netral
  bg: palette.gray50,
  card: palette.gray0,
  surface: palette.gray50,
  border: palette.gray200,
  dashed: palette.gray300,
  white: palette.gray0,
  // Teks
  text: palette.plum900,
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
  overlay: 'rgba(36, 31, 69, 0.48)',
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
  active: { bg: colors.primaryTint, text: colors.primary },
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
