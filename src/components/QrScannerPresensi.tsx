// Pembungkus scanner QR (SRS-26, SRS-28).
// expo-camera adalah modul native: di build yang belum memuatnya, import langsung membuat
// seluruh aplikasi crash ("Cannot find native module 'ExpoCamera'"). File ini memuat
// QrScannerKamera di dalam try/catch dan menampilkan pesan bila fitur kamera belum tersedia.
import type { ComponentType } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import PrimaryButton from './PrimaryButton';
import { colors, font, radius, text } from '../constants/theme';

type Props = {
  visible: boolean;
  onScan: (payload: string) => void;
  onClose: () => void;
  onManual?: () => void;
};

// Dimuat sekali saat modul ini dibaca; try/catch menahan error modul native yang tidak ada.
function muatKamera(): ComponentType<Props> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('./QrScannerKamera') as { default: ComponentType<Props> }).default;
  } catch {
    return null;
  }
}

const Kamera = muatKamera();

// Ditampilkan dalam Modal agar menutupi seluruh layar, termasuk header dan tab bar.
export default function QrScannerPresensi(props: Props) {
  if (!props.visible) return null;

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={props.onClose}
    >
      {Kamera ? (
        <Kamera {...props} />
      ) : (
        <KameraTidakAda onClose={props.onClose} onManual={props.onManual} />
      )}
    </Modal>
  );
}

function KameraTidakAda({
  onClose,
  onManual,
}: {
  onClose: () => void;
  onManual?: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Ionicons name="camera-outline" size={48} color={colors.danger} />
        <Text style={styles.title}>Kamera Belum Tersedia</Text>
        <Text style={styles.message}>
          Fitur pindai QR belum ada di versi aplikasi ini. Pasang versi aplikasi terbaru, atau
          lakukan presensi dengan kode.
        </Text>
        {onManual ? (
          <PrimaryButton
            label="Absensi Manual"
            icon="keypad-outline"
            onPress={onManual}
            style={styles.tombol}
          />
        ) : null}
        <PrimaryButton label="Tutup" onPress={onClose} variant="secondary" style={styles.tombol} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontFamily: font.extraBold,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...text.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  tombol: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
});
