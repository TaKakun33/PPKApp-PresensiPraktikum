// Pemilik: Hadrian (feat/classsessioncrud), SRS-15.
// Asisten mengelola kelas yang diampu: tambah, lihat, ubah, hapus kelas,
// serta menambah (lewat NIM) dan mengeluarkan peserta kelas. Data real-time dari classService.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import PrimaryButton from '../components/PrimaryButton';
import type { ClassDoc, Profile } from '../lib/types';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  addPesertaByNim,
  createClass,
  deleteClass,
  pesanFirestore,
  removePeserta,
  subscribeClassesForAsisten,
  subscribePeserta,
  updateClass,
} from '../services/classService';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type FormState = { mode: 'tambah' } | { mode: 'ubah'; cls: ClassDoc };

const urutNama = <T,>(items: T[], nama: (item: T) => string) =>
  [...items].sort((a, b) => nama(a).localeCompare(nama(b), 'id'));

function ActionButton({
  icon,
  label,
  onPress,
  tone = 'default',
  disabled,
}: {
  icon: IoniconsName;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}) {
  const color = tone === 'primary' ? colors.primary : colors.text;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.action,
        tone === 'primary' && styles.actionPrimary,
        tone === 'danger' && styles.actionDanger,
        pressed && styles.actionPressed,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

// Daftar peserta satu kelas + form tambah peserta lewat NIM.
function PesertaPanel({ cls }: { cls: ClassDoc }) {
  const [peserta, setPeserta] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nim, setNim] = useState('');
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(null);

  // Kunci string supaya listener hanya dibuat ulang saat daftar peserta benar-benar berubah.
  const idsKey = cls.pesertaIds.join(',');
  useEffect(
    () =>
      subscribePeserta(
        idsKey ? idsKey.split(',') : [],
        (data) => {
          setPeserta(urutNama(data, (p) => p.nama ?? ''));
          setError(null);
        },
        (e) => setError(pesanFirestore(e, 'Gagal memuat daftar peserta.')),
      ),
    [idsKey],
  );

  const tambah = async () => {
    setSaving(true);
    setInfo(null);
    try {
      const p = await addPesertaByNim(cls, nim);
      setInfo({ ok: true, text: `${p.nama} ditambahkan ke ${cls.namaKelas}.` });
      setNim('');
    } catch (e) {
      setInfo({ ok: false, text: pesanFirestore(e, 'Gagal menambah peserta.') });
    } finally {
      setSaving(false);
    }
  };

  const keluarkan = (p: Profile) =>
    Alert.alert('Keluarkan peserta?', `${p.nama} tidak akan lagi melihat jadwal ${cls.namaKelas}.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluarkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePeserta(cls, p.id);
          } catch (e) {
            Alert.alert('Gagal', pesanFirestore(e, 'Gagal mengeluarkan peserta.'));
          }
        },
      },
    ]);

  return (
    <View style={styles.panel}>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, styles.addInput]}
          value={nim}
          onChangeText={setNim}
          placeholder="NIM praktikan"
          placeholderTextColor={colors.placeholder}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={tambah}
          editable={!saving}
          accessibilityLabel="NIM praktikan yang ditambahkan"
        />
        <PrimaryButton
          label="Tambah"
          size="sm"
          onPress={tambah}
          disabled={saving || !nim.trim()}
          loading={saving}
          accessibilityLabel="Tambah peserta"
          style={styles.addButton}
        />
      </View>
      {info ? (
        <Text style={[styles.info, { color: info.ok ? colors.success : colors.danger }]}>{info.text}</Text>
      ) : null}

      {error ? (
        <Text style={[styles.info, { color: colors.danger }]}>{error}</Text>
      ) : peserta === null ? (
        <ActivityIndicator style={styles.panelLoading} color={colors.primary} />
      ) : peserta.length === 0 ? (
        <Text style={styles.emptyText}>Belum ada peserta. Tambahkan lewat NIM.</Text>
      ) : (
        peserta.map((p) => (
          <View key={p.id} style={styles.pesertaRow}>
            <View style={styles.pesertaAvatar}>
              <Text style={styles.pesertaInitial}>{p.nama?.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.pesertaNama}>{p.nama}</Text>
              <Text style={styles.pesertaNim}>NIM {p.nim ?? '-'}</Text>
            </View>
            <Pressable
              onPress={() => keluarkan(p)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Keluarkan ${p.nama}`}
            >
              <Ionicons name="person-remove-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

// Modal tambah/ubah kelas.
function ClassFormModal({
  form,
  asistenId,
  onClose,
}: {
  form: FormState;
  asistenId: string;
  onClose: () => void;
}) {
  const awal = form.mode === 'ubah' ? form.cls : null;
  const [namaKelas, setNamaKelas] = useState(awal?.namaKelas ?? '');
  const [praktikum, setPraktikum] = useState(awal?.praktikum ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const simpan = async () => {
    setSaving(true);
    setError('');
    try {
      if (awal) await updateClass(awal.id, { namaKelas, praktikum });
      else await createClass(asistenId, { namaKelas, praktikum });
      onClose();
    } catch (e) {
      setError(pesanFirestore(e, 'Gagal menyimpan kelas.'));
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="height">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{awal ? 'Ubah Kelas' : 'Tambah Kelas'}</Text>

          <Text style={styles.label}>Nama kelas</Text>
          <TextInput
            style={styles.input}
            value={namaKelas}
            onChangeText={setNamaKelas}
            placeholder="Contoh: Kelas A"
            placeholderTextColor={colors.placeholder}
            editable={!saving}
          />

          <Text style={styles.label}>Praktikum</Text>
          <TextInput
            style={styles.input}
            value={praktikum}
            onChangeText={setPraktikum}
            placeholder="Contoh: Praktikum PPK"
            placeholderTextColor={colors.placeholder}
            editable={!saving}
          />

          {error ? <Text style={[styles.info, { color: colors.danger }]}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <PrimaryButton
              label="Batal"
              variant="secondary"
              onPress={onClose}
              disabled={saving}
              style={styles.modalButton}
            />
            <PrimaryButton
              label="Simpan"
              onPress={simpan}
              disabled={saving}
              loading={saving}
              style={styles.modalButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ManageClassScreen() {
  const { profile } = useAuth();
  const asistenId = profile?.role === 'asisten' ? profile.id : null;

  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!asistenId) return;
    return subscribeClassesForAsisten(
      asistenId,
      (data) => {
        setClasses(urutNama(data, (c) => c.namaKelas));
        setError(null);
      },
      (e) => setError(pesanFirestore(e, 'Gagal memuat daftar kelas.')),
    );
  }, [asistenId, retryKey]);

  const header = <Stack.Screen options={{ headerShown: true, title: 'Kelola Kelas' }} />;

  if (!asistenId) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState title="Khusus asisten" message="Hanya asisten yang dapat mengelola kelas dan peserta." />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setClasses(null);
            setRetryKey((k) => k + 1);
          }}
        />
      </View>
    );
  }
  if (classes === null) {
    return (
      <View style={styles.container}>
        {header}
        <LoadingState message="Memuat daftar kelas..." />
      </View>
    );
  }

  const hapus = (cls: ClassDoc) =>
    Alert.alert('Hapus kelas?', `${cls.namaKelas} (${cls.praktikum}) akan dihapus beserta daftar pesertanya.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClass(cls);
          } catch (e) {
            Alert.alert('Gagal menghapus', pesanFirestore(e, 'Gagal menghapus kelas.'));
          }
        },
      },
    ]);

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={classes}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title}>Kelas yang Kamu Ampu</Text>
              <Text style={styles.subtitle}>{classes.length} kelas</Text>
            </View>
            <PrimaryButton
              label="Kelas"
              size="sm"
              icon="add"
              onPress={() => setForm({ mode: 'tambah' })}
              accessibilityLabel="Tambah kelas"
              style={styles.addClassButton}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="Belum ada kelas" message="Tekan tombol + Kelas untuk membuat kelas pertama." />
        }
        renderItem={({ item }) => {
          const open = openId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.namaKelas}</Text>
              <Text style={styles.cardMeta}>
                {item.praktikum} · {item.pesertaIds.length} peserta
              </Text>
              <View style={styles.actions}>
                <ActionButton
                  icon={open ? 'chevron-up' : 'people-outline'}
                  label="Peserta"
                  tone="primary"
                  onPress={() => setOpenId(open ? null : item.id)}
                />
                <ActionButton icon="create-outline" label="Ubah" onPress={() => setForm({ mode: 'ubah', cls: item })} />
                <ActionButton icon="trash-outline" label="Hapus" tone="danger" onPress={() => hapus(item)} />
              </View>
              {open ? <PesertaPanel cls={item} /> : null}
            </View>
          );
        }}
      />
      {form ? <ClassFormModal form={form} asistenId={asistenId} onClose={() => setForm(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: layout.screenPadding, paddingTop: 8, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 19, fontFamily: font.extraBold, color: colors.text },
  subtitle: { ...text.caption },
  addClassButton: { minHeight: 42, paddingHorizontal: 16 },
  separator: { height: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  cardMeta: { ...text.caption },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  actionPrimary: { backgroundColor: colors.tint, borderColor: colors.tint },
  actionDanger: { borderColor: colors.border, backgroundColor: colors.surface },
  actionPressed: { opacity: 0.75 },
  actionText: { fontSize: 12, fontFamily: font.semibold },
  disabled: { opacity: 0.5 },
  panel: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  panelLoading: { paddingVertical: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1 },
  addButton: { minWidth: 88 },
  info: { fontSize: 12, lineHeight: 18, fontFamily: font.medium },
  emptyText: { ...text.caption, paddingVertical: 6 },
  pesertaRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 },
  pesertaAvatar: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tint,
  },
  pesertaInitial: { fontSize: 13, fontFamily: font.extraBold, color: colors.primary },
  pesertaNama: { fontSize: 14, fontFamily: font.semibold, color: colors.text },
  pesertaNim: { ...text.caption },
  label: { ...text.bodyStrong, color: colors.textSecondary, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.text,
    backgroundColor: colors.card,
  },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(20, 35, 74, 0.48)' },
  modal: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 6 },
  modalTitle: { fontSize: 18, fontFamily: font.extraBold, color: colors.text, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalButton: { flex: 1, minHeight: 46, paddingHorizontal: 12 },
});
