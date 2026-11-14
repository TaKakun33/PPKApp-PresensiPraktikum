import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  primary: '#14234A',
  bg: '#F4F5F7',
  card: '#FFFFFF',
  surface: '#F4F5F7',
  tint: '#E3E8F3',
  border: '#E5E7EB',
  dashed: '#C5CAD6',
  text: '#14234A',
  textSecondary: '#6B7280',
  placeholder: '#9CA3AF',
  tabInactive: '#8FA0C8',
  white: '#FFFFFF',
  success: '#1E8E5A',
  successTint: '#E6F4EC',
  warning: '#B7791F',
  warningTint: '#FBF1DC',
  danger: '#C53030',
  dangerTint: '#FBE9E9',
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
  neutral: { bg: colors.tint, text: colors.textSecondary },
} as const;

export const shadow: Record<'floating', ViewStyle> = {
  floating: {
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
};
