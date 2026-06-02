/**
 * app/staff/layout.tsx
 *
 * Simple layout wrapper for the staff section.
 * The page itself handles auth redirects client-side.
 * Add a server-side middleware check if you want extra protection.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Staff Portal — Frankstat",
  description: "Frankstat order management for staff",
  robots:      "noindex, nofollow",  // never index internal pages
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
