import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useMissingTodayStores, useTodayKpi } from '@/lib/hooks/useKpi';

export default function HomeScreen() {
  const { profile, signOut, isAdmin } = useAuth();
  const storeId = profile?.primary_store_id ?? undefined;
  const today = useTodayKpi(storeId);
  const isReviewer = ['nso', 'state_area_manager'].includes(profile?.role ?? '');
  const missing = useMissingTodayStores();

  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 bg-white px-6 py-16 dark:bg-neutral-950">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">
          Welcome{profile?.name ? `, ${profile.name}` : ''}
        </Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">Role: {profile?.role ?? '—'}</Text>
      </View>

      {storeId && !today.isPending && !today.data && (
        <Link href={'/kpi/new' as any} className="rounded-xl border border-amber-400 bg-amber-50 p-4 dark:bg-amber-950">
          <Text className="font-semibold text-amber-900 dark:text-amber-200">You haven&apos;t submitted today&apos;s KPI</Text>
          <Text className="text-amber-800 dark:text-amber-300">Tap to submit now</Text>
        </Link>
      )}

      <Link href={'/kpi' as any} className="text-blue-600 dark:text-blue-400">Open Daily KPI</Link>
      <Link href={'/checklist' as any} className="text-blue-600 dark:text-blue-400">Open Checklists</Link>

      {isReviewer && (
        <View className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Reviews</Text>
          <Link href={'/kpi/pending' as any} className="text-blue-600 dark:text-blue-400">Pending KPI reviews</Link>
          {missing.isPending ? <ActivityIndicator /> : (
            <Text className="text-neutral-600 dark:text-neutral-300">
              Stores missing today&apos;s report: {missing.data?.length ?? 0}
            </Text>
          )}
        </View>
      )}

      {isAdmin && (
        <View className="gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Admin</Text>
          <Link href={'/admin/stores' as any} className="text-blue-600 dark:text-blue-400">Manage stores</Link>
          <Link href={'/admin/users' as any} className="text-blue-600 dark:text-blue-400">Manage users</Link>
          <Link href={'/admin/categories' as any} className="text-blue-600 dark:text-blue-400">Product categories</Link>
          <Link href={'/admin/kpi-config' as any} className="text-blue-600 dark:text-blue-400">KPI config</Link>
          <Link href={'/admin/checklist-templates' as any} className="text-blue-600 dark:text-blue-400">Checklist templates</Link>
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={signOut}
        className="items-center rounded-xl border border-neutral-300 px-6 py-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
