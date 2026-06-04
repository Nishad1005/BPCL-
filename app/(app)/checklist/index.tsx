import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { isTemplateApplicable, useActiveTemplatesWithItems, useTodaysSubmissions } from '@/lib/hooks/useChecklistTemplates';

export default function ChecklistIndex() {
  const { profile } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const tpls = useActiveTemplatesWithItems();
  const subs = useTodaysSubmissions(storeId);

  if (!storeId) {
    return (
      <View className="flex-1 gap-3 bg-white p-6 dark:bg-neutral-950">
        <Stack.Screen options={{ title: 'Checklists' }} />
        <Text className="text-base text-neutral-700 dark:text-neutral-300">This account isn&apos;t assigned to a primary store.</Text>
        <Text className="text-neutral-500">Checklists are for store users. Admins manage templates in Admin → Checklist templates.</Text>
      </View>
    );
  }

  const submittedMap = new Map<string, { id: string; period_start: string; score: number }>();
  for (const s of subs.data ?? []) submittedMap.set(`${s.template_id}:${s.period_start}`, s);

  const applicableRows = (tpls.data ?? []).flatMap((t) => {
    const win = isTemplateApplicable(t.frequency);
    if (!win) return [];
    const key = `${t.id}:${win.periodStart}`;
    const sub = submittedMap.get(key);
    return [{ template: t, periodStart: win.periodStart, submission: sub }];
  });

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Checklists' }} />
      {(tpls.isPending || subs.isPending) && <ActivityIndicator className="mt-8" />}
      <FlatList
        data={applicableRows}
        keyExtractor={(r) => `${r.template.id}:${r.periodStart}`}
        contentContainerClassName="p-4 gap-2"
        ListEmptyComponent={!tpls.isPending ? <Text className="p-4 text-neutral-500">No active checklist templates.</Text> : null}
        renderItem={({ item }) => (
          item.submission
            ? <Link href={`/checklist/${item.submission.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <View>
                  <Text className="font-semibold text-neutral-900 dark:text-white">{item.template.name}</Text>
                  <Text className="text-neutral-500">{item.periodStart} • Score {Math.round(item.submission.score * 100)}%</Text>
                </View>
              </Link>
            : <Link href={`/checklist/new?templateId=${item.template.id}` as any} className="rounded-xl border border-amber-400 bg-amber-50 p-3 dark:bg-amber-950">
                <View>
                  <Text className="font-semibold text-amber-900 dark:text-amber-200">{item.template.name}</Text>
                  <Text className="text-amber-800 dark:text-amber-300">Pending • {item.template.frequency}</Text>
                </View>
              </Link>
        )}
      />
    </View>
  );
}
