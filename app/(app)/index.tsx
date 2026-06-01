import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// WP0 acceptance check: read one row from Supabase.
// Expects a table `health_check` with at least one row (see WP0 setup steps).
function useHealthCheck() {
  return useQuery({
    queryKey: ['health_check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_check')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });
}

export default function HomeScreen() {
  const { signOut } = useAuth();
  const { data, error, isPending, isError } = useHealthCheck();

  return (
    <ScrollView contentContainerClassName="flex-grow gap-6 bg-white px-6 py-16 dark:bg-neutral-950">
      <View className="gap-1">
        <Text className="text-2xl font-bold text-neutral-900 dark:text-white">Dashboard</Text>
        <Text className="text-base text-neutral-500 dark:text-neutral-400">
          WP0 foundation shell. Module screens land in WP1+.
        </Text>
      </View>

      <View className="gap-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Supabase test read
        </Text>

        {isPending && (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator />
            <Text className="text-neutral-600 dark:text-neutral-300">Reading health_check…</Text>
          </View>
        )}

        {isError && (
          <Text className="text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Read failed.'}
          </Text>
        )}

        {!isPending && !isError && (
          <Text className="text-green-700 dark:text-green-400">
            OK — read row: {JSON.stringify(data)}
          </Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        className="items-center rounded-xl border border-neutral-300 px-6 py-4 active:bg-neutral-100 dark:border-neutral-700 dark:active:bg-neutral-900">
        <Text className="text-base font-semibold text-neutral-900 dark:text-white">Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}
