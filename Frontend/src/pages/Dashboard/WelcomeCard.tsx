function WelcomeCard() {
  return (
    <div className="flex items-center justify-between h-full">
      <div className="flex items-center gap-4">
        <h2 className="page-title">Welcome back!</h2>
      </div>
      <div className="flex items-center gap-4">
        {/* Search bar removed to avoid redundancy with Command Palette */}
        <button className="relative p-2 hover:bg-[color:var(--comp-surface-hover)] rounded-lg transition-colors" style={{ color: 'var(--comp-text-secondary)' }}>
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-12" />
          </svg>
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full" style={{ background: 'var(--error)' }}></span>
        </button>
      </div>
    </div>
  );
}

export default WelcomeCard;
