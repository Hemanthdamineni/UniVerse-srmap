function Footer() {
  return (
    <footer className="flex justify-between items-center bg-[var(--comp-accent)] text-white rounded-t-lg p-5">
      <div className="text-left p-0">
        © 2025 UniVerse — SRMAP Edition. All rights reserved.
      </div>
      <div className="flex justify-between gap-5">
        <a href="/privacy-policy" className="text-white no-underline text-sm">Privacy Policy</a>
        <a href="/terms-of-service" className="text-white no-underline text-sm">Terms of Service</a>
      </div>
    </footer>
  );
}

export default Footer;
