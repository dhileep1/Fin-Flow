---
description: UI Visual Coherence Reviewer
---

FinFlow UI Visual Coherence Audit Agent

This agent performs a strict, system-driven visual audit of the FinFlow UI to enforce design consistency, eliminate drift, and maintain a production-grade design system.

Objective

Identify all deviations from the defined design system and produce actionable fixes (not just observations). The output must be precise enough for direct implementation.

Prerequisites
Frontend running:
cd frontend && npm run dev
Backend running with seeded database
Access to:
index.css (design tokens)
Component library (buttons, inputs, cards, etc.)
backend/prisma/seed.js (for credentials if needed)
Execution Workflow
Step 1 — Launch Application

Open:

http://localhost:5174/
Step 2 — Authentication
Attempt login
If credentials unknown:
Inspect backend/prisma/seed.js
Extract:
Org ID
Admin email/password
Step 3 — Page Coverage (MANDATORY)

Audit every listed route and its states:

Dashboard → /
Call Panel → /calls
Loan List → /loans
Loan Detail → /loans/:id
New Loan → /loans/new
Customers → /customers
Admin → /admin
WhatsApp → /whatsapp
Additionally:
Click every interactive element:
Buttons
Dropdowns
Modals / popups
Forms
Tabs
Trigger:
Empty states
Error states
Loading states (if possible)
Evaluation Framework (STRICT)
1. Color System
ONLY allowed:
Tokens from index.css
Slate scale (500–950)
Emerald-500 (primary accent)
Flag:
Hardcoded colors
Inconsistent shades
Opacity misuse

Output format:

[Page] عنصر → Uses #XYZ instead of var(--slate-700)
Fix: Replace with token
2. Typography
Font must be: Inter
Enforce:
Consistent font sizes
Standard weights (400, 500, 600, 700)
Flag:
Inline font overrides
Inconsistent heading hierarchy
3. Component Consistency

Validate against global design system components:

Buttons
Inputs
Cards
Tables
Modals

Flag:

One-off styles
Inline Tailwind overrides breaking consistency
Variants not matching system definitions
4. Spacing & Layout
Enforce 8px grid system
Check:
Padding consistency
Margin rhythm
Alignment (left edges, baselines)

Flag:

Arbitrary spacing (e.g., mt-[13px])
Misaligned sections
5. Interaction States

Verify:

Hover
Focus
Active
Disabled

Flag:

Missing states
Inconsistent transitions
Accessibility issues (no focus ring)
6. Visual Hierarchy

Check:

Clear primary vs secondary actions
Proper emphasis using:
Size
Color
Weight

Flag:

Competing CTAs
Poor contrast
Flat UI with no hierarchy
7. Forms & Data UX
Input alignment
Label consistency
Error messaging
Placeholder usage

Flag:

Misaligned fields
Inconsistent validation UI
Missing helper/error text
Output Requirements (NON-NEGOTIABLE)
1. Page-wise Report

Structure:

## /loans

Issues:
1. Button inconsistency
   - Primary button uses emerald-600 instead of emerald-500
   Fix: Update class to bg-emerald-500

2. Spacing violation
   - Card padding is 18px instead of 16px
   Fix: Replace with p-4
2. Global Violations

List systemic issues:

Token misuse
Typography drift
Component duplication
3. Code-Level Fixes

Provide:

Exact Tailwind replacements OR
CSS token updates OR
Component refactor suggestions

Example:

Replace:
className="bg-green-600 px-5 py-2"

With:
className="bg-emerald-500 px-4 py-2"
4. Design System Gaps

Identify missing abstractions:

"No standard modal component"
"Multiple button styles instead of variants"
5. Priority Classification

Tag each issue:

CRITICAL → breaks system consistency
MAJOR → noticeable inconsistency
MINOR → polish
Behavioral Constraints
Do NOT describe UI vaguely
Do NOT say "looks good" or "slightly off"
Every issue MUST include:
Location
Problem
Fix
Final Instruction to Subagent

Trigger browser_subagent with:

Perform a full visual coherence audit of http://localhost:5174/
 following the strict evaluation framework.

Do not skip interactions, modals, or edge states.

Output only structured, actionable findings with exact fixes. No vague commentary.