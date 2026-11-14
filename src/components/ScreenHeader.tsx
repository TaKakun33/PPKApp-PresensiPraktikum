import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { text } from '../constants/theme';
import LogoutButton from '../navigation/LogoutButton';
import ProfileButton from '../navigation/ProfileButton';

type Props = {
  title: string;
  right?: ReactNode;
};

export default function ScreenHeader({ title, right }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.actions}>
        {right}
        <ProfileButton />
        <LogoutButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { ...text.screenTitle, flexShrink: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
