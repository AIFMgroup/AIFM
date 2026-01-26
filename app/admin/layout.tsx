import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { DashboardLayout } from '@/components/DashboardLayout';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const role = (h.get('x-aifm-role') || '').toLowerCase();
  if (role !== 'admin') notFound();
  return <DashboardLayout>{children}</DashboardLayout>;
}
