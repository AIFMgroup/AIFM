import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-xl',
  {
    variants: {
      variant: {
        default: 'bg-gray-900 text-white hover:bg-gray-800 rounded-lg',
        primary: 'bg-[#2d2a26] text-white hover:bg-[#2d2a26]/90',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-lg',
        accent: 'bg-[#c0a280] text-white hover:bg-[#c0a280]/90',
        destructive: 'bg-red-600 text-white hover:bg-red-700 rounded-lg',
        danger: 'bg-red-600 text-white hover:bg-red-700 rounded-lg',
        outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 rounded-lg',
        ghost: 'hover:bg-gray-100 text-gray-700 rounded-lg',
        link: 'text-gray-900 underline-offset-4 hover:underline',
        minimal: 'bg-transparent hover:bg-gray-100 text-gray-900',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 py-1 text-xs',
        md: 'h-10 px-4 py-2.5 text-sm',
        lg: 'h-12 px-6 py-3 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>,
    VariantProps<typeof buttonVariants> {
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, icon, iconPosition = 'left', loading, fullWidth, children, disabled, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }), fullWidth && 'w-full')}
      ref={ref}
      disabled={disabled ?? loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : icon && iconPosition === 'left' ? icon : null}
      {children}
      {!loading && icon && iconPosition === 'right' ? icon : null}
    </button>
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };