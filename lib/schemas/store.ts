import { z } from 'zod';
export const storeSchema = z.object({
  store_name: z.string().min(1, 'Required'),
  dealer_name: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  region_id: z.string().uuid().nullable().optional(),
  active: z.boolean(),
});
export type StoreFormValues = z.infer<typeof storeSchema>;
