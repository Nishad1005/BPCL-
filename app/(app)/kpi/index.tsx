import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useTodayKpi } from '@/lib/hooks/useKpi';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

function useRecentKpi(storeId: string | undefined) {
  return useQuery({
    queryKey: ['kpi', 'recent', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports').select('id, report_date, status, late, nob, total_sales, abv')
        .eq('store_id', storeId!).order('report_date', { ascending: false }).limit(14);
      if (error) throw error;
      return data;
    },
  });
}

export default function KpiIndex() {
  const { profile } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const today = useTodayKpi(storeId);
  const recent = useRecentKpi(storeId);

  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Daily KPI' }} />

      <View className="border-b border-neutral-200 p-4 dark:border-neutral-800">
        {today.isPending ? <ActivityIndicator /> : today.data ? (
          <Link href={`/kpi/${today.data.id}` as any}>
            <Text className="text-neutral-700 dark:text-neutral-300">
              Today: {today.data.status} • NOB {today.data.nob} • Sales ₹{today.data.total_sales} • ABV ₹{today.data.abv}
            </Text>
          </Link>
        ) : (
          <Link href={"/kpi/new" as any} className="text-blue-600 dark:text-blue-400">+ Submit today's KPI</Link>
        )}
      </View>

      <FlatList
        data={recent.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent</Text>}
        renderItem={({ item }) => (
          <Link href={`/kpi/${item.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="text-neutral-900 dark:text-white">{item.report_date} — {item.status}{item.late ? ' (late)' : ''}</Text>
              <Text className="text-neutral-500">NOB {item.nob} • ₹{item.total_sales} • ABV ₹{item.abv}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
