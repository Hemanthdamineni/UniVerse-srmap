function WelcomeCard() {
  return (
    <div className="flex items-center justify-between h-full">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold text-gray-800">Welcome back!</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Search bar removed to avoid redundancy with Command Palette */}
        <button className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-12" />
          </svg>
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
        </button>
      </div>
    </div>
  );
}

export default WelcomeCard;
