// Scanner QR untuk praktikan (SRS-26). Jangan di-import langsung: pakai QrScannerPresensi,
// yang memuat file ini hanya jika modul native ExpoCamera ada di build.
// Menggunakan expo-camera (CameraView) untuk memindai kode QR yang berisi "sessionId:kode".
// Tangani izin kamera ditolak, QR invalid, QR kadaluarsa, dan error koneksi.
// Mengembalikan hasil scan lewat callback onScan(payload).
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import PrimaryButton from './PrimaryButton';
import { colors, font, radius, text } from '../constants/theme';

type Props = {
  visible: boolean;
  onScan: (payload: string) => void;
  onClose: () => void;
  onManual?: () => void;
};

export default function QrScannerKamera({ visible, onScan, onClose, onManual }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mounted, setMounted] = useState(false);
  const [scanning, setScanning] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) {
      const timer = setTimeout(() => {
        setMounted(false);
        setScanning(true);
      }, 0);
      return () => clearTimeout(timer);
    }
    requestPermission();
  }, [visible, requestPermission]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (permission?.status === 'granted') {
        setMounted(true);
      } else if (permission?.status === 'denied') {
        setMounted(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [permission]);

  const handleBarCodeScanned = (scanningResult: BarcodeScanningResult) => {
    if (!scanning) return;
    setScanning(false);
    onScan(scanningResult.data);
  };

  if (!visible) return null;

  if (!mounted) {
    return (
      <View style={styles.overlay}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Mengaktifkan kamera...</Text>
          {onManual ? (
            <PrimaryButton
              label="Absensi Manual"
              icon="keypad-outline"
              onPress={onManual}
              style={styles.tombol}
            />
          ) : null}
          <PrimaryButton
            label="Batal"
            onPress={onClose}
            variant="secondary"
            style={styles.tombol}
          />
        </View>
      </View>
    );
  }

  if (permission?.status !== 'granted') {
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="camera-outline" size={48} color={colors.danger} />
          <Text style={styles.title}>Izin Kamera Ditolak</Text>
          <Text style={styles.message}>
            Izin kamera diperlukan untuk memindai kode QR presensi.
          </Text>
          {onManual ? (
            <PrimaryButton
              label="Absensi Manual"
              icon="keypad-outline"
              onPress={onManual}
              style={styles.tombol}
            />
          ) : null}
          <PrimaryButton
            label="Coba Lagi"
            onPress={() => {
              setScanning(true);
              requestPermission();
            }}
            variant={onManual ? 'secondary' : 'primary'}
            style={styles.tombol}
          />
          <PrimaryButton
            label="Tutup"
            onPress={onClose}
            variant="secondary"
            style={styles.tombol}
          />
        </View>
      </View>
    );
  }

  // Kamera memenuhi layar; di atasnya hanya judul, bingkai bidik, dan tombol, tanpa lapisan gelap.
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      />
      <View style={[styles.atas, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.judulKamera}>Pindai Kode QR</Text>
        <Text style={styles.pesanKamera}>Arahkan kamera ke kode QR yang ditampilkan asisten.</Text>
      </View>
      <View style={styles.tengah} pointerEvents="none">
        <View style={styles.bingkai} />
      </View>
      <View style={[styles.bawah, { paddingBottom: insets.bottom + 20 }]}>
        {!scanning && (
          <PrimaryButton
            label="Lanjutkan Scan"
            onPress={() => setScanning(true)}
            style={styles.tombol}
          />
        )}
        {onManual ? (
          <PrimaryButton
            label="Absensi Manual"
            icon="keypad-outline"
            onPress={onManual}
            style={styles.tombol}
          />
        ) : null}
        <PrimaryButton
          label="Batal"
          onPress={onClose}
          variant="secondary"
          style={styles.tombol}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  atas: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  judulKamera: {
    fontSize: 18,
    fontFamily: font.extraBold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  pesanKamera: {
    ...text.caption,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  tengah: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bingkai: {
    width: 240,
    height: 240,
    borderWidth: 3,
    borderColor: colors.highlightOnBrand,
    borderRadius: 20,
  },
  bawah: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
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
  loading: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 24,
    gap: 12,
    alignItems: 'center',
    maxWidth: 300,
    width: '100%',
  },
  loadingText: {
    ...text.body,
    color: colors.textSecondary,
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