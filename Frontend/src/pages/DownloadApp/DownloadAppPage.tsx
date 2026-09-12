import { Download, Share, SquarePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../components/button";
import { ANDROID_APK_DOWNLOAD_URL, ANDROID_RELEASE_NOTES_URL } from "../../config/nativeApp";

const ANDROID_STEPS = [
  "Tap Download below — your browser will warn you it's an APK from outside the Play Store, that's expected.",
  "Open the downloaded file. If prompted, allow \"Install unknown apps\" for your browser (Settings asks once, then remembers your choice).",
  "Tap Install, then open UniVerse and log in with your registration number.",
];

const IOS_STEPS = [
  { icon: Share, text: "Open this site in Safari and tap the Share icon." },
  { icon: SquarePlus, text: "Choose \"Add to Home Screen\"." },
  { icon: Download, text: "Launch UniVerse from your home screen — it opens full-screen, works offline for your last-loaded data, and updates itself." },
];

export default function DownloadAppPage() {
  return (
    <div className="flex min-w-0 items-center justify-center px-4 py-10">
      <div className="grid min-w-0 w-full max-w-4xl gap-6">
        <section className="min-w-0 rounded-[28px] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[var(--background)] p-6 shadow-[0_24px_80px_rgba(10,38,42,0.12)] sm:p-8">
          <span className="rounded-full bg-[var(--comp-accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
            Get the app
          </span>
          <h1 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            UniVerse, installed on your phone
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
            We're not on the Play Store or App Store yet, so here's the direct route — same app, no
            listing to wait on.
          </p>
        </section>

        <section className="min-w-0 rounded-[28px] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(10,38,42,0.1)] sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Android</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            A signed APK, built straight from this codebase. Direct install, not through the Play Store.
          </p>

          <Button asChild size="lg" className="mt-4">
            <a href={ANDROID_APK_DOWNLOAD_URL} download>
              <Download />
              Download for Android (.apk)
            </a>
          </Button>

          <ol className="mt-5 space-y-2.5">
            {ANDROID_STEPS.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--comp-accent)_14%,transparent)] text-xs font-semibold text-[var(--comp-accent)]">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <a
            href={ANDROID_RELEASE_NOTES_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-xs font-medium text-[var(--comp-accent)] underline-offset-4 hover:underline"
          >
            Release notes and checksum
          </a>
        </section>

        <section className="min-w-0 rounded-[28px] border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[var(--surface)] p-6 shadow-[0_24px_70px_rgba(10,38,42,0.1)] sm:p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">iPhone / iPad</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Apple doesn't allow installs outside the App Store without a developer account, so there's
            no APK-equivalent here. UniVerse is already installable as a web app, which gets you a real
            home-screen icon and full-screen use today:
          </p>

          <ul className="mt-4 space-y-2.5">
            {IOS_STEPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--comp-accent)]" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="text-center text-sm text-[var(--text-secondary)]">
          <Link to="/login" className="font-semibold text-[var(--comp-text-primary)] no-underline hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
