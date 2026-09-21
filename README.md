# EasyJob

> AI-powered recruitment platform for smarter job search, CV optimization, job matching, and intelligent hiring.

EasyJob is a full-stack AI-powered recruitment platform designed to connect **job seekers and companies** through intelligent job matching, ATS-powered CV analysis, AI-assisted applications, and modern recruitment tools.

The platform helps candidates improve their CVs, discover relevant job opportunities, and manage applications, while companies can publish jobs, evaluate candidates, manage recruitment pipelines, and use AI-assisted recruitment tools.

---

## ✨ Features

### 👤 For Candidates

- 🔎 Real job search and filtering
- 🤖 AI-powered job matching
- 📄 CV upload and parsing
- 📊 ATS CV analysis and scoring
- 💡 Personalized CV improvement recommendations
- 📝 AI-assisted CV creation and optimization
- ✉️ AI-assisted cover letter generation
- 💼 Job applications directly through EasyJob when supported
- 🔖 Saved jobs
- 📋 Application tracking
- 🔔 Job alerts and notifications
- 🎯 Personalized job recommendations
- 🎤 AI interview coaching
- 👤 Complete professional profile
- 🌍 Multilingual interface
- 🌙 Dark mode

### 🏢 For Companies

- 📢 Job creation and publishing
- 👥 Candidate management
- 📋 Application management
- 🤖 AI-powered candidate analysis
- 📊 Candidate matching and ranking
- 🔎 Candidate search and filtering
- 🧠 AI recruitment insights
- 📌 Recruitment pipeline management
- 🎤 Interview management
- 📝 Assessments
- 📈 Recruitment analytics
- 👨‍💼 Team and recruiter management
- 🔐 Role-based permissions
- 🔔 Recruitment notifications
- 💳 Subscription and billing management

---

## 🤖 AI & ATS

EasyJob's ATS engine goes beyond simple keyword matching.

It analyzes the relationship between the candidate and the job using factors such as:

- Skills
- Required vs preferred requirements
- Professional experience
- Relevant experience
- Responsibilities
- Seniority
- Education
- Certifications
- Languages
- Location
- Workplace type
- Keywords and terminology
- CV structure
- ATS readability
- Measurable achievements
- Transferable skills

The system provides:

- ATS score
- Match score
- Score breakdown
- Matching skills
- Partial matches
- Missing requirements
- Relevant experience
- Strengths
- Gaps
- Evidence
- Actionable recommendations

AI-generated analysis is designed as **decision support**, not as an automatic hiring decision.

---

## 🧠 AI Interview Coach

EasyJob includes an AI-assisted interview experience capable of helping candidates prepare for:

- Technical interviews
- HR interviews
- Behavioral interviews
- Situational questions
- Problem-solving questions
- Role-specific interviews

The system can provide feedback on job-relevant factors such as:

- Answer quality
- Technical understanding
- Communication
- Problem solving
- Speaking pace
- Posture and presentation

Sensitive or protected characteristics are not used for recruitment scoring.

---

## 🏗️ Architecture

EasyJob is built as a modern full-stack application with separate services for the web application, API, AI processing, database, caching, background jobs, and search.

```text
                         ┌──────────────────────┐
                         │      EasyJob Web     │
                         │ Next.js / React / TS │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     NestJS API       │
                         │    REST / WebSocket  │
                         └───────┬───────┬──────┘
                                 │       │
                    ┌────────────┘       └────────────┐
                    ▼                                 ▼
          ┌──────────────────┐              ┌──────────────────┐
          │   PostgreSQL     │              │   Redis / BullMQ │
          │   + Prisma       │              │ Background Jobs  │
          └──────────────────┘              └──────────────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │    Python AI API   │
                       │      FastAPI       │
                       └────────────────────┘
                                 │
                                 ▼
                       ┌────────────────────┐
                       │ AI / ATS Services  │
                       └────────────────────┘
