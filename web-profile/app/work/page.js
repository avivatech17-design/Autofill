'use client';
import { redirect } from 'next/navigation';

export default function WorkRedirect() {
  redirect('/?tab=work');
}
