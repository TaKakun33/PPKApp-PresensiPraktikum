// Pemilik: Hadrian (feat/classsessioncrud), SRS-16.
// Form tambah/ubah sesi oleh asisten: kelas, praktikum, tanggal, waktu, dan ruangan.
// /session-form        -> tambah sesi baru
// /session-form?id=xx  -> ubah jadwal sesi xx (hanya selama Belum Dibuka)
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import type { ClassDoc } from '../lib/types';
import { colors, font, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { pesanFirestore, subscribeClassesForAsisten } from '../services/classService';
import {
  createSession,
  getSession,
  updateSession,
  validasiSesi,
  type SessionInput,
} from '../services/sessionService';

const KOSONG: SessionInput = {
  kelasId: '',
  praktikum: '',
  tanggal: '',
  waktuMulai: '',
  waktuSelesai: '',
  ruangan: '',
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  editable: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        keyboardType={keyboardType}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function SessionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const asistenId = profile?.role === 'asisten' ? profile.id : null;

  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [form, setForm] = useState<SessionInput>(KOSONG);
  const [loaded, setLoaded] = useState(!id);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!asistenId) return;
    return subscribeClassesForAsisten(
      asistenId,
      (data) => setClasses([...data].sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, 'id'))),
      (e) => setLoadError(pesanFirestore(e, 'Gagal memuat daftar kelas.')),
    );
  }, [asistenId, retryKey]);

  // Mode ubah: isi form dari data sesi (sekali baca, bukan listener).
  useEffect(() => {
    if (!id || !asistenId) return;
    let aktif = true;
    getSession(id)
      .then((sesi) => {
        if (!aktif) return;
        if (!sesi) setLoadError('Sesi tidak ditemukan atau sudah dihapus.');
        else if (sesi.asistenId !== asistenId) setLoadError('Hanya asisten pengampu yang dapat mengubah sesi ini.');
        else if (sesi.status !== 'belum_dibuka') setLoadError('Jadwal tidak bisa diubah setelah sesi dibuka.');
        else {
          setForm({
            kelasId: sesi.kelasId,
            praktikum: sesi.praktikum,
            tanggal: sesi.tanggal,
            waktuMulai: sesi.waktuMulai,
            waktuSelesai: sesi.waktuSelesai,
            ruangan: sesi.ruangan,
          });
          setLoaded(true);
        }
      })
      .catch((e) => aktif && setLoadError(pesanFirestore(e, 'Gagal memuat data sesi.')));
    return () => {
      aktif = false;
    };
  }, [id, asistenId, retryKey]);

  const set = (key: keyof SessionInput) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pilihKelas = (cls: ClassDoc) =>
    setForm((f) => ({ ...f, kelasId: cls.id, praktikum: f.praktikum || cls.praktikum }));

  const simpan = async () => {
    setError('');
    setSaving(true);
    try {
      const data = validasiSesi(form);
      if (id) await updateSession(id, asistenId!, data);
      else await createSession(asistenId!, data);
      if (router.canGoBack()) router.back();
      else router.replace('/asisten/jadwal');
    } catch (e) {
      setError(pesanFirestore(e, 'Gagal menyimpan sesi.'));
      setSaving(false);
    }
  };

  const header = <Stack.Screen options={{ headerShown: true, title: id ? 'Ubah Sesi' : 'Tambah Sesi' }} />;
  const wrap = (body: React.ReactNode) => (
    <View style={styles.container}>
      {header}
      {body}
    </View>
  );

  if (!asistenId) {
    return wrap(<EmptyState title="Khusus asisten" message="Hanya asisten yang dapat mengelola jadwal sesi." />);
  }
  if (loadError) {
    return wrap(
      <ErrorState
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          setRetryKey((k) => k + 1);
        }}
      />,
    );
  }
  if (classes === null || !loaded) {
    return wrap(<LoadingState message={id ? 'Memuat data sesi...' : 'Memuat daftar kelas...'} />);
  }
  if (classes.length === 0) {
    return wrap(
      <View style={styles.flex}>
        <EmptyState icon="people-outline" title="Belum ada kelas" message="Buat kelas terlebih dahulu sebelum menambah sesi." />
        <PrimaryButton
          label="Kelola Kelas"
          onPress={() => router.push('/kelas')}
          style={styles.centerButton}
        />
      </View>,
    );
  }

  return wrap(
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Kelas</Text>
          <View style={styles.chips}>
            {classes.map((cls) => {
              const aktif = form.kelasId === cls.id;
              return (
                <Pressable
                  key={cls.id}
                  style={[styles.chip, aktif && styles.chipActive]}
                  onPress={() => pilihKelas(cls)}
                  disabled={saving}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: aktif }}
                >
                  <Text style={[styles.chipText, aktif && styles.chipTextActive]}>{cls.namaKelas}</Text>
                  <Text style={[styles.chipSub, aktif && styles.chipTextActive]} numberOfLines={1}>
                    {cls.praktikum}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Field
          label="Praktikum / modul"
          value={form.praktikum}
          onChangeText={set('praktikum')}
          placeholder="Contoh: Praktikum PPK - Modul 3"
          editable={!saving}
        />
        <Field
          label="Tanggal (TTTT-BB-HH)"
          value={form.tanggal}
          onChangeText={set('tanggal')}
          placeholder="2026-11-20"
          keyboardType="numbers-and-punctuation"
          editable={!saving}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field
              label="Mulai (JJ:MM)"
              value={form.waktuMulai}
              onChangeText={set('waktuMulai')}
              placeholder="08:00"
              keyboardType="numbers-and-punctuation"
              editable={!saving}
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Selesai (JJ:MM)"
              value={form.waktuSelesai}
              onChangeText={set('waktuSelesai')}
              placeholder="10:00"
              keyboardType="numbers-and-punctuation"
              editable={!saving}
            />
          </View>
        </View>
        <Field
          label="Ruangan"
          value={form.ruangan}
          onChangeText={set('ruangan')}
          placeholder="Contoh: Lab Komputer 1"
          editable={!saving}
        />

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          label={id ? 'Simpan Perubahan' : 'Tambah Sesi'}
          onPress={simpan}
          disabled={saving}
          loading={saving}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>,
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 32, gap: 14 },
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  label: { ...text.bodyStrong, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { fontSize: 14, fontFamily: font.semibold, color: colors.text },
  chipSub: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  error: { fontSize: 13, fontFamily: font.medium, color: colors.danger },
  submit: { marginTop: 6 },
  centerButton: { alignSelf: 'center', minWidth: 180, marginBottom: 32 },
});
