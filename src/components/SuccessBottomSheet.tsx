// STUB dari PM - pemilik: Damar (feat/student-checkin-history). Boleh diganti total,
// tapi pertahankan props agar layar lain tidak rusak.
// Bottom sheet dibuat dari Modal bawaan React Native (tanpa library tambahan).
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import { COLORS } from '../constants/colors';

type Props = {
  visible: boolean;
  sessionName: string;
  waktuHadir: string; // sudah diformat, contoh: '08.05.12'
  onClose: () => void;
};

export default function SuccessBottomSheet({ visible, sessionName, waktuHadir, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <Text style={styles.title}>Presensi berhasil</Text>
          <Text style={styles.text}>{sessionName}</Text>
          <Text style={styles.text}>Waktu hadir: {waktuHadir}</Text>
          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Tutup</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.success },
  text: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text },
  button: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: COLORS.white, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
