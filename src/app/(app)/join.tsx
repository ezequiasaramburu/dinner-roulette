import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { z } from 'zod';

import { Accent, BackButton, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useJoinCouple } from '@/hooks/use-couple';
import { friendlyError } from '@/lib/errors';
import { usePendingInvite } from '@/lib/pending-invite';

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Codes are 6 letters and numbers'),
});
type Values = z.infer<typeof joinSchema>;

export default function Join() {
  const joinCouple = useJoinCouple();
  const pendingCode = usePendingInvite((s) => s.code);
  const clearPending = usePendingInvite((s) => s.clear);

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(joinSchema), defaultValues: { code: pendingCode ?? '' } });

  // A link opened while this screen is already showing.
  useEffect(() => {
    if (pendingCode) setValue('code', pendingCode);
  }, [pendingCode, setValue]);

  // On success the couple query refreshes and the layout guard moves us to home.
  const submit = handleSubmit(async ({ code }) => {
    try {
      await joinCouple.mutateAsync(code);
      clearPending();
    } catch (e) {
      setError('code', { message: friendlyError(e) });
    }
  });

  return (
    <Screen footer={<Button title="Join" onPress={submit} loading={isSubmitting} />}>
      <BackButton />
      <Animated.View entering={FadeInDown.duration(500)} style={styles.stack}>
        <Text variant="title">
          Enter your <Accent>invite code</Accent>
        </Text>
        <Text tone="secondary">
          Ask your partner for the 6-character code from their app. Joining is free.
        </Text>
        <View style={styles.field}>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <TextField
                label="Invite code"
                variant="code"
                placeholder="······"
                value={field.value}
                onChangeText={(t) => field.onChange(t.toUpperCase())}
                onBlur={field.onBlur}
                error={errors.code?.message}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            )}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md, marginTop: Spacing.lg },
  field: { marginTop: Spacing.lg },
});
