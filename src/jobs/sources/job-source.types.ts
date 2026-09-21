export interface ExternalJobSearchInput {
  keyword: string;
  location: string;
  page?: number;
  limit?: number;
}

export interface ExternalJobListing {
  id: string;
  title: string;
  companyName: string | null;
  location: string | null;
  description: string;
  salaryText: string | null;
  employmentType: string | null;
  sourceLabel: string;
  url: string;
  sourceUpdatedAt: Date | null;
}

export interface ExternalJobSearchResult {
  jobs: ExternalJobListing[];
  total: number;
}

export interface JobSourceAdapter {
  readonly type: 'JOOBLE';
  readonly name: string;
  isConfigured(): boolean;
  search(input: ExternalJobSearchInput): Promise<ExternalJobSearchResult>;
}
