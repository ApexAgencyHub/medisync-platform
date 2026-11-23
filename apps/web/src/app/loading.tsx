export default function RootLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace"
      className="mx-auto min-h-[75vh] max-w-7xl space-y-5 px-4 py-6 sm:px-6"
    >
      <div className="h-16 animate-pulse rounded-2xl border border-[#D7E4F2] bg-white/90" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="h-24 animate-pulse rounded-2xl border border-[#D7E4F2] bg-white/80"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-2xl border border-[#D7E4F2] bg-white/80 lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-2xl border border-[#D7E4F2] bg-white/80 lg:col-span-4" />
      </div>
    </div>
  );
}
