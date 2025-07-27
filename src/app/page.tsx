'use client';

import Calendar from '../components/Calendar'
import AuthWrapper from '../components/AuthWrapper'

export default function Home() {
  return (
    <AuthWrapper>
      <Calendar />
    </AuthWrapper>
  )
}
