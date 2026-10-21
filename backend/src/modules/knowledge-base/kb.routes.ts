import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permissions.js';
import { validate } from '../../middleware/validate.js';
import {
  CreateKBCategorySchema,
  CreateKBTagSchema,
  CreateKBArticleSchema,
  UpdateKBArticleSchema,
  ListKBArticlesQuerySchema,
} from './kb.schema.js';
import * as controller from './kb.controller.js';

export const kbRouter = Router();

kbRouter.use(requireAuth);

// Categories
kbRouter.get('/categories', requirePermission('kb.view'), controller.listCategories);
kbRouter.post(
  '/categories',
  requirePermission('kb.create'),
  validate({ body: CreateKBCategorySchema }),
  controller.createCategory
);

// Tags
kbRouter.get('/tags', requirePermission('kb.view'), controller.listTags);
kbRouter.post(
  '/tags',
  requirePermission('kb.create'),
  validate({ body: CreateKBTagSchema }),
  controller.createTag
);

// Articles
kbRouter.get(
  '/articles',
  requirePermission('kb.view'),
  validate({ query: ListKBArticlesQuerySchema }),
  controller.listArticles
);

kbRouter.get(
  '/articles/slug/:slugOrId',
  requirePermission('kb.view'),
  controller.getArticle
);

kbRouter.get(
  '/articles/:slugOrId',
  requirePermission('kb.view'),
  controller.getArticle
);

kbRouter.post(
  '/articles',
  requirePermission('kb.create'),
  validate({ body: CreateKBArticleSchema }),
  controller.createArticle
);

kbRouter.put(
  '/articles/:articleId',
  requirePermission('kb.update'),
  validate({ body: UpdateKBArticleSchema }),
  controller.updateArticle
);

kbRouter.patch(
  '/articles/:articleId',
  requirePermission('kb.update'),
  validate({ body: UpdateKBArticleSchema }),
  controller.updateArticle
);

kbRouter.delete(
  '/articles/:articleId',
  requirePermission('kb.delete'),
  controller.deleteArticle
);
