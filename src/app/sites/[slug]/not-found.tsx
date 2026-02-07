import Link from 'next/link';

export default function SiteNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Site not found</p>
        <p className="mt-2 text-gray-500">
          The site you&apos;re looking for doesn&apos;t exist or has been deactivated.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-[#00d9c0] px-6 py-3 text-white hover:bg-[#00d9c0]"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
