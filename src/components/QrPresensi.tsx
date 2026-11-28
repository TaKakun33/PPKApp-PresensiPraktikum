// Tampilan QR untuk asisten (SRS-26).
// Menampilkan kode QR berisi "sessionId:kode" yang dapat dipindai praktikan.
// Mengikuti gaya UI aplikasi (Card, PrimaryButton, tema warna).
//
// QR digambar sendiri dari matriks QRCode.create() memakai View.
// QRCode.toDataURL() tidak bisa dipakai: di React Native library qrcode
// memakai versi browser yang membutuhkan <canvas> HTML.
import QRCode from 'qrcode';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from './Card';
import PrimaryButton from './PrimaryButton';
import { colors, font, radius, text } from '../constants/theme';
import { buatPayloadQR } from '../services/sessionCodeService';

type Props = {
  sessionId: string;
  kode: string;
  onTutup: () => void;
};

const UKURAN_QR = 200;
const WARNA_GELAP = colors.secondary;
const WARNA_TERANG = colors.white;

type Petak = { baris: number; kolom: number; panjang: number };

// Matriks QR diringkas menjadi deretan petak gelap per baris supaya jumlah View sedikit.
function buatPetakQR(payload: string): { petak: Petak[]; ukuran: number } | null {
  try {
    const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' });
    const ukuran = modules.size;
    const petak: Petak[] = [];
    for (let baris = 0; baris < ukuran; baris++) {
      let mulai = -1;
      for (let kolom = 0; kolom <= ukuran; kolom++) {
        const gelap = kolom < ukuran && modules.get(baris, kolom);
        if (gelap && mulai < 0) mulai = kolom;
        if (!gelap && mulai >= 0) {
          petak.push({ baris, kolom: mulai, panjang: kolom - mulai });
          mulai = -1;
        }
      }
    }
    return { petak, ukuran };
  } catch {
    return null;
  }
}

function GambarQR({ petak, ukuran }: { petak: Petak[]; ukuran: number }) {
  const sel = Math.floor(UKURAN_QR / ukuran);
  return (
    <View style={{ width: sel * ukuran, height: sel * ukuran, backgroundColor: WARNA_TERANG }}>
      {petak.map((p) => (
        <View
          key={`${p.baris}-${p.kolom}`}
          style={{
            position: 'absolute',
            top: p.baris * sel,
            left: p.kolom * sel,
            width: p.panjang * sel,
            height: sel,
            backgroundColor: WARNA_GELAP,
          }}
        />
      ))}
    </View>
  );
}

export default function QrPresensi({ sessionId, kode, onTutup }: Props) {
  const qr = useMemo(() => buatPetakQR(buatPayloadQR(sessionId, kode)), [sessionId, kode]);

  return (
    <View style={styles.modal}>
      <Card style={styles.card}>
        <Text style={styles.judul}>Tampilkan QR kepada Praktikan</Text>
        <Text style={styles.petunjuk}>
          Praktikan memindai kode QR ini dengan layar presensi miliknya.
        </Text>

        {qr ? (
          <View style={styles.qrContainer}>
            <GambarQR petak={qr.petak} ukuran={qr.ukuran} />
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Gagal menghasilkan kode QR.</Text>
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
    backgroundColor: colors.overlay,
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
    // Area kosong (quiet zone) putih di sekeliling QR, tetap putih di mode gelap.
    padding: 12,
    backgroundColor: WARNA_TERANG,
    borderRadius: 8,
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