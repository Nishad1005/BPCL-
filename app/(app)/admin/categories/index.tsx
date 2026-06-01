import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAllCategories } from '@/lib/hooks/useCategoryAdmin';

export default function CategoriesList() {
  const { data, isPending, error } = useAllCategories();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Categories' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Link href={"/admin/categories/new" as any} className="mb-2 text-blue-600 dark:text-blue-400">+ New category</Link>}
        renderItem={({ item }) => (
          <Link href={`/admin/categories/${item.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name}</Text>
              <Text className="text-neutral-500">{item.active ? 'Active' : 'Inactive'}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
