import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { usePendingKpi } from '@/lib/hooks/useKpi';

export default function PendingKpi() {
  const { data, isPending, error } = usePendingKpi();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Pending review' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-2"
        ListEmptyComponent={!isPending ? <Text className="p-4 text-neutral-500">No KPI reports pending review.</Text> : null}
        renderItem={({ item }) => (
          <Link href={`/kpi/${item.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{(item as any).stores?.store_name ?? '—'}</Text>
              <Text className="text-neutral-500">{item.report_date}{item.late ? ' • late' : ''} • NOB {item.nob} • ₹{item.total_sales}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
