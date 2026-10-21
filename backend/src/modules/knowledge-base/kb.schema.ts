import { z } from 'zod';
import { ArticleStatus } from '@prisma/client';

export const CreateKBCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(255).optional().nullable(),
  order: z.number().int().optional().default(0),
});

export const CreateKBTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50),
});

export const CreateKBArticleSchema = z.object({
  title: z.string().min(1, 'Article title is required').max(255),
  slug: z.string().max(255).optional(),
  categoryId: z.string().optional().nullable(),
  summary: z.string().max(500).optional().nullable(),
  body: z.string().min(1, 'Article body is required'),
  status: z.nativeEnum(ArticleStatus).optional().default(ArticleStatus.DRAFT),
  tagIds: z.array(z.string()).optional().default([]),
});

export const UpdateKBArticleSchema = CreateKBArticleSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

export const ListKBArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  status: z.nativeEnum(ArticleStatus).optional(),
  isArchived: z.coerce.boolean().optional().default(false),
  sortBy: z.enum(['createdAt', 'updatedAt', 'publishedAt', 'views', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateKBCategoryInput = z.infer<typeof CreateKBCategorySchema>;
export type CreateKBTagInput = z.infer<typeof CreateKBTagSchema>;
export type CreateKBArticleInput = z.infer<typeof CreateKBArticleSchema>;
export type UpdateKBArticleInput = z.infer<typeof UpdateKBArticleSchema>;
export type ListKBArticlesQuery = z.infer<typeof ListKBArticlesQuerySchema>;
