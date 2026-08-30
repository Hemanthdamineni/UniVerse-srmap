// Header bar uses --comp-accent instead of hardcoded hex for theme parity.
import { Link, useLocation } from "react-router-dom";
import { hasSessionAuth } from "../lib/core/session";
import horizontalLogo from "../assets/Icons/horizontal_logo.png";

function Logo() {
    return (
        <Link to="/" className="inline-flex items-center">
            <img
                src={horizontalLogo}
                alt="Logo of UniVerse — SRMAP Edition"
                className="h-10 w-auto max-w-[45vw] object-contain sm:h-[52px]"
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
                    ? "rounded-lg border border-white px-2.5 py-1.5 text-[13px] font-medium text-white no-underline transition hover:bg-white hover:text-[var(--comp-text-primary)] sm:px-3 sm:text-sm"
                    : "hidden text-[13px] font-medium text-white/90 no-underline transition hover:text-white min-[420px]:inline-block sm:text-sm"
            }
        >
            {label}
        </Link>
    );
}

function Header() {
    const authenticated = hasSessionAuth();
    const { pathname } = useLocation();
    const buttons = authenticated
        ? [
            { label: "Home", to: "/" },
            { label: "Profile", to: "/profile" },
            { label: "Dashboard", to: "/dashboard", primary: true },
        ]
        : [
            { label: "Home", to: "/" },
            // No "Login" pill while already on the login screen.
            ...(pathname === "/login" ? [] : [{ label: "Login", to: "/login", primary: true }]),
        ];

    return (
        <header
            className="flex items-center justify-between gap-2 rounded-b-lg border-b border-[var(--comp-accent)]/30 px-4"
            style={{ backgroundColor: "var(--header-bg)", color: "var(--header-fg)" }}
        >
            <div className="flex min-w-0 items-center">
                <Logo />
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <div className="flex items-center justify-end gap-2 sm:min-w-[220px] sm:gap-4">
                    {buttons.map((button) => (
                        <HeaderButton key={button.label} {...button} />
                    ))}
                </div>
            </div>
        </header>
    );
}

export default Header;
