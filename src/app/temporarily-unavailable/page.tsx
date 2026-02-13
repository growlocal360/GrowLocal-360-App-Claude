export default function TemporarilyUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Temporarily Unavailable
        </h1>
        <p className="mt-3 text-gray-600">
          This site is temporarily unavailable. Please try again in a few minutes.
        </p>
      </div>
    </div>
  );
}
