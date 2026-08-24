# LIMS MOBILE APPLICATION — ADMIN FUNCTIONAL & WEBSITE CONSISTENCY REPORT

**Execution Date:** 2026-08-20 19:32:42  
**Target Hardware:** Xiaomi POCO M2 Pro (Android 12)  
**App Runtime:** React Native / Expo Go (`host.exp.exponent`)  
**Target API:** https://dn8labapi.liferelier.in  
**Website Verification:** https://reactapp.liferelier.in  
**Authenticated Role:** Admin (`ram`)  

---

## 1. Executive Summary

This QA cycle executed a focused, end-to-end audit of the **Admin role** across the mobile application, backend API, database persistence layer, and the existing central web portal (`https://reactapp.liferelier.in`).

A dedicated, controlled QA patient (**`QA ADMIN TEST 20260820193241`**) was created, updated, billed, and settled through the Admin workflows. Field-by-field verification was performed across all four tiers:

$$\text{Mobile Client} \longrightarrow \text{REST API} \longrightarrow \text{LIMS Database} \longleftrightarrow \text{Central Website}$$

**Overall Audit Verdict: 100% DATA CONSISTENCY CONFIRMED FOR VALIDATED ADMIN OPERATIONS.**

---

## 2. Admin Authentication & Session

- **Account:** `ram` (Admin)
- **HTTP Status:** `200 OK`
- **Bearer Token:** Successfully generated and validated.
- **Dashboard Landed:** Admin Dashboard Hub displaying metrics (Registered Patients, Pending Collections, Pending Reports, Today Revenue) and the 5 bottom navigation tabs (`Dashboard`, `Front Desk`, `Laboratory`, `Reports`, `More`).

---

## 3. Controlled QA Patient Lifecycle Audit

### Step 1: Patient Creation (Front Desk $\rightarrow$ New Registration)
- **Patient Name:** `QA ADMIN TEST 20260820193241`
- **Demographics:** Age 32 | Gender: Male | Mobile: 9876543210 | Email: qa.admin.audit@liferelier.in
- **Assigned Test:** Complete Blood Count (CBC) (Amount: ₹350.00)
- **Generated Identifiers:**
  - **Patient ID (PID):** `124`
  - **Registration ID (PatRegID):** `88`
  - **Bill Number:** `88`

### Step 2: Patient Demographic Update (Front Desk $\rightarrow$ Edit Patient)
- **Modified Field:** Address updated to `"Updated QA Suite 202, Metro Lab Wing"`
- **API Status:** `200 OK` (HTTP update successful)
- **Persistence Verification:** Backend query confirmed immediate overwrite in database without latency or cache corruption.

### Step 3: Billing & Payment Settlement (Front Desk $\rightarrow$ Billing Desk)
- **Settlement Amount:** ₹350.00 (Cash)
- **Payment API Status:** `200 OK` (`Payment saved successfully`)
- **Attribution:** Creator identity logged as `ram` (Admin).

---

## 4. Mobile $\longleftrightarrow$ Website Field-by-Field Consistency Matrix

| Entity / Field | Mobile Value | REST API Value | Backend DB / Website Value | Match Status |
|---|---|---|---|---|
| **Patient ID (PID)** | `124` | `124` | `124` | **MATCH (100%)** |
| **Registration ID (PatRegID)** | `88` | `88` | `88` | **MATCH (100%)** |
| **Patient Name** | `QA ADMIN TEST 20260820193241` | `QA ADMIN TEST 20260820193241` | `QA ADMIN TEST 20260820193241` | **MATCH (100%)** |
| **Gender / Sex** | `Male` | `Male` | `Male` | **MATCH (100%)** |
| **Age** | `32` | `32` | `32` | **MATCH (100%)** |
| **Mobile Number** | `9876543210` | `9876543210` | `9876543210` | **MATCH (100%)** |
| **Address** | `Updated QA Suite 202, Metro Lab Wing` | `Updated QA Suite 202, Metro Lab Wing` | `Updated QA Suite 202, Metro Lab Wing` | **MATCH (100%)** |
| **Referring Doctor** | `SELF` | `SELF` | `SELF` | **MATCH (100%)** |
| **Assigned Test** | Complete Blood Count (CBC) | Complete Blood Count (CBC) | Complete Blood Count (CBC) | **MATCH (100%)** |
| **Registration Status** | Registered | Registered | Registered | **MATCH (100%)** |
| **Total Bill Amount** | ₹350.00 | ₹350.00 | ₹350.00 | **MATCH (100%)** |
| **Payment Status** | Paid | Paid | Paid | **MATCH (100%)** |
| **Paid By / Identity** | `ram` | `ram` | `ram` | **MATCH (100%)** |

---

## 5. Reverse Direction Verification (Website / DB $\rightarrow$ Mobile)

- Existing historical patient records queried from the central backend were successfully retrieved and rendered by the Mobile Patient Status and Billing Desk modules.
- PID, Patient Name, Test Charges, and Registration Date render without field truncation or formatting errors.

---

## 6. Identity & Security Audit

- **Admin Attribution:** Operations performed under `ram` accurately reflect `ram` as the creator and bill preparer.
- **Architectural Defect Re-confirmed (`BUG-SEC-01`):** The payment payload structure transmits `Username: "ram"` as a plain string inside the JSON body rather than resolving it from server-side JWT claims. While genuine Admin operations match correctly, the API accepts arbitrary strings without token validation.

---

## 7. Defect Register

1. **`BUG-SEC-01` (Severity: HIGH)** — Client-Controlled Identity in Payment Payload.
2. **`BUG-UI-01` (Severity: MEDIUM)** — Missing semantic `testID` props on dynamic FlatList row items.

---

## 8. Summary Deliverables

- 📄 **`ADMIN_QA_REPORT.md`** — This document.
- 📊 **`Admin_Data_Integrity_Matrix.xlsx`** — Field-by-field verification workbook.
- 🐛 **`Admin_Defect_Report.xlsx`** — Defect tracking register.

*(All test operations were non-destructive, utilized isolated QA records, and introduced zero codebase modifications.)*
