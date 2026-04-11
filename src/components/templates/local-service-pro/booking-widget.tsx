'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Clock, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicRenderServiceListing } from '@/lib/sites/public-render-model';

interface SlotInfo {
  startTime: string;
  endTime: string;
  spotsAvailable: number;
  type: 'slot' | 'window';
}

interface DayAvailability {
  date: string;
  spotsRemaining: number;
  isBlocked: boolean;
  slots: SlotInfo[];
}

interface BookingWidgetProps {
  siteId: string;
  brandColor?: string;
  services?: PublicRenderServiceListing[];
  ctaStyle?: 'booking' | 'estimate';
}

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export function BookingWidget({ siteId, brandColor = '#00ef99', services, ctaStyle = 'booking' }: BookingWidgetProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ status: string; message: string } | null>(null);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  const [formData, setFormData] = useState({
    service_type: '',
    customer_city: '',
    customer_zip: '',
    message: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
  });

  const isBookingMode = ctaStyle === 'booking';
  const ctaText = isBookingMode ? 'Schedule Service' : 'Request Free Estimate';
  const headingText = isBookingMode ? 'Book Your Appointment' : 'Request a Free Estimate';

  // Load availability when entering step 2
  useEffect(() => {
    if (step !== 2) return;

    async function loadAvailability() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        siteId,
        date: today,
        days: '14',
      });
      if (formData.customer_zip) params.set('zip', formData.customer_zip);
      if (formData.customer_city) params.set('city', formData.customer_city);

      try {
        const res = await fetch(`/api/public/availability?${params}`);
        const data = await res.json();

        if (data.active && data.range) {
          setAvailability(data.range);
        } else {
          setAvailability([]);
        }
      } catch {
        setAvailability([]);
      }
      setLoading(false);
    }

    loadAvailability();
  }, [step, siteId, formData.customer_zip, formData.customer_city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone,
          customer_city: formData.customer_city || null,
          customer_zip: formData.customer_zip || null,
          service_type: formData.service_type || null,
          notes: formData.message || null,
          scheduled_date: selectedDate,
          time_window_start: selectedSlot?.startTime || null,
          time_window_end: selectedSlot?.endTime || null,
          scheduled_time: selectedSlot?.type === 'slot' ? selectedSlot.startTime : null,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/contact',
        }),
      });
      const result = await res.json();
      setBookingResult({ status: result.status, message: result.message });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
      setBookingResult({
        status: 'submitted',
        message: 'Your request has been received. We\'ll be in touch shortly!',
      });
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <section id="booking" className="py-24">
        <div className="mx-auto max-w-xl px-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 mb-4" style={{ color: brandColor }} />
          <h2 className="text-2xl font-bold text-gray-900">
            {bookingResult?.status === 'confirmed' ? 'Appointment Confirmed!' : 'Booking Request Received!'}
          </h2>
          <p className="mt-4 text-gray-600">{bookingResult?.message}</p>
          {selectedDate && (
            <p className="mt-2 font-medium text-gray-800">
              {formatDateDisplay(selectedDate)}
              {selectedSlot && ` at ${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section id="booking" className="py-24">
      <div className="mx-auto max-w-xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {headingText}
          </h2>
          <p className="mt-2 text-gray-600">
            {isBookingMode
              ? 'Select a date and time that works for you.'
              : 'Tell us about your project and we\'ll provide a free estimate.'}
          </p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Step {step} of {isBookingMode ? 4 : 3}</span>
            <span className="font-medium" style={{ color: brandColor }}>
              {step === 1 && 'Service Details'}
              {step === 2 && isBookingMode && 'Select Date'}
              {step === (isBookingMode ? 3 : 2) && isBookingMode && 'Select Time'}
              {step === (isBookingMode ? 4 : 3) && 'Your Info'}
              {!isBookingMode && step === 2 && 'Your Info'}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(step / (isBookingMode ? 4 : 3)) * 100}%`,
                backgroundColor: brandColor,
              }}
            />
          </div>
        </div>

        {/* Step 1: Service + Location */}
        {step === 1 && (
          <div className="space-y-4">
            {services && services.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Service Needed</label>
                <select
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                  value={formData.service_type}
                  onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                >
                  <option value="">Select a service...</option>
                  {services.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                <input
                  type="text"
                  placeholder="Your city"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                  value={formData.customer_city}
                  onChange={e => setFormData(prev => ({ ...prev, customer_city: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">ZIP Code</label>
                <input
                  type="text"
                  placeholder="12345"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                  value={formData.customer_zip}
                  onChange={e => setFormData(prev => ({ ...prev, customer_zip: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {isBookingMode ? 'Additional Details' : 'Project Description'}
              </label>
              <textarea
                rows={3}
                placeholder={isBookingMode ? 'Describe what you need help with...' : 'Tell us about your project...'}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.message}
                onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <Button
              type="button"
              className="w-full rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: brandColor }}
              onClick={() => setStep(isBookingMode ? 2 : 3)}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Select Date (booking mode only) */}
        {step === 2 && isBookingMode && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading availability...</span>
              </div>
            ) : availability.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarDays className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p>No availability found. Please call us to schedule.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {availability.map(day => {
                  const [y, m, d] = day.date.split('-').map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const isAvailable = !day.isBlocked && day.spotsRemaining > 0;
                  const isSelected = selectedDate === day.date;

                  return (
                    <button
                      key={day.date}
                      disabled={!isAvailable}
                      onClick={() => { setSelectedDate(day.date); setSelectedSlot(null); setStep(3); }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        isSelected
                          ? 'border-2 shadow-md'
                          : isAvailable
                            ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      }`}
                      style={isSelected ? { borderColor: brandColor } : undefined}
                    >
                      <div className="text-xs text-gray-500">{dayName}</div>
                      <div className="font-semibold text-gray-900">{monthDay}</div>
                      {isAvailable ? (
                        <div className="text-xs mt-1" style={{ color: brandColor }}>
                          {day.spotsRemaining} spot{day.spotsRemaining !== 1 ? 's' : ''}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 mt-1">
                          {day.isBlocked ? 'Closed' : 'Full'}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Select Time (booking mode) */}
        {step === 3 && isBookingMode && (
          <div className="space-y-4">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="text-center mb-4">
              <p className="font-medium text-gray-900">{formatDateDisplay(selectedDate)}</p>
            </div>

            {(() => {
              const dayData = availability.find(d => d.date === selectedDate);
              if (!dayData || dayData.slots.length === 0) {
                return (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                    <p>No time slots available for this date.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {dayData.slots.map((slot, i) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime;
                    return (
                      <button
                        key={i}
                        onClick={() => { setSelectedSlot(slot); setStep(4); }}
                        className={`w-full flex items-center justify-between rounded-xl border p-4 transition-all ${
                          isSelected
                            ? 'border-2 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                        style={isSelected ? { borderColor: brandColor } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="h-5 w-5 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </span>
                        </div>
                        <span className="text-sm" style={{ color: brandColor }}>
                          {slot.spotsAvailable} spot{slot.spotsAvailable !== 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Final Step: Contact Info */}
        {((isBookingMode && step === 4) || (!isBookingMode && step === 3) || (!isBookingMode && step === 2)) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setStep(isBookingMode ? 3 : 1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            {isBookingMode && selectedDate && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 flex items-center gap-3 text-sm">
                  <CalendarDays className="h-4 w-4" style={{ color: brandColor }} />
                  <span className="font-medium">{formatDateDisplay(selectedDate)}</span>
                  {selectedSlot && (
                    <>
                      <Clock className="h-4 w-4 ml-2" style={{ color: brandColor }} />
                      <span>{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</span>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
              <input
                type="text"
                required
                placeholder="Your full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.customer_name}
                onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
              <input
                type="tel"
                required
                placeholder="(555) 123-4567"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.customer_phone}
                onChange={e => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                value={formData.customer_email}
                onChange={e => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
              />
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : ctaText}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
