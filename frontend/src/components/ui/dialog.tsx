'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogContextType {
  open: boolean;
  onClose: () => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Wrap raw children in a card surface (use when not composing with DialogContent). */
  surface?: boolean;
}

export function Dialog({
  open,
  onOpenChange,
  onClose,
  title,
  description,
  children,
  className,
  surface,
}: DialogProps) {
  const handleClose = React.useCallback(() => {
    if (onClose) onClose();
    if (onOpenChange) onOpenChange(false);
  }, [onClose, onOpenChange]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        handleClose();
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleClose]);

  if (!open) return null;

  // Backward compatibility when title prop is directly provided
  if (title) {
    return (
      <div className="fixed inset-0 z-50 flex p-3 sm:p-6 animate-in fade-in-0 duration-200 overflow-y-auto [&>*]:m-auto">
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
        <div
          className={cn(
            'relative z-50 w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] flex flex-col rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden',
            className
          )}
        >
          {/* Pinned Modal Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-border/70 shrink-0 bg-card">
            <div className="flex flex-col space-y-1 text-left pr-4">
              <h2 className="text-base sm:text-lg font-semibold leading-none tracking-tight text-foreground">
                {title}
              </h2>
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1.5 opacity-70 hover:opacity-100 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 focus:outline-none focus:ring-2 focus:ring-primary -mr-1"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          {/* Scrollable Modal Body (Mouse Wheel scroll enabled) */}
          <div className="p-6 overflow-y-auto flex-1 overscroll-contain">
            {children}
          </div>
        </div>
      </div>
    );
  }

  // Composite dialog pattern with DialogContent, DialogHeader, DialogFooter
  const hasDialogContent = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === DialogContent
  );

  return (
    <DialogContext.Provider value={{ open, onClose: handleClose }}>
      <div className="fixed inset-0 z-50 flex p-3 sm:p-6 animate-in fade-in-0 duration-200 overflow-y-auto [&>*]:m-auto">
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
          onClick={handleClose}
        />
        {hasDialogContent || !surface ? (
          children
        ) : (
          // Raw children (no DialogContent): give them the card surface, or they float on the backdrop
          <div
            className={cn(
              'relative z-50 w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain',
              className
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DialogContext.Provider>
  );
}

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(DialogContext);

  return (
    <div
      className={cn(
        'relative z-50 w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3.5rem)] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 overscroll-contain',
        className
      )}
    >
      {ctx && (
        <button
          type="button"
          onClick={ctx.onClose}
          className="sticky top-0 float-right -mt-2 -mr-2 z-10 rounded-lg p-1.5 opacity-70 hover:opacity-100 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0 focus:outline-none focus:ring-2 focus:ring-primary bg-card/80 backdrop-blur-sm"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col space-y-1.5 text-center sm:text-left mb-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        'text-lg font-semibold leading-none tracking-tight text-foreground',
        className
      )}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t border-border/60',
        className
      )}
    >
      {children}
    </div>
  );
}
