import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { templateSchema, type TemplateFormValues, type ItemFormValues } from '@/lib/schemas/checklist';
import { useDeleteItem, useSaveItem, useSaveTemplate, useTemplate } from '@/lib/hooks/useChecklistAdmin';

const FREQS = ['daily', 'weekly', 'monthly', 'visit_based'] as const;

export default function TemplateForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const { data: existing, isPending } = useTemplate(id);
  const saveTpl = useSaveTemplate();
  const saveItem = useSaveItem();
  const deleteItem = useDeleteItem();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema) as any,
    defaultValues: { name: '', frequency: 'daily', active: true },
  });

  useEffect(() => {
    if (existing) reset({ name: existing.name, frequency: existing.frequency, active: existing.active });
  }, [existing, reset]);

  const onSubmitTpl = (values: TemplateFormValues) =>
    saveTpl.mutate({ id: isNew ? undefined : id, values }, {
      onSuccess: (newId) => { if (isNew) router.replace(`/admin/checklist-templates/${newId}` as any); },
    });

  if (!isNew && isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: isNew ? 'New template' : 'Edit template' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Name</Text>
        <Controller control={control} name="name" render={({ field }) => (
          <TextInput value={field.value} onChangeText={field.onChange}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
        )} />
        {errors.name && <Text className="text-red-600">{errors.name.message}</Text>}
      </View>
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Frequency</Text>
        <Controller control={control} name="frequency" render={({ field }) => (
          <View className="flex-row flex-wrap gap-2">
            {FREQS.map((f) => (
              <Pressable key={f} onPress={() => field.onChange(f)}
                className={`rounded-full border px-3 py-1 ${field.value === f ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                <Text className={field.value === f ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{f}</Text>
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
      {saveTpl.error && <Text className="text-red-600">{(saveTpl.error as Error).message}</Text>}
      <Pressable disabled={saveTpl.isPending} onPress={handleSubmit(onSubmitTpl)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {saveTpl.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save template</Text>}
      </Pressable>

      {!isNew && (
        <View className="gap-3">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Items</Text>
          {(existing?.items ?? []).map((it: any) => (
            <ItemRow key={it.id} item={it} templateId={id!}
              onSave={(values) => saveItem.mutate({ id: it.id, templateId: id!, values })}
              onDelete={() => deleteItem.mutate(it.id)} />
          ))}
          <NewItemRow templateId={id!} onSave={(values) => saveItem.mutate({ templateId: id!, values })} />
        </View>
      )}
    </ScrollView>
  );
}

function ItemRow({ item, templateId, onSave, onDelete }: {
  item: { id: string; section: string | null; prompt: string; requires_photo: boolean; sort: number };
  templateId: string;
  onSave: (v: ItemFormValues) => void;
  onDelete: () => void;
}) {
  const [section, setSection] = useState(item.section ?? '');
  const [prompt, setPrompt] = useState(item.prompt);
  const [requiresPhoto, setRequiresPhoto] = useState(item.requires_photo);
  const [sort, setSort] = useState(String(item.sort));
  return (
    <View className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <TextInput value={section} onChangeText={setSection} placeholder="Section"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 dark:text-white">Requires photo</Text>
        <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} />
      </View>
      <TextInput value={sort} onChangeText={setSort} keyboardType="numeric" placeholder="Sort"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row gap-2">
        <Pressable onPress={() => onSave({ section, prompt, requires_photo: requiresPhoto, sort: Number(sort) || 0 })}
          className="flex-1 items-center rounded-xl bg-blue-600 py-2 active:bg-blue-700">
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
        <Pressable onPress={onDelete} className="items-center rounded-xl border border-red-500 px-3 py-2">
          <Text className="text-red-600">Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NewItemRow({ templateId, onSave }: { templateId: string; onSave: (v: ItemFormValues) => void }) {
  const [section, setSection] = useState('');
  const [prompt, setPrompt] = useState('');
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [sort, setSort] = useState('0');
  return (
    <View className="gap-2 rounded-xl border border-dashed border-neutral-400 p-3">
      <Text className="text-sm font-semibold text-neutral-500">+ New item</Text>
      <TextInput value={section} onChangeText={setSection} placeholder="Section"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <TextInput value={prompt} onChangeText={setPrompt} placeholder="Prompt"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <View className="flex-row items-center justify-between">
        <Text className="text-neutral-900 dark:text-white">Requires photo</Text>
        <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} />
      </View>
      <TextInput value={sort} onChangeText={setSort} keyboardType="numeric" placeholder="Sort"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      <Pressable disabled={!prompt}
        onPress={() => { onSave({ section, prompt, requires_photo: requiresPhoto, sort: Number(sort) || 0 }); setSection(''); setPrompt(''); setRequiresPhoto(false); setSort('0'); }}
        className="items-center rounded-xl bg-blue-600 py-2 active:bg-blue-700 disabled:opacity-50">
        <Text className="font-semibold text-white">Add item</Text>
      </Pressable>
    </View>
  );
}
