import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useKpiConfig, useSaveKpiConfig } from '@/lib/hooks/useCategoryAdmin';

export default function KpiConfigScreen() {
  const { data, isPending } = useKpiConfig();
  const save = useSaveKpiConfig();
  const [cutoff, setCutoff] = useState('');

  useEffect(() => { if (data) setCutoff(data.daily_cutoff_time.slice(0, 5)); }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;

  return (
    <View className="flex-1 gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'KPI config' }} />
      <View className="gap-1">
        <Text className="text-sm text-neutral-500">Daily cutoff time (HH:MM, project TZ Asia/Kolkata)</Text>
        <TextInput value={cutoff} onChangeText={setCutoff} placeholder="22:00"
          className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
      </View>
      {save.error && <Text className="text-red-600">{(save.error as Error).message}</Text>}
      <Pressable disabled={save.isPending || !/^\d{2}:\d{2}$/.test(cutoff)} onPress={() => save.mutate(`${cutoff}:00`)}
        className="items-center rounded-xl bg-blue-600 px-6 py-4 disabled:opacity-50 active:bg-blue-700">
        {save.isPending ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Save</Text>}
      </Pressable>
    </View>
  );
}
