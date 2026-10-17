# EasyJob Playwright MCP QA

Playwright MCP is used as an external QA harness, never as a product runtime dependency. Run these scenarios against a local or staging EasyJob URL with test accounts only:

- candidate login and job application
- recruiter login, create job and schedule interview
- open EasyJob Meeting, grant/revoke transcription consent, continue without transcription
- platform-admin login and inspect `/admin/system/skills` and `/admin/system/transcription`
- subscription, invoice and company-management workflows
- desktop, tablet and mobile layouts: no horizontal overflow, clipped sidebar or runtime error overlay

Do not use this harness for LinkedIn login, CAPTCHA, anti-bot bypass, private scraping or any external-site automation.
