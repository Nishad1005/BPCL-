import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { useChecklistSubmission } from '@/lib/hooks/useChecklistSubmission';
import { signedUrlFor } from '@/lib/storage';

export default function ChecklistDetail() {
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const { data, isPending, error } = useChecklistSubmission(submissionId);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.attachments) return;
    (async () => {
      const urls = await Promise.all(
        (data.attachments as { storage_path: string }[]).map((a) => signedUrlFor(a.storage_path))
      );
      setPhotoUrls(urls);
    })();
  }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;
  if (error) return <Text className="p-6 text-red-600">{(error as Error).message}</Text>;
  if (!data) return null;

  const itemsById = new Map((data.items ?? []).map((it: any) => [it.id, it]));
  const grouped = new Map<string, any[]>();
  for (const a of data.checklist_answers ?? []) {
    const item = itemsById.get(a.item_id);
    if (!item) continue;
    const section = item.section ?? '—';
    const arr = grouped.get(section) ?? [];
    arr.push({ a, item });
    grouped.set(section, arr);
  }

  return (
    <ScrollView contentContainerClassName="gap-3 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: (data as any).checklist_templates?.name ?? 'Checklist' }} />
      <Text className="text-sm text-neutral-500">{data.period_start} • Score {Math.round(((data.score ?? 0) as number) * 100)}%</Text>
      {Array.from(grouped.entries()).map(([section, rows]) => (
        <View key={section} className="gap-2">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{section}</Text>
          {rows.map(({ a, item }) => (
            <View key={a.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <Text className="text-neutral-900 dark:text-white">{item.prompt}</Text>
              <Text className="text-neutral-500">{a.answer}{a.has_photo ? ' • photo' : ''}</Text>
              {a.remarks && <Text className="text-neutral-600 dark:text-neutral-300">{a.remarks}</Text>}
            </View>
          ))}
        </View>
      ))}
      {photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 200, height: 200, borderRadius: 12 }} />)}
    </ScrollView>
  );
}
