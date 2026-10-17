# company-public-context

- **Version:** 1.0.0
- **Purpose:** Orchestrate the existing controlled Agent Reach and REA public-research layer.
- **Inputs:** company name, validated public website, optional job or interview identifier.
- **Outputs:** queued or completed normalized public sources.
- **Rules:** public URLs only; no cookies, sessions, credentials, candidate data, or scoring.
- **Fallback:** return `DISABLED` or `UNAVAILABLE` and keep the product workflow usable.
