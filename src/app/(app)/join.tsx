import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable } from 'react-native';
import { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
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
  const router = useRouter();
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
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <ThemedText type="linkPrimary">‹ Back</ThemedText>
      </Pressable>
      <ThemedText type="subtitle">Enter your invite code</ThemedText>
      <ThemedText themeColor="textSecondary">
        Ask your partner for the 6-character code from their app. Joining is free.
      </ThemedText>
      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Invite code"
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
      <Button title="Join" onPress={submit} loading={isSubmitting} />
    </Screen>
  );
}
