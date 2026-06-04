import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TemplateFormValues, ItemFormValues } from '@/lib/schemas/checklist';

export function useAllTemplates() {
  return useQuery({
    queryKey: ['checklist', 'all_templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('checklist_templates').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', 'template', id],
    enabled: !!id && id !== 'new',
    queryFn: async () => {
      const { data: tpl, error } = await supabase.from('checklist_templates').select('*').eq('id', id!).single();
      if (error) throw error;
      const { data: items } = await supabase.from('checklist_items')
        .select('*').eq('template_id', id!).order('sort');
      return { ...tpl, items: items ?? [] };
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TemplateFormValues }) => {
      if (id && id !== 'new') {
        const { error } = await supabase.from('checklist_templates').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from('checklist_templates').insert(values).select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}

export function useSaveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, templateId, values }: { id?: string; templateId: string; values: ItemFormValues }) => {
      const payload = { ...values, template_id: templateId, section: values.section || null };
      if (id) {
        const { error } = await supabase.from('checklist_items').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('checklist_items').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });
}
