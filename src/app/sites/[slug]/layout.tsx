import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: '',
    template: '%s',
  },
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
