// STUB dari PM - pemilik: Damar (feat/student-checkin-history), SRS-05 dan SRS-06.
// Daftar sesi + tombol presensi. Aktif hanya saat Dibuka dan belum presensi.
// Konfirmasi presensi via Modal, lalu Bottom Sheet sukses.
import { useRef, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import StatusBadge from '../components/StatusBadge';
import SuccessBottomSheet from '../components/SuccessBottomSheet';
import { COLORS } from '../constants/colors';
import { useApp } from '../context/AppContext';
import { formatJam } from '../utils/format';

export default function CheckInScreen() {
  const { currentUser, getVisibleSessions, checkIn, hasCheckedIn } = useApp();

  const [sheet, setSheet] = useState({
    visible: false,
    sessionName: '',
    waktuHadir: '',
  });

  const [confirm, setConfirm] = useState({
    visible: false,
    sessionId: '',
    sessionName: '',
  });

  const inFlightRef = useRef<Set<string>>(new Set());

  if (currentUser.role !== 'praktikan') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Presensi hanya untuk praktikan</Text>
        <Text style={styles.text}>Login sebagai praktikan untuk melakukan presensi.</Text>
      </View>
    );
  }

  const sessions = getVisibleSessions();

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Belum ada sesi</Text>
        <Text style={styles.text}>Sesi praktikum untuk kelasmu belum tersedia.</Text>
      </View>
    );
  }

  const handlePress = (sessionId: string, sessionName: string) => {
    setConfirm({ visible: true, sessionId, sessionName });
  };

  const closeConfirm = () => {
    setConfirm((c) => ({ ...c, visible: false }));
  };

  const runCheckIn = () => {
    const { sessionId, sessionName } = confirm;
    closeConfirm();

    if (inFlightRef.current.has(sessionId)) return;
    inFlightRef.current.add(sessionId);

    const result = checkIn(sessionId);
    if (result.ok) {
      setSheet({
        visible: true,
        sessionName,
        waktuHadir: formatJam(result.attendance.waktuHadir),
      });
    } else {
      inFlightRef.current.delete(sessionId);
      Alert.alert('Presensi gagal', result.message);
    }
  };

  return (
    <>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const checked = hasCheckedIn(item.id);

          let label: string;
          let reason = '';
          let canPress = false;
          if (checked) {
            label = 'Sudah hadir';
          } else if (item.status === 'belum_dibuka') {
            label = 'Belum dibuka';
            reason = 'Sesi belum dibuka oleh asisten.';
          } else if (item.status === 'ditutup') {
            label = 'Ditutup';
            reason = 'Sesi sudah ditutup.';
          } else {
            label = 'Presensi';
            canPress = true;
          }

          return (
            <View style={styles.card}>
              <StatusBadge status={item.status} />

              <Text style={styles.title}>{item.praktikum}</Text>
              <Text style={styles.text}>Kelas: {item.kelas} · {item.tanggal}</Text>
              <Text style={styles.text}>Waktu: {item.waktu}</Text>
              <Text style={styles.text}>Ruangan: {item.ruangan}</Text>
              <Text style={styles.text}>Asisten: {item.asistenNama}</Text>

              <Pressable
                onPress={() => handlePress(item.id, item.praktikum)}
                disabled={!canPress}
                style={({ pressed }) => [
                  styles.button,
                  checked && styles.buttonSuccess,
                  !canPress && !checked && styles.buttonDisabled,
                  pressed && canPress && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    !canPress && !checked && styles.buttonTextDisabled,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>

              {reason ? <Text style={styles.reason}>{reason}</Text> : null}
            </View>
          );
        }}
      />

      {/* Konfirmasi presensi (popup di atas layar) */}
      <Modal
        visible={confirm.visible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirm}
      >
        <Pressable style={styles.confirmBackdrop} onPress={closeConfirm}>
          <Pressable style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Konfirmasi Presensi</Text>
            <Text style={styles.confirmText}>
              Presensi untuk {confirm.sessionName}?
            </Text>

            <View style={styles.confirmRow}>
              <Pressable
                onPress={closeConfirm}
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.confirmButtonText}>Batal</Text>
              </Pressable>

              <Pressable
                onPress={runCheckIn}
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmButtonPrimary,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.confirmButtonTextPrimary}>Presensi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <SuccessBottomSheet
        visible={sheet.visible}
        sessionName={sheet.sessionName}
        waktuHadir={sheet.waktuHadir}
        onClose={() => setSheet((s) => ({ ...s, visible: false }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8, backgroundColor: COLORS.background },
  title: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  text: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  list: { backgroundColor: COLORS.background },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  button: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonSuccess: { backgroundColor: COLORS.success },
  buttonDisabled: { backgroundColor: COLORS.border },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: COLORS.white, fontFamily: 'PlusJakartaSans_600SemiBold' },
  buttonTextDisabled: { color: COLORS.mutedLight },
  reason: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, marginTop: 4 },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  confirmTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  confirmText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.text },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.border,
  },
  confirmButtonPrimary: { backgroundColor: COLORS.primary },
  confirmButtonText: { color: COLORS.text, fontFamily: 'PlusJakartaSans_600SemiBold' },
  confirmButtonTextPrimary: { color: COLORS.white, fontFamily: 'PlusJakartaSans_600SemiBold' },
});