// Header bar uses --comp-accent instead of hardcoded hex for theme parity.
import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { hasSessionAuth } from "../lib/core/session";
import srmLogo from "../assets/FullSrmlogo.png";

function Logo() {
    return (
        <Link to="/" className="inline-flex items-center">
            <img
                src={srmLogo}
                alt="Logo of UniVerse — SRMAP Edition"
                className="w-[120px] h-[60px] m-[2px]"
            />
        </Link>
    );
}

function HeaderButton(props: { label: string; to: string; primary?: boolean }) {
    const { label, to, primary = false } = props;

    return (
        <Link
            to={to}
            className={
                primary
                    ? "rounded-lg border border-white px-3 py-1.5 text-sm font-medium text-white no-underline transition hover:bg-white hover:text-[var(--comp-text-primary)]"
                    : "text-sm font-medium text-white/90 no-underline transition hover:text-white"
            }
        >
            {label}
        </Link>
    );
}

function Header() {
    const authenticated = hasSessionAuth();
    const buttons = authenticated
        ? [
            { label: "Home", to: "/" },
            { label: "Profile", to: "/profile" },
            { label: "Dashboard", to: "/dashboard", primary: true },
        ]
        : [
            { label: "Home", to: "/" },
            { label: "Login", to: "/login", primary: true },
        ];

    return (
        <header
            className="flex items-center justify-between rounded-b-lg border-b border-[var(--comp-accent)]/30 pr-4"
            style={{ backgroundColor: "var(--header-bg)", color: "var(--header-fg)" }}
        >
            <div className="flex items-center">
                <Logo />
            </div>
            <div className="flex items-center gap-4">
                <div className="flex min-w-[220px] items-center justify-end gap-4">
                    {buttons.map((button) => (
                        <HeaderButton key={button.label} {...button} />
                    ))}
                </div>
                <ThemeToggle />
            </div>
        </header>
    );
}

export default Header;
