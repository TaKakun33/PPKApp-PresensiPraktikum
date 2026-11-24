// Dropdown sederhana: tombol berisi nilai terpilih, lalu daftar pilihan dalam modal.
// Dipakai form sesi (kelas, ruangan lab, jam) dan kelola kelas (Kelas A–E).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, text } from '../constants/theme';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  /** Keterangan kecil di bawah label (mis. nama praktikum, "Sudah dibooking"). */
  sub?: string;
  disabled?: boolean;
};

type Props<T extends string | number> = {
  label: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Ditampilkan di dalam modal jika tidak ada pilihan. */
  emptyText?: string;
};

export default function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Pilih',
  disabled,
  emptyText = 'Tidak ada pilihan.',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const terpilih = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.input, pressed && styles.pressed, disabled && styles.disabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: terpilih?.label ?? 'Belum dipilih' }}
      >
        <View style={styles.valueWrap}>
          <Text style={[styles.value, !terpilih && styles.placeholder]} numberOfLines={1}>
            {terpilih?.label ?? placeholder}
          </Text>
          {terpilih?.sub ? (
            <Text style={styles.valueSub} numberOfLines={1}>
              {terpilih.sub}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={16} color={colors.text} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropPress} onPress={() => setOpen(false)} accessibilityLabel="Tutup pilihan" />
          <View style={styles.card}>
            <Text style={styles.title}>{label}</Text>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {options.length === 0 ? <Text style={styles.empty}>{emptyText}</Text> : null}
              {options.map((o) => {
                const aktif = o.value === value;
                return (
                  <Pressable
                    key={String(o.value)}
                    style={({ pressed }) => [
                      styles.option,
                      aktif && styles.optionActive,
                      pressed && !o.disabled && styles.optionPressed,
                    ]}
                    onPress={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    disabled={o.disabled}
                    accessibilityRole="button"
                    accessibilityState={{ selected: aktif, disabled: !!o.disabled }}
                  >
                    <View style={styles.valueWrap}>
                      <Text
                        style={[styles.optionText, aktif && styles.optionTextActive, o.disabled && styles.optionDisabled]}
                      >
                        {o.label}
                      </Text>
                      {o.sub ? (
                        <Text style={[styles.optionSub, o.disabled && styles.optionDisabled]}>{o.sub}</Text>
                      ) : null}
                    </View>
                    {aktif ? <Ionicons name="checkmark" size={18} color={colors.primaryText} /> : null}
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

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...text.bodyStrong, color: colors.textSecondary },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  valueWrap: { flex: 1, gap: 2 },
  value: { fontSize: 14, fontFamily: font.medium, color: colors.text },
  valueSub: { fontSize: 11, fontFamily: font.medium, color: colors.textSecondary },
  placeholder: { color: colors.placeholder },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.overlay,
  },
  backdropPress: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    maxHeight: '75%',
  },
  title: { fontSize: 16, fontFamily: font.bold, color: colors.text },
  list: { marginTop: 8 },
  empty: { ...text.caption, paddingVertical: 12, paddingHorizontal: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.input,
  },
  optionActive: { backgroundColor: colors.tint },
  optionPressed: { backgroundColor: colors.surface },
  optionText: { fontSize: 15, fontFamily: font.medium, color: colors.text },
  optionTextActive: { fontFamily: font.semibold, color: colors.primaryText },
  optionSub: { fontSize: 12, fontFamily: font.medium, color: colors.textSecondary },
  optionDisabled: { color: colors.placeholder, opacity: 0.6 },
});
