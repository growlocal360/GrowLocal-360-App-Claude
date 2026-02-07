import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Globe, Briefcase, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <Image
              src="/grow-local-360-logo-black.svg"
              alt="GrowLocal360"
              width={160}
              height={28}
              priority
            />
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Sign In
            </Link>
            <Button asChild className="bg-black hover:bg-gray-800">
              <Link href="/signup">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-[#00d9c0]/10 px-4 py-1.5 text-sm font-medium text-[#00d9c0]">
            GBP-First Website Architecture
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Build websites that
            <span className="block text-[#00d9c0]">rank locally</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Create SEO-optimized website structures based on your Google Business Profile
            categories. Automate Job Snaps to showcase your work across all platforms.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-black hover:bg-gray-800"
            >
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">View Demo</Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={Globe}
            title="GBP-First Structure"
            description="Website architecture that mirrors your Google Business Profile categories for maximum local SEO impact."
          />
          <FeatureCard
            icon={Briefcase}
            title="Job Snaps"
            description="Upload job photos, let AI generate descriptions, and deploy to your website and social media."
          />
          <FeatureCard
            icon={Zap}
            title="AI-Powered"
            description="Smart category suggestions, image analysis, and content generation to save you time."
          />
          <FeatureCard
            icon={Shield}
            title="Multi-Tenant SaaS"
            description="Manage multiple sites and team members with role-based permissions."
          />
        </div>

        {/* Website Types */}
        <div className="mt-24">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Three Website Types, One Platform
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            Choose the right structure for your business model
          </p>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            <WebsiteTypeCard
              title="Single Location"
              description="Perfect for businesses with one GBP. Homepage targets your primary category + city."
              features={[
                'Homepage = GBP landing page',
                'Category silos for services',
                'Service area pages',
              ]}
            />
            <WebsiteTypeCard
              title="Multi-Location"
              description="For businesses with multiple GBPs. Each location gets its own optimized landing page."
              features={[
                'Brand-focused homepage',
                '/locations/{city}/ structure',
                'Per-location category silos',
              ]}
              highlighted
            />
            <WebsiteTypeCard
              title="Microsite (EMD)"
              description="Hyper-targeted sites for long-tail keywords. Supports your main money site."
              features={[
                'Exact-match domain focus',
                'Single topic + location',
                'High conversion potential',
              ]}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Image
                src="/grow-local-360-logo-black.svg"
                alt="GrowLocal360"
                width={140}
                height={25}
              />
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} GrowLocal360. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Globe;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#00d9c0]/10">
        <Icon className="h-6 w-6 text-[#00d9c0]" />
      </div>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function WebsiteTypeCard({
  title,
  description,
  features,
  highlighted,
}: {
  title: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 p-6 transition-all ${
        highlighted
          ? 'border-[#00d9c0] bg-[#00d9c0]/5 shadow-lg'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {highlighted && (
        <span className="mb-3 inline-block rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
      <ul className="mt-4 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d9c0]" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
