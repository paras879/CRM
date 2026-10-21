'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Eye,
  User,
  Share2,
  Bookmark,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  FolderOpen,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KBArticle, ArticleStatus } from '@/types';

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [article, setArticle] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/knowledge-base/articles/${slug}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Article not found or not published.');
      }
      const json = await res.json();
      setArticle(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load article.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  const handleTogglePublish = async () => {
    if (!article) return;
    setStatusUpdating(true);
    const newStatus: ArticleStatus = article.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    try {
      const res = await fetch(`/api/v1/knowledge-base/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchArticle();
      }
    } catch {
      // ignore
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
        <p className="text-xs text-muted-foreground font-medium">Loading article...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="py-20 text-center max-w-md mx-auto">
        <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
        <h2 className="text-lg font-bold text-foreground">Article Not Found</h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{error || 'This article does not exist or has been unpublished.'}</p>
        <Button variant="outline" onClick={() => router.push('/knowledge-base')}>
          Back to Knowledge Base
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Breadcrumb & Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link href="/knowledge-base" className="hover:text-foreground transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Knowledge Base
          </Link>
          <span>/</span>
          <span>{article.category ? article.category.name : 'General'}</span>
          <span>/</span>
          <span className="text-foreground font-semibold truncate max-w-[200px]">{article.title}</span>
        </nav>

        <div className="flex items-center gap-2">
          {article.status === 'PUBLISHED' ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Published</Badge>
          ) : (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Draft</Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleTogglePublish}
            disabled={statusUpdating}
            className="text-xs h-8"
          >
            {article.status === 'PUBLISHED' ? 'Unpublish to Draft' : 'Publish Article'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {article.title}
            </h1>

            {article.summary && (
              <p className="text-sm text-muted-foreground leading-relaxed font-normal bg-muted/20 p-3.5 rounded-lg border border-border/40">
                {article.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                {article.author?.name || 'Staff Author'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {new Date(article.publishedAt || article.createdAt).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                {article.views} total views
              </span>
            </div>
          </div>

          {/* Formatted Article Body */}
          <article className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm bg-card p-6 sm:p-8 rounded-xl border border-border shadow-sm">
            {article.body}
          </article>

          {/* Tags footer */}
          {article.tags && article.tags.length > 0 && (
            <div className="pt-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Tags:</span>
              <div className="flex flex-wrap gap-1.5">
                {article.tags.map((t, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    #{t.tag?.name ?? 'tag'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Related Articles & Meta (1 col) */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                Article Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Category:</span>
                <span className="font-semibold text-foreground">
                  {article.category ? article.category.name : 'General'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Slug:</span>
                <span className="font-mono text-[11px] text-muted-foreground break-all">
                  {article.slug}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Last Updated:</span>
                <span className="font-medium text-foreground">
                  {new Date(article.updatedAt).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {article.relatedArticles && article.relatedArticles.length > 0 && (
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Related Guides
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3 divide-y divide-border/40 p-0">
                {article.relatedArticles.map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/knowledge-base/${rel.slug}`}
                    className="block p-3 hover:bg-muted/50 transition-colors group"
                  >
                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {rel.title}
                    </p>
                    {rel.summary && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-1">
                        {rel.summary}
                      </p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
