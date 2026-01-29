export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Banner skeleton */}
        <div className="h-64 md:h-80 w-full bg-gray-200 rounded-lg animate-pulse mb-8"></div>
        
        {/* Title and tags skeleton */}
        <div className="mb-6">
          <div className="h-10 w-2/3 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="flex gap-2 mb-4">
            <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="h-6 w-24 bg-gray-200 rounded-full animate-pulse"></div>
          </div>
        </div>
        
        {/* Info cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        
        {/* Navigation tabs skeleton */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-4/5 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        {/* Register button skeleton */}
        <div className="mt-8">
          <div className="h-12 w-48 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </main>
    </div>
  );
}
