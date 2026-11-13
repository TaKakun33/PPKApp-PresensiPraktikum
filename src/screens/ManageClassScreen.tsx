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
import type { ClassDoc, Profile } from '../app/types';
import { COLORS } from '../constants/colors';
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
  const color = tone === 'danger' ? COLORS.danger : tone === 'primary' ? COLORS.primary : COLORS.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.disabled]}
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
          placeholderTextColor={COLORS.mutedLight}
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={tambah}
          editable={!saving}
          accessibilityLabel="NIM praktikan yang ditambahkan"
        />
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.actionPressed, (saving || !nim.trim()) && styles.disabled]}
          onPress={tambah}
          disabled={saving || !nim.trim()}
          accessibilityRole="button"
          accessibilityLabel="Tambah peserta"
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.addButtonText}>Tambah</Text>
          )}
        </Pressable>
      </View>
      {info ? (
        <Text style={[styles.info, { color: info.ok ? COLORS.success : COLORS.danger }]}>{info.text}</Text>
      ) : null}

      {error ? (
        <Text style={[styles.info, { color: COLORS.danger }]}>{error}</Text>
      ) : peserta === null ? (
        <ActivityIndicator style={styles.panelLoading} color={COLORS.primary} />
      ) : peserta.length === 0 ? (
        <Text style={styles.emptyText}>Belum ada peserta. Tambahkan lewat NIM.</Text>
      ) : (
        peserta.map((p) => (
          <View key={p.id} style={styles.pesertaRow}>
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
              <Ionicons name="person-remove-outline" size={18} color={COLORS.danger} />
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
            placeholderTextColor={COLORS.mutedLight}
            editable={!saving}
          />

          <Text style={styles.label}>Praktikum</Text>
          <TextInput
            style={styles.input}
            value={praktikum}
            onChangeText={setPraktikum}
            placeholder="Contoh: Praktikum PPK"
            placeholderTextColor={COLORS.mutedLight}
            editable={!saving}
          />

          {error ? <Text style={[styles.info, { color: COLORS.danger }]}>{error}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.actionPressed]}
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Batal</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.actionPressed, saving && styles.disabled]}
              onPress={simpan}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.primaryText}>Simpan</Text>
              )}
            </Pressable>
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
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.actionPressed]}
              onPress={() => setForm({ mode: 'tambah' })}
              accessibilityRole="button"
              accessibilityLabel="Tambah kelas"
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.primaryText}>Kelas</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <EmptyState title="Belum ada kelas" message="Tekan tombol + Kelas untuk membuat kelas pertama." />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  subtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  separator: { height: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 4,
  },
  cardTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text },
  cardMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  actionPressed: { opacity: 0.75 },
  actionText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  disabled: { opacity: 0.5 },
  panel: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  panelLoading: { paddingVertical: 12 },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1 },
  addButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 84,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  addButtonText: { color: COLORS.white, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  info: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  emptyText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, paddingVertical: 6 },
  pesertaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  pesertaNama: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text },
  pesertaNim: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.textSecondary, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  modal: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, gap: 6 },
  modalTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 92,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
  },
  primaryText: { color: COLORS.white, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  secondaryButton: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryText: { color: COLORS.text, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
