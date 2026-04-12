import { Link } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { hasSessionAuth } from "../lib/session";

function Logo() {
    return (
        <Link to="/" className="inline-flex items-center">
            <img
                src="src/assets/FullSrmLogo.png"
                alt="Logo of SRM University Ap"
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
                    ? "rounded-lg border border-white px-3 py-1.5 text-sm font-medium text-white no-underline transition hover:bg-white hover:text-[#0A3035]"
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
            { label: "Reset Password", to: "/forgot-password" },
            { label: "Login", to: "/login", primary: true },
        ];

    return (
        <header className="bg-primary flex items-center pr-4 justify-between rounded-b-lg" style={{ backgroundColor: "#0A3035" }}>
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
