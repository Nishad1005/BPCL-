import { z } from 'zod';

const optionalText = z.string().optional().or(z.literal(''));

export const stockoutItemSchema = z.object({
  sku: optionalText,
  category_id: z.string().uuid().nullable().optional(),
  remarks: optionalText,
});

export const kpiFormSchema = z.object({
  store_id: z.string().uuid(),
  nob: z.coerce.number().int().nonnegative(),
  walk_ins: z.coerce.number().int().nonnegative().optional(),
  total_sales: z.coerce.number().nonnegative(),
  promotion_sales: z.coerce.number().nonnegative().optional(),
  fuel_conversion_pct: z.coerce.number().min(0).max(100).optional(),
  top_category_id: z.string().uuid().nullable().optional(),
  top_category_remarks: optionalText,
  slow_category_id: z.string().uuid().nullable().optional(),
  slow_category_remarks: optionalText,
  support_needed: optionalText,
  stockouts: z.array(stockoutItemSchema),
});

export type KpiFormValues = z.infer<typeof kpiFormSchema>;
export type StockoutItem = z.infer<typeof stockoutItemSchema>;
