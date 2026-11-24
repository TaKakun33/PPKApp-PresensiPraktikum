// Pemilik: Hadrian (feat/classsessioncrud), SRS-16. Disesuaikan evaluasi Sprint 2.
// Form tambah/ubah sesi oleh asisten: kelas, tanggal, ruangan lab, dan jam (slot 2 jam).
// Semua pilihan lewat dropdown; jam yang sudah dibooking sesi lain di lab itu tidak bisa dipilih.
// /session-form        -> tambah sesi baru
// /session-form?id=xx  -> ubah jadwal sesi xx (hanya selama Belum Dibuka; kelas tidak bisa diganti)
import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import SelectField, { type SelectOption } from '../components/SelectField';
import { SLOT_WAKTU } from '../lib/constants';
import type { ClassDoc, Lab } from '../lib/types';
import { colors, font, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  isTertunda,
  labelKelas,
  pesanFirestore,
  subscribeClassesForAsisten,
} from '../services/classService';
import {
  hariIniWib,
  slotDariJam,
  slotSudahLewat,
  subscribeBookingLab,
  subscribeLabs,
  type LabBooking,
} from '../services/jadwalService';
import {
  createSession,
  getSession,
  updateSession,
  validasiSesi,
  type SessionInput,
} from '../services/sessionService';
import { formatTanggal } from '../utils/format';

const KOSONG: SessionInput = { kelasId: '', tanggal: '', labKode: '', slot: 0 };

function ymdKeTanggal(value: string): Date {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!cocok) return awalHariIni();
  return new Date(Number(cocok[1]), Number(cocok[2]) - 1, Number(cocok[3]));
}

function awalHariIni(): Date {
  return ymdKeTanggalWib(hariIniWib());
}

function ymdKeTanggalWib(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function tanggalKeYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function labelJam(jam: string): string {
  return jam.replace(':', '.');
}

export default function SessionFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { profile } = useAuth();
  const asistenId = profile?.role === 'asisten' ? profile.id : null;

  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [bookingState, setBookingState] = useState<{ key: string; list: LabBooking[] } | null>(null);
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
      (data) =>
        setClasses(
          [...data].sort(
            (a, b) => a.praktikum.localeCompare(b.praktikum, 'id') || a.namaKelas.localeCompare(b.namaKelas, 'id'),
          ),
        ),
      (e) => setLoadError(pesanFirestore(e, 'Gagal memuat daftar kelas.')),
    );
  }, [asistenId, retryKey]);

  useEffect(() => {
    if (!asistenId) return;
    return subscribeLabs(setLabs, (e) => setLoadError(pesanFirestore(e, 'Gagal memuat daftar lab.')));
  }, [asistenId, retryKey]);

  // Booking lab terpilih pada tanggal terpilih (real-time), untuk menonaktifkan jam yang terpakai.
  const bookingKey = form.labKode && form.tanggal ? `${form.labKode}|${form.tanggal}` : '';
  useEffect(() => {
    if (!bookingKey) return;
    const [labKode, tanggal] = bookingKey.split('|');
    return subscribeBookingLab(
      labKode,
      tanggal,
      (list) => setBookingState({ key: bookingKey, list }),
      () => setBookingState({ key: bookingKey, list: [] }),
    );
  }, [bookingKey]);
  const booking = bookingState && bookingState.key === bookingKey ? bookingState.list : [];

  // Mode ubah: isi form dari data sesi (sekali baca, bukan listener).
  useEffect(() => {
    if (!id || !asistenId) return;
    let aktif = true;
    getSession(id)
      .then((sesi) => {
        if (!aktif) return;
        if (!sesi) setLoadError('Sesi tidak ditemukan atau sudah dihapus.');
        else if (sesi.status !== 'belum_dibuka') setLoadError('Jadwal tidak bisa diubah setelah sesi dibuka.');
        else {
          setForm({
            kelasId: sesi.kelasId,
            tanggal: sesi.tanggal,
            labKode: sesi.labKode ?? '',
            // Sesi lama tanpa slot: cocokkan dari jamnya jika tepat satu slot, jika tidak pilih ulang.
            slot: sesi.slot ?? slotDariJam(sesi.waktuMulai, sesi.waktuSelesai) ?? 0,
          });
          setLoaded(true);
        }
      })
      .catch((e) => aktif && setLoadError(pesanFirestore(e, 'Gagal memuat data sesi.')));
    return () => {
      aktif = false;
    };
  }, [id, asistenId, retryKey]);

  const opsiKelas: SelectOption<string>[] = useMemo(
    () => (classes ?? []).map((c) => ({ value: c.id, label: labelKelas(c), sub: c.praktikum })),
    [classes],
  );

  const opsiLab: SelectOption<string>[] = useMemo(
    () =>
      (labs ?? []).map((l) => ({
        value: l.kode,
        label: l.nama,
        sub: l.kapasitas ? `Kapasitas ${l.kapasitas} orang` : undefined,
      })),
    [labs],
  );

  // Jam yang sudah dibooking sesi lain (bukan sesi yang sedang diubah) atau sudah lewat: nonaktif.
  const opsiSlot: SelectOption<number>[] = SLOT_WAKTU.map((s) => {
    const dipakai = booking.some((b) => b.slot === s.slot && b.sessionId !== id);
    const lewat = !!form.tanggal && slotSudahLewat(form.tanggal, s);
    return {
      value: s.slot,
      label: `${labelJam(s.mulai)} – ${labelJam(s.selesai)} WIB`,
      sub: dipakai ? 'Sudah dibooking sesi lain' : lewat ? 'Jam sudah lewat' : 'Tersedia (2 jam)',
      disabled: dipakai || lewat,
    };
  });

  const slotTerpilihNonaktif = opsiSlot.find((o) => o.value === form.slot)?.disabled ?? false;

  const pilihTanggal = (date: Date) => setForm((f) => ({ ...f, tanggal: tanggalKeYmd(date) }));

  const simpan = async () => {
    setError('');
    if (slotTerpilihNonaktif) {
      setError('Jam yang dipilih sudah dibooking atau sudah lewat. Pilih jam lain.');
      return;
    }
    setSaving(true);
    try {
      const data = validasiSesi(form);
      if (id) await updateSession(id, asistenId!, data);
      else await createSession(asistenId!, data);
      kembali();
    } catch (e) {
      if (isTertunda(e)) {
        // Sudah tersimpan di perangkat; tinggalkan form agar sesi tidak tersimpan dua kali.
        Alert.alert('Belum terkirim', pesanFirestore(e));
        kembali();
        return;
      }
      setError(pesanFirestore(e, 'Gagal menyimpan sesi.'));
      setSaving(false);
    }
  };

  function kembali() {
    if (router.canGoBack()) router.back();
    else router.replace('/asisten/jadwal');
  }

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
  if (classes === null || labs === null || !loaded) {
    return wrap(<LoadingState message={id ? 'Memuat data sesi...' : 'Memuat daftar kelas dan lab...'} />);
  }
  if (classes.length === 0) {
    return wrap(
      <View style={styles.flex}>
        <EmptyState icon="people-outline" title="Belum ada kelas" message="Buat atau gabung kelas terlebih dahulu sebelum menambah sesi." />
        <PrimaryButton
          label="Kelola Kelas"
          onPress={() => router.push('/kelas')}
          style={styles.centerButton}
        />
      </View>,
    );
  }
  if (labs.length === 0) {
    return wrap(
      <EmptyState
        icon="business-outline"
        title="Data lab belum ada"
        message="Koleksi labs (Lab A, B, C, D, AP) belum diisi admin di Firebase Console."
      />,
    );
  }

  const batasTanggal = awalHariIni();
  const tanggalForm = form.tanggal ? ymdKeTanggal(form.tanggal) : batasTanggal;
  const nilaiTanggal = tanggalForm < batasTanggal ? batasTanggal : tanggalForm;

  return wrap(
    <KeyboardAvoidingView style={styles.flex} behavior="height">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SelectField
          label="Kelas"
          value={form.kelasId || null}
          options={opsiKelas}
          onChange={(kelasId) => setForm((f) => ({ ...f, kelasId }))}
          placeholder="Pilih kelas"
          disabled={saving || !!id}
        />
        {id ? <Text style={styles.hint}>Kelas sesi tidak bisa diganti. Buat sesi baru untuk kelas lain.</Text> : null}

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
            <Ionicons name="calendar-outline" size={18} color={colors.secondary} />
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

        <SelectField
          label="Ruangan Lab"
          value={form.labKode || null}
          options={opsiLab}
          onChange={(labKode) => setForm((f) => ({ ...f, labKode }))}
          placeholder="Pilih lab"
          disabled={saving}
        />

        <SelectField
          label="Jam"
          value={form.slot || null}
          options={opsiSlot}
          onChange={(slot) => setForm((f) => ({ ...f, slot }))}
          placeholder={form.labKode && form.tanggal ? 'Pilih jam' : 'Pilih tanggal dan lab dulu'}
          disabled={saving || !form.labKode || !form.tanggal}
        />
        <Text style={styles.hint}>
          Setiap sesi tepat 2 jam. Jam yang sudah dibooking sesi lain di lab ini tidak bisa dipilih.
        </Text>

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
  label: { ...text.bodyStrong, color: colors.textSecondary },
  hint: { ...text.caption, marginTop: -8 },
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
  error: { fontSize: 13, fontFamily: font.medium, color: colors.danger },
  submit: { marginTop: 6 },
  centerButton: { alignSelf: 'center', minWidth: 180, marginBottom: 32 },
});
