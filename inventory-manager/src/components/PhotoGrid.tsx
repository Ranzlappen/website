import { useRef, useState } from 'react';
import {
  inventoryDeletePhotoFn,
  inventoryImportPhotoFromUrlFn,
  inventoryReorderPhotosFn,
  inventoryUploadPhotoFn,
} from '../firebase';
import { useStore } from '../store';
import type { PhotoRef } from '../types';
import DrivePicker from './DrivePicker';
import PhotoLightbox from './PhotoLightbox';

interface Props {
  itemId: string;
  photos: PhotoRef[];
  onChange: (photos: PhotoRef[]) => void;
}

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['.webp', '.png', '.jpg', '.jpeg'];

function readAsBase64(file: File): Promise<{ base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const dataUrl = fr.result as string;
      const base64 = dataUrl.split(',')[1];
      // Probe dimensions in parallel.
      const img = new Image();
      img.onload = () => resolve({ base64, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ base64, width: 0, height: 0 });
      img.src = dataUrl;
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export default function PhotoGrid({ itemId, photos, onChange }: Props) {
  const addToast = useStore((s) => s.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);

  async function importFromUrl() {
    if (!urlInput.trim()) return;
    setUrlBusy(true);
    try {
      const res = await inventoryImportPhotoFromUrlFn({
        itemId,
        url: urlInput.trim(),
      });
      onChange([...photos, res.data]);
      addToast('Photo imported', 'success');
      setUrlInput('');
      setUrlImportOpen(false);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setUrlBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      let next = photos.slice();
      for (const file of Array.from(files)) {
        const lower = file.name.toLowerCase();
        const ext = lower.slice(lower.lastIndexOf('.'));
        if (!ALLOWED.includes(ext)) {
          addToast(`${file.name}: unsupported file type`, 'error');
          continue;
        }
        if (file.size > MAX_SIZE) {
          addToast(`${file.name}: too large (max 10MB)`, 'error');
          continue;
        }
        try {
          const { base64, width, height } = await readAsBase64(file);
          const res = await inventoryUploadPhotoFn({
            itemId,
            filename: file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-'),
            base64Data: base64,
            width,
            height,
          });
          next = [...next, res.data];
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          addToast(`${file.name}: ${msg}`, 'error');
        }
      }
      onChange(next);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function deletePhoto(photo: PhotoRef) {
    if (!confirm(`Delete ${photo.filename}?`)) return;
    try {
      const res = await inventoryDeletePhotoFn({
        itemId,
        storagePath: photo.storagePath,
      });
      onChange(res.data.photos);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  }

  async function reorderTo(from: number, to: number) {
    if (from === to) return;
    const next = photos.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    try {
      const res = await inventoryReorderPhotosFn({
        itemId,
        photoOrder: next.map((p) => p.storagePath),
      });
      onChange(res.data.photos);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Reorder failed', 'error');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-[var(--text-muted)]">
          Photos ({photos.length} / 24)
        </h3>
        <div className="flex items-center gap-2">
          {photos.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    photos.map((p) => p.downloadUrl).join('|'),
                  );
                  addToast(
                    `Copied ${photos.length} URL${photos.length === 1 ? '' : 's'}`,
                    'success',
                  );
                } catch {
                  addToast('Copy failed', 'error');
                }
              }}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              title="Copy a pipe-separated list of every photo URL (same shape as the eBay PicURL column)"
            >
              Copy gallery URLs
            </button>
          )}
          <button
            type="button"
            onClick={() => setUrlImportOpen((v) => !v)}
            disabled={photos.length >= 24}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            title="Paste a Google Drive share URL or any public image URL"
          >
            + From URL
          </button>
          <button
            type="button"
            onClick={() => setDriveOpen(true)}
            disabled={photos.length >= 24}
            className="px-3 py-1.5 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
            title="Browse a public Google Drive folder"
          >
            + From Drive
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || photos.length >= 24}
            className="px-3 py-1.5 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : '+ Upload'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".webp,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {urlImportOpen && (
        <div className="mb-3 flex gap-2 flex-wrap">
          <input
            type="url"
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !urlBusy) importFromUrl();
            }}
            placeholder="Paste a Google Drive share URL or any public image URL"
            className="flex-1 min-w-[200px] bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setUrlImportOpen(false)}
            className="px-3 py-2 text-sm rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={importFromUrl}
            disabled={urlBusy || !urlInput.trim()}
            className="px-3 py-2 text-sm rounded bg-[var(--accent)] text-[var(--bg)] font-semibold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
          >
            {urlBusy ? 'Fetching…' : 'Add'}
          </button>
        </div>
      )}

      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 min-h-[120px] p-3 rounded border-2 border-dashed border-[var(--border)]"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
      >
        {photos.length === 0 && (
          <div className="col-span-full text-center text-sm text-[var(--text-muted)] py-8">
            Drop photos here or click Upload. The first photo is the primary
            (used as the cover thumbnail in eBay exports).
          </div>
        )}
        {photos.map((p, idx) => (
          <div
            key={p.storagePath}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorderTo(dragIndex, idx);
              setDragIndex(null);
            }}
            className="relative group bg-[var(--bg)] rounded border border-[var(--border)] overflow-hidden cursor-move"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(idx)}
              aria-label={`Open ${p.filename}`}
              className="block w-full p-0 m-0 bg-transparent"
            >
              <img
                src={p.downloadUrl}
                alt={p.filename}
                className="block w-full aspect-square object-cover"
                loading="lazy"
              />
            </button>
            {idx === 0 && (
              <span className="pointer-events-none absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-[var(--bg)] font-semibold">
                Primary
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-1 flex justify-between gap-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-white truncate flex-1">{p.filename}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(p.downloadUrl);
                    addToast('Photo URL copied', 'success');
                  } catch {
                    addToast('Copy failed', 'error');
                  }
                }}
                className="text-[10px] text-white/80 hover:text-white shrink-0"
              >
                Copy URL
              </button>
              <button
                type="button"
                onClick={() => deletePhoto(p)}
                className="text-[10px] text-red-300 hover:text-red-100 shrink-0"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <DrivePicker
        open={driveOpen}
        itemId={itemId}
        onClose={() => setDriveOpen(false)}
        onImported={(newOnes) => onChange([...photos, ...newOnes])}
      />
    </div>
  );
}
