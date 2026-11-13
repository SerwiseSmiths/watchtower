import { prisma } from '@/lib/db/prisma';
import MediaLibraryView from './MediaLibraryView';

const PAGE_SIZE = 24;

const TYPE_FILTERS: Record<string, string> = {
  image: 'image/',
  video: 'video/',
  audio: 'audio/',
};

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; folder?: string; type?: string }>;
}) {
  const { page: pageParam, q, folder, type } = await searchParams;
  const page = pageParam ? Number.parseInt(pageParam, 10) || 1 : 1;
  const folderId = folder ? Number.parseInt(folder, 10) : null;

  const where: Record<string, unknown> = {};
  if (q?.trim()) where.name = { contains: q.trim(), mode: 'insensitive' };
  if (type && TYPE_FILTERS[type]) where.mime = { startsWith: TYPE_FILTERS[type] };
  if (folderId != null) {
    const links = await prisma.files_folder_lnk.findMany({ where: { folder_id: folderId } });
    where.id = { in: links.map((l) => l.file_id).filter((id): id is number => id != null) };
  }

  const [files, total, folders] = await Promise.all([
    prisma.files.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.files.count({ where }),
    prisma.upload_folders.findMany({ orderBy: { name: 'asc' } }),
  ]);

  return (
    <MediaLibraryView
      files={files.map((f) => ({
        id: f.id,
        url: f.url,
        name: f.name,
        mime: f.mime,
        ext: f.ext,
        size: f.size != null ? Number(f.size) : null,
        width: f.width,
        height: f.height,
        alternativeText: f.alternative_text,
        caption: f.caption,
      }))}
      folders={folders.map((f) => ({ id: f.id, name: f.name ?? 'Untitled' }))}
      pagination={{ page, pageSize: PAGE_SIZE, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), total }}
      query={q ?? ''}
      activeFolderId={folderId}
      activeType={type ?? ''}
    />
  );
}
