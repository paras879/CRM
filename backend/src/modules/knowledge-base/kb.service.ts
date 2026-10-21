import crypto from 'node:crypto';
import { prisma, isDatabaseConnected } from '../../config/database.js';
import { devStore, DevKBCategory, DevKBTag, DevKBArticle } from '../../config/dev-store.js';
import { ArticleStatus } from '@prisma/client';
import {
  CreateKBCategoryInput,
  CreateKBTagInput,
  CreateKBArticleInput,
  UpdateKBArticleInput,
  ListKBArticlesQuery,
} from './kb.schema.js';
import { AppError } from '../../utils/app-error.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { sanitizeText } from '../tickets/tickets.service.js';

async function logAudit(companyId: string, actorId: string, action: string, entityType: string, entityId: string, metadata?: any) {
  return await recordAuditLog({ companyId, actorId, action, entityType, entityId, metadata });
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

async function ensureUniqueArticleSlug(
  companyId: string,
  baseSlug: string,
  excludeArticleId?: string
): Promise<string> {
  let candidate = baseSlug || 'article';
  let counter = 1;

  while (true) {
    if (!isDatabaseConnected) {
      const match = devStore.kbArticles.find(
        (a) => a.companyId === companyId && a.slug === candidate && a.id !== excludeArticleId
      );
      if (!match) return candidate;
    } else {
      const match = await prisma.knowledgeBaseArticle.findFirst({
        where: {
          companyId,
          slug: candidate,
          id: excludeArticleId ? { not: excludeArticleId } : undefined,
        },
      });
      if (!match) return candidate;
    }
    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
}

// Category Services
export async function listCategories(companyId: string): Promise<DevKBCategory[]> {
  if (!isDatabaseConnected) {
    return devStore.kbCategories.filter((c) => c.companyId === companyId).sort((a, b) => a.order - b.order);
  }
  return (await prisma.knowledgeBaseCategory.findMany({
    where: { companyId },
    orderBy: { order: 'asc' },
  })) as unknown as DevKBCategory[];
}

export async function createCategory(
  companyId: string,
  input: CreateKBCategoryInput
): Promise<DevKBCategory> {
  const baseSlug = slugify(input.name);
  const slug = baseSlug || 'category';

  if (!isDatabaseConnected) {
    const existing = devStore.kbCategories.find(
      (c) => c.companyId === companyId && (c.slug === slug || c.name.toLowerCase() === input.name.toLowerCase())
    );
    if (existing) {
      throw new AppError(409, 'DUPLICATE_CATEGORY', `Category '${input.name}' or slug '${slug}' already exists.`);
    }

    const newCategory: DevKBCategory = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      order: input.order ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    devStore.kbCategories.push(newCategory);
    return newCategory;
  }

  const existing = await prisma.knowledgeBaseCategory.findFirst({
    where: { companyId, OR: [{ slug }, { name: { equals: input.name, mode: 'insensitive' } }] },
  });
  if (existing) {
    throw new AppError(409, 'DUPLICATE_CATEGORY', `Category '${input.name}' or slug '${slug}' already exists.`);
  }

  return (await prisma.knowledgeBaseCategory.create({
    data: {
      companyId,
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      order: input.order ?? 0,
    },
  })) as unknown as DevKBCategory;
}

// Tag Services
export async function listTags(companyId: string): Promise<DevKBTag[]> {
  if (!isDatabaseConnected) {
    return devStore.kbTags.filter((t) => t.companyId === companyId);
  }
  return (await prisma.knowledgeBaseTag.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  })) as unknown as DevKBTag[];
}

export async function createTag(companyId: string, input: CreateKBTagInput): Promise<DevKBTag> {
  const slug = slugify(input.name);

  if (!isDatabaseConnected) {
    const existing = devStore.kbTags.find(
      (t) => t.companyId === companyId && (t.slug === slug || t.name.toLowerCase() === input.name.toLowerCase())
    );
    if (existing) return existing;

    const newTag: DevKBTag = {
      id: crypto.randomUUID(),
      companyId,
      name: input.name.trim(),
      slug,
      createdAt: new Date(),
    };
    devStore.kbTags.push(newTag);
    return newTag;
  }

  const existing = await prisma.knowledgeBaseTag.findFirst({
    where: { companyId, OR: [{ slug }, { name: { equals: input.name, mode: 'insensitive' } }] },
  });
  if (existing) return existing as unknown as DevKBTag;

  return (await prisma.knowledgeBaseTag.create({
    data: {
      companyId,
      name: input.name.trim(),
      slug,
    },
  })) as unknown as DevKBTag;
}

// Article Services
export async function createArticle(
  companyId: string,
  authorId: string,
  input: CreateKBArticleInput
) {
  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
  const finalSlug = await ensureUniqueArticleSlug(companyId, baseSlug);

  const cleanBody = sanitizeText(input.body);
  const cleanSummary = input.summary ? sanitizeText(input.summary) : null;
  const now = new Date();
  const publishedAt = input.status === ArticleStatus.PUBLISHED ? now : null;

  if (!isDatabaseConnected) {
    const newArticle: DevKBArticle = {
      id: crypto.randomUUID(),
      companyId,
      categoryId: input.categoryId ?? null,
      authorId,
      title: input.title.trim(),
      slug: finalSlug,
      summary: cleanSummary,
      body: cleanBody,
      status: input.status ?? ArticleStatus.DRAFT,
      views: 0,
      publishedAt,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      tagIds: input.tagIds ?? [],
    };
    devStore.kbArticles.unshift(newArticle);

    await logAudit(companyId, authorId, 'kb_article.created', 'KnowledgeBaseArticle', newArticle.id, {
      title: newArticle.title,
      slug: newArticle.slug,
      status: newArticle.status,
    });

    return populateArticle(newArticle);
  }

  const created = await prisma.knowledgeBaseArticle.create({
    data: {
      companyId,
      categoryId: input.categoryId ?? null,
      authorId,
      title: input.title.trim(),
      slug: finalSlug,
      summary: cleanSummary,
      body: cleanBody,
      status: input.status ?? ArticleStatus.DRAFT,
      publishedAt,
      tags: {
        create: (input.tagIds ?? []).map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      },
    },
    include: {
      category: true,
      author: { select: { id: true, name: true, email: true } },
      tags: { include: { tag: true } },
    },
  });

  await logAudit(companyId, authorId, 'kb_article.created', 'KnowledgeBaseArticle', created.id, {
    title: created.title,
    slug: created.slug,
    status: created.status,
  });

  return created;
}

export async function listArticles(
  companyId: string,
  query: ListKBArticlesQuery,
  isStaff = true
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  if (!isDatabaseConnected) {
    let items = devStore.kbArticles.filter((a) => a.companyId === companyId);

    // Non-staff can only see published and non-archived articles
    if (!isStaff) {
      items = items.filter((a) => a.status === ArticleStatus.PUBLISHED && !a.isArchived);
    } else {
      if (query.isArchived !== undefined) {
        items = items.filter((a) => a.isArchived === query.isArchived);
      }
      if (query.status) {
        items = items.filter((a) => a.status === query.status);
      }
    }

    if (query.categoryId) {
      items = items.filter((a) => a.categoryId === query.categoryId);
    }
    if (query.tagId) {
      items = items.filter((a) => a.tagIds.includes(query.tagId!));
    }
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter((a) => {
        const titleMatch = a.title.toLowerCase().includes(q);
        const summaryMatch = a.summary?.toLowerCase().includes(q) ?? false;
        const bodyMatch = a.body.toLowerCase().includes(q);
        const tagMatch = a.tagIds.some((tid) => {
          const t = devStore.kbTags.find((tag) => tag.id === tid);
          return t?.name.toLowerCase().includes(q);
        });
        return titleMatch || summaryMatch || bodyMatch || tagMatch;
      });
    }

    const total = items.length;

    items.sort((a, b) => {
      const field = query.sortBy ?? 'createdAt';
      const aVal = a[field as keyof DevKBArticle];
      const bVal = b[field as keyof DevKBArticle];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return query.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return query.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const paged = items.slice(skip, skip + limit).map(populateArticle);

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const where: any = { companyId };

  if (!isStaff) {
    where.status = ArticleStatus.PUBLISHED;
    where.isArchived = false;
  } else {
    if (query.isArchived !== undefined) where.isArchived = query.isArchived;
    if (query.status) where.status = query.status;
  }

  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.tagId) {
    where.tags = { some: { tagId: query.tagId } };
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { summary: { contains: query.search, mode: 'insensitive' } },
      { body: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.knowledgeBaseArticle.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
      include: {
        category: true,
        author: { select: { id: true, name: true, email: true } },
        tags: { include: { tag: true } },
      },
    }),
    prisma.knowledgeBaseArticle.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getArticleBySlugOrId(
  companyId: string,
  slugOrId: string,
  isStaff = true
) {
  if (!isDatabaseConnected) {
    const article = devStore.kbArticles.find(
      (a) => a.companyId === companyId && (a.id === slugOrId || a.slug === slugOrId)
    );
    if (!article) {
      throw new AppError(404, 'ARTICLE_NOT_FOUND', 'Article not found.');
    }

    if (!isStaff && (article.status !== ArticleStatus.PUBLISHED || article.isArchived)) {
      throw new AppError(404, 'ARTICLE_NOT_FOUND', 'Article not found.');
    }

    // Increment view count
    article.views += 1;

    // Related articles in same category
    const related = devStore.kbArticles
      .filter((a) => a.companyId === companyId && a.id !== article.id && a.categoryId === article.categoryId && a.status === ArticleStatus.PUBLISHED)
      .slice(0, 3)
      .map(populateArticle);

    return {
      ...populateArticle(article),
      relatedArticles: related,
    };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);

  const article = await prisma.knowledgeBaseArticle.findFirst({
    where: {
      companyId,
      ...(isUuid ? { OR: [{ id: slugOrId }, { slug: slugOrId }] } : { slug: slugOrId }),
      ...(!isStaff ? { status: ArticleStatus.PUBLISHED, isArchived: false } : {}),
    },
    include: {
      category: true,
      author: { select: { id: true, name: true, email: true } },
      tags: { include: { tag: true } },
    },
  });

  if (!article) {
    throw new AppError(404, 'ARTICLE_NOT_FOUND', 'Article not found.');
  }

  // Increment view count
  await prisma.knowledgeBaseArticle.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
  });

  const related = await prisma.knowledgeBaseArticle.findMany({
    where: {
      companyId,
      id: { not: article.id },
      categoryId: article.categoryId,
      status: ArticleStatus.PUBLISHED,
      isArchived: false,
    },
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      publishedAt: true,
    },
  });

  return {
    ...article,
    views: article.views + 1,
    relatedArticles: related,
  };
}

export async function updateArticle(
  companyId: string,
  articleId: string,
  userId: string,
  input: UpdateKBArticleInput
) {
  const existing = await getArticleBySlugOrId(companyId, articleId, true);
  const now = new Date();

  let finalSlug = existing.slug;
  if (input.slug && input.slug !== existing.slug) {
    finalSlug = await ensureUniqueArticleSlug(companyId, slugify(input.slug), existing.id);
  }

  let publishedAt = existing.publishedAt;
  if (input.status === ArticleStatus.PUBLISHED && existing.status !== ArticleStatus.PUBLISHED) {
    publishedAt = now;
  } else if (input.status && input.status !== ArticleStatus.PUBLISHED) {
    publishedAt = null;
  }

  const cleanBody = input.body ? sanitizeText(input.body) : undefined;
  const cleanSummary = input.summary !== undefined ? (input.summary ? sanitizeText(input.summary) : null) : undefined;

  if (!isDatabaseConnected) {
    const idx = devStore.kbArticles.findIndex((a) => a.id === existing.id && a.companyId === companyId);
    if (idx === -1) throw new AppError(404, 'ARTICLE_NOT_FOUND', 'Article not found.');

    const current = devStore.kbArticles[idx];
    const updated: DevKBArticle = {
      ...current,
      title: input.title ? input.title.trim() : current.title,
      slug: finalSlug,
      categoryId: input.categoryId !== undefined ? input.categoryId : current.categoryId,
      summary: cleanSummary !== undefined ? cleanSummary : current.summary,
      body: cleanBody !== undefined ? cleanBody : current.body,
      status: input.status ?? current.status,
      publishedAt,
      isArchived: input.isArchived !== undefined ? input.isArchived : current.isArchived,
      tagIds: input.tagIds ?? current.tagIds,
      updatedAt: now,
    };
    devStore.kbArticles[idx] = updated;

    await logAudit(companyId, userId, 'kb_article.updated', 'KnowledgeBaseArticle', existing.id, {
      title: updated.title,
      slug: updated.slug,
      status: updated.status,
    });

    return populateArticle(updated);
  }

  // Update Prisma model
  const updated = await prisma.knowledgeBaseArticle.update({
    where: { id: existing.id },
    data: {
      title: input.title ? input.title.trim() : undefined,
      slug: finalSlug,
      categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
      summary: cleanSummary,
      body: cleanBody,
      status: input.status,
      publishedAt,
      isArchived: input.isArchived,
      tags: input.tagIds
        ? {
            deleteMany: {},
            create: input.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
          }
        : undefined,
    },
    include: {
      category: true,
      author: { select: { id: true, name: true, email: true } },
      tags: { include: { tag: true } },
    },
  });

  await logAudit(companyId, userId, 'kb_article.updated', 'KnowledgeBaseArticle', existing.id, {
    title: updated.title,
    slug: updated.slug,
    status: updated.status,
  });

  return updated;
}

export async function deleteArticle(companyId: string, articleId: string, userId: string) {
  const existing = await getArticleBySlugOrId(companyId, articleId, true);

  if (!isDatabaseConnected) {
    const article = devStore.kbArticles.find((a) => a.id === existing.id);
    if (article) {
      article.isArchived = true;
      article.updatedAt = new Date();
    }
    await logAudit(companyId, userId, 'kb_article.archived', 'KnowledgeBaseArticle', existing.id);
    return { success: true, message: 'Article archived successfully' };
  }

  await prisma.knowledgeBaseArticle.update({
    where: { id: existing.id },
    data: { isArchived: true },
  });

  await logAudit(companyId, userId, 'kb_article.archived', 'KnowledgeBaseArticle', existing.id);
  return { success: true, message: 'Article archived successfully' };
}

function populateArticle(a: DevKBArticle) {
  const category = a.categoryId ? devStore.kbCategories.find((c) => c.id === a.categoryId) : null;
  const author = devStore.users.find((u) => u.id === a.authorId);
  const tags = a.tagIds
    .map((tid) => {
      const tag = devStore.kbTags.find((t) => t.id === tid);
      return tag ? { tag } : null;
    })
    .filter(Boolean);

  return {
    ...a,
    category: category ?? null,
    author: author ? { id: author.id, name: author.name, email: author.email } : null,
    tags,
  };
}
