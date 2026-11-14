// STUB dari PM - pemilik: Naufal (feat/assistant-session-recap). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
import { Modal, StyleSheet, Text, View } from 'react-native';

import { colors, font, text } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Ya',
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <PrimaryButton
              label="Batal"
              onPress={onCancel}
              variant="secondary"
              style={styles.button}
            />
            <PrimaryButton label={confirmLabel} onPress={onConfirm} style={styles.button} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 22,
    gap: 10,
  },
  title: { fontSize: 18, fontFamily: font.extraBold, color: colors.text },
  message: { ...text.body },
  row: { flexDirection: 'row', gap: 10, marginTop: 10 },
  button: { flex: 1, minHeight: 46, paddingHorizontal: 12 },
});
