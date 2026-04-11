'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { getActiveOrgIdClient } from '@/lib/auth/active-org-client';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Phone, Mail,
  User, CalendarDays, AlertCircle,
} from 'lucide-react';
import type { Appointment } from '@/types/database';

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

interface PendingAppointment extends Appointment {
  staff_member?: { id: string; full_name: string } | null;
}

export default function PendingApprovalsPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [appointments, setAppointments] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState({ name: 'User', email: '', avatarUrl: undefined as string | undefined });

  const supabase = createClient();

  const loadPending = useCallback(async () => {
    const res = await fetch(`/api/sites/${siteId}/scheduling/appointments?status=pending`);
    const data = await res.json();
    setAppointments(Array.isArray(data) ? data : []);
  }, [siteId]);

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      const activeOrgId = getActiveOrgIdClient();
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      const profile = (activeOrgId
        ? profiles?.find((p: { organization_id: string }) => p.organization_id === activeOrgId)
        : profiles?.[0]) || profiles?.[0] || null;

      setUserData({
        name: profile?.full_name || user?.user_metadata?.full_name || 'User',
        email: user?.email || '',
        avatarUrl: profile?.avatar_url,
      });

      await loadPending();
      setLoading(false);
    }

    loadData();
  }, [supabase, siteId, loadPending]);

  const handleApprove = async (appointmentId: string) => {
    await fetch(`/api/sites/${siteId}/scheduling/appointments/${appointmentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    loadPending();
  };

  const handleDecline = async (appointmentId: string) => {
    await fetch(`/api/sites/${siteId}/scheduling/appointments/${appointmentId}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    loadPending();
  };

  if (loading) {
    return (
      <div className="flex flex-col">
        <Header title="Pending Approvals" user={userData} />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/3 rounded bg-gray-200" />
            <div className="h-32 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header title="Pending Approvals" user={userData} />

      <div className="space-y-6 p-6">
        <Link
          href={`/dashboard/sites/${siteId}/scheduling`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Calendar
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="mt-1 text-gray-500">
            {appointments.length} booking{appointments.length !== 1 ? 's' : ''} awaiting your review
          </p>
        </div>

        {appointments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="mb-4 h-12 w-12 text-green-300" />
              <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="mt-1 text-sm text-gray-500">
                No pending bookings to review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map(appt => (
              <Card key={appt.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">{appt.customer_name}</h3>
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Pending
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(appt.scheduled_date)}
                        </span>
                        {(appt.time_window_start || appt.scheduled_time) && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {appt.scheduled_time
                              ? formatTime(appt.scheduled_time)
                              : `${formatTime(appt.time_window_start)} - ${formatTime(appt.time_window_end)}`}
                          </span>
                        )}
                        {appt.customer_phone && (
                          <a href={`tel:${appt.customer_phone}`} className="flex items-center gap-1 hover:text-gray-900">
                            <Phone className="h-3.5 w-3.5" />
                            {appt.customer_phone}
                          </a>
                        )}
                        {appt.customer_email && (
                          <a href={`mailto:${appt.customer_email}`} className="flex items-center gap-1 hover:text-gray-900">
                            <Mail className="h-3.5 w-3.5" />
                            {appt.customer_email}
                          </a>
                        )}
                      </div>

                      {appt.service_type && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Service:</span> {appt.service_type}
                        </p>
                      )}
                      {appt.notes && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {appt.notes}
                        </p>
                      )}
                      {(appt.customer_city || appt.customer_zip) && (
                        <p className="text-xs text-gray-400">
                          Location: {[appt.customer_city, appt.customer_zip].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 sm:flex-col">
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(appt.id)}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700 border-red-200"
                        onClick={() => handleDecline(appt.id)}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
