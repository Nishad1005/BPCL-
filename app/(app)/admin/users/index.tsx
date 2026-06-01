import { Link, Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useUsers } from '@/lib/hooks/useUsers';

export default function UsersList() {
  const { data, isPending, error } = useUsers();
  return (
    <View className="flex-1 bg-white dark:bg-neutral-950">
      <Stack.Screen options={{ title: 'Users' }} />
      {isPending && <ActivityIndicator className="mt-8" />}
      {error && <Text className="p-6 text-red-600">{(error as Error).message}</Text>}
      <FlatList
        data={data ?? []}
        keyExtractor={(u) => u.id}
        contentContainerClassName="p-4 gap-2"
        renderItem={({ item }) => (
          <Link href={`/admin/users/${item.id}`} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <View>
              <Text className="font-semibold text-neutral-900 dark:text-white">{item.name || '(no name)'}</Text>
              <Text className="text-neutral-500">{item.role}</Text>
            </View>
          </Link>
        )}
      />
    </View>
  );
}
