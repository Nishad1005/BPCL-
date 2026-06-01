import { supabase } from '@/lib/supabase';

type EntityType = 'daily_kpi_report' | 'checklist_submission' | 'nso_visit' | 'promotion_compliance';

function uuid(): string {
  return (globalThis.crypto as Crypto).randomUUID();
}

export async function uploadAttachmentObject(opts: {
  entityType: EntityType;
  entityId: string;
  file: Blob;
  ext: string;
}): Promise<string> {
  const path = `${opts.entityType}/${opts.entityId}/${uuid()}.${opts.ext}`;
  const { error } = await supabase.storage.from('attachments').upload(path, opts.file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrlFor(path: string, expiresIn = 300): Promise<string> {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
