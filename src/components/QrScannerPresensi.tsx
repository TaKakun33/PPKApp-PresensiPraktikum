// Scanner QR untuk praktikan (SRS-26).
// Menggunakan expo-kamera (CameraView) untuk memindai kode QR yang berisi "sessionId:kode".
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
};

export default function QrScannerPresensi({ visible, onScan, onClose }: Props) {
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
          <PrimaryButton
            label="Coba Lagi"
            onPress={() => {
              setScanning(true);
              requestPermission();
            }}
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="qr-code-outline" size={32} color={colors.primary} />
          <Text style={styles.title}>Pindai Kode QR</Text>
          <Text style={styles.message}>
            Arahkan kamera ke kode QR yang ditampilkan asisten.
          </Text>
          {!scanning && (
            <PrimaryButton
              label="Lanjutkan Scan"
              onPress={() => setScanning(true)}
              style={styles.tombol}
            />
          )}
          <PrimaryButton
            label="Batal"
            onPress={onClose}
            variant="secondary"
            style={styles.tombol}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 35, 74, 0.6)',
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
    alignItems: 'center',
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