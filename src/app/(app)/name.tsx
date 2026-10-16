import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { z } from 'zod';

import { Accent, Button, Screen, Text, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { enter } from '@/hooks/use-motion';
import { useUpdateDisplayName } from '@/hooks/use-profile';
import { isNetworkError, OFFLINE_MESSAGE } from '@/lib/errors';
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

  // Once the profile refetches, the guard in (app)/_layout moves us to the next step.
  const submit = handleSubmit(async ({ name }) => {
    try {
      await updateName.mutateAsync(name);
    } catch (e) {
      setError('name', { message: isNetworkError(e) ? OFFLINE_MESSAGE : 'Could not save your name. Please try again.' });
    }
  });

  return (
    <Screen footer={<Button title="Continue" onPress={submit} loading={isSubmitting} />}>
      <Animated.View entering={enter()} style={styles.stack}>
        <Text variant="overline" tone="primary">
          Welcome
        </Text>
        <Text variant="title">
          What should we <Accent>call you?</Accent>
        </Text>
        <Text tone="secondary">This is the name your partner will see.</Text>
        <View style={styles.field}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextField
                label="Your first name"
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
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.md, marginTop: Spacing.xxl },
  field: { marginTop: Spacing.lg },
});
