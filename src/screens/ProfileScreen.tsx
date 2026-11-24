// Layar Profil: lihat data akun, ubah nama, ubah password.
// Email, NIM, dan peran hanya ditampilkan (tidak bisa diubah). Semua panggilan Firebase lewat authService.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PrimaryButton from '../components/PrimaryButton';
import { colors, font, layout, radius, text } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  PASSWORD_MIN,
  changePassword,
  getAuthErrorMessage,
  updateProfileName,
} from '../services/authService';

type Notice = { type: 'success' | 'error'; text: string } | null;

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const ok = notice.type === 'success';
  return (
    <View style={[styles.notice, ok ? styles.noticeOk : styles.noticeErr]}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={15}
        color={ok ? colors.success : colors.danger}
      />
      <Text style={[styles.noticeText, { color: colors.text }]}>{notice.text}</Text>
    </View>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputBox}>
        <Ionicons name="lock-closed-outline" size={18} color={colors.placeholder} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
        />
        <Pressable
          onPress={() => setShow((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={show ? 'Sembunyikan password' : 'Tampilkan password'}
        >
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.placeholder} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();

  const [nama, setNama] = useState(profile?.nama ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameNotice, setNameNotice] = useState<Notice>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwNotice, setPwNotice] = useState<Notice>(null);

  if (!profile) return null;

  const nameChanged = nama.trim() !== profile.nama;

  const handleSaveName = async () => {
    if (savingName) return;
    setNameNotice(null);
    setSavingName(true);
    try {
      await updateProfileName(profile.id, nama);
      setNama(nama.trim());
      setNameNotice({ type: 'success', text: 'Nama berhasil diperbarui.' });
    } catch (e: unknown) {
      setNameNotice({ type: 'error', text: getAuthErrorMessage(e, 'Gagal menyimpan nama. Coba lagi.') });
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (savingPw) return;
    setPwNotice(null);
    if (!currentPw || !newPw || !confirmPw) {
      setPwNotice({ type: 'error', text: 'Semua kolom password harus diisi.' });
      return;
    }
    if (newPw.length < PASSWORD_MIN) {
      setPwNotice({ type: 'error', text: `Password baru minimal ${PASSWORD_MIN} karakter.` });
      return;
    }
    if (newPw !== confirmPw) {
      setPwNotice({ type: 'error', text: 'Konfirmasi password baru tidak sama.' });
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwNotice({ type: 'success', text: 'Password berhasil diubah.' });
    } catch (e: unknown) {
      setPwNotice({ type: 'error', text: getAuthErrorMessage(e, 'Gagal mengubah password. Coba lagi.') });
    } finally {
      setSavingPw(false);
    }
  };

  const isAsisten = profile.role === 'asisten';
  const initial = (profile.nama.trim()[0] ?? '?').toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Ringkasan akun */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile.nama}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{isAsisten ? 'Asisten' : 'Praktikan'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={colors.placeholder} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
          {!isAsisten && profile.nim ? (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={16} color={colors.placeholder} />
              <Text style={styles.infoLabel}>NIM</Text>
              <Text style={styles.infoValue}>{profile.nim}</Text>
            </View>
          ) : null}
          <Text style={styles.hint}>Email dan NIM tidak bisa diubah. Hubungi admin bila ada kesalahan.</Text>
        </View>

        {/* Ubah nama */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ubah nama</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nama lengkap</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={18} color={colors.placeholder} />
              <TextInput
                style={styles.input}
                placeholder="Nama lengkap"
                placeholderTextColor={colors.placeholder}
                value={nama}
                onChangeText={(t) => {
                  setNama(t);
                  setNameNotice(null);
                }}
                autoCapitalize="words"
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={nameChanged ? handleSaveName : undefined}
              />
            </View>
          </View>
          <NoticeBox notice={nameNotice} />
          <PrimaryButton
            label={savingName ? 'Menyimpan...' : 'Simpan nama'}
            onPress={handleSaveName}
            loading={savingName}
            disabled={!nameChanged}
            accessibilityLabel="Simpan nama"
          />
        </View>

        {/* Ubah password */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ubah password</Text>
          <PasswordField
            label="Password lama"
            value={currentPw}
            onChangeText={(t) => {
              setCurrentPw(t);
              setPwNotice(null);
            }}
            placeholder="Password lama"
            autoComplete="current-password"
          />
          <PasswordField
            label="Password baru"
            value={newPw}
            onChangeText={(t) => {
              setNewPw(t);
              setPwNotice(null);
            }}
            placeholder={`Minimal ${PASSWORD_MIN} karakter`}
            autoComplete="new-password"
          />
          <PasswordField
            label="Ulangi password baru"
            value={confirmPw}
            onChangeText={(t) => {
              setConfirmPw(t);
              setPwNotice(null);
            }}
            placeholder="Ulangi password baru"
            autoComplete="new-password"
          />
          <NoticeBox notice={pwNotice} />
          <PrimaryButton
            label={savingPw ? 'Memproses...' : 'Ubah password'}
            onPress={handleChangePassword}
            loading={savingPw}
            accessibilityLabel="Ubah password"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: 12, gap: 12 },
  card: {
    gap: 14,
    padding: 18,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontFamily: font.extraBold, color: colors.secondary },
  name: { textAlign: 'center', fontSize: 18, fontFamily: font.extraBold, color: colors.text },
  roleBadge: {
    alignSelf: 'center',
    backgroundColor: colors.tint,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  roleText: { fontSize: 12, fontFamily: font.semibold, color: colors.secondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { ...text.bodyStrong, color: colors.textSecondary },
  infoValue: { flex: 1, textAlign: 'right', ...text.bodyStrong },
  hint: { fontSize: 11, lineHeight: 16, fontFamily: font.medium, color: colors.textSecondary },
  sectionTitle: { ...text.sectionTitle },
  fieldGroup: { gap: 7 },
  label: { fontSize: 10, letterSpacing: 0.4, fontFamily: font.bold, color: colors.textSecondary, textTransform: 'uppercase' },
  inputBox: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.medium,
    color: colors.text,
    paddingVertical: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  noticeOk: { backgroundColor: colors.successTint, borderColor: colors.success },
  noticeErr: { backgroundColor: colors.dangerTint, borderColor: colors.danger },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: font.medium },
});
