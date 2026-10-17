import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandidateEmploymentOffer } from '../candidate/employment-offer';
import { EmploymentOffers, OfferSummary } from './employment-offers';
import { nextApplicationStages } from './application-stage-control';
const mock=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),patch:vi.fn()}));
vi.mock('@/lib/api/client',()=>({api:mock}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({locale:'fr'})}));
vi.mock('@/lib/i18n/hiring',()=>({useHiringText:()=>(key:string)=>key}));
vi.mock('@/lib/i18n/recruitment',()=>({useRecruitmentText:()=>(key:string)=>key}));
const offer={id:'o',title:'Backend Developer',companyName:'Company',contractType:'CDI',salaryAmount:5800,salaryCurrency:'TND',salaryPeriod:'MONTH',workMode:'HYBRID',benefits:['Assurance'],status:'VIEWED',expiresAt:'2030-01-01T12:00:00Z'};
function mount(ui:React.ReactNode){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>{ui}</QueryClientProvider>);}
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('employment workflow UI',()=>{
  it('shows structured salary, contract and benefits',()=>{mount(<OfferSummary offer={offer}/>);expect(screen.getByText('CDI')).toBeInTheDocument();expect(screen.getByText(/5\s800 TND/)).toBeInTheDocument();expect(screen.getByText('Assurance')).toBeInTheDocument();});
  it('requires a confirmation before accepting',async()=>{mock.get.mockResolvedValue(offer);mock.post.mockResolvedValue({});mount(<CandidateEmploymentOffer id="o"/>);fireEvent.click(await screen.findByRole('button',{name:'acceptOffer'}));expect(mock.post).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'confirm'}));await waitFor(()=>expect(mock.post).toHaveBeenCalledWith('/recruitment-offers/o/respond',{response:'ACCEPTED',reason:undefined}));});
  it('does not expose response actions after expiry',async()=>{mock.get.mockResolvedValue({...offer,status:'EXPIRED'});mount(<CandidateEmploymentOffer id="o"/>);await screen.findByText('EXPIRED');expect(screen.queryByRole('button',{name:'acceptOffer'})).not.toBeInTheDocument();});
  it('prefills the builder from the job and warns before interview stage',async()=>{mock.get.mockImplementation((url:string)=>Promise.resolve(url.endsWith('/defaults')?{...offer,applicationStatus:'APPLIED',salaryMin:4500,salaryMax:7200}:[]));mount(<EmploymentOffers companyId="co" applicationId="a" editable/>);fireEvent.click(await screen.findByRole('button',{name:'draftOffer'}));await screen.findByText('earlyOffer');expect(screen.getByDisplayValue('Backend Developer')).toBeInTheDocument();expect(screen.getByDisplayValue('CDI')).toBeInTheDocument();expect(mock.post).not.toHaveBeenCalled();});
  it('cannot enter the OFFER stage via the generic stage switch',()=>{expect(nextApplicationStages('INTERVIEW')).not.toContain('OFFER');});
});
