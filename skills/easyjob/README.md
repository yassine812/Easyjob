# EasyJob Skills

EasyJob Skills are versioned, auditable business capabilities. The executable implementation lives in `src/skills/easyjob`; each skill directory documents its contract and policy here.

Skills receive a narrow `SkillContext`, run through `EasyJobSkillRuntime`, and can only call registered services. They do not receive database credentials, tokens, cookies, unrestricted filesystem access, or unrestricted shell access.
