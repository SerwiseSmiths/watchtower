import { redirect } from 'next/navigation';
import { allContentTypes } from '@/lib/content-schema/registry';

export default function ContentManagerIndexPage() {
  const first = allContentTypes()[0];
  const slug = first.kind === 'collectionType' ? first.pluralName : first.singularName;
  redirect(`/admin/content-manager/${slug}`);
}
