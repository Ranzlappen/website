/**
 * Commander tag icon + picker, and the team-only `/squadjoin` chip.
 *
 * Icons are the in-game commander / catmander tags (wvw/public/tags, built by
 * scripts/build-tags.py — committed, never hotlinked). A raid without a tag
 * shows the default blue commander.
 */
import { useState, type MouseEvent } from "react";
import { useT } from "../i18n";
import {
  DEFAULT_TAG,
  TAG_COLORS,
  TAG_SHAPES,
  labelOf,
  type TagColor,
  type TagShape,
} from "../shared/constants";
import type { CommanderTag } from "../shared/types";
import { useStore } from "../store";

export const tagSrc = (tag: CommanderTag | null | undefined) => {
  const t = tag ?? DEFAULT_TAG;
  return `${import.meta.env.BASE_URL}tags/${t.shape}-${t.color}.webp`;
};

/** "Red catmander" etc. (translated). */
export function useTagLabel() {
  const t = useT();
  return (tag: CommanderTag | null | undefined) => {
    const x = tag ?? DEFAULT_TAG;
    return t("{color} {shape} tag", {
      color: t(labelOf(TAG_COLORS, x.color)),
      shape: t(labelOf(TAG_SHAPES, x.shape)),
    });
  };
}

export function TagIcon({
  tag,
  size = 18,
  className = "",
}: {
  tag: CommanderTag | null | undefined;
  size?: number;
  className?: string;
}) {
  const label = useTagLabel()(tag);
  return (
    <img
      src={tagSrc(tag)}
      alt={label}
      title={label}
      width={Math.round(size * 0.9)}
      height={size}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 select-none object-contain align-[-0.2em] drop-shadow ${className}`}
      style={{ width: Math.round(size * 0.9), height: size }}
      draggable={false}
    />
  );
}

/** Shape toggle + one button per colour. */
export function TagPicker({
  value,
  onChange,
}: {
  value: CommanderTag | null;
  onChange: (v: CommanderTag) => void;
}) {
  const t = useT();
  const cur = value ?? DEFAULT_TAG;
  const label = useTagLabel();
  return (
    <div className="grid gap-2">
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label={t("Tag shape")}
      >
        {TAG_SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={cur.shape === s.id}
            onClick={() => onChange({ ...cur, shape: s.id as TagShape })}
            className="chip"
          >
            <TagIcon
              tag={{ color: cur.color, shape: s.id as TagShape }}
              size={16}
            />
            {t(s.label)}
          </button>
        ))}
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label={t("Tag colour")}
      >
        {TAG_COLORS.map((c) => {
          const tag = { shape: cur.shape, color: c.id as TagColor };
          const on = cur.color === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label(tag)}
              title={label(tag)}
              onClick={() => onChange(tag)}
              className={`grid h-11 w-11 place-items-center rounded-xl border transition ${
                on
                  ? "border-[var(--gold)] bg-[rgba(224,179,65,0.12)]"
                  : "border-[var(--border)] bg-[var(--bg-2)] hover:border-[var(--border-strong)]"
              }`}
            >
              <TagIcon tag={tag} size={28} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** `/squadjoin Name` with a copy button (team-only data — only rendered when present). */
export function SquadJoin({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  const t = useT();
  const toast = useStore((s) => s.toast);
  const [copied, setCopied] = useState(false);
  const cmd = `/squadjoin ${name}`;
  const copy = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(cmd);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={t("Copy — paste it into the in-game chat to join the squad")}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[rgba(79,191,106,0.35)] bg-[rgba(79,191,106,0.08)] font-mono text-emerald-200 hover:border-emerald-400 ${
        compact ? "px-1.5 py-0.5 text-[0.7rem]" : "px-2 py-1 text-xs"
      }`}
    >
      <span className="truncate">{cmd}</span>
      <span aria-hidden className="shrink-0 font-sans">
        {copied ? "✓" : "⧉"}
      </span>
      <span className="sr-only">{copied ? t("Copied") : t("Copy")}</span>
    </button>
  );
}
