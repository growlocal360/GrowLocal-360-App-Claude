import { Loader2 } from 'lucide-react';

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Coming Soon
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          We&apos;re putting the finishing touches on this website.
          It will be ready shortly!
        </p>
      </div>
    </div>
  );
}
