import { useEffect, useState, useCallback } from 'react';
import { useStore } from './useStore';

export function useKeyboard() {
  const toggleTheme = useStore((s) => s.toggleTheme);
  const [showHelp, setShowHelp] = useState(false);

  const closeHelp = useCallback(() => setShowHelp(false), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          document.getElementById('topic-search')?.focus();
          break;
        case 't':
          if (!e.ctrlKey && !e.metaKey) toggleTheme();
          break;
        case '?':
          setShowHelp((prev) => !prev);
          break;
        case 'Escape':
          setShowHelp(false);
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleTheme]);

  return { showHelp, closeHelp };
}
