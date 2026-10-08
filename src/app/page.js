import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, BookOpen, BrainCircuit, ChartNoAxesCombined, GraduationCap,
  ScanLine, ShieldCheck, Stethoscope,
} from 'lucide-react';
import styles from './page.module.css';

const capabilities = [
  { icon: ScanLine, title: 'AI analysis', text: 'Review radiographs with clear findings and visual context.' },
  { icon: GraduationCap, title: 'Clinical learning', text: 'Build interpretation skills with guided lessons and practice.' },
  { icon: ChartNoAxesCombined, title: 'Research & education', text: 'Explore anatomy, landmarks, and forensic applications.' },
  { icon: BrainCircuit, title: 'AI assistance', text: 'Bring image intelligence into a focused dental workflow.' },
];

const destinations = [
  { icon: Stethoscope, title: 'Dental Studio', text: 'Move from image upload to a structured review across diagnostic and anatomical tools.', href: '/studio', action: 'Explore the studio' },
  { icon: BookOpen, title: 'Learning', text: 'Use tutorials, quizzes, and landmark practice to reinforce radiographic interpretation.', href: '/learning', action: 'Browse learning' },
  { icon: BrainCircuit, title: 'AI assistant', text: 'Ask focused questions about dental anatomy, common pathologies, radiographs, and study material.', href: '/ai-assistant', action: 'Meet the assistant' },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}><span className={styles.kickerMark} /> Dental imaging, made more useful</span>
            <h1>AI-Powered Dental Intelligence, <span>in one Studio.</span></h1>
            <p>Analyze dental radiographs, review pathologies, explore anatomical landmarks, and learn with AI — all in one integrated Dental Studio.</p>
            <div className={styles.heroActions}>
              <Link href="/studio" className={styles.primaryButton}>Explore Dental Studio <ArrowRight size={16} /></Link>
              <Link href="/learning" className={styles.secondaryButton}>Start Learning</Link>
            </div>
            <div className={styles.trustLine}><ShieldCheck size={15} /> Built for dental students, clinicians, and researchers</div>
          </div>

          <div className={styles.viewer} aria-label="Panoramic dental radiograph example with sample annotations">
            <div className={styles.viewerHeader}><span><span className={styles.viewerDot} /> Sample OPG view</span><span>Panoramic radiograph</span></div>
            <div className={styles.xrayFrame}>
              <Image src="/samples/ce76f196d49069dba67520e91241663719417d5d7ccfa38e72c87f1ca351558d_big_gallery.png" alt="Example panoramic dental radiograph" fill priority sizes="(max-width: 900px) 100vw, 52vw" className={styles.xrayImage} />
              <span className={`${styles.annotation} ${styles.annotationOne}`}><i /> Landmark</span>
              <span className={`${styles.annotation} ${styles.annotationTwo}`}><i /> Bone level</span>
              <span className={`${styles.annotation} ${styles.annotationThree}`}><i /> Tooth region</span>
              <span className={styles.imageCaption}>Illustrative image · findings require professional review</span>
            </div>
            <div className={styles.viewerFooter}><span><span className={styles.legendDot} /> Anatomy reference</span><span>Sample image</span></div>
          </div>
        </div>
      </section>

      <section className={styles.capabilitySection} aria-label="Platform capabilities">
        <div className={styles.capabilityGrid}>
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article className={styles.capability} key={title}>
              <span className={styles.capabilityIcon}><Icon size={18} /></span>
              <div><h2>{title}</h2><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.platformSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionEyebrow}>One connected platform</span>
          <h2>From clinical review to confident learning.</h2>
          <p>Purpose-built tools bring imaging, education, and research together in a calm, practical workspace.</p>
        </div>
        <div className={styles.destinationGrid}>
          {destinations.map(({ icon: Icon, title, text, href, action }) => (
            <article className={styles.destination} key={title}>
              <span className={styles.destinationIcon}><Icon size={20} /></span>
              <h3>{title}</h3><p>{text}</p>
              <Link href={href}>{action}<ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.whySection}>
        <div className={styles.whyIntro}><span className={styles.sectionEyebrow}>Why Dental AI</span><h2>Designed for focused dental work.</h2></div>
        <div className={styles.whyPoints}>
          <p><strong>Clear review.</strong> Keep scans, findings, and supporting context together.</p>
          <p><strong>Useful learning.</strong> Move from reference material to active practice.</p>
          <p><strong>Human-led decisions.</strong> AI supports review; qualified professionals remain responsible for clinical decisions.</p>
        </div>
      </section>
    </div>
  );
}
