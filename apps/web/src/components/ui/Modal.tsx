import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  size?: 'small' | 'default' | 'large' | 'fullscreen';
}

export function Modal({ isOpen, onClose, title, children, className, size = 'default' }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity hidden sm:block"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={cn(
          // Mobile: always fullscreen
          'relative z-50 flex flex-col bg-background p-4 sm:p-6',
          'w-full h-full sm:h-auto sm:rounded-lg sm:border sm:shadow-lg',
          // Desktop: size-specific constraints
          size === 'fullscreen'
            ? 'sm:w-full sm:h-full sm:max-w-none sm:max-h-none sm:rounded-none sm:border-0'
            : size === 'large'
            ? 'sm:w-[80vw] sm:max-w-[80vw] sm:h-[80vh] sm:max-h-[80vh]'
            : size === 'small'
            ? 'sm:max-w-md sm:max-h-[90vh]'
            : 'sm:max-w-4xl sm:max-h-[90vh]',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
          <div id="modal-title" className="flex-1 min-w-0">
            {title}
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
