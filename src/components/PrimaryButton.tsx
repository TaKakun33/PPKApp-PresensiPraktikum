import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, font, radius, text } from '../constants/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'md' | 'sm';
  icon?: IoniconsName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export default function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: Props) {
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;
  const foreground = isPrimary ? colors.white : colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.small,
        isPrimary ? styles.primary : styles.secondary,
        inactive && (isPrimary ? styles.primaryDisabled : styles.secondaryDisabled),
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={inactive && !isPrimary ? colors.placeholder : foreground} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 15 : 17} color={foreground} />
      ) : null}
      <Text
        style={[
          styles.label,
          size === 'sm' && styles.labelSmall,
          { color: foreground },
          inactive && !isPrimary && styles.labelSecondaryDisabled,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  small: { minHeight: 42, paddingHorizontal: 14, gap: 6 },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  primaryDisabled: { backgroundColor: colors.dashed },
  secondaryDisabled: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: 0.84 },
  label: { ...text.button, fontFamily: font.bold },
  labelSmall: { fontSize: 12, letterSpacing: 0.4 },
  labelSecondaryDisabled: { color: colors.placeholder },
});
