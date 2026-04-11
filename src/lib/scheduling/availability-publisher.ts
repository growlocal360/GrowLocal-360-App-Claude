/**
 * Availability Publishing Engine
 * Generates and publishes real-time availability content to GBP.
 * The differentiator: scheduling data becomes SEO-relevant content.
 */

const TEMPLATES = [
  {
    hasSpots: "It's {day} and we have {count} spot{s} available for same-day {service} in {city}. Book online or call {phone}!",
    fullyBooked: "We're fully booked today! Call {phone} to join our waitlist for {service} in {city}.",
  },
  {
    hasSpots: "Need {service} today? We have {count} opening{s} for same-day service in {city}. Schedule now at {url} or call {phone}.",
    fullyBooked: "All {service} appointments in {city} are booked for today. Call {phone} for next-day availability.",
  },
  {
    hasSpots: "{count} same-day {service} appointment{s} still available in {city}! Don't wait — book online or call {phone} now.",
    fullyBooked: "Today's {service} schedule in {city} is full! Call {phone} to book for tomorrow.",
  },
  {
    hasSpots: "Looking for {service} in {city} today? We have {count} spot{s} left. Book your appointment at {url} or call {phone}.",
    fullyBooked: "Our {city} {service} team is fully booked today. Call {phone} for priority scheduling tomorrow!",
  },
  {
    hasSpots: "Good news, {city}! {count} same-day appointment{s} available for {service}. Call {phone} or book at {url}.",
    fullyBooked: "Same-day {service} in {city} is sold out! We open new spots daily — call {phone} or check back tomorrow.",
  },
  {
    hasSpots: "Only {count} spot{s} left for {service} in {city} today! Book now at {url} or call {phone} before they're gone.",
    fullyBooked: "Every {service} slot in {city} is taken today! For urgent needs, call {phone}.",
  },
  {
    hasSpots: "Same-day {service} is available! {count} opening{s} in {city}. Schedule at {url} or call {phone}.",
    fullyBooked: "Our {service} crew in {city} is booked solid today. Tomorrow's schedule opens at 7am — call {phone}!",
  },
  {
    hasSpots: "Your {city} {service} experts have {count} spot{s} open today. Book your appointment now: {url} or {phone}.",
    fullyBooked: "No same-day {service} slots in {city} today, but we can get you in tomorrow! Call {phone}.",
  },
];

interface PublishContext {
  spotsAvailable: number;
  serviceName: string;
  city: string;
  phone: string;
  siteUrl: string;
  dayName: string;
}

/**
 * Generate a post for GBP based on availability data.
 * Rotates through 8 template variations to avoid duplicate content penalties.
 */
export function generateAvailabilityPost(context: PublishContext): string {
  const { spotsAvailable, serviceName, city, phone, siteUrl, dayName } = context;

  // Pick template based on day-of-year for deterministic rotation
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const templateIndex = dayOfYear % TEMPLATES.length;
  const template = TEMPLATES[templateIndex];

  const isBooked = spotsAvailable <= 0;
  const raw = isBooked ? template.fullyBooked : template.hasSpots;

  return raw
    .replace('{count}', String(spotsAvailable))
    .replace('{s}', spotsAvailable === 1 ? '' : 's')
    .replace('{service}', serviceName.toLowerCase())
    .replace('{city}', city)
    .replace('{phone}', phone)
    .replace('{url}', siteUrl)
    .replace('{day}', dayName)
    // Handle any remaining {s} for plural
    .replace('{s}', spotsAvailable === 1 ? '' : 's');
}
