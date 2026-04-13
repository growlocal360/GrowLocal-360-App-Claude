'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicRenderCategory } from '@/lib/sites/public-render-model';

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

interface AddressPrediction {
  placeId: string;
  description: string;
}

interface UnifiedLeadFormProps {
  siteId: string;
  brandColor?: string;
  categories?: PublicRenderCategory[];
  schedulingActive?: boolean;
  ctaStyle?: 'booking' | 'estimate';
  variant?: 'hero' | 'section';
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

export function UnifiedLeadForm({
  siteId,
  brandColor = '#00ef99',
  categories,
  schedulingActive = false,
  ctaStyle = 'booking',
  variant = 'hero',
}: UnifiedLeadFormProps) {
  const isBookingMode = schedulingActive && ctaStyle === 'booking';
  const totalSteps = isBookingMode ? 5 : 3;

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ status: string; message: string } | null>(null);

  // Form data
  const [formData, setFormData] = useState({
    service_type: '',
    message: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  // Address autocomplete state
  const [addressQuery, setAddressQuery] = useState('');
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const addressRef = useRef<HTMLDivElement>(null);

  // Scheduling state (booking mode only)
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  // Address autocomplete - debounced fetch
  useEffect(() => {
    if (addressQuery.length < 3) {
      setPredictions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?query=${encodeURIComponent(addressQuery)}`);
        const data = await res.json();
        setPredictions(data.predictions || []);
        setShowPredictions(true);
      } catch {
        setPredictions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addressQuery]);

  // Close predictions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (addressRef.current && !addressRef.current.contains(e.target as Node)) {
        setShowPredictions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load availability when entering step 4 (booking mode)
  useEffect(() => {
    if (!isBookingMode || step !== 4) return;

    async function loadAvailability() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({ siteId, date: today, days: '14' });

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
  }, [step, siteId, isBookingMode]);

  const handleSelectPrediction = (prediction: AddressPrediction) => {
    setFormData(prev => ({ ...prev, address: prediction.description }));
    setAddressQuery(prediction.description);
    setShowPredictions(false);
    setPredictions([]);
  };

  const handleSubmitLead = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/sites/${siteId}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || null,
          service_type: formData.service_type || null,
          message: formData.message || null,
          address: formData.address || null,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const handleSubmitBooking = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          customer_name: formData.name,
          customer_email: formData.email || null,
          customer_phone: formData.phone,
          service_type: formData.service_type || null,
          notes: formData.message || null,
          address: formData.address || null,
          scheduled_date: selectedDate,
          scheduled_time: selectedSlot?.type === 'slot' ? selectedSlot.startTime : null,
          time_window_start: selectedSlot?.startTime || null,
          time_window_end: selectedSlot?.endTime || null,
          source_page: typeof window !== 'undefined' ? window.location.pathname : '/',
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

  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBookingMode) {
      setStep(4);
    } else {
      handleSubmitLead();
    }
  };

  const stepLabel = (s: number): string => {
    if (s === 1) return 'Service Details';
    if (s === 2) return 'Contact Info';
    if (s === 3) return 'Address';
    if (s === 4) return 'Select Date';
    if (s === 5) return 'Select Time';
    return '';
  };

  const inputClass = variant === 'hero'
    ? 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2'
    : 'w-full rounded-xl border border-gray-300 px-4 py-3 text-sm transition-all duration-300 focus:border-transparent focus:outline-none focus:ring-2';

  const ringStyle = { '--tw-ring-color': brandColor } as React.CSSProperties;

  // ---- Success state ----
  if (submitted) {
    if (variant === 'hero') {
      return (
        <div className="text-center py-4">
          <CheckCircle2 className="mx-auto h-12 w-12 mb-3" style={{ color: brandColor }} />
          <h3 className="text-xl font-bold text-gray-900">Thank You!</h3>
          <p className="mt-2 text-sm text-gray-600">
            {bookingResult?.message || 'We\'ve received your request. A team member will reach out shortly.'}
          </p>
          {selectedDate && (
            <p className="mt-2 font-medium text-gray-800 text-sm">
              {formatDateDisplay(selectedDate)}
              {selectedSlot && ` at ${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`}
            </p>
          )}
        </div>
      );
    }

    return (
      <section id="booking" className="py-24">
        <div className="mx-auto max-w-xl px-4 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 mb-4" style={{ color: brandColor }} />
          <h2 className="text-2xl font-bold text-gray-900">
            {bookingResult?.status === 'confirmed' ? 'Appointment Confirmed!' : 'Thank You!'}
          </h2>
          <p className="mt-4 text-gray-600">
            {bookingResult?.message || 'We\'ve received your request and will be in touch shortly.'}
          </p>
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

  // ---- Form content ----
  const formContent = (
    <>
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          {variant === 'hero' ? (
            <>
              <div>
                <span className="font-bold text-gray-900 text-2xl">
                  {step === 1 ? (ctaStyle === 'booking' ? 'Book Online' : 'Get Free Estimate') : stepLabel(step)}
                </span>
                {step === 1 && (
                  <div className="font-medium" style={{ color: brandColor }}>In less than 30 seconds</div>
                )}
              </div>
              <span className="text-gray-500">Step {step} of {totalSteps}</span>
            </>
          ) : (
            <>
              <span className="text-gray-500">Step {step} of {totalSteps}</span>
              <span className="font-medium" style={{ color: brandColor }}>{stepLabel(step)}</span>
            </>
          )}
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%`, backgroundColor: brandColor }}
          />
        </div>
      </div>

      {/* Step 1: Service & Details */}
      {step === 1 && (
        <div className="space-y-4">
          {categories && categories.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Service Needed</label>
              <select
                className={inputClass}
                style={ringStyle}
                value={formData.service_type}
                onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
              >
                <option value="">Select a service...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.gbp_category.display_name}>
                    {cat.gbp_category.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">How Can We Help - Details?</label>
            <textarea
              rows={3}
              placeholder="Describe what you need help with..."
              className={inputClass}
              style={ringStyle}
              value={formData.message}
              onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            className={variant === 'hero'
              ? 'w-full py-2.5 hover:opacity-90'
              : 'w-full rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'}
            style={{ backgroundColor: brandColor }}
            onClick={() => setStep(2)}
          >
            Continue
          </Button>
        </div>
      )}

      {/* Step 2: Contact Info */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
            <input
              type="text"
              required
              placeholder="Your full name"
              className={inputClass}
              style={ringStyle}
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
            <input
              type="tel"
              required
              placeholder="(555) 123-4567"
              className={inputClass}
              style={ringStyle}
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="you@example.com (optional)"
              className={inputClass}
              style={ringStyle}
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              className={variant === 'hero'
                ? 'flex-1 hover:opacity-90'
                : 'flex-1 rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'}
              style={{ backgroundColor: brandColor }}
              onClick={() => {
                if (!formData.name || !formData.phone) return;
                setStep(3);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Address */}
      {step === 3 && (
        <form onSubmit={handleStep3Submit} className="space-y-4">
          <div ref={addressRef} className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input
              type="text"
              placeholder="Start typing your address..."
              className={inputClass}
              style={ringStyle}
              value={addressQuery}
              onChange={e => {
                setAddressQuery(e.target.value);
                setFormData(prev => ({ ...prev, address: e.target.value }));
              }}
              onFocus={() => { if (predictions.length > 0) setShowPredictions(true); }}
            />
            {showPredictions && predictions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                {predictions.map(p => (
                  <li
                    key={p.placeId}
                    className="cursor-pointer px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                    onMouseDown={() => handleSelectPrediction(p)}
                  >
                    {p.description}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-1"
              onClick={() => setStep(2)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={variant === 'hero'
                ? 'flex-1 hover:opacity-90'
                : 'flex-1 rounded-full py-3.5 text-base shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg'}
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
              ) : isBookingMode ? 'Continue' : (ctaStyle === 'booking' ? 'Schedule Service' : 'Get Free Estimate')}
            </Button>
          </div>
        </form>
      )}

      {/* Step 4: Select Date (booking mode only) */}
      {step === 4 && isBookingMode && (
        <div className="space-y-4">
          <button
            onClick={() => setStep(3)}
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
                    onClick={() => { setSelectedDate(day.date); setSelectedSlot(null); setStep(5); }}
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

      {/* Step 5: Select Time (booking mode only) */}
      {step === 5 && isBookingMode && (
        <div className="space-y-4">
          <button
            onClick={() => setStep(4)}
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
                {dayData.slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedSlot(slot);
                      handleSubmitBooking();
                    }}
                    disabled={submitting}
                    className="w-full flex items-center justify-between rounded-xl border border-gray-200 p-4 transition-all hover:border-gray-300 hover:shadow-sm"
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
                ))}
              </div>
            );
          })()}

          {submitting && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Booking your appointment...</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  // ---- Layout wrapper ----
  if (variant === 'hero') {
    return <div>{formContent}</div>;
  }

  return (
    <section id="booking" className="py-24">
      <div className="mx-auto max-w-xl px-4">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            {ctaStyle === 'booking' ? 'Schedule Your Service' : 'Get a Free, No-Obligation Estimate'}
          </h2>
          <p className="mt-2 text-gray-600">
            {ctaStyle === 'booking'
              ? 'Fill out the form below to request an appointment.'
              : 'Fill out the form below and we\'ll get back to you promptly.'}
          </p>
        </div>
        {formContent}
      </div>
    </section>
  );
}
