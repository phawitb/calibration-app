export default function RecordsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded mt-2" />
        </div>
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>
      <div className="card">
        <div className="h-10 bg-gray-100 rounded w-full" />
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="bg-military-800 h-11 w-full" />
        <div className="divide-y divide-gray-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-4">
              <div className="h-5 w-12 bg-gray-100 rounded-full" />
              <div className="h-5 w-20 bg-gray-100 rounded" />
              <div className="h-5 flex-1 bg-gray-100 rounded" />
              <div className="h-5 w-28 bg-gray-100 rounded hidden md:block" />
              <div className="h-5 w-20 bg-gray-100 rounded hidden lg:block" />
              <div className="h-5 w-16 bg-gray-100 rounded-full hidden md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
