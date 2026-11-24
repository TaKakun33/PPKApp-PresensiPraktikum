import type { TextStyle, ViewStyle } from 'react-native';

// Palet 60-30-10 "Sand / Rust / Cobalt" + Espresso untuk teks.
//   60% base   : Sand     -> latar layar
//   30% brand  : Rust     -> tab bar, header/kartu hero, judul layar & bagian
//   10% accent : Cobalt   -> tombol utama, tautan, progres, item terpilih
//   text       : Espresso -> teks isi dan ikon
// Cobalt di atas Rust hanya 1.5:1, jadi tab aktif memakai pill putih + ikon Cobalt.
// Warning (emas) dan danger (crimson) digeser menjauh dari Rust agar tidak tertukar.
// Semua pasangan teks/latar lolos kontras WCAG AA (>= 4.5:1).
const palette = {
  sand: '#EFE9DF',
  rust: '#7A3E22',
  rustLight: '#E2C3B2',
  rustTint: '#F3E4DA',
  cobalt: '#2F5BEA',
  cobaltTint: '#EEF2FD',
  espresso: '#2A1D16',
  white: '#FFFFFF',
  stone200: '#E2DACD',
  stone300: '#CBC1B1',
  stone500: '#6F6358',
  stone600: '#63574D',
} as const;

export const colors = {
  // 10% - aksen
  primary: palette.cobalt,
  primaryTint: palette.cobaltTint,
  onPrimary: palette.white,
  // 30% - brand
  secondary: palette.rust,
  tint: palette.rustTint,
  tabInactive: palette.rustLight,
  // 60% - base
  bg: palette.sand,
  card: palette.white,
  surface: palette.sand,
  border: palette.stone200,
  dashed: palette.stone300,
  white: palette.white,
  // Teks & ikon
  text: palette.espresso,
  textSecondary: palette.stone600,
  placeholder: palette.stone500,
  // Semantik
  success: '#17744A',
  successTint: '#E6F4EC',
  warning: '#7D6200',
  warningTint: '#FAF1CF',
  danger: '#A51D3A',
  dangerTint: '#FBE7EC',
  dangerBorder: '#F2C2CD',
  overlay: 'rgba(42, 29, 22, 0.48)',
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
  screenTitle: { fontSize: 18, fontFamily: font.extraBold, color: colors.secondary },
  sectionTitle: { fontSize: 16, fontFamily: font.bold, color: colors.secondary },
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
