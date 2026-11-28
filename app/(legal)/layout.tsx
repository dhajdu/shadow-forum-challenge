import Link from "next/link";
import s from "./legal.module.css";

// Public pages: /privacy, /terms, /support. Outside the middleware's protected list, so anyone
// (App Review included) can read them without signing in.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={`page ${s.main}`}>
      <nav className={s.nav} aria-label="Legal">
        <Link href="/">Sign in</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
      </nav>
      <div className={s.body}>{children}</div>
    </main>
  );
}
