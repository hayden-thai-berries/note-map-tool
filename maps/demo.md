# Sheets Ecosystem Map

## Operations
Lead: Kim Tran · IT contact: Sam
> Weekly stock count — Fridays, Ops lead
  Count on the warehouse floor, then update Inventory before 3pm.
- Inventory | Kim | high
  Master stock levels. Only Kim and Raj can edit.
- Orders | Kim | high
  Feeds the Sales pipeline through IMPORTRANGE.
> Suppliers
- Supplier List | Raj | medium

## Sales
Lead: Ana Cole
> Quote approval — per quote, Sales manager
- Pipeline | Ana | high
- Quotes | Lee | high
  Quotes over $10k need Finance sign-off before they go out.
> Planning
- Targets | Ana | medium

## Finance
Lead: Sam Ortiz
> Month-end close — days 1–3, Finance lead
  Starts on the first working day. Budget Tracker is locked once the close is signed off.
- Budget Tracker | Sam | high
- Invoice Log | Priya | high
> Payroll run — fortnightly
- Payroll Summary | Sam | high
  Headcount is copied in by hand before each run. Check the totals against HR.

## HR
Lead: Jo Park
> New starter setup — on hire, HR admin
- Onboarding Checklist | Jo | low
- Headcount | Jo | high
  Source of truth for payroll. Update within one day of any change.
> Leave
- Leave Requests | Jo | medium

## Apps
- Vendor portal | Supplier price export
- CRM | Daily connector sync
  Owned by Sales ops. If the sync fails, Quotes stops updating.
- Looker Studio | Finance dashboard
- Slack | Apps Script reminders

## Links
- Orders -> Pipeline | IMPORTRANGE
- Quotes -> Invoice Log | IMPORTRANGE
- Headcount -> Payroll Summary | manual copy
- Vendor portal -> Supplier List | CSV import
- CRM -> Quotes | connector, daily
- Invoice Log -> Looker Studio | connector
- Onboarding Checklist -> Slack | Apps Script
