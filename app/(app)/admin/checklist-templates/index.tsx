import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useAllTemplates } from '@/lib/hooks/useChecklistAdmin';

export default function TemplatesList() {
  const { data, isPending, error } = useAllTemplates();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Checklist templates' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerClassName="p-4 gap-2"
        ListHeaderComponent={<Link href={'/admin/checklist-templates/new' as any} className="mb-2 text-blue-600 dark:text-blue-400">+ New template</Link>}
        renderItem={({ item }) => (
          <Link href={`/admin/checklist-templates/${item.id}` as any} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name}</Text>
              <Text className="text-neutral-500">{item.frequency}{item.active ? '' : ' • inactive'}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
