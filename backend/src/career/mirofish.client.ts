import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type AppConfig } from '../config/configuration';

export interface RecruiterSimulationInput {
  question: string;
  answer: string;
  jobTitle: string;
  company?: string | null;
  jobDescription?: string;
  candidateText?: string;
  locale: string;
}

export interface RecruiterSimulationResult {
  source: 'mirofish' | 'local_fallback';
  enabled: boolean;
  available: boolean;
  response: string;
  signals: string[];
  recommendation: 'ADVANCE' | 'REVIEW' | 'REJECT_RISK';
  simulationId?: string;
}

/**
 * Small, private adapter around MiroFish. MiroFish is a swarm simulation
 * engine, not an interview API: an already prepared simulation/agent is
 * required for its `/api/simulation/interview` endpoint. When it is not
 * configured or temporarily unavailable, EasyJob returns a deterministic
 * recruiter simulation so the candidate workflow never breaks.
 */
@Injectable()
export class MiroFishClient {
  private readonly logger = new Logger(MiroFishClient.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  async simulateRecruiter(input: RecruiterSimulationInput): Promise<RecruiterSimulationResult> {
    const fallback = this.localFallback(input);
    const settings = this.config.mirofish;
    const simulationId = settings?.simulationId;
    if (!settings?.enabled || !simulationId) return fallback;
    try {
      const response = await fetch(`${settings.baseUrl}/api/simulation/interview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          simulation_id: simulationId,
          agent_id: settings.agentId,
          platform: 'reddit',
          timeout: Math.ceil(settings.timeoutMs / 1000),
          prompt: this.prompt(input),
        }),
        signal: AbortSignal.timeout(settings.timeoutMs),
      });
      if (!response.ok) throw new Error(`MiroFish HTTP ${response.status}`);
      const payload = await response.json() as { success?: boolean; data?: { result?: { response?: string; platforms?: Record<string, { response?: string }> } } };
      const result = payload.data?.result;
      const text = result?.response || Object.values(result?.platforms ?? {}).map(item => item.response).find(Boolean);
      if (!payload.success || !text) throw new Error('MiroFish returned no interview response');
      return { ...fallback, source: 'mirofish', enabled: true, available: true, response: String(text), simulationId };
    } catch (error) {
      this.logger.warn(`MiroFish unavailable; using local recruiter simulation: ${error instanceof Error ? error.message : 'unknown error'}`);
      return fallback;
    }
  }

  private prompt(input: RecruiterSimulationInput) {
    return `You are simulating a hiring recruiter for a realistic interview practice. Reply in ${input.locale === 'fr' ? 'French' : input.locale === 'ar' ? 'Arabic' : 'English'}. Role: ${input.jobTitle}. Company: ${input.company || 'the company'}. Interview question: ${input.question}. Candidate answer: ${input.answer}. Assess credibility, relevance, evidence, communication and the next recruiter action. Do not invent facts and keep the response under 180 words.`;
  }

  private localFallback(input: RecruiterSimulationInput): RecruiterSimulationResult {
    const answer = input.answer.trim();
    const words = answer ? answer.split(/\s+/).length : 0;
    const evidence = /\b(j'ai|j’ai|i |implemented|built|développ|mesuré|résultat|result|impact|%|chiffre|metric)/i.test(answer);
    const focused = words >= 35 && answer.length >= 160;
    const recommendation = focused && evidence ? 'ADVANCE' : words >= 15 ? 'REVIEW' : 'REJECT_RISK';
    const signals = [
      focused ? 'Réponse suffisamment développée' : 'Réponse trop courte pour conclure',
      evidence ? 'Une action ou un résultat est mentionné' : 'Ajoute une preuve concrète et mesurable',
      /\b(contexte|situation|problème|objectif|action|résultat|situation|task|action|result)/i.test(answer) ? 'Structure de réponse détectée' : 'Structure STAR à renforcer',
    ];
    const response = input.locale === 'fr'
      ? recommendation === 'ADVANCE' ? 'Le recruteur voit une réponse crédible et suffisamment étayée. Il poursuivrait avec une question de détail sur ton résultat.' : recommendation === 'REVIEW' ? 'Le recruteur garderait ton profil en revue et demanderait un exemple plus précis avant d’avancer.' : 'Le recruteur demanderait une réponse plus concrète avant de pouvoir retenir cette candidature.'
      : input.locale === 'ar' ? recommendation === 'ADVANCE' ? 'يرى مسؤول التوظيف إجابة موثوقة ومدعومة، وسيتابع بسؤال تفصيلي عن النتيجة.' : recommendation === 'REVIEW' ? 'سيبقي مسؤول التوظيف ملفك قيد المراجعة ويطلب مثالاً أكثر دقة.' : 'سيطلب مسؤول التوظيف إجابة أكثر واقعية قبل متابعة الترشيح.'
      : recommendation === 'ADVANCE' ? 'The recruiter sees a credible, evidenced answer and would follow up with a detail question about the outcome.' : recommendation === 'REVIEW' ? 'The recruiter would keep the profile under review and ask for a more specific example before advancing.' : 'The recruiter would ask for a more concrete answer before moving this application forward.';
    return { source: 'local_fallback', enabled: this.config.mirofish?.enabled === true, available: false, response, signals, recommendation };
  }
}
