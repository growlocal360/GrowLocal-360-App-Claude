'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  name: string;
  displayName: string;
  price: number;
  features: readonly string[];
  highlighted?: boolean;
  onSelect: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function PlanCard({
  displayName,
  price,
  features,
  highlighted = false,
  onSelect,
  isLoading = false,
  disabled = false,
}: PlanCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price / 100);

  return (
    <Card
      className={cn(
        'relative flex flex-col transition-all',
        highlighted
          ? 'border-2 border-[#00d9c0] shadow-lg'
          : 'border hover:border-gray-300 hover:shadow-md'
      )}
    >
      {highlighted && (
        <Badge
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00d9c0] text-white"
        >
          Most Popular
        </Badge>
      )}

      <CardHeader className="pb-4 pt-6">
        <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
        <div className="mt-2">
          <span className="text-4xl font-bold text-gray-900">{formattedPrice}</span>
          <span className="text-gray-500">/month</span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#00d9c0]" />
              <span className="text-sm text-gray-600">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={onSelect}
          disabled={disabled || isLoading}
          className={cn(
            'mt-6 w-full',
            highlighted
              ? 'bg-black hover:bg-gray-800'
              : 'bg-gray-900 hover:bg-gray-800'
          )}
        >
          {isLoading ? 'Processing...' : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  );
}
