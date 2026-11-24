import type { TextStyle, ViewStyle } from 'react-native';

// Palet 60-30-10 "Chalk / Moss / Vermilion" + Ink untuk teks.
//   60% base   : Chalk     -> latar layar dan permukaan
//   30% brand  : Moss      -> tab bar, header/kartu hero, tab & opsi terpilih, tautan
//   10% accent : Vermilion -> tombol utama, CTA, tenggat/penanda waktu, status "Dibuka"
//   text       : Ink       -> teks isi dan ikon
// Success (teal) dan danger (crimson) sengaja dibedakan dari moss dan vermilion
// supaya status tidak tertukar dengan warna brand/aksen.
// Semua pasangan teks/latar lolos kontras WCAG AA (>= 4.5:1).
const palette = {
  chalk: '#F4F1EA',
  moss: '#4A5A2B',
  mossLight: '#D3DBBE',
  mossTint: '#E6EAD9',
  vermilion: '#C63A22',
  vermilionTint: '#FDF1ED',
  ink: '#22201C',
  white: '#FFFFFF',
  stone200: '#E3DED2',
  stone300: '#CFC8B8',
  stone500: '#6E685C',
  stone600: '#5F5A50',
} as const;

export const colors = {
  // 10% - aksen
  primary: palette.vermilion,
  primaryTint: palette.vermilionTint,
  // 30% - brand
  secondary: palette.moss,
  tint: palette.mossTint,
  tabInactive: palette.mossLight,
  // 60% - base
  bg: palette.chalk,
  card: palette.white,
  surface: palette.chalk,
  border: palette.stone200,
  dashed: palette.stone300,
  white: palette.white,
  // Teks & ikon
  text: palette.ink,
  textSecondary: palette.stone600,
  placeholder: palette.stone500,
  // Semantik
  success: '#1F6B5C',
  successTint: '#E3F1EC',
  warning: '#8A5A12',
  warningTint: '#FBF1DC',
  danger: '#9E1B32',
  dangerTint: '#F9E6EA',
  dangerBorder: '#F0C4CD',
  overlay: 'rgba(34, 32, 28, 0.48)',
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
