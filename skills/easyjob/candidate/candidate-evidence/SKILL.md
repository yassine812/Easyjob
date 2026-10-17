# candidate-evidence

- **Version:** 1.0.0
- **Purpose:** Extract explainable evidence and gaps from a CV against a job.
- **Inputs:** CV snapshot, candidate profile, cover letter, job snapshot.
- **Outputs:** evidence by skill, source excerpts, weak or missing evidence, transferable evidence.
- **Rules:** evidence and coverage only; no hire/reject, personality, cultural-fit, or protected-attribute inference.
- **Fallback:** return no evidence and explain that review is unavailable.
