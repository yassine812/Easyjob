import { api } from './client';
import { qs } from './client';
import type {
  AutomationActionType,
  AutomationExecution,
  AutomationRule,
  AutomationTriggerType,
  Paginated,
} from '@/types/api';

export interface AutomationActionInput {
  type: AutomationActionType | string;
  config: Record<string, unknown>;
}

export interface AutomationConditionInput {
  field: string;
  op: 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

export interface AutomationRuleInput {
  name: string;
  triggerType: AutomationTriggerType;
  triggerConfig?: Record<string, unknown>;
  conditions?: AutomationConditionInput[];
  actions: AutomationActionInput[];
  active?: boolean;
}

export const automationApi = {
  list: (companyId: string) => api.get<AutomationRule[]>(`/companies/${companyId}/automation/rules`),
  create: (companyId: string, dto: AutomationRuleInput) =>
    api.post<AutomationRule>(`/companies/${companyId}/automation/rules`, dto),
  update: (companyId: string, ruleId: string, dto: Partial<AutomationRuleInput>) =>
    api.patch<AutomationRule>(`/companies/${companyId}/automation/rules/${ruleId}`, dto),
  remove: (companyId: string, ruleId: string) =>
    api.delete<{ success: boolean }>(`/companies/${companyId}/automation/rules/${ruleId}`),
  executions: (companyId: string, params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AutomationExecution>>(
      `/companies/${companyId}/automation/executions${qs(params)}`,
    ),
};
