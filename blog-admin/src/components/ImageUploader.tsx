import { useState, useRef, type DragEvent } from 'react';
import { blogUploadImageFn } from '../firebase';
import { useStore } from '../store';

interface Props {
  slug: string;
  open: boolean;
  onClose: () => void;
  onUploaded: (markdownImg: string) => void;
}

export default function ImageUploader({ slug, open, onClose, onUploaded }: Props) {
  const addToast = useStore((s) => s.addToast);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      addToast('Only image files are allowed', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image must be under 5MB', 'error');
      return;
    }

    const targetSlug = slug || 'uploads';
    const filename = file.name
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-');

    setUploading(true);
    try {
      // Read as base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data:...;base64, prefix
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await blogUploadImageFn({
        slug: targetSlug,
        filename,
        base64Data: base64,
      });

      const md = `![${file.name}](${result.data.path})`;
      onUploaded(md);
      addToast('Image uploaded', 'success');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      addToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect() {
    const file = fileRef.current?.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Upload Image</h3>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)]'
          }`}
        >
          {uploading ? (
            <p className="text-[var(--text-muted)]">Uploading...</p>
          ) : (
            <>
              <p className="text-[var(--text-muted)] mb-3">
                Drag and drop an image here, or
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded bg-[var(--accent)] text-[var(--bg)] font-medium text-sm hover:bg-[var(--accent-hover)] transition-colors"
              >
                Choose file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/webp,image/png,image/jpeg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-xs text-[var(--text-muted)] mt-3">
                WebP, PNG, or JPEG. Max 5MB.
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-3">
          Uploads to: <code>assets/images/{slug || 'uploads'}/</code>
        </p>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 rounded border border-[var(--border)] text-sm hover:border-[var(--text-muted)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
