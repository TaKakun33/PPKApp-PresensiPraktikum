// STUB dari PM - pemilik: Naufal (feat/assistant-session-recap). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/colors';

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
            <Pressable style={[styles.button, styles.cancel]} onPress={onCancel}>
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirm]} onPress={onConfirm}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: COLORS.card, borderRadius: 14, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  message: { fontSize: 14, color: COLORS.muted },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancel: { backgroundColor: COLORS.border },
  confirm: { backgroundColor: COLORS.primary },
  cancelText: { color: COLORS.text, fontWeight: '600' },
  confirmText: { color: '#FFFFFF', fontWeight: '600' },
});
