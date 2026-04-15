import { useState } from 'react';
import type { FrontMatter } from '../types';
import { CATEGORIES, STATUSES, SERIES_OPTIONS, slugify } from '../types';

interface Props {
  frontMatter: FrontMatter;
  slug: string;
  onChange: (fm: FrontMatter) => void;
  onSlugChange: (slug: string) => void;
}

export default function FrontMatterForm({ frontMatter, slug, onChange, onSlugChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  function update(partial: Partial<FrontMatter>) {
    onChange({ ...frontMatter, ...partial });
  }

  function handleTitleChange(title: string) {
    update({ title });
    // Auto-generate slug from title if slug is empty or was auto-generated
    if (!slug || slug === slugify(frontMatter.title)) {
      onSlugChange(slugify(title));
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !frontMatter.tags.includes(tag)) {
      update({ tags: [...frontMatter.tags, tag] });
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    update({ tags: frontMatter.tags.filter((t) => t !== tag) });
  }

  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !frontMatter.keywords.includes(kw)) {
      update({ keywords: [...frontMatter.keywords, kw] });
    }
    setKeywordInput('');
  }

  function removeKeyword(kw: string) {
    update({ keywords: frontMatter.keywords.filter((k) => k !== kw) });
  }

  const inputClass =
    'bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none transition-colors w-full';
  const labelClass = 'text-xs text-[var(--text-muted)] font-medium';

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Title — full width */}
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className={labelClass}>Title *</span>
          <input
            type="text"
            value={frontMatter.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Post title"
            maxLength={200}
            className={inputClass}
          />
        </label>

        {/* Slug */}
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Slug *</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="post-url-slug"
            className={inputClass}
          />
        </label>

        {/* Date */}
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Date *</span>
          <input
            type="date"
            value={frontMatter.date}
            onChange={(e) => update({ date: e.target.value })}
            className={inputClass}
          />
        </label>

        {/* Category */}
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Category *</span>
          <select
            value={frontMatter.category}
            onChange={(e) => update({ category: e.target.value })}
            className={inputClass}
          >
            <option value="">Select...</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {/* Status */}
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Status *</span>
          <select
            value={frontMatter.status}
            onChange={(e) => update({ status: e.target.value as FrontMatter['status'] })}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Comments toggle */}
        <label className="flex items-center gap-2 self-end pb-1">
          <input
            type="checkbox"
            checked={frontMatter.comments}
            onChange={(e) => update({ comments: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          <span className="text-sm">Enable comments</span>
        </label>

        {/* Description — full width */}
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <span className={labelClass}>Description (SEO)</span>
          <textarea
            value={frontMatter.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Brief description for search engines and social cards"
            rows={2}
            maxLength={500}
            className={`${inputClass} resize-y`}
          />
        </label>

        {/* Tags */}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Tags</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Add tag and press Enter"
              className={inputClass}
            />
            <button
              type="button"
              onClick={addTag}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors shrink-0"
            >
              Add
            </button>
          </div>
          {frontMatter.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {frontMatter.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--bg)] border border-[var(--border)]"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] leading-none"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image path */}
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={labelClass}>Hero Image Path</span>
          <input
            type="text"
            value={frontMatter.image}
            onChange={(e) => update({ image: e.target.value })}
            placeholder="/assets/images/topic/hero.webp"
            className={inputClass}
          />
        </label>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
      >
        {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
      </button>

      {showAdvanced && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3 pt-3 border-t border-[var(--border)]">
          {/* Series */}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Series</span>
            <select
              value={frontMatter.series ?? ''}
              onChange={(e) =>
                update({
                  series: e.target.value || null,
                  seriesOrder: e.target.value ? frontMatter.seriesOrder : null,
                })
              }
              className={inputClass}
            >
              <option value="">None</option>
              {SERIES_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>

          {/* Series order */}
          {frontMatter.series && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Series Order</span>
              <input
                type="number"
                min={1}
                value={frontMatter.seriesOrder ?? ''}
                onChange={(e) =>
                  update({ seriesOrder: e.target.value ? parseInt(e.target.value) : null })
                }
                className={inputClass}
              />
            </label>
          )}

          {/* Author */}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Author</span>
            <input
              type="text"
              value={frontMatter.author ?? ''}
              onChange={(e) => update({ author: e.target.value || null })}
              placeholder="Defaults to site author"
              className={inputClass}
            />
          </label>

          {/* Backdrop */}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Backdrop Image</span>
            <input
              type="text"
              value={frontMatter.backdrop ?? ''}
              onChange={(e) => update({ backdrop: e.target.value || null })}
              placeholder="/assets/images/topic/hero.webp"
              className={inputClass}
            />
          </label>

          {/* PolyVote topic */}
          <label className="flex flex-col gap-1">
            <span className={labelClass}>PolyVote Topic ID</span>
            <input
              type="text"
              value={frontMatter.polyvoteTopic ?? ''}
              onChange={(e) => update({ polyvoteTopic: e.target.value || null })}
              placeholder="topic-id"
              className={inputClass}
            />
          </label>

          {/* Keywords */}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Keywords (SEO)</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder="Add keyword and press Enter"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addKeyword}
                className="px-3 py-1.5 text-sm rounded border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors shrink-0"
              >
                Add
              </button>
            </div>
            {frontMatter.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {frontMatter.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--bg)] border border-[var(--border)]"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)] leading-none"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
