'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronsUpDown, Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserRole } from '@/types/database';

export interface OrgOption {
  orgId: string;
  orgName: string;
  role: UserRole;
}

interface OrgSwitcherProps {
  orgs: OrgOption[];
  activeOrgId: string;
}

export function OrgSwitcher({ orgs, activeOrgId }: OrgSwitcherProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // Don't show switcher for single-org users
  if (orgs.length <= 1) return null;

  const activeOrg = orgs.find(o => o.orgId === activeOrgId) || orgs[0];

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrgId) return;
    setSwitching(true);

    try {
      const res = await fetch('/api/auth/switch-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to switch org:', error);
    } finally {
      setSwitching(false);
    }
  }

  const roleBadgeColor = (role: UserRole) => {
    if (role === 'owner') return 'bg-purple-100 text-purple-700';
    if (role === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50',
          switching && 'opacity-50 pointer-events-none'
        )}
        disabled={switching}
      >
        <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 truncate font-medium text-gray-900">
          {activeOrg.orgName}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        {orgs.map((org) => (
          <DropdownMenuItem
            key={org.orgId}
            onClick={() => handleSwitch(org.orgId)}
            className="flex items-center gap-2"
          >
            {org.orgId === activeOrgId && (
              <Check className="h-4 w-4 shrink-0 text-[#00ef99]" />
            )}
            {org.orgId !== activeOrgId && (
              <span className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 truncate">{org.orgName}</span>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0', roleBadgeColor(org.role))}
            >
              {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
