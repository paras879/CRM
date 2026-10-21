'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Search,
  Plus,
  Eye,
  Calendar,
  Layers,
  Tag,
  FolderOpen,
  Clock,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
  Bookmark,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { KBArticle, KBCategory, KBTag, ArticleStatus } from '@/types';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<KBCategory[]>([]);
  const [tags, setTags] = useState<KBTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Create article modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    categoryId: '',
    summary: '',
    body: '',
    status: 'PUBLISHED' as ArticleStatus,
    tagIds: [] as string[],
  });

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCategory !== 'ALL') params.set('categoryId', selectedCategory);
      if (selectedTag !== 'ALL') params.set('tagId', selectedTag);
      if (selectedStatus !== 'ALL') params.set('status', selectedStatus);

      const res = await fetch(`/api/v1/knowledge-base/articles?${params.toString()}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setArticles(json.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedTag, selectedStatus]);

  const fetchMetadata = async () => {
    try {
      const [catRes, tagRes] = await Promise.all([
        fetch('/api/v1/knowledge-base/categories', { credentials: 'include' }),
        fetch('/api/v1/knowledge-base/tags', { credentials: 'include' }),
      ]);
      if (catRes.ok) {
        const json = await catRes.json();
        setCategories(json.data ?? []);
      }
      if (tagRes.ok) {
        const json = await tagRes.json();
        setTags(json.data ?? []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.body) return;

    setSubmitting(true);
    try {
      const payload: any = {
        title: formData.title,
        slug: formData.slug || undefined,
        categoryId: formData.categoryId || undefined,
        summary: formData.summary || undefined,
        body: formData.body,
        status: formData.status,
        tagIds: formData.tagIds,
      };

      const res = await fetch('/api/v1/knowledge-base/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setFormData({
          title: '',
          slug: '',
          categoryId: '',
          summary: '',
          body: '',
          status: 'PUBLISHED',
          tagIds: [],
        });
        fetchArticles();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ArticleStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">Published</Badge>;
      case 'DRAFT':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge variant="secondary" className="text-[10px]">Archived</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Hero Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-background border border-primary/20 p-8 shadow-sm overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <Badge className="bg-primary/20 text-primary border-primary/30 mb-2">Help Center & Docs</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Knowledge Base</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">
            Browse guides, developer specifications, billing workflows, and operational procedures for your team.
          </p>

          <div className="mt-5 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search knowledge base articles by topic, keyword, or tag..."
              className="pl-10 h-11 bg-background/90 text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="absolute top-6 right-6 hidden sm:flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            New Article
          </Button>
        </div>
      </div>

      {/* Categories Horizontal Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Browse by Category</h2>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-primary h-7 sm:hidden"
            onClick={() => setCreateModalOpen(true)}
          >
            + New Article
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card
            onClick={() => setSelectedCategory('ALL')}
            className={`hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer border-border/80 ${
              selectedCategory === 'ALL' ? 'border-primary ring-1 ring-primary bg-primary/[0.03]' : 'bg-card'
            }`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Bookmark className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">All Categories</p>
                <p className="text-[11px] text-muted-foreground">{articles.length} articles</p>
              </div>
            </CardContent>
          </Card>

          {categories.map((c) => {
            const isSelected = selectedCategory === c.id;
            const count = articles.filter((a) => a.categoryId === c.id).length;
            return (
              <Card
                key={c.id}
                onClick={() => setSelectedCategory(isSelected ? 'ALL' : c.id)}
                className={`hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 cursor-pointer border-border/80 ${
                  isSelected ? 'border-primary ring-1 ring-primary bg-primary/[0.03]' : 'bg-card'
                }`}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{count} articles</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Filter Row: Tags and Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1 flex items-center gap-1">
            <Tag className="h-3.5 w-3.5" /> Tags:
          </span>
          <Badge
            variant={selectedTag === 'ALL' ? 'default' : 'outline'}
            className="cursor-pointer text-[11px]"
            onClick={() => setSelectedTag('ALL')}
          >
            All Tags
          </Badge>
          {tags.map((t) => (
            <Badge
              key={t.id}
              variant={selectedTag === t.id ? 'default' : 'outline'}
              className="cursor-pointer text-[11px]"
              onClick={() => setSelectedTag(selectedTag === t.id ? 'ALL' : t.id)}
            >
              #{t.name}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Publication States</option>
            <option value="PUBLISHED">Published Only</option>
            <option value="DRAFT">Drafts Only</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Articles Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-xs text-muted-foreground font-medium">Loading articles...</p>
        </div>
      ) : articles.length === 0 ? (
        <Card className="border-dashed p-16 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-40 text-primary" />
          <h3 className="font-bold text-foreground text-sm">No articles match your query</h3>
          <p className="text-xs mt-1">Try relaxing filters, or publish a new article.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a) => (
            <Card
              key={a.id}
              onClick={() => router.push(`/knowledge-base/${a.slug}`)}
              className="hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/60 cursor-pointer transition-all duration-200 border-border/80 bg-card flex flex-col justify-between group"
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded">
                    {a.category ? a.category.name : 'General'}
                  </span>
                  {getStatusBadge(a.status)}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    {a.title}
                  </h3>
                  {a.summary && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                      {a.summary}
                    </p>
                  )}
                </div>

                {a.tags && a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {a.tags.map((t, idx) => (
                      <span key={idx} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        #{t.tag?.name ?? 'tag'}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>

              <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {a.views} views
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                  Read article <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Article Dialog */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Create Knowledge Base Article</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateArticle} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Article Title *</label>
              <Input
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. How to configure Webhook endpoints securely"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">No Category (General)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Publication Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as ArticleStatus })}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="PUBLISHED">Published (Immediately visible)</option>
                  <option value="DRAFT">Draft (Staff review only)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Summary</label>
              <Input
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Short 1-2 sentence description shown in cards and search results..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">Article Body (Markdown Supported) *</label>
              <textarea
                required
                rows={8}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Write your article body here. Markdown headings, code blocks and bullet points are supported..."
                className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {submitting ? 'Saving...' : 'Save Article'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
