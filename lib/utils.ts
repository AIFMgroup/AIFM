import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success border-success/20',
    ERROR: 'bg-danger/10 text-danger border-danger/20',
    PAUSED: 'bg-warning/10 text-warning border-warning/20',
    PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    BLOCKED: 'bg-danger/10 text-danger border-danger/20',
    NEEDS_REVIEW: 'bg-warning/10 text-warning border-warning/20',
    DONE: 'bg-success/10 text-success border-success/20',
    DRAFT: 'bg-gray-50 text-gray-700 border-gray-200',
    QC: 'bg-blue-50 text-blue-700 border-blue-200',
    APPROVAL: 'bg-warning/10 text-warning border-warning/20',
    PUBLISHED: 'bg-success/10 text-success border-success/20',
  };
  return map[status] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
