# Copyright Agent Skills

## 1. Search Copyright Records
Search for existing registrations on the Library of Congress (Copyright.gov) website.

**Tool:** `browser_navigate`
**URL:** `https://publicrecords.copyright.gov/`
**Target:** Search bar for artist/work name.

## 2. Prepare Application
Automate the data entry for a "Standard Application" (Single Work).

**Data Points Required:**
- **Title of Work:** (from Project Metadata)
- **Year of Completion:** (from Project Metadata)
- **Author:** (from User Profile / Brand Kit)
- **Owner of Copyright:** (from Legal Splits)
- **Citizenship/Domicile:** (from User Profile)

## 3. Fee Calculation
- Single Work (Standard): $45-$65
- Group of Unpublished Works: $85

## 4. Automation Strategy
1. **Navigate** to `https://eco.copyright.gov/`
2. **Login** using stored credentials in Secure Storage.
3. **Draft** the application by filling forms using `browser_action`.
4. **Pause** for human review before payment/submission.
