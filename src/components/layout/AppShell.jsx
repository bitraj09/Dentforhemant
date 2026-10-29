'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TbDental } from 'react-icons/tb';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import StatusBar from './StatusBar';
import styles from './AppShell.module.css';

/**
 * Enterprise Application Shell
 * Dynamically renders the appropriate shell layout based on the active route:
 * - Auth routes (/login, /signup, /pending-approval): Clean centered layout
 * - Marketing routes (/, /about): Clean public SaaS navigation + footer
 * - Clinical App routes: Enterprise Studio shell (Sidebar + Topbar + Content + StatusBar)
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 */
export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hidden admin access for marketing/auth headers — 5 rapid clicks on logo within 3s
  const clickCount = useRef(0);
  const clickTimer = useRef(null);

  const handleLogoClick = useCallback(
    (e) => {
      clickCount.current += 1;
      if (clickTimer.current) clearTimeout(clickTimer.current);

      if (clickCount.current > 5) {
        e.preventDefault();
        clickCount.current = 0;
        if (session?.user?.role === 'SUPER_ADMIN') {
          router.push('/superadmin');
        } else {
          router.push('/login?super=1');
        }
        return;
      }

      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 3000);
    },
    [router, session]
  );

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('dental-sidebar-collapsed');
      if (saved === 'true') setCollapsed(true);
    } catch {}
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dental-sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/pending-approval';

  const isMarketingRoute = pathname === '/' || pathname === '/about';

  /* ── 1. Auth Route Layout ── */
  if (isAuthRoute) {
    return (
      <div className={styles.authContainer}>
        <header className={styles.authHeader}>
          <Link href="/" className={styles.brandLink} onClick={handleLogoClick}>
            <span className={styles.brandIcon}>
              <TbDental size={22} />
            </span>
            <span className={styles.brandTitle}>Dental AI</span>
          </Link>

          <span className={styles.authProductName}>Dental Studio</span>
        </header>

        <main className={styles.authMain}>{children}</main>
        <StatusBar standalone />
      </div>
    );
  }

  /* ── 2. Marketing Route Layout ── */
  if (isMarketingRoute) {
    return (
      <div className={styles.marketingContainer}>
        <header className={styles.marketingNav}>
          <div className={styles.marketingNavInner}>
            <Link href="/" className={styles.brandLink} onClick={handleLogoClick}>
              <span className={styles.brandIcon}>
                <TbDental size={22} />
              </span>
              <span className={styles.brandTitle}>Dental AI</span>
              <span className={styles.clinicalBadge}>Dental Studio</span>
            </Link>

            <nav className={styles.marketingLinks} aria-label="Marketing navigation">
              <Link
                href="/learning"
                className={`${styles.marketingLink} ${pathname === '/learning' ? styles.active : ''}`}
              >
                Learning
              </Link>
              <Link
                href="/studio"
                className={`${styles.marketingLink} ${pathname === '/studio' ? styles.active : ''}`}
              >
                Explore Studio
              </Link>
              <Link
                href="/about"
                className={`${styles.marketingLink} ${pathname === '/about' ? styles.active : ''}`}
              >
                About Us
              </Link>
            </nav>

            <div className={styles.marketingActions}>
              {mounted && session ? (
                <Link href="/studio" className={styles.openStudioBtn}>
                  <span>Open Studio</span>
                  <ArrowRight size={15} />
                </Link>
              ) : mounted ? (
                <>
                  <Link href="/login" className={styles.signInBtn}>Login</Link>
                  <Link href="/signup" className={styles.openStudioBtn}>Get Started</Link>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className={styles.marketingMain}>{children}</main>

        <footer className={styles.marketingFooter}>
          <div className={styles.marketingFooterInner}>
            <div className={styles.footerBrand}>
              <div className={styles.brandLink}>
                <span className={styles.brandIcon}>
                  <TbDental size={18} />
                </span>
                <span className={styles.brandTitle}>Dental AI</span>
              </div>
              <p className={styles.footerDisclaimer}>
                AI-powered dental imaging, clinical learning, and research in one integrated studio.
              </p>
            </div>

            <div className={styles.footerLinksGroup}>
              <span className={styles.footerGroupTitle}>Clinical Studios</span>
              <Link href="/landmarks" className={styles.footerLink}>Landmark Detection</Link>
              <Link href="/diagnosis" className={styles.footerLink}>Diagnostic Findings</Link>
              <Link href="/compare" className={styles.footerLink}>Radiograph Compare</Link>
              <Link href="/forensics" className={styles.footerLink}>Forensics & Age</Link>
            </div>

            <div className={styles.footerLinksGroup}>
              <span className={styles.footerGroupTitle}>Education & Tools</span>
              <Link href="/learning" className={styles.footerLink}>Tutorials</Link>
              <Link href="/education" className={styles.footerLink}>Interactive Quiz</Link>
              <Link href="/landmark-practice" className={styles.footerLink}>Practice Canvas</Link>
              <Link href="/tooth-chart" className={styles.footerLink}>Tooth Chart</Link>
            </div>

            <div className={styles.footerLinksGroup}>
              <span className={styles.footerGroupTitle}>Compliance & Security</span>
              <div className={styles.complianceNote}>
                <ShieldCheck size={14} className={styles.shieldIcon} />
                <span>HIPAA-Conscious Architecture</span>
              </div>
              <p className={styles.advisoryText}>
                Clinical decision support tool. Verification by qualified clinician mandatory.
              </p>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <span>&copy; {new Date().getFullYear()} Dental AI Dental Studio. All rights reserved.</span>
            <div className={styles.footerBottomLinks}>
              <Link href="/about" className={styles.footerSubLink}>About</Link>
              <Link href="/login" className={styles.footerSubLink}>Clinician Login</Link>
            </div>
          </div>
        </footer>
        <StatusBar standalone />
      </div>
    );
  }

  /* ── 3. Enterprise Clinical App Shell ── */
  return (
    <div className={styles.appShell}>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <Topbar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleMobileMenu={() => setMobileOpen((prev) => !prev)}
      />

      <main
        className={`${styles.appContent} ${collapsed ? styles.sidebarCollapsed : ''}`}
      >
        {children}
      </main>

      <StatusBar collapsed={collapsed} />
    </div>
  );
}
