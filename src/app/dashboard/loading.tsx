export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Welcome skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-lg" />
            <div>
              <div className="h-7 w-16 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded mt-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Two column skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded w-3/4" />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="h-5 w-20 bg-gray-200 rounded mb-4" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 w-28 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Table skeleton */}
      <div className="card">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-gray-100 rounded flex-1" />
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
