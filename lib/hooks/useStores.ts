import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { StoreFormValues } from '@/lib/schemas/store';

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('*').order('store_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useStore(id: string | undefined) {
  return useQuery({
    queryKey: ['stores', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('stores').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('regions').select('id, name, type').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: StoreFormValues }) => {
      const payload = { ...values, dealer_name: values.dealer_name || null };
      if (id && id !== 'new') {
        const { error } = await supabase.from('stores').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stores').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}
