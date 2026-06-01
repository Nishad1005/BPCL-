export type Module = 'daily_kpi' | 'nso_visit' | 'promotion_vm' | 'resolution' | 'lms' | 'coaching';
export type Verb = 'view' | 'create' | 'edit' | 'approve' | 'export';
export type AppRole =
  | 'super_admin' | 'management' | 'state_area_manager' | 'nso'
  | 'udc' | 'dealer' | 'marketing_vm' | 'training_admin' | 'consultant';

export type PermissionRow = {
  module: Module;
  can_view: boolean; can_create: boolean; can_edit: boolean; can_approve: boolean; can_export: boolean;
};

const VERB_COLUMN: Record<Verb, keyof PermissionRow> = {
  view: 'can_view', create: 'can_create', edit: 'can_edit', approve: 'can_approve', export: 'can_export',
};

export function can(perms: PermissionRow[], module: Module, verb: Verb): boolean {
  const row = perms.find((p) => p.module === module);
  return row ? Boolean(row[VERB_COLUMN[verb]]) : false;
}
