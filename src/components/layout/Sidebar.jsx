'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Home, Info, MessageSquareText, MapPin, Stethoscope, GitCompare, Skull,
  GraduationCap, BookOpen, Target, Grid3x3,
  Clock, Settings, ShieldCheck, ChevronLeft,
  LogOut, User,
} from 'lucide-react';
import { TbDental } from 'react-icons/tb';
import styles from './Sidebar.module.css';

/* ═══════════════════════════════════════════════════════════
   NAV CONFIG — grouped by section
   ═══════════════════════════════════════════════════════════ */
const NAV_SECTIONS = [
  {
    id: 'home',
    label: 'Workspace',
    items: [{ href: '/studio', label: 'Overview', icon: Home }],
  },
  {
    id: 'studio',
    label: 'Dental Studio',
    items: [
      { href: '/landmarks',   label: 'Landmarks',  icon: MapPin,       featureKey: 'Landmarks' },
      { href: '/diagnosis',   label: 'Diagnosis',   icon: Stethoscope,  featureKey: 'Diagnosis' },
      { href: '/compare',     label: 'Compare',     icon: GitCompare,   featureKey: 'Comparison' },
      { href: '/forensics',   label: 'Forensics',   icon: Skull,        featureKey: 'Forensics' },
      { href: '/tooth-chart', label: 'Tooth Chart',  icon: Grid3x3 },
    ],
  },
  {
    id: 'assistant',
    label: 'Assistant',
    items: [{ href: '/ai-assistant', label: 'AI Assistant', icon: MessageSquareText }],
  },
  {
    id: 'learn',
    label: 'Learning',
    items: [
      { href: '/learning',          label: 'Learning Hub',  icon: BookOpen },
      { href: '/education',         label: 'Quiz',       icon: GraduationCap, featureKey: 'Education' },
      { href: '/landmark-practice', label: 'Practice',   icon: Target },
    ],
  },
  {
    id: 'records',
    label: 'Records',
    items: [
      { href: '/history', label: 'History', icon: Clock },
    ],
  },
];

const ADMIN_ITEMS = [
  { href: '/admin',      label: 'Admin Panel', icon: Settings,     role: 'ADMIN' },
  { href: '/superadmin', label: 'Super Admin', icon: ShieldCheck,  role: 'SUPER_ADMIN' },
];

export default function Sidebar({
  collapsed: controlledCollapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [features, setFeatures] = useState(null);

  const isControlled = controlledCollapsed !== undefined;
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  // ── Hidden superadmin access: 5+ clicks on brand within 3s ──
  const clickCount = useRef(0);
  const clickTimer = useRef(null);

  const handleBrandClick = useCallback((e) => {
    clickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);

    if (clickCount.current >= 5) {
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
  }, [router, session]);

  useEffect(() => {
    setMounted(true);
    fetch('/api/config/features')
      .then(res => res.json())
      .then(data => setFeatures(data))
      .catch(() => {});
  }, []);

  // Read collapsed preference from localStorage if uncontrolled
  useEffect(() => {
    if (!isControlled) {
      try {
        const saved = localStorage.getItem('dental-sidebar-collapsed');
        if (saved === 'true') setInternalCollapsed(true);
      } catch {}
    }
  }, [isControlled]);

  const toggleCollapsed = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('dental-sidebar-collapsed', String(next)); } catch {}
        return next;
      });
    }
  };

  // Filter items by feature flags
  const isItemAllowed = (item) => {
    if (!features || !item.featureKey) return true;
    return features[item.featureKey] !== false;
  };

  // Build admin items based on role
  const adminItems = ADMIN_ITEMS.filter(item => {
    const role = session?.user?.role;
    if (item.role === 'ADMIN') return role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (item.role === 'SUPER_ADMIN') return role === 'SUPER_ADMIN';
    return false;
  });

  const userName = session?.user?.name?.split(' ')[0] || 'User';

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
        />
      )}
      <aside id="primary-navigation" aria-label="Primary navigation" className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      {/* ── Brand ── */}
      <div className={styles.brand}>
        <Link href="/" className={styles.brandLink} onClick={handleBrandClick}>
          <span className={styles.brandIcon}>
            <TbDental size={20} />
          </span>
          {!collapsed && <span className={styles.brandText}>Dental AI</span>}
        </Link>
        <button
          className={styles.collapseBtn}
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* ── Navigation ── */}
      <nav className={styles.nav}>
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(isItemAllowed);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.id} className={styles.section}>
              {!collapsed && (
                <span className={styles.sectionLabel}>{section.label}</span>
              )}
              <ul className={styles.list}>
                {visibleItems.map(item => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onCloseMobile}
                        className={`${styles.link} ${isActive ? styles.active : ''}`}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon size={18} strokeWidth={1.8} />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {/* Admin section */}
        {mounted && adminItems.length > 0 && (
          <div className={styles.section}>
            {!collapsed && (
              <span className={styles.sectionLabel}>Administration</span>
            )}
            <ul className={styles.list}>
              {adminItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onCloseMobile}
                      className={`${styles.link} ${isActive ? styles.active : ''}`}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      <div className={styles.section}>
        {!collapsed && <span className={styles.sectionLabel}>Platform</span>}
        <ul className={styles.list}>
          <li>
            <Link
              href="/about"
              onClick={onCloseMobile}
              className={`${styles.link} ${pathname === '/about' ? styles.active : ''}`}
              title={collapsed ? 'About Us' : undefined}
            >
              <Info size={18} strokeWidth={1.8} />
              {!collapsed && <span>About Us</span>}
            </Link>
          </li>
        </ul>
      </div>

      {/* ── User footer ── */}
      {mounted && session && (
        <div className={styles.userFooter}>
          <div className={styles.userInfo} title={session.user.name || 'User'}>
            <span className={styles.userAvatar}>
              <User size={14} />
            </span>
            {!collapsed && (
              <span className={styles.userName}>{userName}</span>
            )}
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => signOut()}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}

      {mounted && !session && (
        <div className={styles.userFooter}>
          <Link
            href="/login"
            onClick={onCloseMobile}
            className={styles.signInLink}
          >
            <User size={16} />
            {!collapsed && <span>Sign In</span>}
          </Link>
        </div>
      )}
    </aside>
    </>
  );
}
