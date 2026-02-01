'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/admin';

  useEffect(() => {
    // Redirect to home with showLogin param - the Calendar component will open the modal
    router.replace(`/?showLogin=true&from=${encodeURIComponent(from)}`);
  }, [router, from]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="text-white">Redirecting...</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginRedirect />
    </Suspense>
  );
}
