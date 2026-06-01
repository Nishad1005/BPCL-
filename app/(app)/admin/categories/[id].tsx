import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { categorySchema, type CategoryFormValues } from '@/lib/schemas/category';
import { useCategory, useSaveCategory } from '@/lib/hooks/useCategoryAdmin';

export default function CategoryForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useCategory(id);
  const save = useSaveCategory();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', active: true },
  });
  useEffect(() => { if (existing) reset({ name: existing.name, active: existing.active }); }, [existing, reset]);

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  const onSubmit = (values: CategoryFormValues) =>
    save.mutate({ id: isNew ? undefined : id, values }, { onSuccess: () => router.back() });

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New category' : 'Edit category' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            value={field.value} onChangeText={field.onChange} />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
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
