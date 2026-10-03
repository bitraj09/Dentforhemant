'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Menu, LogOut, User, ChevronRight, Plus
} from 'lucide-react';
import styles from './Topbar.module.css';

const ROUTE_CRUMBS = {
  '/studio': { section: 'Dental Studio', title: 'Overview' },
  '/ai-assistant': { section: 'Dental Studio', title: 'AI Assistant' },
  '/landmarks': { section: 'Clinical Studio', title: 'Landmark Detection' },
  '/diagnosis': { section: 'Clinical Studio', title: 'Patient Diagnosis' },
  '/compare': { section: 'Clinical Studio', title: 'Radiograph Comparison' },
  '/forensics': { section: 'Clinical Studio', title: 'Forensic Odontology' },
  '/tooth-chart': { section: 'Clinical Studio', title: 'Dental Charting' },
  '/learning': { section: 'Education', title: 'Video Tutorials' },
  '/education': { section: 'Education', title: 'Interactive Quiz' },
  '/landmark-practice': { section: 'Education', title: 'Landmark Practice' },
  '/history': { section: 'Records', title: 'Patient History' },
  '/admin': { section: 'Administration', title: 'User Management' },
  '/superadmin': { section: 'Administration', title: 'System Configuration' },
  '/about': { section: 'Platform', title: 'About DentalAI' },
};

/**
 * Topbar component for enterprise clinical workspace.
 * Provides breadcrumb trail, AI engine indicator, theme toggle, and user actions.
 *
 * @param {object} props
 * @param {boolean} props.collapsed - Whether sidebar is collapsed
 * @param {() => void} props.onToggleMobileMenu - Handler to toggle mobile navigation drawer
 */
export default function Topbar({ collapsed, onToggleMobileMenu, mobileOpen = false }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const routeInfo = ROUTE_CRUMBS[pathname] || {
    section: 'Workspace',
    title: pathname.replace('/', '').replace(/-/g, ' ').toUpperCase() || 'Studio',
  };

  const userName = session?.user?.name?.split(' ')[0] || 'Clinician';
  const userRole = session?.user?.role;

  return (
    <header className={`${styles.topbar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.left}>
        <button
          className={styles.mobileMenuBtn}
          onClick={onToggleMobileMenu}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation"
        >
          <Menu size={20} />
        </button>

        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <span className={styles.crumbSection}>{routeInfo.section}</span>
          <ChevronRight size={14} className={styles.crumbSeparator} />
          <span className={styles.crumbCurrent}>{routeInfo.title}</span>
        </nav>
      </div>

      <div className={styles.right}>
        <Link href="/diagnosis" className={styles.newAnalysisBtn}>
          <Plus size={15} />
          <span>New analysis</span>
        </Link>

        {/* User profile / session */}
        {mounted && session ? (
          <div className={styles.userSection}>
            <div className={styles.userBadge}>
              <span className={styles.userAvatar}>
                <User size={13} />
              </span>
              <span className={styles.userName}>{userName}</span>
              {userRole && userRole !== 'USER' && (
                <span className={styles.roleTag}>
                  {userRole === 'SUPER_ADMIN' ? 'Super' : 'Admin'}
                </span>
              )}
            </div>
            <button
              className={styles.iconBtn}
              onClick={() => signOut()}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : mounted ? (
          <Link href="/login" className={styles.signInBtn}>
            Sign In
          </Link>
        ) : null}
      </div>
    </header>
  );
}
