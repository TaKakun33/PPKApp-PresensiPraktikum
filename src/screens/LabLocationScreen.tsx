import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { createAppError, getFriendlyError, isTimeoutError, withTimeout } from '../services/serviceUtils';
import {
  getLabs,
  updateLabLocation,
  type LabCode,
  type LabLocation,
} from '../services/labService';

type LabDraft = { lat: string; lng: string; radiusMeter: string };
type Feedback = { message: string; status: 'success' | 'pending' | 'error' };
type DraftField = keyof LabDraft;

const EMPTY_DRAFT: LabDraft = { lat: '', lng: '', radiusMeter: '' };
const GPS_ACQUISITION_TIMEOUT_MS = 30000;

function draftFromLab(lab: LabLocation): LabDraft {
  return {
    lat: lab.lat === null ? '' : String(lab.lat),
    lng: lab.lng === null ? '' : String(lab.lng),
    radiusMeter: lab.radiusMeter === null ? '' : String(lab.radiusMeter),
  };
}

function parseInput(value: string, label: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    throw createAppError('app/invalid-input', `${label} wajib diisi.`);
  }

  const number = Number(trimmed);
  if (!Number.isFinite(number)) {
    throw createAppError('app/invalid-input', `${label} harus berupa angka.`);
  }
  return number;
}

function displayValue(value: number | null, suffix = ''): string {
  return value === null ? 'Belum diatur' : `${value}${suffix}`;
}

export default function LabLocationScreen() {
  const { role, loading: authLoading } = useAuth();
  const [labs, setLabs] = useState<LabLocation[] | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<LabCode, LabDraft>>>({});
  const [feedback, setFeedback] = useState<Partial<Record<LabCode, Feedback>>>({});
  const [gpsAccuracy, setGpsAccuracy] = useState<Partial<Record<LabCode, number | null>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<LabCode | null>(null);
  const [locationCode, setLocationCode] = useState<LabCode | null>(null);

  const setLabData = useCallback((items: LabLocation[]) => {
    setLabs(items);
    const nextDrafts: Partial<Record<LabCode, LabDraft>> = {};
    items.forEach((lab) => {
      nextDrafts[lab.kode] = draftFromLab(lab);
    });
    setDrafts(nextDrafts);
  }, []);

  const loadLabs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await getLabs();
      setLabData(items);
    } catch (error) {
      setLoadError(getFriendlyError(error, 'Gagal memuat data laboratorium. Periksa koneksi internet.'));
    } finally {
      setLoading(false);
    }
  }, [setLabData]);

  useEffect(() => {
    if (authLoading || role !== 'asisten') {
      return;
    }

    let active = true;
    getLabs()
      .then((items) => {
        if (active) setLabData(items);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(getFriendlyError(error, 'Gagal memuat data laboratorium. Periksa koneksi internet.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, role, setLabData]);

  const setLabFeedback = (kode: LabCode, message: string, status: Feedback['status']) => {
    setFeedback((current) => ({ ...current, [kode]: { message, status } }));
  };

  const updateDraft = (kode: LabCode, field: DraftField, value: string) => {
    setDrafts((current) => ({
      ...current,
      [kode]: { ...(current[kode] ?? EMPTY_DRAFT), [field]: value },
    }));
    if (field === 'lat' || field === 'lng') {
      setGpsAccuracy((current) => ({ ...current, [kode]: undefined }));
    }
    setFeedback((current) => ({ ...current, [kode]: undefined }));
  };

  const getCurrentLocation = async (lab: LabLocation) => {
    setLocationCode(lab.kode);
    setFeedback((current) => ({ ...current, [lab.kode]: undefined }));
    try {
      const Location = await import('expo-location');
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLabFeedback(
          lab.kode,
          'Layanan lokasi/GPS perangkat sedang mati. Aktifkan layanan lokasi, atau isi koordinat secara manual.',
          'error',
        );
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLabFeedback(
          lab.kode,
          'Izin lokasi ditolak. Izinkan akses lokasi di pengaturan perangkat, atau isi koordinat secara manual.',
          'error',
        );
        return;
      }

      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        GPS_ACQUISITION_TIMEOUT_MS,
      );
      updateDraft(lab.kode, 'lat', String(position.coords.latitude));
      updateDraft(lab.kode, 'lng', String(position.coords.longitude));
      setGpsAccuracy((current) => ({ ...current, [lab.kode]: position.coords.accuracy }));
      setLabFeedback(
        lab.kode,
        'Koordinat sudah diisi. Periksa koordinat dan akurasinya sebelum menyimpan.',
        'success',
      );
    } catch (error) {
      if (isTimeoutError(error)) {
        setLabFeedback(
          lab.kode,
          'Pencarian GPS melewati batas waktu 30 detik. Coba lagi di area terbuka atau isi koordinat secara manual.',
          'error',
        );
        return;
      }

      const locationModuleMissing =
        error instanceof Error && error.message.includes("Cannot find native module 'ExpoLocation'");
      setLabFeedback(
        lab.kode,
        locationModuleMissing
          ? 'Fitur GPS tidak tersedia di build aplikasi ini. Minta tim memasukkan Expo Location ke development build terbaru.'
          : 'Lokasi saat ini tidak tersedia. Periksa layanan lokasi/GPS atau isi koordinat secara manual.',
        'error',
      );
    } finally {
      setLocationCode(null);
    }
  };

  const saveLocation = async (lab: LabLocation) => {
    const draft = drafts[lab.kode];
    if (!draft) {
      setLabFeedback(lab.kode, 'Data koordinat belum siap. Muat ulang data lalu coba lagi.', 'error');
      return;
    }
    if (!lab.exists) {
      setLabFeedback(
        lab.kode,
        `Dokumen labs/${lab.kode} tidak ditemukan dan tidak dapat dibuat dari layar ini.`,
        'error',
      );
      return;
    }

    setSavingCode(lab.kode);
    setFeedback((current) => ({ ...current, [lab.kode]: undefined }));
    try {
      const location = {
        lat: parseInput(draft.lat, 'Latitude'),
        lng: parseInput(draft.lng, 'Longitude'),
        radiusMeter: parseInput(draft.radiusMeter, 'Radius'),
      };
      await updateLabLocation(lab.kode, location);
      setLabs((current) =>
        current?.map((item) => (item.kode === lab.kode ? { ...item, ...location } : item)) ?? null,
      );
      setLabFeedback(lab.kode, `Lokasi Lab ${lab.kode} berhasil disimpan.`, 'success');
    } catch (error) {
      if (isTimeoutError(error)) {
        setLabFeedback(
          lab.kode,
          'Tersimpan di perangkat; sinkronisasi akan dilanjutkan saat online. Periksa kembali setelah koneksi pulih.',
          'pending',
        );
        return;
      }

      setLabFeedback(
        lab.kode,
        getFriendlyError(error, 'Lokasi gagal disimpan. Periksa koneksi internet lalu coba lagi.'),
        'error',
      );
    } finally {
      setSavingCode(null);
    }
  };

  const screenHeader = <Stack.Screen options={{ headerShown: true, title: 'Kelola Lokasi Lab' }} />;

  if (authLoading) {
    return (
      <>
        {screenHeader}
        <LoadingState message="Memeriksa akun..." />
      </>
    );
  }

  if (role !== 'asisten') {
    return (
      <>
        {screenHeader}
        <EmptyState title="Fitur khusus asisten" message="Hanya akun asisten yang dapat mengelola lokasi lab." />
      </>
    );
  }

  if (loading) {
    return (
      <>
        {screenHeader}
        <LoadingState message="Memuat data lokasi laboratorium..." />
      </>
    );
  }

  if (loadError || !labs) {
    return (
      <>
        {screenHeader}
        <ErrorState message={loadError ?? 'Data laboratorium belum tersedia.'} onRetry={() => void loadLabs()} />
      </>
    );
  }

  const busy = savingCode !== null || locationCode !== null;

  return (
    <>
      {screenHeader}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.title}>Pengelolaan Lokasi Lab</Text>
          <Text style={styles.subtitle}>Perbarui koordinat dan radius kehadiran setiap laboratorium.</Text>
        </View>

        {labs.map((lab) => {
          const draft = drafts[lab.kode] ?? EMPTY_DRAFT;
          const message = feedback[lab.kode];

          return (
            <View key={lab.kode} style={styles.card}>
              <View style={styles.cardHeading}>
                <Text style={styles.labCode}>Lab {lab.kode}</Text>
                <Text style={styles.labName}>{lab.nama ?? 'Nama lab belum tersedia'}</Text>
              </View>

              <View style={styles.currentValues}>
                <Text style={styles.sectionLabel}>Lokasi saat ini</Text>
                <Text style={styles.valueText}>Latitude: {displayValue(lab.lat)}</Text>
                <Text style={styles.valueText}>Longitude: {displayValue(lab.lng)}</Text>
                <Text style={styles.valueText}>Radius: {displayValue(lab.radiusMeter, ' m')}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                  accessibilityLabel={`Latitude Lab ${lab.kode}`}
                  style={styles.input}
                  value={draft.lat}
                  onChangeText={(value) => updateDraft(lab.kode, 'lat', value)}
                  keyboardType="numbers-and-punctuation"
                  placeholder="-90 sampai 90"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                  accessibilityLabel={`Longitude Lab ${lab.kode}`}
                  style={styles.input}
                  value={draft.lng}
                  onChangeText={(value) => updateDraft(lab.kode, 'lng', value)}
                  keyboardType="numbers-and-punctuation"
                  placeholder="-180 sampai 180"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Radius (meter)</Text>
                <TextInput
                  accessibilityLabel={`Radius Lab ${lab.kode}`}
                  style={styles.input}
                  value={draft.radiusMeter}
                  onChangeText={(value) => updateDraft(lab.kode, 'radiusMeter', value)}
                  keyboardType="numbers-and-punctuation"
                  placeholder="10 sampai 200"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              {!lab.exists ? (
                <Text style={styles.warning}>
                  Dokumen labs/{lab.kode} tidak ditemukan. Layar ini tidak akan membuat dokumen baru.
                </Text>
              ) : null}

              {message ? (
                <View
                  style={[
                    styles.feedback,
                    message.status === 'success'
                      ? styles.successFeedback
                      : message.status === 'pending'
                        ? styles.pendingFeedback
                        : styles.errorFeedback,
                  ]}
                >
                  <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>
                    {message.message}
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Gunakan lokasi saat ini untuk Lab ${lab.kode}`}
                disabled={busy}
                onPress={() => void getCurrentLocation(lab)}
                style={({ pressed }) => [
                  styles.locationButton,
                  pressed && !busy && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                {locationCode === lab.kode ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                <Text style={styles.locationButtonText}>
                  {locationCode === lab.kode ? 'Mengambil lokasi...' : 'Gunakan Lokasi Saat Ini'}
                </Text>
              </Pressable>

              {gpsAccuracy[lab.kode] !== undefined ? (
                <Text style={styles.accuracyText}>
                  Akurasi GPS:{' '}
                  {gpsAccuracy[lab.kode] === null
                    ? 'tidak tersedia'
                    : `±${gpsAccuracy[lab.kode]?.toFixed(1)} m`}
                </Text>
              ) : null}

              <PrimaryButton
                label={savingCode === lab.kode ? 'Menyimpan...' : 'Simpan Lokasi'}
                onPress={() => void saveLocation(lab)}
                loading={savingCode === lab.kode}
                disabled={busy || !lab.exists}
                accessibilityLabel={`Simpan lokasi Lab ${lab.kode}`}
              />
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },
  heading: { gap: 6, marginBottom: 4 },
  title: { ...text.screenTitle, fontSize: 22 },
  subtitle: { ...text.body, lineHeight: 20 },
  card: {
    gap: 12,
    padding: 18,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeading: { gap: 2 },
  labCode: { fontSize: 17, fontFamily: font.extraBold, color: colors.text },
  labName: { fontSize: 13, fontFamily: font.medium, color: colors.textSecondary },
  currentValues: { gap: 4, padding: 12, backgroundColor: colors.surface, borderRadius: radius.input },
  sectionLabel: { fontSize: 13, fontFamily: font.bold, color: colors.text },
  valueText: { fontSize: 13, fontFamily: font.medium, color: colors.textSecondary },
  field: { gap: 6 },
  label: {
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: font.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 14,
    fontFamily: font.medium,
  },
  warning: { ...text.caption, color: colors.warning },
  feedback: { padding: 11, borderWidth: 1, borderRadius: radius.input },
  successFeedback: { borderColor: colors.success, backgroundColor: colors.successTint },
  pendingFeedback: { borderColor: colors.warning, backgroundColor: colors.warningTint },
  errorFeedback: { borderColor: colors.danger, backgroundColor: colors.dangerTint },
  feedbackText: { ...text.bodyStrong },
  accuracyText: { ...text.caption, color: colors.textSecondary, textAlign: 'center' },
  locationButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
  },
  locationButtonText: { fontSize: 13, fontFamily: font.bold, color: colors.primary },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.8 },
});
