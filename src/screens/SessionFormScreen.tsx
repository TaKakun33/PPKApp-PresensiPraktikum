// Pemilik: Hadrian (feat/classsessioncrud), SRS-16.
// Form tambah/ubah sesi oleh asisten: kelas, praktikum, tanggal, waktu, dan ruangan.
// /session-form        -> tambah sesi baru
// /session-form?id=xx  -> ubah jadwal sesi xx (hanya selama Belum Dibuka)
import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { formatTanggal } from '../utils/format';

const KOSONG: SessionInput = {
  kelasId: '',
  praktikum: '',
  tanggal: '',
  waktuMulai: '',
  waktuSelesai: '',
  ruangan: '',
};

const JAM_AWAL = 7;
const JAM_AKHIR = 21;
const OPSI_JAM = Array.from({ length: (JAM_AKHIR - JAM_AWAL) * 2 + 1 }, (_, i) => {
  const totalMenit = JAM_AWAL * 60 + i * 30;
  return `${String(Math.floor(totalMenit / 60)).padStart(2, '0')}:${String(totalMenit % 60).padStart(2, '0')}`;
});

function awalHariIni(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function tanggalKeYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ymdKeTanggal(value: string): Date {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!cocok) return awalHariIni();
  return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
}

function labelJam(jam: string): string {
  return jam.replace(':', '.');
}

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

function TimeField({
  label,
  value,
  onChange,
  disabled,
  minJam,
}: {
  label: string;
  value: string;
  onChange: (jam: string) => void;
  disabled: boolean;
  minJam?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.input,
          styles.selectInput,
          pressed && styles.selectPressed,
          disabled && styles.selectDisabled,
        ]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ? labelJam(value) : 'Belum dipilih' }}
      >
        <Text style={[styles.selectText, !value && styles.selectPlaceholder]}>
          {value ? labelJam(value) : 'Pilih jam'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.primary} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.timeBackdrop}>
          <Pressable
            style={styles.timeBackdropPress}
            onPress={() => setOpen(false)}
            accessibilityLabel="Tutup pilihan jam"
          />
          <View style={styles.timeCard}>
            <Text style={styles.timeTitle}>{label}</Text>
            <ScrollView style={styles.timeList} showsVerticalScrollIndicator={false}>
              {OPSI_JAM.map((jam) => {
                const aktif = jam === value;
                const nonaktif = Boolean(minJam && jam <= minJam);
                return (
                  <Pressable
                    key={jam}
                    style={({ pressed }) => [
                      styles.timeOption,
                      aktif && styles.timeOptionActive,
                      pressed && !nonaktif && styles.timeOptionPressed,
                    ]}
                    onPress={() => {
                      onChange(jam);
                      setOpen(false);
                    }}
                    disabled={nonaktif}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktif, disabled: nonaktif }}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        aktif && styles.timeOptionTextActive,
                        nonaktif && styles.timeOptionTextDisabled,
                      ]}
                    >
                      {labelJam(jam)}
                    </Text>
                    {aktif ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const pilihMulai = (jam: string) =>
    setForm((f) => ({
      ...f,
      waktuMulai: jam,
      waktuSelesai: f.waktuSelesai && f.waktuSelesai <= jam ? '' : f.waktuSelesai,
    }));

  const pilihTanggal = (date: Date) =>
    setForm((f) => ({ ...f, tanggal: tanggalKeYmd(date) }));

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

  const batasTanggal = awalHariIni();
  const tanggalForm = form.tanggal ? ymdKeTanggal(form.tanggal) : batasTanggal;
  const nilaiTanggal = tanggalForm < batasTanggal ? batasTanggal : tanggalForm;

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
        <View style={styles.field}>
          <Text style={styles.label}>Tanggal</Text>
          <Pressable
            style={({ pressed }) => [
              styles.input,
              styles.selectInput,
              pressed && styles.selectPressed,
              saving && styles.selectDisabled,
            ]}
            onPress={() => setShowDatePicker(true)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={form.tanggal ? `Tanggal ${formatTanggal(`${form.tanggal}T00:00:00`)}` : 'Pilih tanggal'}
          >
            <Text style={[styles.selectText, !form.tanggal && styles.selectPlaceholder]}>
              {form.tanggal ? formatTanggal(`${form.tanggal}T00:00:00`) : 'Pilih tanggal'}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          </Pressable>
        </View>
        {showDatePicker ? (
          Platform.OS === 'android' ? (
            <DateTimePicker
              value={nilaiTanggal}
              mode="date"
              presentation="dialog"
              minimumDate={batasTanggal}
              onValueChange={(_, date) => {
                setShowDatePicker(false);
                pilihTanggal(date);
              }}
              onDismiss={() => setShowDatePicker(false)}
            />
          ) : (
            <Modal
              transparent
              animationType="fade"
              visible
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View style={styles.pickerBackdrop}>
                <View style={styles.pickerCard}>
                  <Text style={styles.pickerTitle}>Pilih Tanggal</Text>
                  <DateTimePicker
                    value={nilaiTanggal}
                    mode="date"
                    display="compact"
                    minimumDate={batasTanggal}
                    accentColor={colors.primary}
                    style={styles.nativePicker}
                    onValueChange={(_, date) => pilihTanggal(date)}
                  />
                  <PrimaryButton label="Selesai" onPress={() => setShowDatePicker(false)} />
                </View>
              </View>
            </Modal>
          )
        ) : null}
        <View style={styles.row}>
          <View style={styles.flex}>
            <TimeField
              label="Jam mulai"
              value={form.waktuMulai}
              onChange={pilihMulai}
              disabled={saving}
            />
          </View>
          <View style={styles.flex}>
            <TimeField
              label="Jam selesai"
              value={form.waktuSelesai}
              onChange={set('waktuSelesai')}
              disabled={saving}
              minJam={form.waktuMulai || undefined}
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
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  selectPressed: { opacity: 0.85 },
  selectDisabled: { opacity: 0.5 },
  selectText: { flex: 1, fontSize: 14, fontFamily: font.medium, color: colors.text },
  selectPlaceholder: { color: colors.placeholder },
  nativePicker: { alignSelf: 'stretch' },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
  },
  pickerCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: 20,
    gap: 14,
  },
  pickerTitle: { fontSize: 17, fontFamily: font.bold, color: colors.text },
  timeBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 35, 74, 0.48)',
  },
  timeBackdropPress: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  timeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '75%',
  },
  timeTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  timeList: { marginTop: 8 },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.input,
  },
  timeOptionActive: { backgroundColor: colors.tint },
  timeOptionPressed: { backgroundColor: colors.surface },
  timeOptionText: { fontSize: 15, fontFamily: font.medium, color: colors.text },
  timeOptionTextActive: { fontFamily: font.semibold, color: colors.primary },
  timeOptionTextDisabled: { color: colors.placeholder, opacity: 0.5 },
  error: { fontSize: 13, fontFamily: font.medium, color: colors.danger },
  submit: { marginTop: 6 },
  centerButton: { alignSelf: 'center', minWidth: 180, marginBottom: 32 },
});
