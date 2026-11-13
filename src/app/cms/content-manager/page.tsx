import { redirect } from 'next/navigation';
import { ensureSchemaRegistry, slugForContentType } from '@/lib/content-schema/registry';
import { cmsContentTypes } from '../content-types';

export default async function ContentManagerIndexPage() {
  await ensureSchemaRegistry();
  redirect(`/cms/content-manager/${slugForContentType(cmsContentTypes()[0])}`);
}
