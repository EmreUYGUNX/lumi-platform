# Compliance Overview (GDPR & KVKK Readiness)

This document outlines Phase 0 activities that prepare Lumi for European (GDPR) and Turkish (KVKK) data protection regulations.

## 1. Data Classification

- Catalogue personal data categories (PII, SPI) handled by each service.
- Tag datasets in the data inventory with retention periods and lawful basis.
- Restrict access to production data to approved roles with MFA enforced.

## 2. Record of Processing Activities (RoPA)

- Maintain a RoPA entry per processing purpose: controller/processor roles, data subjects, data categories, recipients, storage locations.
- Update RoPA whenever new features introduce data flows or third-party integrations.

## 3. Lawful Basis & Consent

- Document lawful basis for each data processing purpose (contractual, legitimate interest, consent).
- Capture consent for optional processing (marketing emails, analytics) with explicit opt-in.
- Store consent state in an auditable system; include revocation workflows.

## 4. Data Subject Rights (DSR)

- Implement processes to fulfil access, rectification, erasure, and portability requests within statutory timelines (30 days).
- Provide self-service account deletion once authentication (Phase 3) is available.
- Log DSR requests and outcomes for auditability.

## 5. Data Retention & Minimisation

- Define retention schedules for each data class; automate purges where possible.
- Ensure backups respect retention policies and are encrypted at rest.
- Avoid collecting unnecessary data; justify each attribute stored.

## 6. Vendor & Third-Party Management

- Maintain a register of sub-processors and ensure Data Processing Agreements (DPAs) are signed.
- Assess vendor compliance posture annually; document results in the vendor risk tracker.

## 7. Security & Privacy by Design

- Incorporate threat modelling and privacy impact assessments (PIAs) into the feature intake process.
- Ensure new services adopt the security defaults defined in `docs/security.md`.
- Log configuration changes impacting personal data handling.

## 8. Breach Notification Readiness

- Align incident response timelines with GDPR (72h) and KVKK requirements.
- Pre-draft regulator and customer notification templates stored in the incident playbook.
- Ensure evidence collection procedures meet forensic standards (see `docs/security/incident-response.md`).

Track progress against these controls in the Compliance roadmap and escalate gaps to the Security Lead for prioritisation.
