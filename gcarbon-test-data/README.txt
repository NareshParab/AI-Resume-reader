GCARBON RESUME AI — TEST DATA SET
===================================

10 resumes across different fields (all fictional test data):
  01 Priya Nair       — Registered Nurse (Healthcare)
  02 Marcus Bell      — B2B Sales Executive (Sales)
  03 Aisha Rahman     — Marketing Coordinator (Marketing)
  04 Daniel Osei      — Elementary School Teacher (Education)
  05 Sofia Martinez   — Hotel Front Office Manager (Hospitality)
  06 Rajesh Kulkarni  — Staff Accountant (Finance)
  07 Emily Chen       — Civil Engineer (Engineering)
  08 Liam O'Connor    — Graphic Designer (Creative)
  09 Fatima Zahra     — HR Generalist (Human Resources)
  10 Tom Baxter       — Licensed Electrician (Skilled Trade)

Each resume uses slightly different section headings (e.g. "Experience" vs
"Employment History" vs "Work History", "Education" vs "Education &
Certification") and skills formatting (bulleted vs pipe-separated) on
purpose — this stress-tests the parser's section-detection logic, not
just the AI.

5 matching job descriptions:
  jd_registered_nurse.txt       -> best match: 01 (others should score low)
  jd_sales_executive.txt        -> best match: 02
  jd_marketing_coordinator.txt  -> best match: 03
  jd_accountant.txt             -> best match: 06
  jd_customer_service.txt       -> general/soft-skills role, no strong match
                                    expected (good test of honest low scores)

HOW TO TEST
-----------
Single-resume flow: upload each of the 10 resumes one at a time, run
Parse + Generate AI Insights on each. Check: does the extracted profile
look accurate for that field? Does the AI summary/strengths/suggestions
make sense and stay grounded in what's actually on the resume?

Batch flow: pick one job description (e.g. jd_registered_nurse.txt),
upload all 10 resumes against it in one batch. Check: does the matching
candidate (Priya Nair) score highest? Do the other 9 score honestly low,
with reasoning that makes sense? Does "Matched Skills (AI)" show real,
relevant terms for the top candidate and stay empty/sparse for mismatches?

Repeat with a different job description each time to see how ranking
changes when the "right" candidate changes.
