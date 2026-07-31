function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="flex flex-col gap-2 rounded-t-lg border-t border-[var(--comp-accent)]/30 p-5 text-sm sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: "var(--footer-bg)", color: "var(--footer-fg)" }}>
      <div className="text-left p-0">
        © {year} UniVerse, SRMAP Edition. All rights reserved.
      </div>
      <div className="text-left opacity-85 sm:text-right">
        SRM AP student companion
      </div>
    </footer>
  );
}

export default Footer;
