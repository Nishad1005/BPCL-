import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { APP_ROLES, userSchema, type UserFormValues } from '@/lib/schemas/user';
import { useSaveUser, useUser } from '@/lib/hooks/useUsers';

export default function UserForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: existing, isPending } = useUser(id);
  const save = useSaveUser();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', role: 'udc', primary_store_id: null, active: true },
  });

  useEffect(() => {
    if (existing) reset({
      name: existing.name, role: existing.role as UserFormValues['role'],
      primary_store_id: existing.primary_store_id, active: existing.active,
    });
  }, [existing, reset]);

  if (isPending) return <ActivityIndicator className="mt-8" />;

  const onSubmit = (values: UserFormValues) => save.mutate({ id: id!, values }, { onSuccess: () => router.back() });

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Edit user' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
            value={field.value} onChangeText={field.onChange} />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
      </View>
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Role</Text>
        <Controller control={control} name="role" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {APP_ROLES.map((r) => (
              <Pressable key={r} onPress={() => field.onChange(r)}
                className={`rounded-full border px-3 py-1 ${field.value === r ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === r ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{r}</Text>
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
