import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { storeSchema, type StoreFormValues } from '@/lib/schemas/store';
import { useRegions, useSaveStore, useStore } from '@/lib/hooks/useStores';

export default function StoreForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useStore(id);
  const { data: regions } = useRegions();
  const save = useSaveStore();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: { store_name: '', dealer_name: '', city: '', state: '', region_id: null, active: true },
  });

  useEffect(() => {
    if (existing) reset({
      store_name: existing.store_name, dealer_name: existing.dealer_name ?? '',
      city: existing.city ?? '', state: existing.state ?? '',
      region_id: existing.region_id, active: existing.active,
    });
  }, [existing, reset]);

  const onSubmit = (values: StoreFormValues) =>
    save.mutate({ id: isNew ? undefined : id, values }, { onSuccess: () => router.back() });

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New store' : 'Edit store' }} />
      <Field name="store_name" label="Store name" control={control} error={errors.store_name?.message} />
      <Field name="dealer_name" label="Dealer name" control={control} />
      <Field name="city" label="City" control={control} />
      <Field name="state" label="State" control={control} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Region</Text>
        <Controller control={control} name="region_id" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {(regions ?? []).map((reg) => (
              <Pressable key={reg.id} onPress={() => field.onChange(reg.id)}
                className={`rounded-full border px-3 py-1 ${field.value === reg.id ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === reg.id ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{reg.name}</Text>
              </Pressable>
            ))}
          </View>
        )} />
      </View>
      <Controller control={control} name="active" render={({ field }) => (
        <View className="flex-row items-center justify-between">
          <Text className="text-neutral-900 dark:text-white">Active</Text>
          <Switch value={field.value} onValueChange={field.onChange} />
        </View>
      )} />
      {save.error && <Text className="text-red-600">{(save.error as Error).message}</Text>}
      <Pressable disabled={save.isPending} onPress={handleSubmit(onSubmit)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ name, label, control, error }: { name: keyof StoreFormValues; label: string; control: any; error?: string }) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <TextInput className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          value={(field.value as string) ?? ''} onChangeText={field.onChange} />
      )} />
      {error && <Text className="text-red-600">{error}</Text>}
    </View>
  );
}
