import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { kpiFormSchema, type KpiFormValues } from '@/lib/schemas/kpi';
import { useCategories } from '@/lib/hooks/useCategories';
import { useSubmitKpi } from '@/lib/hooks/useKpi';

export default function NewKpiScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const submit = useSubmitKpi();
  const { data: cats } = useCategories();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const defaultStore = profile?.primary_store_id ?? '';
  const { control, handleSubmit, watch, formState: { errors } } = useForm<KpiFormValues>({
    resolver: zodResolver(kpiFormSchema) as any,
    defaultValues: {
      store_id: defaultStore,
      nob: 0, walk_ins: undefined, total_sales: 0,
      promotion_sales: undefined, fuel_conversion_pct: undefined,
      top_category_id: null, top_category_remarks: '',
      slow_category_id: null, slow_category_remarks: '',
      support_needed: '',
      stockouts: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'stockouts' });

  const nob = watch('nob');
  const sales = watch('total_sales');
  const liveAbv = useMemo(() => (Number(nob) > 0 ? (Number(sales) / Number(nob)).toFixed(2) : '—'), [nob, sales]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled) return;
    const asset = res.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    setPhotoUri(asset.uri);
    setPhotoBlob(blob);
  };

  const onSubmit = (values: KpiFormValues) => {
    const photo = photoBlob ? { blob: photoBlob, ext: 'jpg' } : null;
    submit.mutate({ values, photo }, { onSuccess: (row) => router.replace(`/kpi/${row.id}` as any) });
  };

  return (
    <ScrollView contentContainerClassName="gap-4 bg-white p-6 dark:bg-neutral-950">
      <Stack.Screen options={{ title: "Today's KPI" }} />

      <Field control={control} name="nob" label="NOB (Number of Bills)" keyboardType="numeric" error={errors.nob?.message} />
      <Field control={control} name="walk_ins" label="Walk-ins (estimate ok)" keyboardType="numeric" />
      <Field control={control} name="total_sales" label="Total Sales (₹)" keyboardType="decimal-pad" error={errors.total_sales?.message} />

      <View className="rounded-xl bg-neutral-100 px-4 py-3 dark:bg-neutral-900">
        <Text className="text-sm text-neutral-500">ABV (auto)</Text>
        <Text className="text-xl font-semibold text-neutral-900 dark:text-white">₹ {liveAbv}</Text>
      </View>

      <Field control={control} name="promotion_sales" label="Promotion Sales (₹, optional)" keyboardType="decimal-pad" />
      <Field control={control} name="fuel_conversion_pct" label="Fuel → store conversion % (optional)" keyboardType="decimal-pad" />

      <CategoryPicker control={control} name="top_category_id" label="Top selling category" cats={cats ?? []} />
      <Field control={control} name="top_category_remarks" label="Top category remarks" />
      <CategoryPicker control={control} name="slow_category_id" label="Slow moving category" cats={cats ?? []} />
      <Field control={control} name="slow_category_remarks" label="Slow category remarks" />

      <Text className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">Stockouts</Text>
      {fields.map((f, i) => (
        <View key={f.id} className="gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <Field control={control} name={`stockouts.${i}.sku`} label="SKU" />
          <CategoryPicker control={control} name={`stockouts.${i}.category_id`} label="Category" cats={cats ?? []} />
          <Field control={control} name={`stockouts.${i}.remarks`} label="Remarks" />
          <Pressable onPress={() => remove(i)} className="self-end"><Text className="text-red-600">Remove</Text></Pressable>
        </View>
      ))}
      <Pressable onPress={() => append({ sku: '', category_id: null, remarks: '' })}
        className="items-center rounded-xl border border-dashed border-neutral-400 p-3">
        <Text className="text-neutral-700 dark:text-neutral-300">+ Add stockout item</Text>
      </Pressable>

      <Field control={control} name="support_needed" label="Support needed" multiline />

      <Text className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">Photo (optional)</Text>
      {photoUri && <Image source={{ uri: photoUri }} style={{ width: 120, height: 120, borderRadius: 12 }} />}
      <Pressable onPress={pickPhoto} className="items-center rounded-xl border border-neutral-300 p-3 dark:border-neutral-700">
        <Text className="text-neutral-700 dark:text-neutral-300">{photoUri ? 'Replace photo' : 'Add photo'}</Text>
      </Pressable>

      {submit.error && <Text className="text-red-600">{(submit.error as Error).message}</Text>}
      <Pressable disabled={submit.isPending} onPress={handleSubmit(onSubmit)}
        className="mt-2 items-center rounded-xl bg-blue-600 px-6 py-4 active:bg-blue-700">
        {submit.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Submit KPI</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Field({ control, name, label, keyboardType, error, multiline }: {
  control: any; name: string; label: string;
  keyboardType?: 'numeric' | 'decimal-pad' | 'default';
  error?: string; multiline?: boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <TextInput
          className="rounded-xl border border-neutral-300 px-4 py-3 text-neutral-900 dark:border-neutral-700 dark:text-white"
          value={field.value == null ? '' : String(field.value)}
          onChangeText={field.onChange}
          keyboardType={keyboardType}
          multiline={multiline}
        />
      )} />
      {error && <Text className="text-red-600">{error}</Text>}
    </View>
  );
}

function CategoryPicker({ control, name, label, cats }: {
  control: any; name: string; label: string; cats: { id: string; name: string }[];
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-500">{label}</Text>
      <Controller control={control} name={name} render={({ field }) => (
        <View className="flex-row flex-wrap gap-2">
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => field.onChange(field.value === c.id ? null : c.id)}
              className={`rounded-full border px-3 py-1 ${field.value === c.id ? 'border-blue-600 bg-blue-600' : 'border-neutral-300 dark:border-neutral-700'}`}>
              <Text className={field.value === c.id ? 'text-white' : 'text-neutral-700 dark:text-neutral-300'}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      )} />
    </View>
  );
}
