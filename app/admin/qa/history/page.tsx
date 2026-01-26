import Link from 'next/link';

export default function AdminQaHistoryPage() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6">
      <h1 className="text-xl font-semibold text-aifm-charcoal">Admin · Q&amp;A History</h1>
      <p className="text-sm text-aifm-charcoal/50 mt-1">
        Placeholder. Här kan vi visa historik över frågor/svar, feedback och eventuella policy-beslut.
      </p>
      <div className="mt-4 flex gap-3">
        <Link className="text-sm text-aifm-gold hover:underline" href="/admin/dashboard">
          ← Till admin dashboard
        </Link>
        <Link className="text-sm text-aifm-gold hover:underline" href="/admin/qa">
          Till Q&amp;A →
        </Link>
      </div>
    </div>
  );
}


