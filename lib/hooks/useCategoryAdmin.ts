import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CategoryFormValues } from '@/lib/schemas/category';

export function useAllCategories() {
  return useQuery({
    queryKey: ['product_categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCategory(id: string | undefined) {
  return useQuery({
    queryKey: ['product_categories', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data, error } = await supabase.from('product_categories').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: CategoryFormValues }) => {
      if (id && id !== 'new') {
        const { error } = await supabase.from('product_categories').update(values).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_categories').insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product_categories'] }),
  });
}

export function useKpiConfig() {
  return useQuery({
    queryKey: ['kpi_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('kpi_config').select('*').eq('id', 1).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveKpiConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cutoff: string) => {
      const { error } = await supabase.from('kpi_config')
        .update({ daily_cutoff_time: cutoff, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi_config'] }),
  });
}
