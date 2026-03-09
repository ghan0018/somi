# SOMI Treatment – Purpose and User Requirements

> **Naming & Branding**
> - **Business/Brand:** **SOMI** (the practice/organization)
> - **Applications (internal names):**
>   - **SOMI Home** – Client mobile apps (iOS, Android). **Display name/branding shown to users:** “SOMI”
>   - **SOMI Clinic** – Therapist/Admin web portal
>   - **SOMI Connect** – Backend services (APIs, jobs, integrations)

---

## 1. Purpose

**SOMI Treatment** is a HIPAA-compliant software product suite that powers the **Treatment** phase of SOMI’s client journey.  
It enables therapists to assign and track individualized home programming, deliver pre-recorded VOD exercise content, communicate securely with clients, and monitor treatment progress through client-submitted videos and structured feedback.

The goal is a seamless, secure, and engaging experience that connects therapist and client between sessions while maintaining clinical integrity and regulatory compliance.

---

## 2. User Roles

| Role | Description | Primary App |
|------|-------------|-------------|
| **Client / Patient** | Receives therapy; views assigned programs, watches exercises, records/uploads practice videos, receives feedback, and messages the therapist. | **SOMI Home** (iOS/Android) |
| **Therapist** | Licensed SLP/myofunctional therapist; manages clients, creates programs, reviews videos, gives feedback, chats, and tracks progress. | **SOMI Clinic** (web) |
| **Admin** | Practice staff; user provisioning, therapist assignments, compliance/audit oversight, content library management. | **SOMI Clinic** (web) |

---

## 3. Core Value Propositions

1. **Personalized Exercise Delivery** – Assign structured home programs with VOD, text, and image instruction.  
2. **Asynchronous Feedback Loop** – Clients upload practice videos; therapists respond with written or video feedback (timestamped annotations as a fast follow).  
3. **Secure Communication** – HIPAA-compliant in-app messaging replaces email/text.  
4. **Adherence & Reminders** – Notifications drive daily compliance and habit formation.  
5. **Progress Visibility** – Dashboards for adherence and qualitative improvement over time.

---

## 4. Product & Repo Overview

| Product | Tech/Targets | Repo(s) | Notes |
|--------|--------------|---------|------|
| **SOMI Home** | Native mobile: **iOS (Swift)**, **Android (Kotlin)** | `apps/somi-home-ios`, `apps/somi-home-android` | Client-facing; branded “SOMI” in stores and UI |
| **SOMI Clinic** | **ReactJS + TypeScript** web app | `apps/somi-clinic-web` | Therapist/Admin portal |
| **SOMI Connect** | **Node.js + TypeScript** (Express/Nest), REST/GraphQL, workers/queues | `services/somi-connect` | API, auth, jobs, integrations |

**Shared:**  
- Database: **MongoDB Atlas (Dedicated, HIPAA-eligible, BAA)**  
- Media Storage: **Object storage** (e.g., S3) with pre-signed URLs  
- Notifications: APNs/Firebase (no PHI in payloads)  
- Identity: Email/password + **MFA**

---

## 5. Initial Functional Scope (High-Level)

- **Home Programming & Exercises**  
  - Therapist creates plan templates and session schedules (Clinic).  
  - Client views daily tasks; each task links to exercise detail with VOD and instructions (Home).  
  - Client can mark done, add notes, and upload a practice video.

- **Therapist Feedback**  
  - Review client uploads; provide written or video feedback (Clinic).  
  - (Fast follow) Add timestamped annotations.

- **Chat / Messaging**  
  - 1:1 secure messaging between client and therapist; optional image/video attachments (Home/Clinic).

- **Reminders & Notifications**  
  - Daily or program-based reminders; in-app alerts and push (Home).

- **Progress Tracking**  
  - Client adherence view (Home).  
  - Therapist dashboards for adherence, symptoms, session advancement (Clinic).

---

## 6. Key Non-Functional Goals

- HIPAA compliance (Privacy, Security, Breach Notification).  
- Encryption in transit (TLS 1.2+) and at rest; client-side field-level encryption for select PHI.  
- Role-based access control; comprehensive audit logging.  
- Mobile-first performance; offline playback for VOD.  
- Scalable, multi-tenant-ready architecture.

---

## 7. Out of Scope (Initial Release)

- Billing/payments (fast follow).  
- Live video sessions (future integration).  
- Cross-clinic data sharing.  
- Multi-language UI.

---

## 8. Success Metrics

- ≥ 80% weekly adherence among active clients.  
- < 1% upload failure rate.  
- Therapist review turnaround < 48 hours.  
- HIPAA risk assessment completed; internal audit passes.

---

## 9. Future Considerations

- Payments & subscriptions.  
- Therapist collaboration (shared cases, internal notes).  
- AI-assisted scoring/guidance for video submissions.  
- EHR integrations (FHIR/HL7).

---

## 10. Client Types and Clinical Focus Areas

SOMI Treatment supports therapy delivery across age groups and the dual clinical frameworks of **Function** and **Structure**.

### 10.1 Functional Domains
| Domain | Description | Representative Focus Areas |
|---|---|---|
| **Breathing** | Normalize nasal breathing and respiratory patterns. | Mouth-breathing correction, Buteyko, diaphragmatic control, sleep-related breathing retraining. |
| **Swallowing** | Coordinate tongue, jaw, and airway for efficient, safe swallowing. | Tongue placement, sequential swallow coordination, saliva management. |
| **Chewing** | Adequate mastication and bolus control across textures. | Bilateral chewing, graded texture tolerance, rhythm of chewing. |
| **Speech** | Articulatory precision and oral-motor efficiency. | /s/, /z/, /r/, /l/ placement; tongue-to-palate coordination. |
| **Sleep** | Improve airway patency and rest quality via functional change. | Snoring reduction, nocturnal mouth-breathing correction, fragmentation reduction. |

### 10.2 Structural Domains
| Domain | Description | Example Focus Areas |
|---|---|---|
| **Tongue** | Range, strength, rest posture. | Elevation, suction strength, coordination, frenectomy recovery. |
| **Jaw** | Muscular balance and alignment. | Bruxism reduction, mandibular stabilization, tension release. |
| **Palate** | Width/shape influencing airflow and tongue placement. | Expansion retention, nasal airflow optimization. |
| **Airway** | Openness/tone influencing sleep and breathing. | UARS awareness, snoring-risk reduction. |
| **Muscles** | Orofacial/postural tone affecting rest and function. | Lip-seal training, neck/shoulder tension release, posture correction. |

### 10.3 Infant & Early-Childhood Focus Areas
- **Feeding Efficiency:** breastfeeding/bottle coordination, poor latch, clicking, reflux-like behaviors, excess air intake, inefficient milk transfer.  
- **Oral-Motor & Reflex Integration:** tongue coordination, oral reflex immaturity, poor suction, early mouth-breathing.  
- **Habits & Early Posture:** pacifier/thumb habits, open-mouth rest posture.  
- **Pre/Post-Frenectomy Support:** wound management, improved tongue range/oral posture.

*Product implications:* parent-uploaded videos, guided daily programs, checklists, therapist feedback library.

### 10.4 Child / Adolescent / Adult Focus Areas
- **Oral & Orthodontic:** orthodontic stability, expansion retention, tongue thrust, open-bite relapse.  
- **Feeding & Sensory:** gag sensitivity, picky/restricted eating, texture avoidance.  
- **Behavioral & Cognitive:** reduced attention/focus, irritability, reduced stamina, poor school/work endurance.  
- **Postural & Musculoskeletal:** mouth-breathing posture, forward-head, neck/jaw tension, bruxism.  
- **Airway & Sleep:** SDB risk, UARS features, reduced sleep quality/efficiency, snoring, noisy/mouth breathing in sleep, fragmented/restless sleep.

---

## 11. Role Within the Client Journey

SOMI Treatment primarily supports the **Treatment** phase.

| Phase | Description | Primary Systems |
|---|---|---|
| **Discovery & Scheduling** | Referrals; consult scheduling via third-party tools (Calendly/Clockwise). | External tools |
| **Intake** | Client demographics/clinical intake; legal notices and HIPAA consents. | Web intake or connected CRM; **SOMI Connect** receives data |
| **Evaluation** | Therapist evaluation (in-person/Zoom) and plan decisioning. | Practice/EHR tools |
| **Treatment (SOMI Core)** | Programming, communication, uploads, reminders, progress & feedback. | **SOMI Home**, **SOMI Clinic**, **SOMI Connect** |
| **Follow-Up & Goal Attainment** | Assess outcomes; maintenance/next steps. | SOMI Clinic reports; exports to practice records |

**SOMI Treatment does not** replace intake, evaluation scheduling, or billing software; it operates downstream to execute therapy plans and maintain continuity between sessions.

---

## 12. Compliance Footprint (Preview—expanded in `07-compliance-and-legal.md`)

- BAAs with hosting, storage, messaging vendors.  
- Encryption in transit & at rest; client-side FLE for select PHI.  
- RBAC, MFA, least privilege.  
- Immutable audit logs (access, reads/writes, URL issuance).  
- Breach response plan; periodic risk assessments.  

