import Link from 'next/link';

export default function AdminQaPage() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h1 className="text-xl font-semibold text-aifm-charcoal">Admin · Q&amp;A</h1>
      <p className="text-sm text-aifm-charcoal/50 mt-1">
        Placeholder. Här kan vi lägga admin-funktioner för Q&amp;A (moderering, prompt policies, KB overrides).
      </p>
      <div className="mt-4 flex gap-3">
        <Link className="text-sm text-aifm-gold hover:underline" href="/admin/dashboard">
          ← Till admin dashboard
        </Link>
        <Link className="text-sm text-aifm-gold hover:underline" href="/admin/qa/history">
          Q&amp;A history →
        </Link>
      </div>
    </div>
  );
}


