# PolicyTrace

A support tool that lets insurance software engineers see, in one view, everything every System did to a policy across logs, messages, sagas and Jira tickets, and act on messages that failed.

## Language

### Policies and risks

**Policy**:
An insurance contract that covers one or more Risks.

**Policy number**:
The identifier of a Policy. It stays the same across all of the Policy's Risks and Terms, and it is what a Lookup searches for. In production it looks like `OUT00123456`; in INT and STG it looks like `OUTINT00123456`.
_Avoid_: Policy ID, reference

**Risk**:
One insured thing on a Policy. Each Risk has its own lifecycle, Status and Terms.

**Risk code**:
The kind of Risk: `VEH` (vehicle) or `HME` (home).

**Risk status**:
Where a Risk is in its lifecycle. The codes are the same across the group's companies, even though each company has its own business rules:

- **PD** (pending): never sold yet, or reopened and being edited like a new quote, with a new Quote date and premium.
- **AC** (accepted): live and in cover.
- **CX** (cancelled): cancelled by the customer, by the insurer, automatically for non-payment, or because it Lapsed.
- **CA**: cancelled by product or underwriting rules. Only product can move it back to PD or AC. Operations and IT can't.
- **DQ**: like CA, but before the Risk was ever accepted, for customers the business doesn't want.

**Cancellation date**:
The last day of cover of a cancelled Risk. It is what drives the cancellation, not the day the Risk moved to CX or the day the customer called.

**Archived risk**:
A CX Risk whose Cancellation date has passed: a Risk cancelled with a Cancellation date of 15/10 is archived from 16/10. It isn't a stored status. Policy admin works it out from CX and the Cancellation date.
_Avoid_: Archived (alone; that is ServiceControl's word for Failure records)

**Lapsed**:
A Risk whose Term ended without a Renewal. It is stored as CX, but it is called "lapsed" to tell it apart from other cancellations.
_Avoid_: Expired, not renewed

### Terms and renewal

**Term**:
A one-year period of cover for a Risk.
_Avoid_: Period, year, cycle

**Current term**:
The Term in force right now in Policy admin. It is the Term whose live data engineers almost always need to look at and fix. Rerates has no Current term.
_Avoid_: Active term, latest term, Renewal term

**Old term**:
A Term that has ended.
_Avoid_: Previous term, expired term, past term

**Next term**:
The Term after the Current term, once a Renewal has committed it to Policy admin. While a Next term exists, the Current term is frozen, and changes can only take effect on or after the Rerate date.
_Avoid_: Future term, Renewal term, pending term

**Rerate date**:
The first day of a Risk's Next term: the day after the last day of cover of the Current term.
_Avoid_: Renewal date (ambiguous: it is also used for the day the customer actually renewed)

**Renewal**:
The regulated process that decides a Risk's next-year premium, tells the customer the outcome in a Rerate letter, and commits the Next term once the premium is paid. It bumps the Risk's Major version, and so the Policy's too.

**Rerate**:
One recalculation of a Risk's Next-term premium during Renewal.

**Rerate refresh**:
Recalculating a Risk's Rerate because its Current term was amended while the Risk was in rerates.

**Renewal batch**:
A group of Risks taken into Rerates together, usually about two months before their Rerate dates.

**In rerates**:
Describes a Risk that is in a Renewal batch being worked on by Rerates. Engineers say "it's in rerates", not "the current term in rerates".

**Rerate letter**:
What the customer is sent for a Renewal: the new premium (or why the Risk won't be renewed), whether it will Auto-renew, and the next steps.
_Avoid_: Renewal offer, renewal invite

**Auto-renew**:
A Renewal where the premium is collected automatically when the Renewal window opens, and the Next term is committed if that collection succeeds. If the collection fails, the customer is emailed and asked to contact CSD, and CRD may contact them first. If neither works out (including when the customer is UTC), the Risk Lapses.

**CSD**:
Customer service: the team customers contact about their Policy.

**CRD**:
Customer retentions: the team that proactively contacts customers to keep them, for example to take a renewal payment before the Risk lapses.

**UTC**:
Unable to contact: the customer couldn't be reached.

**Grace period**:
A window after a Risk is cancelled during which it can be Reinstated on easier terms. After it, getting back on cover is treated as a new quote with a completely new premium.

**Reinstatement**:
Putting a CX Risk back on cover, either straight to AC or through PD. Depending on why and when the Risk was cancelled, and whether it is still in its Grace period, a Reinstatement may keep the original data or reset it (Quote date, premium), and may leave a Gap in cover or charge for the missing days to close it.
_Avoid_: Unarchive, reactivation

**Gap in cover**:
A stretch of days between cancellation and Reinstatement when the Risk was not covered.

**Renewal window**:
The 7 days before the Rerate date. Within it, the customer can no longer change the Current term, only the Next term.

### Versions and changes

**Major version**:
The accepted, live version of a Policy or a Risk. A Sale creates version 1. Each accepted Amendment, and each Renewal of a Risk, creates the next Major version.
_Avoid_: Revision, snapshot

**Minor version**:
An unaccepted, in-progress version created while an Adviser works through an Amendment. It becomes the next Major version once the Adviser accepts all the changes.
_Avoid_: Draft version, sub-version

**Sale**:
The moment a Policy and its Risks are first created, at version 1.

**Amendment**:
A change to a Policy, its Risks, or both, made by an Adviser. Changes that don't touch any Risk bump only the Policy's version. Changes to a Risk bump that Risk's version and also the Policy's. Also called an **MTA** (mid-term adjustment); the two words are used interchangeably.
_Avoid_: Endorsement, change request

**Effective date**:
The date from which a Sale or an Amendment comes into force. It can be later than the day it was made. (For cancellations, the Cancellation date plays this role.)

**Adviser operation**:
The business action an Adviser was trying to do when something failed: a Sale, an Amendment (such as adding or removing a temporary driver, or adding a payment method), adding a Risk, or a Reinstatement. Engineers describe a failure's impact this way: "the adviser can't complete the sale". Always say "adviser operation", never just "operation".
_Avoid_: Operation (alone; clashes with Collection operation)

**Adviser**:
The person who sells and amends Policies on behalf of the customer.
_Avoid_: Agent, broker, user

### Pricing

**Quote date**:
The date a premium calculation is based on.

**Annual premium**:
The price of a Risk for its whole Term, calculated as if the current cover had applied since the Term started. It excludes levies and stamp duty.
_Avoid_: Price, cost

**Payment schedule**:
What the customer actually pays or is refunded for the rest of the Term after a premium change, worked out pro rata from the Annual premium and the Effective date: annually, or monthly with updated instalments.

**Payment schedule item**:
One line of a Payment schedule, such as the premium, an admin fee like stamp duty, or a refund. Its identifier is the PSIID. Once collected successfully, a Payment schedule item belongs to exactly one Transaction reference.
_Avoid_: Instalment, line

**Monthly payer**:
A customer paying a Term monthly: the first two months are taken at Sale, and the rest is spread over ten monthly collections.

**Transaction reference**:
One Collection operation for a Risk's Major version, grouping one or more Payment schedule items. The amount due is the balance of those items, and can be zero. It is written as Policy number, Risk ID, Risk Major version, Risk code and sequence number: `OUT00123456-1-1-VEH-1`. So it contains the Policy number. A failed attempt is retried as a new Transaction reference with the next sequence number and the same Payment schedule items (`…-VEH-2`).

**Collection operation**:
What Collections does under a Transaction reference: a Collection, a Refund, or a Write-off. Always say "collection operation", never just "operation".

**Collection**:
Taking money from the customer under a Transaction reference.

**Refund**:
Returning money to the customer under a Transaction reference.

**Write-off**:
Reversing in the Shadow ledger a Collection that was sent there as successful but later failed, for example a SEPA direct debit whose failure notice arrives about two days later. It means the money isn't in the account after all.
_Avoid_: Reversal, chargeback

**Collection status**:
Where a Transaction reference is in Collections. Every one starts as **Created**, then ends as **Collected**, **Refunded** or **Rejected** (failed). A zero-amount Transaction reference stays Created.

### Systems

**System**:
A group of endpoints owned and talked about as one unit. A Lookup shows every System in one view, because a failure often starts in one System and surfaces in another.

**Policy admin**:
The System that holds Policies, Risks and their Terms, and where Sales and Amendments happen.

**Rerates**:
The System that handles Renewals. It's owned by the same team, but it's separate from Policy admin and works only on the Next term.
_Avoid_: Renewals system

**Calc engine**:
The System that prices a Risk from the rating factors supplied by product (actuaries and underwriting), returning an Annual premium.

**Payment schedule service**:
The System that turns an Annual premium and an Effective date into a Payment schedule.

**Profile service**:
The System that provides the excess and sum-insured ranges a Risk can choose from.

**Collections**:
The System that turns Payment schedule items into Transaction references and collects or refunds them through the Payment gateway.

**Comms orchestrator**:
The System that sends customer communications, such as Rerate letters and emails, including documents rendered by Documents.

**Documents**:
The System that renders customer documents, which the Comms orchestrator then sends.

**Claims**:
The System that connects Policies to claims handling.

**Payment gateway**:
The System that takes payments: the last step between the business and the Payment providers.

**Payment provider**:
A third party that actually moves the money: Bank of Ireland (BOI) for SEPA direct debits, and Global Payments for cards. Global Payments was formerly integrated as BOIPA, so it's the same provider under a different brand and integration route.

**Shadow ledger**:
A ledger that combines Collections with the Payment schedules from Policy admin to produce the daily export to Dynamics. A common support problem is a **missing entry in the shadow ledger**: a Transaction reference that's missing, or a Collection, Refund or Write-off that's missing for one.

**Dynamics**:
Dynamics 365 Finance & Operations, the finance system that receives the Shadow ledger's daily export.
_Avoid_: D365, F&O (as separate names)

### Messages

**Message**:
A logical NServiceBus message, identified by its MessageId. One Message can have several Failure records.
_Avoid_: Event, command (unless the distinction matters), record

**Status**:
A Message's latest known outcome across all its records, using ServiceControl's names: successful, failed, retry issued, resolved, and deleted (which ServiceControl calls archived). A Message that failed more than once is still "failed", shown with its attempt count. Not to be confused with Risk status.
_Avoid_: Repeated failure, state

**Conversation**:
Every Message caused, directly or indirectly, by one initiating Message. A Replacement message stays in the original's Conversation.
_Avoid_: Flow, thread, chain

**Failure record**:
ServiceControl's record of a Message that failed processing. It is the thing an Operator retries or archives.
_Avoid_: Failed message (ambiguous with Message), error

**Replacement message**:
A new Message created when an Operator edits and retries a Failure record. It is linked to the original Message.
_Avoid_: Edited message, copy

**Resolved**:
A Failure record that was retried and then processed successfully.
_Avoid_: Fixed, done

**Deleted**:
A Failure record that an Operator has removed as not to be retried. It is purged when the retention period ends (about 30 days). ServiceControl and ServicePulse call this "archive", but engineers say "delete". **Restore** brings a Deleted Failure record back before it's purged.
_Avoid_: Archived (for Failure records), dismissed

### Investigation

**Lookup**:
A search for one Policy number across Seq and ServiceControl over a time window. It covers every System at once, so the whole story is in one view. It can reach back about 30 days at most, because neither source keeps anything older.
_Avoid_: Trace, search, query

**Timeline**:
The merged, chronological list of Messages and log events that a Lookup returns.
_Avoid_: Feed, history, results

**Noise**:
Any log event or Message produced by infrastructure rather than by business processing for the policy. It is hidden from Lookups by default, and which items count as Noise is configured per environment.
_Avoid_: Framework logs, chatter

### Actions

**Operator**:
The support engineer who performs an Action in PolicyTrace.
_Avoid_: User, admin

**Action**:
A change an Operator makes to Failure records: retry, edit-and-retry, delete or restore. Not to be confused with an Adviser operation or a Collection operation.
_Avoid_: Operation, command

### Jira

**Related ticket**:
A Jira ticket linked to a policy or Message by a Relation and labelled with a Hint.

**Relation**:
Why a Related ticket was matched. There are three:

- **Mentions policy**: the Policy number appears anywhere in the ticket.
- **Matches error**: the failure's exception type appears in the ticket.
- **Recent change**: the ticket's component maps to the failing endpoint, and the ticket was resolved within a configured window before the first failure.

**Hint**:
What a Related ticket probably means for the investigation: possible cause, possible fix, or just related. It is derived by fixed rules from the Relation and from when the ticket changed compared with the failure.
_Avoid_: Score, confidence
