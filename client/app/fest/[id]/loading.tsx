export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Banner skeleton */}
        <div className="h-64 md:h-80 w-full bg-gray-200 rounded-lg animate-pulse mb-8"></div>
        
        {/* Title skeleton */}
        <div className="mb-6">
          <div className="h-10 w-2/3 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        {/* Info cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        
        {/* Description skeleton */}
        <div className="mb-8">
          <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        
        {/* Events section skeleton */}
        <div className="mt-12">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </main>
    </div>
  );
}
