// FILE MILIK ZHAFRAN (feat/push-notif) — Layar daftar notifikasi masuk (inbox).
// Menampilkan semua notifikasi yang diterima pengguna dan bisa diklik untuk navigasi ke layar terkait.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useNotificationInbox } from '../context/NotificationContext';
import {
  RETENSI_NOTIF_HARI,
  type NotifData,
  type NotifItem,
} from '../services/notificationService';
import { formatTanggalJam } from '../utils/format';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function ikonUntukLayar(layar?: NotifData['layar']): IoniconsName {
  switch (layar) {
    case 'detail-sesi':
      return 'lock-open-outline';
    case 'jadwal':
      return 'calendar-outline';
    case 'izin':
      return 'document-text-outline';
    default:
      return 'notifications-outline';
  }
}

function labelTujuan(data: NotifData): string | null {
  switch (data.layar) {
    case 'detail-sesi':
      return data.id ? 'Buka detail sesi' : null;
    case 'jadwal':
      return 'Lihat jadwal';
    case 'izin':
      return 'Buka halaman izin';
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const { notifications, unreadCount, loading, bukaNotifikasi, tandaiSemuaDibaca } =
    useNotificationInbox();

  if (loading && notifications.length === 0) {
    return <LoadingState message="Memuat notifikasi..." />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.infoBanner}>
        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoBannerText}>
          Notifikasi biasa terhapus otomatis setelah {RETENSI_NOTIF_HARI} hari. Notifikasi penting dari asisten tetap disimpan.
        </Text>
      </View>

      {unreadCount > 0 ? (
        <View style={styles.topBar}>
          <Text style={styles.unreadSummary}>{unreadCount} belum dibaca</Text>
          <Pressable
            onPress={() => void tandaiSemuaDibaca()}
            style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
            <Text style={styles.markAllText}>Tandai semua dibaca</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.listEmpty,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="Belum ada notifikasi"
            message="Notifikasi pembukaan sesi, perubahan jadwal, dan status izin akan muncul di sini."
          />
        }
        renderItem={({ item }: { item: NotifItem }) => {
          const tujuan = labelTujuan(item.data);
          const unread = !item.dibaca;

          return (
            <Pressable
              onPress={() => bukaNotifikasi(item)}
              style={({ pressed }) => [
                styles.card,
                unread && styles.cardUnread,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.judul}. ${item.isi}`}
            >
              <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
                <Ionicons
                  name={ikonUntukLayar(item.data.layar)}
                  size={20}
                  color={colors.primary}
                />
              </View>

              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>
                    {item.judul}
                  </Text>
                  <View style={styles.titleBadges}>
                    {item.penting ? (
                      <View style={styles.importantBadge}>
                        <Ionicons name="star" size={10} color={colors.warning} />
                        <Text style={styles.importantBadgeText}>Penting</Text>
                      </View>
                    ) : null}
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                </View>

                {item.isi ? (
                  <Text style={styles.message} numberOfLines={3}>
                    {item.isi}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.time}>
                    {formatTanggalJam(item.dibuatPada.toISOString())}
                  </Text>
                  {tujuan ? (
                    <View style={styles.linkRow}>
                      <Text style={styles.linkText}>{tujuan}</Text>
                      <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 2,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: font.medium,
    color: colors.textSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding,
    paddingTop: 14,
    paddingBottom: 6,
  },
  unreadSummary: {
    ...text.caption,
    fontFamily: font.semibold,
    color: colors.primary,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
  },
  markAllText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.primary,
  },
  listContent: {
    padding: layout.screenPadding,
    paddingBottom: 32,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardUnread: {
    backgroundColor: '#F5F8FF',
    borderColor: '#C9D6F0',
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.icon,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  iconWrapUnread: {
    backgroundColor: colors.tint,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.semibold,
    color: colors.text,
  },
  titleUnread: {
    fontFamily: font.bold,
  },
  titleBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  importantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.warningTint,
  },
  importantBadgeText: {
    fontSize: 10,
    fontFamily: font.bold,
    color: colors.warning,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.danger,
  },
  message: {
    ...text.body,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  time: {
    fontSize: 11,
    fontFamily: font.medium,
    color: colors.placeholder,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: {
    fontSize: 12,
    fontFamily: font.semibold,
    color: colors.primary,
  },
});
