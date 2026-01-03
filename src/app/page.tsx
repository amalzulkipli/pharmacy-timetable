'use client';

import Calendar from '../components/Calendar';
import { AuthProvider } from '../context/AuthContext';

export default function Home() {
  return (
    <AuthProvider>
      <Calendar mode="public" />
    </AuthProvider>
  );
}
