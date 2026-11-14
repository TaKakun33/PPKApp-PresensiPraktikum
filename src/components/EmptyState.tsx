// Pemilik: Hadrian (feat/schedule-detail), SRS-03.
// Tampilan saat daftar kosong. Dipakai juga oleh layar Riwayat dan Rekap, jadi props jangan diubah.
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, layout, radius, text } from '../constants/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  message?: string;
  icon?: IoniconsName;
  compact?: boolean;
};

export default function EmptyState({
  title,
  message,
  icon = 'file-tray-outline',
  compact = false,
}: Props) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.box, compact && styles.boxCompact]}>
        <View style={[styles.iconBox, compact && styles.iconBoxCompact]}>
          <Ionicons name={icon} size={compact ? 24 : 28} color={colors.primary} />
        </View>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {message ? <Text style={[styles.message, compact && styles.messageCompact]}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  containerCompact: {
    justifyContent: 'flex-start',
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 0,
  },
  box: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.dashed,
    backgroundColor: colors.card,
  },
  boxCompact: {
    minHeight: 144,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: radius.card,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: colors.tint,
  },
  iconBoxCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
    marginBottom: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: font.bold,
    color: colors.text,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 14 },
  message: {
    ...text.body,
    marginTop: 6,
    textAlign: 'center',
  },
  messageCompact: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
