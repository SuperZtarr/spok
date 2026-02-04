import { useMemo } from 'react';
import { bbcodeToHtml } from '../lib/bbcode';

interface BBCodeTextProps {
  content: string;
  className?: string;
}

/**
 * Component to render BBCode formatted text as HTML
 * Used for displaying forum content imported from SMF
 */
export function BBCodeText({ content, className = '' }: BBCodeTextProps) {
  const html = useMemo(() => bbcodeToHtml(content), [content]);

  return (
    <div
      className={`bbcode-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
