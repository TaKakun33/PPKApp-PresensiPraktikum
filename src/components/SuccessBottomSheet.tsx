import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Presensi Berhasil</Text>
          <Text style={styles.subtitle}>{sessionName}</Text>
          <View style={styles.timeBox}>
            <Text style={styles.timeLabel}>Waktu hadir:</Text>
            <Text style={styles.timeValue}>{waktuHadir}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Selesai</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: "PlusJakartaSans_700Bold",
    color: COLORS.success,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: COLORS.text,
  },
  timeBox: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  timeLabel: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_400Regular",
    color: COLORS.muted,
  },
  timeValue: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: COLORS.text,
  },
  button: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: COLORS.white,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
  },
});
