import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

/**
 * Analytics must validate the session's account identity against this database.
 * This prevents an ID-only session refresh from attributing one database user to another.
 */
export async function getVerifiedAnalyticsUser() {
  const session = await getServerSession(authOptions);
  const id = Number(session?.user?.id);
  const email = session?.user?.email;

  if (!Number.isSafeInteger(id) || id < 1 || typeof email !== 'string' || !email) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized. Please sign in again.' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { email: true, role: true },
  });

  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Session identity no longer matches this account. Please sign in again.' }, { status: 401 }),
    };
  }

  return { user, error: null };
}

export function requireVerifiedAnalyticsAdmin(user) {
  if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  }
  return null;
}
