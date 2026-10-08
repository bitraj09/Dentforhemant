'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Activity, ArrowRight, BookOpen, CalendarDays, FileSearch, GitCompare,
  GraduationCap, MapPin, ScanLine, Skull, Stethoscope, TriangleAlert,
} from 'lucide-react';
import styles from './page.module.css';

const tools = [
  { href: '/diagnosis', title: 'OPG analysis', description: 'Review radiographs and organize findings.', icon: Stethoscope },
  { href: '/landmarks', title: 'Landmarks', description: 'Explore anatomical landmarks on a scan.', icon: MapPin },
  { href: '/compare', title: 'Compare scans', description: 'Review two radiographs side by side.', icon: GitCompare },
  { href: '/forensics', title: 'Forensic analysis', description: 'Explore dental age assessment tools.', icon: Skull },
  { href: '/tooth-chart', title: 'Tooth chart', description: 'Explore the interactive 3D tooth chart.', icon: Activity },
];

function formatDate(value) {
  if (!value) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function StudioOverviewPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/records', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load recent examinations.');
        if (active) {
          setRecords(Array.isArray(data.records) ? data.records : []);
          setLoadState('ready');
        }
      })
      .catch(() => { if (active) setLoadState('error'); });
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => [
    { label: 'Saved examinations', value: records.length, icon: ScanLine },
    { label: 'Diagnosis reviews', value: records.filter((record) => record.type === 'Diagnosis').length, icon: Stethoscope },
    { label: 'Landmark studies', value: records.filter((record) => record.type === 'Landmarks').length, icon: MapPin },
    { label: 'Forensic cases', value: records.filter((record) => record.type === 'Forensics').length, icon: FileSearch },
  ], [records]);

  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const greeting = new Intl.DateTimeFormat(undefined, { hour: 'numeric', hour12: false }).format(new Date());
  const hour = Number(greeting.split(':')[0]);
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Dental AI Dental Studio</p>
          <h1>{timeGreeting}{firstName ? `, ${firstName}` : ''}.</h1>
          <p className={styles.intro}>Analyze, learn, and explore with your dental workspace.</p>
        </div>
        <Link className={styles.primaryAction} href="/diagnosis"><ScanLine size={17} /> Start an analysis</Link>
      </header>

      <section className={styles.metrics} aria-label="Your workspace activity">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article className={styles.metricCard} key={label}>
            <span className={styles.metricIcon}><Icon size={18} /></span>
            <div><p>{label}</p><strong>{loadState === 'loading' ? '—' : value}</strong></div>
          </article>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="tools-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="tools-title">Clinical tools</h2><p>Choose a workspace to continue.</p></div>
        </div>
        <div className={styles.toolGrid}>
          {tools.map(({ href, title, description, icon: Icon }) => (
            <Link href={href} className={styles.toolCard} key={href}>
              <span className={styles.toolIcon}><Icon size={19} /></span>
              <span className={styles.toolText}><strong>{title}</strong><span>{description}</span></span>
              <ArrowRight className={styles.toolArrow} size={16} />
            </Link>
          ))}
        </div>
      </section>

      <div className={styles.lowerGrid}>
        <section className={styles.section} aria-labelledby="recent-title">
          <div className={styles.sectionHeading}>
            <div><h2 id="recent-title">Recent examinations</h2><p>Your latest saved work.</p></div>
            <Link className={styles.textLink} href="/history">View history <ArrowRight size={14} /></Link>
          </div>
          <div className={styles.recentPanel}>
            {loadState === 'loading' && <p className={styles.stateMessage}>Loading your examinations…</p>}
            {loadState === 'error' && <p className={styles.stateMessage}><TriangleAlert size={16} /> Recent examinations could not be loaded. <Link href="/history">Open history</Link></p>}
            {loadState === 'ready' && records.length === 0 && <p className={styles.stateMessage}>No saved examinations yet. Your work will appear here after you save an analysis.</p>}
            {loadState === 'ready' && records.slice(0, 4).map((record) => (
              <div className={styles.recordRow} key={record.id}>
                <span className={styles.recordIcon}><FileSearch size={16} /></span>
                <div className={styles.recordInfo}>
                  <strong>{record.patientName || 'Untitled case'}</strong>
                  <span>{record.type || 'Examination'} · {formatDate(record.createdAt)}</span>
                </div>
                <span className={styles.findingCount}>{Array.isArray(record.findings) ? record.findings.length : '—'} findings</span>
              </div>
            ))}
          </div>
        </section>

        <aside className={styles.learningCard}>
          <span className={styles.learningIcon}><GraduationCap size={20} /></span>
          <p className={styles.eyebrow}>Keep learning</p>
          <h2>Build confidence with guided study.</h2>
          <p>Continue with radiographic interpretation, dental anatomy, and landmark practice.</p>
          <Link className={styles.textLink} href="/learning">Explore learning <ArrowRight size={14} /></Link>
          <BookOpen className={styles.bookMark} size={72} aria-hidden="true" />
        </aside>
      </div>

      <p className={styles.disclaimer}><CalendarDays size={14} /> AI results support review and education and should be interpreted by a qualified dental professional.</p>
    </div>
  );
}
