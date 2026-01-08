import Link from 'next/link';

export default function DomainNotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center px-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Domain Not Found
        </h1>
        <p className="text-gray-600 mb-8">
          This domain is not configured or has not been verified yet.
          If you own this domain, please verify your DNS settings in your dashboard.
        </p>
        <Link
          href="https://growlocal360.com"
          className="inline-flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Go to GrowLocal 360
        </Link>
      </div>
    </div>
  );
}
