// Tombol di header (samping ProfileButton): membuka layar daftar Notifikasi masuk.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius } from '../constants/theme';
import { useNotificationInbox } from '../context/NotificationContext';

export default function NotificationButton() {
  const { unreadCount } = useNotificationInbox();

  return (
    <Pressable
      onPress={() => router.push('/notifications' as never)}
      style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0 ? `Buka notifikasi (${unreadCount} belum dibaca)` : 'Buka notifikasi'
      }
    >
      <Ionicons name="notifications-outline" size={18} color={colors.primary} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.icon,
    backgroundColor: colors.surface,
  },
  btnPressed: { backgroundColor: colors.tint, opacity: 0.9 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 999,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: font.bold,
    color: colors.white,
    lineHeight: 11,
  },
});
