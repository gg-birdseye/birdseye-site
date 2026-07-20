import Link from "next/link";

export function SiteLogoHeader() {
  return (
    <header className="site-logo-header">
      <Link href="/" className="site-logo-header-link" aria-label="Birdseye home">
        <img
          src="/logo1.svg"
          alt="Birdseye"
          className="site-logo-header-img"
        />
      </Link>
    </header>
  );
}
