export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-parchment-dark border-t-gnome-green rounded-full animate-spin mb-4" />
        <p className="text-bark-brown-light text-sm">Loading...</p>
      </div>
    </div>
  );
}
