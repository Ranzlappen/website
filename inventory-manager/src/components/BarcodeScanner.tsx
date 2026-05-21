import { useEffect, useRef, useState } from 'react';

// Subset of the WICG Shape Detection API we rely on. The actual global is
// not in TS's lib.dom yet on every TS version, so we declare what we use.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

interface Props {
  open: boolean;
  onDetected: (code: string) => void;
  onCancel: () => void;
}

export default function BarcodeScanner({ open, onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const detectorAvailable =
    typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!open) return;
    stoppedRef.current = false;
    setError(null);

    if (!detectorAvailable) {
      setError(
        "This browser doesn't expose a barcode scanner. Use Chrome on Android, Edge, or Safari (iOS 17+) — or type the code manually.",
      );
      return;
    }

    let cancelled = false;

    const stop = () => {
      stoppedRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();

        const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
          .BarcodeDetector;
        const detector = new Ctor({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'],
        });

        const tick = async () => {
          if (stoppedRef.current) return;
          try {
            const results = await detector.detect(video);
            if (results.length > 0) {
              const code = results[0].rawValue;
              stop();
              onDetected(code);
              return;
            }
          } catch {
            // Per-frame detect can throw transiently; just continue.
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err: unknown) {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError') {
          setError('Camera permission denied. Allow access and try again.');
        } else if (name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not start the camera.');
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [open, detectorAvailable, onDetected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Scan barcode</h2>
          <button
            onClick={onCancel}
            className="text-[var(--text-muted)] hover:text-[var(--text)] text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {error ? (
          <p className="text-sm text-[var(--danger)] py-6">{error}</p>
        ) : (
          <div className="relative rounded overflow-hidden bg-black aspect-square">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--accent)] opacity-70" />
            <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
              Center the barcode within the line.
            </p>
          </div>
        )}

        <div className="flex justify-end mt-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded border border-[var(--border)] hover:border-[var(--accent)] text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
