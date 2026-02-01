'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Calendar from '../components/Calendar';
import { AuthProvider } from '../context/AuthContext';

function HomeContent() {
  const searchParams = useSearchParams();
  const showLogin = searchParams.get('showLogin') === 'true';
  const redirectTo = searchParams.get('from') || '/admin';

  return (
    <Calendar
      mode="public"
      autoOpenLogin={showLogin}
      loginRedirectTo={redirectTo}
    />
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="min-h-screen bg-gray-100" />}>
        <HomeContent />
      </Suspense>
    </AuthProvider>
  );
}
