import { Request, Response, NextFunction } from 'express';
import * as kbService from './kb.service.js';
import {
  CreateKBCategoryInput,
  CreateKBTagInput,
  CreateKBArticleInput,
  UpdateKBArticleInput,
  ListKBArticlesQuery,
} from './kb.schema.js';

export async function listCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await kbService.listCategories(req.user!.companyId);
    res.json({ data: categories });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const category = await kbService.createCategory(req.user!.companyId, req.body as CreateKBCategoryInput);
    res.status(201).json({ data: category });
  } catch (error) {
    next(error);
  }
}

export async function listTags(req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await kbService.listTags(req.user!.companyId);
    res.json({ data: tags });
  } catch (error) {
    next(error);
  }
}

export async function createTag(req: Request, res: Response, next: NextFunction) {
  try {
    const tag = await kbService.createTag(req.user!.companyId, req.body as CreateKBTagInput);
    res.status(201).json({ data: tag });
  } catch (error) {
    next(error);
  }
}

export async function listArticles(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff = req.user?.permissions?.includes('kb.view') ?? true;
    const result = await kbService.listArticles(
      req.user!.companyId,
      req.query as unknown as ListKBArticlesQuery,
      isStaff
    );
    res.json({
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff = req.user?.permissions?.includes('kb.view') ?? true;
    const article = await kbService.getArticleBySlugOrId(
      req.user!.companyId,
      req.params.slugOrId,
      isStaff
    );
    res.json({ data: article });
  } catch (error) {
    next(error);
  }
}

export async function createArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const article = await kbService.createArticle(
      req.user!.companyId,
      req.user!.id,
      req.body as CreateKBArticleInput
    );
    res.status(201).json({ data: article });
  } catch (error) {
    next(error);
  }
}

export async function updateArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const article = await kbService.updateArticle(
      req.user!.companyId,
      req.params.articleId,
      req.user!.id,
      req.body as UpdateKBArticleInput
    );
    res.json({ data: article });
  } catch (error) {
    next(error);
  }
}

export async function deleteArticle(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await kbService.deleteArticle(
      req.user!.companyId,
      req.params.articleId,
      req.user!.id
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
