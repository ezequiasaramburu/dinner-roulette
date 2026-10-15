import { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { COUNTRY_NAMES, countryFlag } from '@/constants/countries';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = { label: string; value: string; onChange: (country: string) => void; error?: string };

/** A field that opens a searchable list of every country, so recipes always carry a country with a flag. */
export function CountryField({ label, value, onChange, error }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const countries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRY_NAMES.filter((n) => n.toLowerCase().includes(q)) : COUNTRY_NAMES;
  }, [query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : `${label}: choose`}
        onPress={() => setOpen(true)}
        style={[
          styles.field,
          { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.borderStrong },
        ]}>
        <Text style={styles.fieldText} tone={value ? 'default' : 'tertiary'}>
          {value ? `${countryFlag(value)}  ${value}` : 'Choose a country'}
        </Text>
        <Text tone="tertiary">›</Text>
      </PressableScale>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <Text variant="heading">Country</Text>
            <PressableScale accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close}>
              <Text tone="primary" variant="bodyStrong">
                Close
              </Text>
            </PressableScale>
          </View>
          <View style={styles.search}>
            <TextField
              label="Search"
              hideLabel
              placeholder="Search countries"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
          <FlatList
            data={countries}
            keyExtractor={(name) => name}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text tone="secondary" align="center" style={styles.empty}>
                No country matches &quot;{query}&quot;.
              </Text>
            }
            renderItem={({ item }) => (
              <PressableScale
                accessibilityRole="button"
                onPress={() => {
                  onChange(item);
                  close();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: theme.border },
                  pressed && { backgroundColor: theme.surfaceMuted },
                ]}>
                <Text style={styles.flag}>{countryFlag(item)}</Text>
                <Text style={styles.name} variant={item === value ? 'bodyStrong' : 'body'}>
                  {item}
                </Text>
                {item === value ? <Text tone="primary">✓</Text> : null}
              </PressableScale>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  field: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  fieldText: { flex: 1 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  search: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flag: { fontSize: 24, lineHeight: 30 },
  name: { flex: 1 },
  empty: { marginTop: Spacing.xl },
});
