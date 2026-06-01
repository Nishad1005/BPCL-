import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadAttachmentObject } from '@/lib/storage';
import type { KpiFormValues } from '@/lib/schemas/kpi';

const today = () => new Date().toISOString().slice(0, 10);

export function useTodayKpi(storeId: string | undefined) {
  return useQuery({
    queryKey: ['kpi', 'today', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports').select('*')
        .eq('store_id', storeId!).eq('report_date', today()).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useKpiReport(id: string | undefined) {
  return useQuery({
    queryKey: ['kpi', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: report, error } = await supabase
        .from('daily_kpi_reports')
        .select('*, daily_kpi_stockout_items(*), stores(store_name)')
        .eq('id', id!).single();
      if (error) throw error;
      const { data: atts } = await supabase
        .from('attachments').select('*')
        .eq('entity_type', 'daily_kpi_report').eq('entity_id', id!);
      return { ...report, attachments: atts ?? [] };
    },
  });
}

export function usePendingKpi() {
  return useQuery({
    queryKey: ['kpi', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_kpi_reports')
        .select('id, report_date, status, store_id, late, nob, total_sales, abv, stores(store_name)')
        .eq('status', 'submitted')
        .order('report_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMissingTodayStores() {
  return useQuery({
    queryKey: ['kpi', 'missing-today'],
    queryFn: async () => {
      const [{ data: stores, error: sErr }, { data: reports, error: rErr }] = await Promise.all([
        supabase.from('stores').select('id, store_name').eq('active', true),
        supabase.from('daily_kpi_reports').select('store_id').eq('report_date', today()),
      ]);
      if (sErr) throw sErr;
      if (rErr) throw rErr;
      const done = new Set((reports ?? []).map((r) => r.store_id));
      return (stores ?? []).filter((s) => !done.has(s.id));
    },
  });
}

export function useSubmitKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { values: KpiFormValues; photo?: { blob: Blob; ext: string } | null }) => {
      const { values, photo } = args;

      const [{ data: udcAsg }, { data: nsoAsg }, { data: me }] = await Promise.all([
        supabase.from('user_store_assignments').select('user_id')
          .eq('store_id', values.store_id).eq('assignment_type', 'udc').limit(1).maybeSingle(),
        supabase.from('user_store_assignments').select('user_id')
          .eq('store_id', values.store_id).eq('assignment_type', 'nso').limit(1).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (!me.user) throw new Error('Not signed in');

      const { stockouts, ...kpi } = values;

      const insertPayload = {
        store_id: kpi.store_id,
        report_date: today(),
        nob: kpi.nob,
        walk_ins: kpi.walk_ins ?? null,
        total_sales: kpi.total_sales,
        promotion_sales: kpi.promotion_sales ?? null,
        fuel_conversion_pct: kpi.fuel_conversion_pct ?? null,
        top_category_id: kpi.top_category_id || null,
        top_category_remarks: kpi.top_category_remarks || null,
        slow_category_id: kpi.slow_category_id || null,
        slow_category_remarks: kpi.slow_category_remarks || null,
        support_needed: kpi.support_needed || null,
        udc_id: udcAsg?.user_id ?? null,
        nso_id: nsoAsg?.user_id ?? null,
        submitted_by: me.user.id,
      };

      const { data: row, error } = await supabase.from('daily_kpi_reports')
        .insert(insertPayload).select().single();
      if (error) {
        if (error.code === '23505') throw new Error('Already submitted today for this store');
        throw error;
      }

      const cleanStockouts = stockouts
        .filter((s) => s.sku || s.category_id || s.remarks)
        .map((s) => ({
          kpi_report_id: row.id,
          sku: s.sku || null,
          category_id: s.category_id || null,
          remarks: s.remarks || null,
        }));
      if (cleanStockouts.length > 0) {
        const { error: sErr } = await supabase.from('daily_kpi_stockout_items').insert(cleanStockouts);
        if (sErr) throw sErr;
      }

      if (photo) {
        const path = await uploadAttachmentObject({
          entityType: 'daily_kpi_report', entityId: row.id, file: photo.blob, ext: photo.ext,
        });
        const { error: aErr } = await supabase.from('attachments').insert({
          entity_type: 'daily_kpi_report', entity_id: row.id, storage_path: path, uploaded_by: me.user.id,
        });
        if (aErr) throw aErr;
      }

      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi'] }),
  });
}

export function useReviewKpi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; decision: 'approved' | 'rejected'; comment?: string }) => {
      const { data: me } = await supabase.auth.getUser();
      const { error } = await supabase.from('daily_kpi_reports').update({
        status: args.decision,
        reviewed_by: me.user!.id,
        reviewed_at: new Date().toISOString(),
        review_comment: args.comment ?? null,
      }).eq('id', args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kpi'] }),
  });
}
