import { api } from './client';
import { qs } from './client';
import type { CurrentSubscription, Plan, PlanType } from '@/types/api';

/** Matches the backend CheckoutDto: planId, ownerType, companyId?, billingCountry?, currency?. */
export interface CheckoutInput {
  planId: string;
  ownerType: PlanType;
  companyId?: string;
  billingCountry?: string;
  currency?: 'TND' | 'EUR' | 'USD';
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
}

export interface PaymentStatusResult {
  id?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | string;
  amountCents?: number;
  baseAmountTndCents?: number | null;
  paymentAmountMinor?: number | null;
  providerExchangeRate?: number | string | null;
  providerConvertedAmount?: number | null;
  currency?: string;
  provider?: string;
  billingCountry?: string;
  createdAt?: string;
  paidAt?: string;
  planName?: string;
  message?: string;
}

export const billingApi = {
  quote: (planId: string, currency: 'TND' | 'EUR' | 'USD' = 'TND', billingCountry?: string) => api.get<{ amountCents: number; amountMinor: number; currency: string; provider: string; baseAmountTndCents?: number; exchangeRate?: number }>(`/subscriptions/quote${qs({ planId, currency, billingCountry })}`),
  plans: (type?: PlanType) => api.get<Plan[]>(`/plans${qs({ type })}`, { auth: false }),
  currentSubscription: (ownerType: PlanType, companyId?: string) =>
    api.get<CurrentSubscription>(
      `/subscriptions/me${qs({ ownerType, companyId: companyId ?? undefined })}`,
    ),
  checkout: (dto: CheckoutInput) =>
    api.post<{
      checkoutUrl: string;
      providerReference: string;
      orderId?: string;
      provider?: string;
      currency?: string;
      amountCents?: number;
    }>('/subscriptions/checkout', dto),
  cancel: (dto: CancelSubscriptionInput) =>
    api.post<{ success: boolean; message: string }>('/subscriptions/cancel', dto),
  paymentStatus: (ref: string) =>
    api.get<PaymentStatusResult>(`/subscriptions/payments/status${qs({ ref })}`),
};
