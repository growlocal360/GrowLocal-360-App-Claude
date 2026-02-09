'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Inbox, Phone, Mail, Clock } from 'lucide-react';
import type { Lead, LeadStatus } from '@/types/database';

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-green-100 text-green-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-800' },
  { value: 'converted', label: 'Converted', color: 'bg-purple-100 text-purple-800' },
  { value: 'archived', label: 'Archived', color: 'bg-gray-100 text-gray-700' },
];

export default function LeadsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all');
  const [userData, setUserData] = useState({
    name: 'User',
    email: '',
    avatarUrl: undefined as string | undefined,
  });

  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      const { data: leadsData } = await supabase
        .from('leads')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false });

      setLeads((leadsData || []) as Lead[]);
      setLoading(false);
    }

    loadData();
  }, [supabase, siteId]);

  const updateLeadStatus = async (leadId: string, newStatus: LeadStatus) => {
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);

    if (!error) {
      setLeads((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );
    }
  };

  const filteredLeads = filterStatus === 'all'
    ? leads
    : leads.filter((lead) => lead.status === filterStatus);

  const newCount = leads.filter((l) => l.status === 'new').length;

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Leads" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200"></div>
            <div className="h-32 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Leads" user={userData} />

      <div className="space-y-6 p-6">
        {/* Back Link */}
        <Link
          href={`/dashboard/sites/${siteId}`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Site Dashboard
        </Link>

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            <p className="mt-1 text-gray-500">
              {leads.length} total lead{leads.length !== 1 ? 's' : ''}
              {newCount > 0 && ` (${newCount} new)`}
            </p>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
          >
            All ({leads.length})
          </Button>
          {STATUS_OPTIONS.map((opt) => {
            const count = leads.filter((l) => l.status === opt.value).length;
            return (
              <Button
                key={opt.value}
                variant={filterStatus === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus(opt.value)}
              >
                {opt.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Leads List */}
        {filteredLeads.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Inbox className="mb-4 h-12 w-12 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900">No leads yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Leads from your website forms will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => {
              const statusOpt = STATUS_OPTIONS.find((s) => s.value === lead.status) || STATUS_OPTIONS[0];
              return (
                <Card key={lead.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Lead Info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{lead.name}</h3>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusOpt.color}`}>
                            {statusOpt.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-gray-900">
                              <Phone className="h-3.5 w-3.5" />
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-gray-900">
                              <Mail className="h-3.5 w-3.5" />
                              {lead.email}
                            </a>
                          )}
                          <span className="flex items-center gap-1 text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(lead.created_at).toLocaleDateString()}{' '}
                            {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {lead.service_type && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Service:</span> {lead.service_type}
                          </p>
                        )}

                        {lead.message && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Message:</span> {lead.message}
                          </p>
                        )}

                        {lead.source_page && (
                          <p className="text-xs text-gray-400">
                            From: {lead.source_page}
                          </p>
                        )}
                      </div>

                      {/* Status Update */}
                      <div className="shrink-0">
                        <select
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value as LeadStatus)}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
