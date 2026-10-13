import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useUpdateDisplayName } from '@/hooks/use-profile';
import { nameSchema } from '@/lib/validation';

type Values = z.infer<typeof nameSchema>;

export default function Name() {
  const updateName = useUpdateDisplayName();
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(nameSchema), defaultValues: { name: '' } });

  // Once the profile refetches, the guard in (app)/_layout moves us to the home screen.
  const submit = handleSubmit(async ({ name }) => {
    try {
      await updateName.mutateAsync(name);
    } catch {
      setError('name', { message: 'Could not save your name. Please try again.' });
    }
  });

  return (
    <Screen>
      <ThemedText type="subtitle">What should we call you?</ThemedText>
      <ThemedText themeColor="textSecondary">This is what your partner will see.</ThemedText>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Your name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.name?.message}
            autoComplete="given-name"
            textContentType="givenName"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        )}
      />
      <Button title="Continue" onPress={submit} loading={isSubmitting} />
    </Screen>
  );
}
