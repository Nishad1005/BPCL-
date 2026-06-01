import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useKpiReport, useReviewKpi } from '@/lib/hooks/useKpi';
import { signedUrlFor } from '@/lib/storage';

export default function KpiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { data, isPending, error } = useKpiReport(id);
  const review = useReviewKpi();
  const [comment, setComment] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!data?.attachments) return;
    (async () => {
      const urls = await Promise.all(data.attachments.map((a: { storage_path: string }) => signedUrlFor(a.storage_path)));
      setPhotoUrls(urls);
    })();
  }, [data]);

  if (isPending) return <ActivityIndicator className="mt-8" />;
  if (error) return <Text className="p-6 text-red-600">{(error as Error).message}</Text>;
  if (!data) return null;

  const canReview = ['nso', 'state_area_manager', 'super_admin'].includes(profile?.role ?? '') && data.status === 'submitted';

  const decide = (decision: 'approved' | 'rejected') =>
    review.mutate({ id: id!, decision, comment: decision === 'rejected' ? comment : undefined }, {
      onSuccess: () => router.back(),
    });

  return (
    <ScrollView contentContainerClassName="gap-3 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: `${(data as any).stores?.store_name ?? 'Store'} — ${data.report_date}` }} />
      <Row label="Status" value={`${data.status}${data.late ? ' (late)' : ''}`} />
      <Row label="NOB" value={data.nob} />
      <Row label="Walk-ins" value={data.walk_ins ?? '—'} />
      <Row label="Total Sales" value={`₹${data.total_sales}`} />
      <Row label="ABV" value={`₹${data.abv}`} />
      <Row label="Promotion sales" value={data.promotion_sales ?? '—'} />
      <Row label="Fuel→store %" value={data.fuel_conversion_pct ?? '—'} />
      <Row label="Support needed" value={data.support_needed ?? '—'} />

      {data.daily_kpi_stockout_items?.length > 0 && (
        <View className="gap-1">
          <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Stockouts</Text>
          {data.daily_kpi_stockout_items.map((s: any) => (
            <Text key={s.id} className="text-neutral-700 dark:text-neutral-300">
              • {s.sku || '(no SKU)'} {s.remarks ? `— ${s.remarks}` : ''}
            </Text>
          ))}
        </View>
      )}

      {photoUrls.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: 200, height: 200, borderRadius: 12 }} />)}

      {data.review_comment && <Row label="Review comment" value={data.review_comment} />}

      {canReview && (
        <View className="mt-4 gap-2">
          <TextInput placeholder="Comment (required for reject)" value={comment} onChangeText={setComment}
            className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white" />
          {review.error && <Text className="text-red-600">{(review.error as Error).message}</Text>}
          <View className="flex-row gap-2">
            <Pressable onPress={() => decide('approved')} disabled={review.isPending}
              className="flex-1 items-center rounded-xl bg-green-600 px-4 py-3 active:bg-green-700">
              <Text className="font-semibold text-white">Approve</Text>
            </Pressable>
            <Pressable onPress={() => decide('rejected')} disabled={review.isPending || !comment}
              className="flex-1 items-center rounded-xl bg-red-600 px-4 py-3 disabled:opacity-50 active:bg-red-700">
              <Text className="font-semibold text-white">Reject</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View className="flex-row justify-between border-b border-neutral-100 pb-1 dark:border-neutral-900">
      <Text className="text-neutral-500">{label}</Text>
      <Text className="text-neutral-900 dark:text-white">{String(value)}</Text>
    </View>
  );
}
