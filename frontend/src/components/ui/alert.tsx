import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive bg-destructive/10',
        success: 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 [&>svg]:text-emerald-500 bg-emerald-500/10',
        warning: 'border-amber-500/50 text-amber-600 dark:text-amber-400 [&>svg]:text-amber-500 bg-amber-500/10',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant, title, children, ...props }: AlertProps) {
  const Icon =
    variant === 'destructive'
      ? AlertCircle
      : variant === 'success'
      ? CheckCircle2
      : variant === 'warning'
      ? AlertTriangle
      : Info;

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="h-4 w-4" />
      {title && <h5 className="mb-1 font-medium leading-none tracking-tight">{title}</h5>}
      <div className="text-sm [&_p]:leading-relaxed">{children}</div>
    </div>
  );
}
