import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useActiveTemplatesWithItems } from '@/lib/hooks/useChecklistTemplates';
import { useSubmitChecklist } from '@/lib/hooks/useChecklistSubmission';
import type { StagedAnswer } from '@/lib/schemas/checklist';

const ANSWERS = ['done', 'not_done', 'needs_support', 'na'] as const;
const LABEL: Record<typeof ANSWERS[number], string> = {
  done: 'Done', not_done: 'Not Done', needs_support: 'Needs Support', na: 'N/A',
};

export default function NewChecklistScreen() {
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const tpls = useActiveTemplatesWithItems();
  const submit = useSubmitChecklist();

  const template = tpls.data?.find((t) => t.id === templateId);
  const [answers, setAnswers] = useState<Record<string, StagedAnswer>>({});

  const update = (itemId: string, patch: Partial<StagedAnswer>) =>
    setAnswers((prev) => {
      const base: StagedAnswer = prev[itemId] ?? { itemId, answer: null, remarks: '' };
      return { ...prev, [itemId]: { ...base, ...patch, itemId } };
    });

  const pickPhotoFor = async (itemId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    update(itemId, { photo: { blob, ext: 'jpg' } });
  };

  const grouped = useMemo(() => {
    type Item = NonNullable<typeof template>['items'][number];
    if (!template) return [] as { section: string | null; items: Item[] }[];
    const map = new Map<string | null, Item[]>();
    for (const it of template.items) {
      const key = it.section ?? null;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
  }, [template]);

  if (tpls.isPending) return <ActivityIndicator className="mt-8" />;
  if (!template) return <Text className="p-6 text-red-600">Template not found.</Text>;
  if (template.frequency === 'visit_based') {
    return (
      <View className="p-6">
        <Stack.Screen options={{ title: 'Checklist' }} />
        <Text className="text-neutral-700 dark:text-neutral-300">
          This template is visit-based — it&apos;s submitted as part of an NSO visit (M3, not yet built).
        </Text>
      </View>
    );
  }
  if (template.items.length === 0) {
    return (
      <View className="gap-2 p-6">
        <Stack.Screen options={{ title: template.name }} />
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">No items in this template yet</Text>
        <Text className="text-neutral-500">
          A Super Admin needs to add at least one item in Admin → Checklist templates → {template.name}, then return here.
        </Text>
      </View>
    );
  }

  const photoMissing = template.items.some((it) => it.requires_photo
    && answers[it.id]?.answer === 'done'
    && !answers[it.id]?.photo);

  const allAnswered = template.items.every((it) => answers[it.id]?.answer != null);

  const storeId = profile?.primary_store_id;
  const canSubmit = !!storeId && allAnswered && !photoMissing && !submit.isPending;

  const onSubmit = () => {
    if (!storeId) return;
    submit.mutate(
      { templateId: template.id, frequency: template.frequency, storeId, answers: Object.values(answers) },
      { onSuccess: ({ id }) => router.replace(`/checklist/${id}` as any) },
    );
  };

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: template.name }} />

      {grouped.map(({ section, items }) => (
        <View key={section ?? '__unsectioned__'} className="gap-3">
          {section && <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{section}</Text>}
          {items.map((it) => (
            <View key={it.id} className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <Text className="text-neutral-900 dark:text-white">{it.prompt}</Text>
              <View className="flex-row flex-wrap gap-2">
                {ANSWERS.map((a) => (
                  <Pressable key={a} onPress={() => update(it.id, { answer: a })}
                    className={`rounded-full border px-3 py-1 ${answers[it.id]?.answer === a ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
                    <Text className={answers[it.id]?.answer === a ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{LABEL[a]}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput placeholder="Remarks (optional)"
                value={answers[it.id]?.remarks ?? ''}
                onChangeText={(v) => update(it.id, { remarks: v })}
                className="rounded-xl border border-neutral-300 px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:text-white" />
              {it.requires_photo && (
                <View className="gap-2">
                  {answers[it.id]?.photo && <Text className="text-green-700 dark:text-green-400">Photo staged ✓</Text>}
                  <Pressable onPress={() => pickPhotoFor(it.id)}
                    className="items-center rounded-xl border border-neutral-300 p-2 dark:border-neutral-700">
                    <Text className="text-neutral-700 dark:text-neutral-300">{answers[it.id]?.photo ? 'Replace photo' : 'Add required photo'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      ))}

      {submit.error && <Text className="text-red-600">{(submit.error as Error).message}</Text>}
      {photoMissing && <Text className="text-amber-700">Some Done answers require a photo.</Text>}
      <Pressable disabled={!canSubmit} onPress={onSubmit}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 disabled:opacity-50 active:bg-blue-700">
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Submit checklist</Text>}
      </Pressable>
    </ScrollView>
  );
}
