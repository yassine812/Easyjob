# smart-job-creation

- **Version:** 1.0.0
- **Purpose:** Produce deterministic job-draft suggestions while preserving recruiter edits.
- **Inputs:** title, role metadata, company context, selected skills, optional generated draft.
- **Outputs:** description suggestions, responsibilities, required skills, preferred skills, source hints.
- **Dependencies:** internal taxonomy, structured templates, existing JobDraftingClient output.
- **Rules:** never overwrite recruiter text; external research enriches only.
- **Prohibited:** automatic publication, opaque candidate scoring, hiring decisions.
- **Fallback:** preserve the current draft and return empty suggestions.
