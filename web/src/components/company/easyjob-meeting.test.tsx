import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingContent } from './easyjob-meeting';
import { MeetingAssistant } from './meeting-assistant';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Meeting } from './meeting-types';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ api }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'i1' }) }));
vi.mock('./native-meeting-room', () => ({ MeetingDevicePicker: () => null, NativeMeetingRoom: ({ onJoined, onLeave }: { onJoined: () => void; onLeave: () => void }) => <><button onClick={onJoined}>connected</button><button onClick={onLeave}>leave-room</button></> }));
vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ locale: 'fr' }), LanguageToggle: () => null }));
vi.mock('@/lib/i18n/hiring', () => ({ useHiringText: () => (key: string) => key }));
vi.mock('@/lib/i18n/ux', () => ({ useUxText: () => (key: string) => key }));
vi.mock('@/hooks/use-auth', () => ({ useRole: () => ({ can: () => true }) }));
vi.mock('@/components/shared/guards', () => ({ RequireAuth: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/layout/logo', () => ({ Logo: () => <span>EasyJob</span> }));
vi.mock('./interview-scheduler', () => ({ FeedbackEditor: () => <div>Feedback editor</div>, InterviewEditor: () => null }));
vi.mock('./meeting-transcription', () => ({ MeetingTranscription: () => null }));

const meeting: Meeting = { id: 'i1', applicationId: 'a', companyId: 'co', companyName: 'Company', candidateName: 'Amel Ben Salem', title: 'Backend Developer', candidate: false, status: 'SCHEDULED', startAt: new Date(Date.now() + 3600000).toISOString(), endAt: new Date(Date.now() + 6300000).toISOString(), timezone: 'Africa/Tunis', locationType: 'EASYJOB', location: null, assistantEnabled: false, consented: false, transcriptionAvailable: false, transcriptionReady: false, joinAvailable: false };
function mount(element: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TooltipProvider>{element}</TooltipProvider></QueryClientProvider>); }
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue(meeting); api.post.mockResolvedValue({ saved: true }); Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) }); });
afterEach(cleanup);

describe('meeting lifecycle', () => {
  it('explains upcoming access, asks for device permission, and hides finish before joining', async () => {
    mount(<MeetingContent />);
    expect(await screen.findByText('Entretien à venir')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autoriser la caméra et le micro' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Tester caméra et micro' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'launch' })).toBeDisabled();
    expect(screen.getByText(/Disponible dans/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'finish' })).not.toBeInTheDocument();
  });
  it('shows finish only after the native room connects and persists the start', async () => {
    api.get.mockResolvedValue({ ...meeting, startAt: new Date().toISOString(), joinAvailable: true, consented: true });
    api.post.mockResolvedValue({ url: 'ws://localhost:7880', roomName: 'room', token: 'short-lived' });
    mount(<MeetingContent />);
    fireEvent.click(await screen.findByRole('button', { name: 'launch' }));
    expect(screen.queryByRole('button', { name: 'finish' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'connected' }));
    expect(api.post).toHaveBeenCalledWith('/meetings/i1/started', {});
    expect(screen.getByRole('button', { name: 'finish' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'leave-room' }));
    expect(screen.queryByRole('button', { name: 'finish' })).not.toBeInTheDocument();
  });
  it('shows the report after completion without prejoin or finish actions', async () => {
    api.get.mockResolvedValue({ ...meeting, status: 'COMPLETED' }); mount(<MeetingContent />);
    expect(await screen.findByText('Entretien terminé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'evaluate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'launch' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'finish' })).not.toBeInTheDocument();
  });
  it('never exposes the private assistant to a candidate', async () => {
    api.get.mockResolvedValue({ ...meeting, candidate: true, assistantEnabled: true }); mount(<MeetingContent />);
    await screen.findByText('Entretien à venir'); expect(screen.queryByRole('tab', { name: 'Dossier' })).not.toBeInTheDocument();
  });
  it('opens consent before requesting access to the room', async () => {
    api.get.mockResolvedValue({ ...meeting, candidate: true, assistantEnabled: true, startAt: new Date().toISOString(), joinAvailable: true }); mount(<MeetingContent />);
    fireEvent.click(await screen.findByRole('button', { name: 'join' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
  });
});

describe('meeting assistant', () => {
  const data = { ...meeting, assistantEnabled: true, brief: { questions: [{ id: 'q1', question: 'How do you test APIs?', priority: 'HIGH', sourceType: 'JOB_CV_EVIDENCE', sourceReference: 'Django', rationale: 'weak CV evidence · unknown requirement · 1 job mention(s)', reason: { reason_type: 'WEAK_EVIDENCE' as const, skill: 'Django', source_types: ['JOB' as const, 'CV' as const] } }] } };
  it('opens the brief first and autosaves private notes through the existing API', async () => {
    mount(<MeetingAssistant meeting={data} running={false} open={false} onOpenChange={vi.fn()} onPrivacy={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Dossier' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Notes' }), { button: 0, ctrlKey: false });
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Concrete API experience' } });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/meetings/i1/notes', { notes: 'Concrete API experience', covered: [], locale: 'fr' }), { timeout: 3000 });
    expect(await screen.findByText('Enregistré')).toBeInTheDocument();
  });
  it('groups questions with source and reason during the meeting', () => {
    mount(<MeetingAssistant meeting={data} running open={false} onOpenChange={vi.fn()} onPrivacy={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Questions' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Essentielles')).toBeInTheDocument(); expect(screen.getByText('Preuve limitée')).toBeInTheDocument(); expect(screen.queryByText(/weak CV evidence/)).not.toBeInTheDocument();
    expect(screen.getByText('Pourquoi EasyJob la suggère')).toBeInTheDocument();
  });
});
