'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  LayoutDashboard,
  Globe,
  Plus,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import type { UserRole } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { OrgSwitcher, type OrgOption } from '@/components/layout/org-switcher';

interface SidebarProps {
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  role?: UserRole;
  orgs?: OrgOption[];
  activeOrgId?: string;
}

const mainNavItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Sites',
    href: '/dashboard/sites',
    icon: Globe,
  },
  {
    title: 'Job Snaps',
    href: '/dashboard/job-snaps',
    icon: Briefcase,
  },
  {
    title: 'Team',
    href: '/dashboard/team',
    icon: Users,
  },
];

const shortcutItems = [
  {
    title: 'New Site',
    href: '/dashboard/sites/new',
    icon: Plus,
  },
];

export function Sidebar({ user, role, orgs, activeOrgId }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────── */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b bg-white px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="ml-3">
          <Image
            src="/grow-local-360-logo-black.svg"
            alt="GrowLocal360"
            width={130}
            height={22}
            priority
          />
        </div>
      </div>

      {/* ── Backdrop (mobile only) ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar panel ──────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r bg-white transition-transform duration-200',
          'md:relative md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button (mobile only) */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 md:hidden"
        >
          <X className="h-5 w-5" />
        </Button>

      {/* Logo */}
      <div className="flex h-16 items-center px-6">
        <Image
          src="/grow-local-360-logo-black.svg"
          alt="GrowLocal360"
          width={150}
          height={26}
          priority
        />
      </div>

      {/* Org Switcher */}
      {orgs && orgs.length > 1 && activeOrgId && (
        <div className="px-3 pb-2">
          <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
          Main Menu
        </p>
        {mainNavItems
          .filter((item) => {
            // Hide Team link for 'user' role
            if (item.href === '/dashboard/team' && role === 'user') return false;
            return true;
          })
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#00ef99]/10 text-black'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}

        <Separator className="my-4" />

        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-gray-400">
          Shortcuts
        </p>
        {shortcutItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <item.icon className="h-5 w-5" />
            {item.title}
          </Link>
        ))}
      </nav>

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatarUrl} alt={user?.name} />
            <AvatarFallback className="bg-amber-100 text-amber-600">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || 'User'}
              </p>
              {role && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] px-1.5 py-0',
                    role === 'owner' && 'bg-purple-100 text-purple-700',
                    role === 'admin' && 'bg-blue-100 text-blue-700'
                  )}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-gray-500">
              {user?.email || 'user@example.com'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" asChild>
            <Link href="/dashboard/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </Button>
          <form action="/api/auth/signout" method="POST">
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
    </>
  );
}
