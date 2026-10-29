'use client';
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiXCircle, FiRefreshCw, FiLogOut } from 'react-icons/fi';
import { useSession, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function PendingApprovalContent() {
    const { data: session, update } = useSession();
    const searchParams = useSearchParams();
    const userId = session?.user?.id;
    const isRejected = searchParams.get('status') === 'rejected';
    const isApproved = session?.user?.status === 'APPROVED';
    const [reapplying, setReapplying] = useState(false);
    const [reapplied, setReapplied] = useState(false);
    const [checkingApproval, setCheckingApproval] = useState(false);

    const refreshApproval = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await fetch('/api/account/status', { cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            if (data.status === 'APPROVED') {
                await update();
                window.location.replace('/studio');
            }
        } catch (error) {
            console.error('Could not refresh approval status:', error);
        }
    }, [update, userId]);

    useEffect(() => {
        if (!userId) return undefined;

        refreshApproval();
        const intervalId = window.setInterval(refreshApproval, 10_000);
        window.addEventListener('focus', refreshApproval);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', refreshApproval);
        };
    }, [refreshApproval, userId]);

    useEffect(() => {
        if (isApproved) window.location.replace('/studio');
    }, [isApproved]);

    const checkApproval = async () => {
        setCheckingApproval(true);
        await refreshApproval();
        setCheckingApproval(false);
    };

    const handleReapply = async () => {
        setReapplying(true);
        try {
            const res = await fetch('/api/reapply', { method: 'POST' });
            if (res.ok) {
                setReapplied(true);
            }
        } catch (err) {
            console.error('Reapply failed:', err);
        } finally {
            setReapplying(false);
        }
    };

    return (
        <div className={styles.page}>
            <motion.div
                className={styles.card}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 100, damping: 20 }}
            >
                {isRejected ? (
                    <>
                        <motion.div
                            className={styles.iconWrapperRejected}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                        >
                            <FiXCircle size={48} />
                        </motion.div>

                        <h1 className={styles.title}>Registration Rejected</h1>
                        <p className={styles.subtitle}>
                            Unfortunately, your registration was not approved by the admin.
                            This may be due to an invalid college ID or incomplete information.
                        </p>

                        {!reapplied ? (
                            <div className={styles.actions}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleReapply}
                                    disabled={reapplying}
                                >
                                    <FiRefreshCw size={16} className={reapplying ? styles.spinning : ''} />
                                    {reapplying ? 'Submitting...' : 'Re-apply for Approval'}
                                </button>
                                <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>
                                    <FiLogOut size={16} /> Sign Out
                                </button>
                            </div>
                        ) : (
                            <motion.div
                                className={styles.successMessage}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <p>✅ Your re-application has been submitted! The admin will review it again.</p>
                                <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })} style={{ marginTop: 12 }}>
                                    <FiLogOut size={16} /> Sign Out
                                </button>
                            </motion.div>
                        )}
                    </>
                ) : (
                    <>
                        <motion.div
                            className={styles.iconWrapper}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring' }}
                        >
                            <FiClock size={48} />
                        </motion.div>

                        <h1 className={styles.title}>{isApproved ? 'Access Granted' : 'Awaiting Approval'}</h1>
                        <p className={styles.subtitle}>
                            {isApproved
                                ? 'Your account is approved. Opening the Dental AI Studio…'
                                : <>Your registration is being reviewed by the admin. You&apos;ll be able to access all features once approved.</>}
                        </p>

                        {session?.user && (
                            <div className={styles.userInfo}>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoLabel}>Name</span>
                                    <span className={styles.infoValue}>{session.user.name}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoLabel}>Email</span>
                                    <span className={styles.infoValue}>{session.user.email}</span>
                                </div>
                                <div className={styles.infoRow}>
                                    <span className={styles.infoLabel}>Status</span>
                                    <span className={styles.statusBadge}>
                                        {session.user.status === 'APPROVED' ? 'Approved' : 'Pending Review'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={styles.timeline}>
                            <div className={`${styles.timelineStep} ${styles.completed}`}>
                                <div className={styles.timelineDot} />
                                <span>Account Created</span>
                            </div>
                            <div className={`${styles.timelineStep} ${styles.active}`}>
                                <div className={styles.timelineDot} />
                                <span>{isApproved ? 'Review Complete' : 'Admin Review'}</span>
                            </div>
                            <div className={`${styles.timelineStep} ${isApproved ? styles.completed : ''}`}>
                                <div className={styles.timelineDot} />
                                <span>Access Granted</span>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button className="btn btn-primary" onClick={checkApproval} disabled={checkingApproval}>
                                <FiRefreshCw size={16} className={checkingApproval ? styles.spinning : ''} />
                                {isApproved ? 'Opening studio...' : checkingApproval ? 'Checking...' : 'Check approval'}
                            </button>
                            <button className="btn btn-ghost" onClick={() => signOut({ callbackUrl: '/' })}>
                                <FiLogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
