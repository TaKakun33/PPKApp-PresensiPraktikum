// Pemilik: Hadrian (feat/classsessioncrud), SRS-15.
// Asisten mengelola kelas yang diampu: membuat Kelas A–E atau bergabung sebagai partner (maks. 2
// asisten per kelas), keluar, hapus kelas, serta mencari (awalan NIM / nama) dan menambah atau
// mengeluarkan peserta kelas. Data real-time dari classService.
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
import SelectField from '../components/SelectField';
import { KODE_KELAS, MAKS_ASISTEN_KELAS, type KodeKelas } from '../lib/constants';
import type { ClassDoc, Profile } from '../lib/types';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  addPeserta,
  addPesertaByNim,
  cariPraktikan,
  deleteClass,
  getDaftarPraktikum,
  getNamaPengguna,
  isTertunda,
  keluarDariKelas,
  labelKelas,
  MAKS_PRAKTIKUM,
  pesanFirestore,
  removePeserta,
  simpanKelas,
  subscribeClassesForAsisten,
  subscribePeserta,
} from '../services/classService';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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

// Daftar peserta satu kelas + pencarian praktikan (awalan NIM atau nama) untuk ditambahkan.
function PesertaPanel({ cls }: { cls: ClassDoc }) {
  const [peserta, setPeserta] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [hasilCari, setHasilCari] = useState<{ teks: string; list: Profile[] } | null>(null);
  // Praktikan yang baru ditambahkan langsung disembunyikan dari hasil, tanpa menunggu snapshot kelas.
  const [sudahDitambah, setSudahDitambah] = useState<Set<string>>(() => new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
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

  // Cari otomatis 400 ms setelah berhenti mengetik. Hasil disimpan bersama teksnya, jadi hasil untuk
  // teks lama tidak ditampilkan. Hasil TETAP tampil setelah menambah peserta (yang sudah masuk kelas
  // disaring), supaya asisten bisa langsung menambah praktikan berikutnya tanpa mengetik ulang.
  const teksCari = cari.trim();
  useEffect(() => {
    if (teksCari.length < 2) return;
    let aktif = true;
    const t = setTimeout(() => {
      cariPraktikan(cls, teksCari)
        .then((list) => aktif && setHasilCari({ teks: teksCari, list }))
        .catch((e) => {
          if (!aktif) return;
          setHasilCari({ teks: teksCari, list: [] });
          setInfo({ ok: false, text: pesanFirestore(e, 'Gagal mencari praktikan.') });
        });
    }, 400);
    return () => {
      aktif = false;
      clearTimeout(t);
    };
    // cls berganti objek di setiap snapshot; yang menentukan hasil hanya teksnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teksCari]);
  const hasil =
    teksCari.length >= 2 && hasilCari?.teks === teksCari
      ? hasilCari.list.filter((p) => !cls.pesertaIds.includes(p.id) && !sudahDitambah.has(p.id))
      : null;
  const mencari = teksCari.length >= 2 && hasilCari?.teks !== teksCari;

  const tandaiDitambah = (id: string) => setSudahDitambah((lama) => new Set(lama).add(id));

  const tambah = async (p: Profile | null) => {
    setSavingId(p?.id ?? 'nim');
    setInfo(null);
    try {
      const ditambah = p ? await addPeserta(cls, p) : await addPesertaByNim(cls, cari);
      tandaiDitambah(ditambah.id);
      setInfo({ ok: true, text: `${ditambah.nama} ditambahkan ke ${labelKelas(cls)}.` });
      // NIM lengkap yang diketik manual sudah selesai dipakai; hasil pencarian biasa dibiarkan.
      if (!p) setCari('');
    } catch (e) {
      // Tertunda = sudah tersimpan di perangkat; sembunyikan agar tidak dikirim dua kali.
      if (isTertunda(e) && p) tandaiDitambah(p.id);
      setInfo({ ok: false, text: pesanFirestore(e, 'Gagal menambah peserta.') });
    } finally {
      setSavingId(null);
    }
  };

  // Tambahkan semua hasil pencarian satu per satu; yang gagal (mis. jadwal bentrok) dilaporkan.
  const tambahSemua = async (daftar: Profile[]) => {
    setSavingId('semua');
    setInfo(null);
    const gagal: string[] = [];
    let berhasil = 0;
    for (const p of daftar) {
      try {
        await addPeserta(cls, p);
        berhasil++;
        tandaiDitambah(p.id);
      } catch (e) {
        if (isTertunda(e)) {
          berhasil++;
          tandaiDitambah(p.id);
        } else {
          gagal.push(`${p.nama}: ${pesanFirestore(e, 'gagal ditambahkan')}`);
        }
      }
    }
    setInfo({
      ok: gagal.length === 0,
      text:
        `${berhasil} praktikan ditambahkan ke ${labelKelas(cls)}.` +
        (gagal.length ? `\n${gagal.length} gagal:\n• ${gagal.join('\n• ')}` : ''),
    });
    setSavingId(null);
  };

  const keluarkan = (p: Profile) =>
    Alert.alert('Keluarkan peserta?', `${p.nama} tidak akan lagi melihat jadwal ${labelKelas(cls)}.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluarkan',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePeserta(cls, p.id);
          } catch (e) {
            Alert.alert(isTertunda(e) ? 'Belum terkirim' : 'Gagal', pesanFirestore(e, 'Gagal mengeluarkan peserta.'));
          }
        },
      },
    ]);

  const nimLengkap = /^[0-9]{5,20}$/.test(cari.trim());

  return (
    <View style={styles.panel}>
      <TextInput
        style={styles.input}
        value={cari}
        onChangeText={(t) => {
          setCari(t);
          setInfo(null);
        }}
        placeholder="Cari NIM atau nama praktikan"
        placeholderTextColor={colors.placeholder}
        maxLength={100}
        returnKeyType="search"
        onSubmitEditing={() => nimLengkap && hasil?.length === 0 && tambah(null)}
        editable={!savingId}
        accessibilityLabel="Cari praktikan berdasarkan NIM atau nama"
      />
      <Text style={styles.hintText}>
        Ketik minimal 2 karakter, misalnya awal NIM atau awal nama. Hasil tetap tampil setelah menambah,
        jadi bisa langsung menambah yang lain.
      </Text>

      {mencari ? <ActivityIndicator style={styles.panelLoading} color={colors.primary} /> : null}
      {!mencari && hasil ? (
        hasil.length === 0 ? (
          <Text style={styles.emptyText}>
            Tidak ada praktikan yang cocok dan belum menjadi peserta kelas ini.
          </Text>
        ) : (
          <View style={styles.hasilList}>
            {hasil.length > 1 ? (
              <PrimaryButton
                label={`Tambah semua (${hasil.length})`}
                size="sm"
                variant="secondary"
                onPress={() => tambahSemua(hasil)}
                disabled={!!savingId}
                loading={savingId === 'semua'}
                accessibilityLabel={`Tambah semua ${hasil.length} praktikan hasil pencarian`}
                style={styles.tambahSemua}
              />
            ) : null}
            {hasil.map((p) => (
              <View key={p.id} style={styles.hasilRow}>
                <View style={styles.flex}>
                  <Text style={styles.pesertaNama}>{p.nama}</Text>
                  <Text style={styles.pesertaNim}>NIM {p.nim ?? '-'}</Text>
                </View>
                <PrimaryButton
                  label="Tambah"
                  size="sm"
                  onPress={() => tambah(p)}
                  disabled={!!savingId}
                  loading={savingId === p.id}
                  accessibilityLabel={`Tambah ${p.nama}`}
                  style={styles.addButton}
                />
              </View>
            ))}
          </View>
        )
      ) : null}

      {info ? (
        <Text style={[styles.info, { color: info.ok ? colors.success : colors.danger }]}>{info.text}</Text>
      ) : null}

      <Text style={styles.label}>Peserta ({cls.pesertaIds.length})</Text>
      {error ? (
        <Text style={[styles.info, { color: colors.danger }]}>{error}</Text>
      ) : peserta === null ? (
        <ActivityIndicator style={styles.panelLoading} color={colors.primary} />
      ) : peserta.length === 0 ? (
        <Text style={styles.emptyText}>Belum ada peserta. Cari praktikan di atas untuk menambahkannya.</Text>
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
              <Ionicons name="person-remove-outline" size={18} color={colors.secondary} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

// Modal buat Kelas A–E, atau gabung sebagai asisten partner jika kelas itu sudah dibuat asisten lain.
function ClassFormModal({ asistenId, onClose }: { asistenId: string; onClose: () => void }) {
  const [praktikum, setPraktikum] = useState('');
  const [kode, setKode] = useState<KodeKelas | null>(null);
  const [daftarPraktikum, setDaftarPraktikum] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let aktif = true;
    getDaftarPraktikum()
      .then((list) => aktif && setDaftarPraktikum(list))
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, []);

  const saran = daftarPraktikum.filter(
    (p) => p !== praktikum && p.toLowerCase().includes(praktikum.trim().toLowerCase()),
  );

  const simpan = async () => {
    if (!kode) {
      setError('Pilih kelas A, B, C, D, atau E.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const hasil = await simpanKelas(asistenId, { praktikum, kode });
      onClose();
      if (hasil.bergabung) {
        Alert.alert('Bergabung ke kelas', `Kamu sekarang asisten partner Kelas ${kode}. Sesi kelas ini kalian kelola bersama.`);
      }
    } catch (e) {
      setError(pesanFirestore(e, 'Gagal menyimpan kelas.'));
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="height">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Tambah / Gabung Kelas</Text>
          <Text style={styles.hintText}>
            Jika kelas yang sama sudah dibuat asisten lain, kamu otomatis bergabung sebagai partner
            (maksimal {MAKS_ASISTEN_KELAS} asisten per kelas).
          </Text>

          <Text style={styles.label}>Praktikum</Text>
          <TextInput
            style={styles.input}
            value={praktikum}
            onChangeText={setPraktikum}
            placeholder="Contoh: Praktikum PPK"
            placeholderTextColor={colors.placeholder}
            maxLength={MAKS_PRAKTIKUM}
            editable={!saving}
          />
          {saran.length > 0 ? (
            <View style={styles.saranRow}>
              {saran.slice(0, 4).map((p) => (
                <Pressable
                  key={p}
                  style={({ pressed }) => [styles.saran, pressed && styles.actionPressed]}
                  onPress={() => setPraktikum(p)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Pakai praktikum ${p}`}
                >
                  <Text style={styles.saranText} numberOfLines={1}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <SelectField
            label="Kelas"
            value={kode}
            options={KODE_KELAS.map((k) => ({ value: k, label: `Kelas ${k}` }))}
            onChange={setKode}
            placeholder="Pilih kelas"
            disabled={saving}
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

// Nama asisten pengampu kelas (mis. "Budi & Sari"), dibaca sekali per perubahan daftar.
function useNamaPengampu(classes: ClassDoc[] | null): Record<string, string> {
  const [nama, setNama] = useState<Record<string, string>>({});
  const key = [...new Set((classes ?? []).flatMap((c) => c.asistenIds))].sort().join('|');
  useEffect(() => {
    const ids = key ? key.split('|') : [];
    let aktif = true;
    Promise.all(ids.map(async (id) => [id, (await getNamaPengguna(id)) ?? 'Asisten'] as const)).then(
      (pasangan) => aktif && setNama(Object.fromEntries(pasangan)),
    );
    return () => {
      aktif = false;
    };
  }, [key]);
  return nama;
}

export default function ManageClassScreen() {
  const { profile } = useAuth();
  const asistenId = profile?.role === 'asisten' ? profile.id : null;

  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const namaPengampu = useNamaPengampu(classes);

  useEffect(() => {
    if (!asistenId) return;
    return subscribeClassesForAsisten(
      asistenId,
      (data) => {
        setClasses(urutNama(data, (c) => `${c.praktikum} ${c.namaKelas}`));
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

  const keluar = (cls: ClassDoc) =>
    Alert.alert('Keluar dari kelas?', `Kamu tidak lagi mengampu ${labelKelas(cls)} (${cls.praktikum}). Partnermu tetap mengampu kelas ini.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          try {
            await keluarDariKelas(cls, asistenId);
          } catch (e) {
            Alert.alert(isTertunda(e) ? 'Belum terkirim' : 'Gagal', pesanFirestore(e, 'Gagal keluar dari kelas.'));
          }
        },
      },
    ]);

  const hapus = (cls: ClassDoc) =>
    Alert.alert('Hapus kelas?', `${labelKelas(cls)} (${cls.praktikum}) akan dihapus beserta daftar pesertanya.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClass(cls);
          } catch (e) {
            Alert.alert(isTertunda(e) ? 'Belum terkirim' : 'Gagal menghapus', pesanFirestore(e, 'Gagal menghapus kelas.'));
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
              onPress={() => setFormOpen(true)}
              accessibilityLabel="Tambah atau gabung kelas"
              style={styles.addClassButton}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Belum ada kelas"
            message="Tekan tombol + Kelas untuk membuat Kelas A–E atau bergabung ke kelas partnermu."
          />
        }
        renderItem={({ item }) => {
          const open = openId === item.id;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{labelKelas(item)}</Text>
              <Text style={styles.cardMeta}>
                {item.praktikum} · {item.pesertaIds.length} peserta
              </Text>
              <Text style={styles.cardMeta}>
                Asisten ({item.asistenIds.length}/{MAKS_ASISTEN_KELAS}):{' '}
                {item.asistenIds.map((id) => namaPengampu[id] ?? '…').join(' & ')}
              </Text>
              <View style={styles.actions}>
                <ActionButton
                  icon={open ? 'chevron-up' : 'people-outline'}
                  label="Peserta"
                  tone="primary"
                  onPress={() => setOpenId(open ? null : item.id)}
                />
                {item.asistenIds.length > 1 ? (
                  <ActionButton icon="exit-outline" label="Keluar" onPress={() => keluar(item)} />
                ) : null}
                <ActionButton icon="trash-outline" label="Hapus" tone="danger" onPress={() => hapus(item)} />
              </View>
              {open ? <PesertaPanel cls={item} /> : null}
            </View>
          );
        }}
      />
      {formOpen ? <ClassFormModal asistenId={asistenId} onClose={() => setFormOpen(false)} /> : null}
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
  addButton: { minWidth: 88 },
  hintText: { ...text.caption },
  hasilList: { gap: 2, borderRadius: radius.input, backgroundColor: colors.surface, padding: 10 },
  tambahSemua: { alignSelf: 'flex-start', marginBottom: 4 },
  hasilRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  saranRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  saran: {
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.tint,
  },
  saranText: { fontSize: 12, fontFamily: font.semibold, color: colors.secondary },
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
  pesertaInitial: { fontSize: 13, fontFamily: font.extraBold, color: colors.secondary },
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
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.overlay },
  modal: { backgroundColor: colors.card, borderRadius: 24, padding: 20, gap: 6 },
  modalTitle: { fontSize: 18, fontFamily: font.extraBold, color: colors.text, marginBottom: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalButton: { flex: 1, minHeight: 46, paddingHorizontal: 12 },
});
