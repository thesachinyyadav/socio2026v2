export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header skeleton */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-10">
          <div className="flex-1">
            <div className="h-10 w-72 bg-gray-200 rounded animate-pulse mb-4"></div>
            <div className="flex gap-4">
              <div className="h-12 w-36 bg-gray-200 rounded-full animate-pulse"></div>
              <div className="h-12 w-36 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="h-10 w-64 bg-gray-200 rounded-full animate-pulse"></div>
        </div>

        {/* Fests section skeleton */}
        <div className="mb-12">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="h-40 bg-gray-200 animate-pulse"></div>
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events section skeleton */}
        <div>
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg overflow-hidden border-2 border-gray-200">
                <div className="h-40 bg-gray-200 animate-pulse"></div>
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
