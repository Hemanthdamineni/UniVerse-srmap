import { useCallback, useRef } from "react";
import srmLogo from "../../assets/FullSrmlogo.png";

const HIGHLIGHTS = [
  { label: "Secure session-based login", sub: "Credentials verified directly against the university backend." },
  { label: "Captcha protected", sub: "Each login requires a fresh captcha for compliance." },
  { label: "Password recovery available", sub: "Reset via OTP sent to your registered email." },
];

export default function LoginIdentityPanel() {
  const cursorRippleRef = useRef<HTMLDivElement>(null);

  const handleIdentityMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + "%";
    const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + "%";
    if (cursorRippleRef.current) {
      cursorRippleRef.current.style.setProperty("--cx", x);
      cursorRippleRef.current.style.setProperty("--cy", y);
    }
  }, []);

  const handleIdentityMouseLeave = useCallback(() => {
    if (cursorRippleRef.current) {
      cursorRippleRef.current.style.setProperty("--cx", "-200px");
      cursorRippleRef.current.style.setProperty("--cy", "-200px");
    }
  }, []);

  return (
    <div
      className="login-identity-panel"
      onMouseMove={handleIdentityMouseMove}
      onMouseLeave={handleIdentityMouseLeave}
    >
      <div ref={cursorRippleRef} className="login-cursor-ripple" />

      <div className="login-identity-content" style={{ padding: "48px 40px", justifyContent: "space-between" }}>
        <div>
          <div className="login-identity-enter login-id-d0">
            <img src={srmLogo} alt="SRM AP University" style={{ height: "40px", width: "auto", objectFit: "contain", display: "block", filter: "brightness(0) invert(1)", marginBottom: "40px" }} />
          </div>
          <div className="login-identity-enter login-id-d1">
            <h1 style={{ fontSize: "1.7rem", fontWeight: 700, color: "#ffffff", lineHeight: 1.25, margin: 0, letterSpacing: "-0.02em" }}>
              SRM AP<br />University ERP
            </h1>
          </div>
          <div className="login-identity-enter login-id-d2">
            <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "rgba(255,255,255,0.58)", lineHeight: 1.6, maxWidth: "260px" }}>
              Your academic records, attendance, and campus services in one place.
            </p>
          </div>
        </div>

        <div style={{ marginTop: "48px" }}>
          {HIGHLIGHTS.map((item, i) => (
            <div
              key={item.label}
              className={`login-identity-enter login-id-d${i + 2}`}
              style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.09)" }}
            >
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34AEBE", flexShrink: 0, marginTop: "5px", boxShadow: "0 0 8px rgba(52,174,190,0.55)" }} />
              <div>
                <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "rgba(255,255,255,0.88)", lineHeight: 1.3 }}>{item.label}</p>
                <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "rgba(255,255,255,0.42)", lineHeight: 1.5 }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="login-identity-enter login-id-d4" style={{ marginTop: "36px" }}>
          <span style={{ display: "inline-block", padding: "5px 12px", background: "rgba(52,174,190,0.18)", border: "1px solid rgba(52,174,190,0.32)", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 600, color: "#34AEBE", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Student Portal
          </span>
        </div>
      </div>
    </div>
  );
}
