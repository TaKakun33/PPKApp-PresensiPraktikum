import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, text } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

type Props = {
  visible: boolean;
  sessionName: string;
  waktuHadir: string;
  onClose: () => void;
};

export default function SuccessBottomSheet({
  visible,
  sessionName,
  waktuHadir,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.iconBox}>
            <Ionicons name="checkmark" size={30} color={colors.success} />
          </View>
          <Text style={styles.title}>Presensi Berhasil</Text>
          <Text style={styles.subtitle}>{sessionName}</Text>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Waktu hadir</Text>
            <Text style={styles.timeValue}>{waktuHadir}</Text>
          </View>
          <PrimaryButton label="Selesai" onPress={onClose} style={styles.button} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 18,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successTint,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontFamily: font.extraBold, color: colors.text },
  subtitle: { ...text.body, marginTop: 4, textAlign: 'center' },
  timeBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  timeLabel: { ...text.caption },
  timeValue: { fontSize: 15, fontFamily: font.bold, color: colors.text },
  button: { alignSelf: 'stretch', marginTop: 18 },
});
