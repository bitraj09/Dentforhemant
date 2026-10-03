import Link from 'next/link';
import { ArrowRight, BookOpen, BrainCircuit, ScanLine, ShieldCheck, Stethoscope } from 'lucide-react';
import styles from './page.module.css';

const principles = [
  { icon: ScanLine, title: 'Imaging tools', text: 'Radiograph review, pathology screening, landmark exploration, and scan comparison.' },
  { icon: BookOpen, title: 'Dental learning', text: 'Lessons, quizzes, and practice activities built around dental imaging and anatomy.' },
  { icon: BrainCircuit, title: 'AI support', text: 'AI-assisted analysis helps organize observations for review and education.' },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>About DENTEX</span>
        <h1>Dental intelligence for learning, imaging, and research.</h1>
        <p>DENTEX Dental Studio brings dental radiograph tools and educational resources together in one focused workspace for students, clinicians, and researchers.</p>
        <Link href="/studio" className={styles.action}>Explore the studio <ArrowRight size={16} /></Link>
      </section>

      <section className={styles.principles} aria-label="What DENTEX brings together">
        {principles.map(({ icon: Icon, title, text }) => (
          <article className={styles.principle} key={title}>
            <span className={styles.icon}><Icon size={20} /></span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className={styles.founders} aria-labelledby="founders-heading">
        <div>
          <span className={styles.eyebrow}>The people behind DENTEX</span>
          <h2 id="founders-heading">Our founders</h2>
        </div>
        <ul className={styles.founderList}>
          <li>Raj Chavan</li>
          <li>Hemant Singh</li>
        </ul>
      </section>

      <section className={styles.approach}>
        <div><span className={styles.eyebrow}>Our approach</span><h2>Useful context, clear workflows, human judgment.</h2></div>
        <div className={styles.approachCopy}>
          <p>Dental imaging is information-rich. DENTEX helps users explore a scan, inspect findings, and connect image review with structured learning.</p>
          <p>AI-generated observations are decision-support aids. They may be incomplete or inaccurate and do not replace professional interpretation, diagnosis, or treatment planning.</p>
        </div>
      </section>

      <section className={styles.ctaPanel}>
        <span className={styles.icon}><Stethoscope size={20} /></span>
        <div><h2>Explore the Dental Studio</h2><p>Open the workspace or browse guided learning resources.</p></div>
        <div className={styles.ctaLinks}><Link href="/diagnosis">Clinical tools <ArrowRight size={14} /></Link><Link href="/learning">Learning hub <ArrowRight size={14} /></Link></div>
        <ShieldCheck className={styles.ctaMark} size={72} aria-hidden="true" />
      </section>
    </div>
  );
}
