import { api } from './client';
import { qs } from './client';
import type { CurrentSubscription, Plan, PlanType } from '@/types/api';

/** Matches the backend CheckoutDto: planId, ownerType, companyId?, billingCountry?. */
export interface CheckoutInput {
  planId: string;
  ownerType: PlanType;
  companyId?: string;
  billingCountry?: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
}

export interface PaymentStatusResult {
  id?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | string;
  amountCents?: number;
  currency?: string;
  provider?: string;
  billingCountry?: string;
  createdAt?: string;
  paidAt?: string;
  planName?: string;
  message?: string;
}

export const billingApi = {
  quote: (planId: string, billingCountry: string) => api.get<{ amountCents: number; currency: string; provider: string }>(`/subscriptions/quote${qs({ planId, billingCountry })}`),
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
