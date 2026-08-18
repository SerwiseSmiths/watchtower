import { prisma } from '@/lib/db/prisma';
import MediaLibraryView from './MediaLibraryView';

export default async function MediaLibraryPage() {
  const files = await prisma.files.findMany({ orderBy: { created_at: 'desc' }, take: 100 });

  return (
    <MediaLibraryView
      files={files.map((f) => ({
        id: f.id,
        url: f.url,
        name: f.name,
        mime: f.mime,
        ext: f.ext,
        alternativeText: f.alternative_text,
      }))}
    />
  );
}
