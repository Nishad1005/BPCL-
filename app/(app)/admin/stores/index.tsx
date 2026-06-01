import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useStores } from '@/lib/hooks/useStores';

export default function StoresList() {
  const { data, isPending, error } = useStores();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Stores' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Link href="/admin/stores/new" className="mb-2 text-blue-600 dark:text-blue-400">+ New store</Link>}
        renderItem={({ item }) => (
          <Link href={`/admin/stores/${item.id}`} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.store_name}</Text>
              <Text className="text-neutral-500">{[item.city, item.state].filter(Boolean).join(', ')}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
