import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

const MIN = 3;
const MAX_LENGTH = 40;
const MAX_TERMS = 20;

/** Same cleaning as the database: lower-case, letters/digits/spaces/hyphens only, single spaces. */
export function cleanTerm(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N} '-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Props = {
  label: string;
  placeholder: string;
  terms: string[];
  onChange: (terms: string[]) => void;
};

/** Free-text list: type something, add it, tap a chip to remove it. */
export function TermsField({ label, placeholder, terms, onChange }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  function add() {
    const term = cleanTerm(text);
    if (!term) return;
    if (term.length < MIN) return setError(`Use at least ${MIN} letters`);
    if (term.length > MAX_LENGTH) return setError(`Keep it under ${MAX_LENGTH} characters`);
    if (terms.length >= MAX_TERMS) return setError(`You can add up to ${MAX_TERMS}`);
    setError(undefined);
    setText('');
    if (!terms.includes(term)) onChange([...terms, term]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.input}>
          <TextField
            label={label}
            placeholder={placeholder}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(undefined);
            }}
            onSubmitEditing={add}
            maxLength={MAX_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            error={error}
          />
        </View>
        <Button title="Add" variant="secondary" onPress={add} disabled={!text.trim()} style={styles.button} />
      </View>
      {terms.length ? (
        <View style={styles.chips}>
          {terms.map((term) => (
            <Chip key={term} label={`${term}  ✕`} selected onPress={() => onChange(terms.filter((t) => t !== term))} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  input: { flex: 1 },
  // Lines up with the input, below the field's label (18pt line + gap).
  button: { minWidth: 72, alignSelf: 'flex-start', marginTop: 18 + Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
