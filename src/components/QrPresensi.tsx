// Tampilan QR untuk asisten (SRS-26).
// Menampilkan kode QR berisi "sessionId:kode" yang dapat dipindai praktikan.
// Mengikuti gaya UI aplikasi (Card, PrimaryButton, tema warna).
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import Card from './Card';
import PrimaryButton from './PrimaryButton';
import { colors, font, radius, text } from '../constants/theme';
import { buatPayloadQR } from '../services/sessionCodeService';

type Props = {
  sessionId: string;
  kode: string;
  onTutup: () => void;
};

export default function QrPresensi({ sessionId, kode, onTutup }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;
    QRCode.toDataURL(buatPayloadQR(sessionId, kode), {
      width: 280,
      margin: 2,
      color: { dark: '#14234A', light: '#FFFFFF' },
    })
      .then((url: string) => {
        if (aktif) setQrDataUrl(url);
      })
      .catch(() => {
        if (aktif) setQrError('Gagal menghasilkan kode QR.');
      });
    return () => {
      aktif = false;
    };
  }, [sessionId, kode]);

  return (
    <View style={styles.modal}>
      <Card style={styles.card}>
        <Text style={styles.judul}>Tampilkan QR kepada Praktikan</Text>
        <Text style={styles.petunjuk}>
          Praktikan memindai kode QR ini dengan layar presensi miliknya.
        </Text>

        {qrError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{qrError}</Text>
          </View>
        ) : qrDataUrl ? (
          <View style={styles.qrContainer}>
            <Image source={{ uri: qrDataUrl }} style={styles.qrImage} />
          </View>
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Menghasilkan QR...</Text>
          </View>
        )}

        <View style={styles.kodeBox}>
          <Text style={styles.kodeLabel}>Kode sesi:</Text>
          <Text style={styles.kodeValue}>{kode}</Text>
        </View>

        <PrimaryButton
          label="Tutup"
          onPress={onTutup}
          variant="secondary"
          style={styles.tombolTutup}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    padding: 24,
    gap: 16,
    alignItems: 'center',
  },
  judul: {
    fontSize: 18,
    fontFamily: font.extraBold,
    color: colors.text,
    textAlign: 'center',
  },
  petunjuk: {
    ...text.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  qrContainer: {
    borderWidth: 4,
    borderColor: colors.white,
    padding: 8,
    backgroundColor: colors.white,
  },
  qrImage: {
    width: 200,
    height: 200,
    resizeMode: 'contain',
  },
  loadingBox: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  loadingText: {
    ...text.caption,
    color: colors.textSecondary,
  },
  errorBox: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.dangerTint,
    borderRadius: radius.card,
  },
  errorText: {
    ...text.caption,
    color: colors.danger,
    textAlign: 'center',
  },
  kodeBox: {
    gap: 4,
    paddingHorizontal: 8,
  },
  kodeLabel: {
    ...text.caption,
    color: colors.textSecondary,
  },
  kodeValue: {
    fontSize: 20,
    fontFamily: font.extraBold,
    color: colors.text,
    letterSpacing: 4,
    textAlign: 'center',
  },
  tombolTutup: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
});