# JobOps in EasyJob

EasyJob integrates [DaKheera47/job-ops](https://github.com/DaKheera47/job-ops)
through its read-only OJCP interface. JobOps discovers listings from its
supported boards (including Gradcracker, WUZZUF and other configured sources);
EasyJob imports the original posting and application URLs into the same
catalogue used by candidate search.

EasyJob still owns the candidate experience: semantic matching, fit
explanations, tailored CV content, PDF export, application tracking and
interview preparation. No automatic application is sent by this connector.

## It is enabled in the unified deployment

Set these values in the deployment environment:

```dotenv
JOB_SOURCE_JOBOPS_ENABLED=true
JOB_SOURCE_JOBOPS_URL=http://jobops:3001
JOB_SOURCE_JOBOPS_SEARCH_TERMS=software engineer,frontend developer,data analyst
JOB_SOURCE_JOBOPS_MAX_PAGES=3
JOB_SOURCE_JOBOPS_PAGE_SIZE=50
```

The production environment template already sets `COMPOSE_PROFILES=jobops,mirofish` and `JOB_SOURCE_JOBOPS_ENABLED=true`, so the normal stack command starts JobOps automatically:

```bash
docker compose -f backend/docker-compose.prod.yml --env-file .env.staging \
  up -d --build
```

The `jobops` service is the upstream published image and is internal-only;
only the EasyJob web/API domain is exposed. If the profile is not enabled, the
connector reports `DISABLED` and all existing EasyJob sources continue working.

## Attribution and licensing

The upstream JobOps repository is licensed under **AGPLv3 with the Commons
Clause**. EasyJob does not copy its source code; it calls the documented OJCP
endpoint and keeps the upstream project attribution. If you redistribute or
modify the JobOps service itself, preserve its `LICENSE` and comply with the
upstream license terms.
