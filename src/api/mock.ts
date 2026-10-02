import {
  ActionResult,
  AppConfig,
  ConversationGraph,
  LogEvent,
  LookupResult,
  MessageDetail,
  MessageStatus,
  MessageSummary,
  Paged,
  ProblemDetails,
  RelatedTicket,
  RelatedTicketsResult,
  SagaHistory,
  TimelineItem,
} from "./types";

export class ApiProblemError extends Error {
  title: string;
  detail: string;
  status: number;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiProblemError";
    this.title = problem.title;
    this.detail = problem.detail;
    this.status = problem.status;
  }
}

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

export const MOCK_CONFIG: AppConfig = {
  environmentName: "INT",
  seqPublicUrl: "https://seq.int.stratos-insure.internal",
  servicePulsePublicUrl: "https://servicepulse.int.stratos-insure.internal",
  actions: {
    retry: true,
    archive: true,
    edit: true,
    maxBatchSize: 5,
  },
  defaultLookbackDays: 7,
  policyNumberPattern: "^OUTINT\\d{8}$",
  jira: {
    enabled: true,
    baseUrl: "https://jira.stratos-insure.internal",
  },
};

export const MOCK_ENDPOINTS: string[] = [
  "policy-admin",
  "policy-admin-api",
  "billing-ledger-worker",
  "document-render-worker",
  "claims-bridge",
];

// Helper to build ISO timestamps relative to Oct 2, 2026
function isoMinutesAgo(minsAgo: number): string {
  const base = new Date("2026-10-02T13:15:00.000Z").getTime();
  return new Date(base - minsAgo * 60 * 1000).toISOString();
}

const SAGA_ID_MAIN = "saga-9941a-softlock-00118618";
const SAGA_ID_RENEW = "saga-7712b-renewal-00118618";

const CONV_1 = "conv-810a-4412-lock-workflow";
const CONV_2 = "conv-810b-8891-endorsement";
const CONV_3 = "conv-810c-9930-renewal-calc";

// Mutable message store so retry/archive/edit-retry actions mutate state & settle
const messageStore: Map<string, MessageDetail> = new Map();

function buildInitialMessages(): MessageDetail[] {
  const list: MessageDetail[] = [
    // Conversation 1: SoftLock & Validation workflow (6 messages)
    {
      id: "msg-02ee40a6",
      messageId: "02ee40a6-723f-4511-a004-b4d500ac3188",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Policies.AcquireSoftLock.AcquireSoftLockCommand",
      status: "successful",
      sendingEndpoint: "policy-admin-api",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(195),
      processedAt: isoMinutesAgo(194.9),
      conversationId: CONV_1,
      sagaIds: [SAGA_ID_MAIN],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/02ee40a6-723f-4511-a004-b4d500ac3188",
      headers: {
        "NServiceBus.MessageId": "02ee40a6-723f-4511-a004-b4d500ac3188",
        "NServiceBus.ConversationId": CONV_1,
        "NServiceBus.MessageIntent": "Send",
        "NServiceBus.EnclosedMessageTypes":
          "Stratos.Core.PolicyAdmin.Commands.Policies.AcquireSoftLock.AcquireSoftLockCommand, Stratos.Core.PolicyAdmin.Messages",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-lock-901a",
        "x-stratos-session-id": "sess-uw-4410",
        "NServiceBus.OriginatingEndpoint": "policy-admin-api",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          lockOwner: "uw.j.kovacs@stratos-insure.internal",
          lockReason: "MidTermEndorsementAdjustment",
          requestedDurationMinutes: 15,
          correlationToken: "corr-88412-a",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-14bf81c2",
      messageId: "14bf81c2-510a-4910-9a11-b4d500ac3490",
      messageType:
        "Stratos.Core.PolicyAdmin.Events.Policies.PolicySoftLockedEvent",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin-api",
      timeSent: isoMinutesAgo(194.8),
      processedAt: isoMinutesAgo(194.5),
      conversationId: CONV_1,
      sagaIds: [SAGA_ID_MAIN],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/14bf81c2-510a-4910-9a11-b4d500ac3490",
      headers: {
        "NServiceBus.MessageId": "14bf81c2-510a-4910-9a11-b4d500ac3490",
        "NServiceBus.ConversationId": CONV_1,
        "NServiceBus.MessageIntent": "Publish",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-lock-901a",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          sagaId: SAGA_ID_MAIN,
          lockedAtUtc: isoMinutesAgo(194.8),
          expiresAtUtc: isoMinutesAgo(179.8),
          lockVersion: 4,
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-2937a3e5",
      messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Policies.ExpireSoftLock.ExpireSoftLockCommand",
      status: "failed",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(179.8),
      processedAt: isoMinutesAgo(179.5),
      conversationId: CONV_1,
      sagaIds: [SAGA_ID_MAIN],
      exceptionType: "Microsoft.Azure.Cosmos.CosmosException",
      exceptionMessage:
        "Response status code does not indicate success: PreconditionFailed (412); Substatus: 0; ETag mismatch on partition key 'OUTINT00118618' while releasing soft lock v4.",
      numberOfProcessingAttempts: 5,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      headers: {
        "NServiceBus.MessageId": "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
        "NServiceBus.ConversationId": CONV_1,
        "NServiceBus.MessageIntent": "Send",
        "NServiceBus.EnclosedMessageTypes":
          "Stratos.Core.PolicyAdmin.Commands.Policies.ExpireSoftLock.ExpireSoftLockCommand, Stratos.Core.PolicyAdmin.Messages",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-lock-901a",
        "x-stratos-session-id": "sess-uw-4410",
        "NServiceBus.Retries": "5",
        "NServiceBus.ExceptionInfo.ExceptionType":
          "Microsoft.Azure.Cosmos.CosmosException",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          expectedLockVersion: 4,
          forceReleaseOnVersionMismatch: false,
          sagaId: SAGA_ID_MAIN,
          expiredAtUtc: isoMinutesAgo(179.8),
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "NServiceBus.EnclosedMessageTypes",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `Microsoft.Azure.Cosmos.CosmosException : Response status code does not indicate success: PreconditionFailed (412); Substatus: 0; ActivityId: 8c12f90e-221a-4b99-8311-00219ab41e90; Reason: (ETag mismatch on partition key 'OUTINT00118618' while releasing soft lock v4.)
   at Microsoft.Azure.Cosmos.ResponseMessage.EnsureSuccessStatusCode()
   at Stratos.Infrastructure.Cosmos.PolicyDocumentRepository.UpsertWithETagAsync(PolicyAggregate policy, String expectedETag, CancellationToken ct) in /src/Stratos.Infrastructure.Cosmos/PolicyDocumentRepository.cs:line 148
   at Stratos.Out.PolicyAdmin.Worker.Handlers.ExpireSoftLockCommandHandler.Handle(ExpireSoftLockCommand message, IMessageHandlerContext context) in /src/Stratos.Out.PolicyAdmin.Worker/Handlers/ExpireSoftLockCommandHandler.cs:line 64
   at NServiceBus.InvokeHandlerTerminator.Terminate(IInvokeHandlerContext context) in /_/src/NServiceBus.Core/Pipeline/Incoming/InvokeHandlerTerminator.cs:line 32`,
    },
    {
      id: "msg-3810c9a1",
      messageId: "3810c9a1-4b22-4190-9f11-b4d500ad0912",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Policies.SyncPolicyReadModel.SyncPolicyReadModelCommand",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin-api",
      timeSent: isoMinutesAgo(178),
      processedAt: isoMinutesAgo(177.8),
      conversationId: CONV_1,
      sagaIds: [SAGA_ID_MAIN],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/3810c9a1-4b22-4190-9f11-b4d500ad0912",
      headers: {
        "NServiceBus.MessageId": "3810c9a1-4b22-4190-9f11-b4d500ad0912",
        "NServiceBus.ConversationId": CONV_1,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-lock-901a",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          projectionName: "PolicySummaryReadModel",
          sourceVersion: 5,
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },

    // Conversation 2: Endorsement & Rating calculation (6 messages)
    {
      id: "msg-4401d8f0",
      messageId: "4401d8f0-991a-4c11-8812-b4d500ae1001",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Endorsements.SubmitEndorsementCommand",
      status: "successful",
      sendingEndpoint: "policy-admin-api",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(125),
      processedAt: isoMinutesAgo(124.7),
      conversationId: CONV_2,
      sagaIds: [],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/4401d8f0-991a-4c11-8812-b4d500ae1001",
      headers: {
        "NServiceBus.MessageId": "4401d8f0-991a-4c11-8812-b4d500ae1001",
        "NServiceBus.ConversationId": CONV_2,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-end-772b",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          endorsementNumber: "END-2026-004",
          effectiveDate: "2026-10-15",
          coverageDelta: {
            section: "CommercialProperty",
            sumInsuredGBP: 2450000,
            deductibleGBP: 5000,
          },
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-4402e9a1",
      messageId: "4402e9a1-991a-4c11-8812-b4d500ae1002",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Rating.CalculateEndorsementPremiumCommand",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(124.6),
      processedAt: isoMinutesAgo(124.1),
      conversationId: CONV_2,
      sagaIds: [],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/4402e9a1-991a-4c11-8812-b4d500ae1002",
      headers: {
        "NServiceBus.MessageId": "4402e9a1-991a-4c11-8812-b4d500ae1002",
        "NServiceBus.ConversationId": CONV_2,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-end-772b",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          endorsementNumber: "END-2026-004",
          tariffVersion: "COMMERCIAL-UK-2026.09",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-4403f1b2",
      messageId: "4403f1b2-991a-4c11-8812-b4d500ae1003",
      messageType:
        "Stratos.Core.PolicyAdmin.Events.Endorsements.EndorsementPricedEvent",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "billing-ledger-worker",
      timeSent: isoMinutesAgo(124.0),
      processedAt: isoMinutesAgo(123.6),
      conversationId: CONV_2,
      sagaIds: [],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/4403f1b2-991a-4c11-8812-b4d500ae1003",
      headers: {
        "NServiceBus.MessageId": "4403f1b2-991a-4c11-8812-b4d500ae1003",
        "NServiceBus.ConversationId": CONV_2,
        "NServiceBus.MessageIntent": "Publish",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-end-772b",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          endorsementNumber: "END-2026-004",
          netPremiumDeltaGBP: 412.5,
          iptTaxRate: 0.12,
          grossPremiumDeltaGBP: 462.0,
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-4404a2c3",
      messageId: "4404a2c3-991a-4c11-8812-b4d500ae1004",
      messageType:
        "Stratos.Core.Billing.Commands.PostEndorsementLedgerEntryCommand",
      status: "repeatedFailure",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "billing-ledger-worker",
      timeSent: isoMinutesAgo(123.5),
      processedAt: isoMinutesAgo(121.0),
      conversationId: CONV_2,
      sagaIds: [],
      exceptionType:
        "Stratos.Billing.Domain.Exceptions.TaxJurisdictionMappingException",
      exceptionMessage:
        "Missing IPT tax schedule mapping for endorsement 'END-2026-004' on policy 'OUTINT00118618' with effective date 2026-10-15 (SubRegionCode=null).",
      numberOfProcessingAttempts: 10,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/4404a2c3-991a-4c11-8812-b4d500ae1004",
      headers: {
        "NServiceBus.MessageId": "4404a2c3-991a-4c11-8812-b4d500ae1004",
        "NServiceBus.ConversationId": CONV_2,
        "NServiceBus.MessageIntent": "Send",
        "NServiceBus.EnclosedMessageTypes":
          "Stratos.Core.Billing.Commands.PostEndorsementLedgerEntryCommand, Stratos.Core.Billing.Messages",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-end-772b",
        "x-stratos-session-id": "sess-uw-4410",
        "NServiceBus.Retries": "10",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          endorsementNumber: "END-2026-004",
          netAmountGBP: 412.5,
          taxScheduleCode: "UK-IPT-STD-2026",
          subRegionCode: null,
          accountReference: "LEDGER-OUTINT00118618",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "NServiceBus.EnclosedMessageTypes",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `Stratos.Billing.Domain.Exceptions.TaxJurisdictionMappingException : Missing IPT tax schedule mapping for endorsement 'END-2026-004' on policy 'OUTINT00118618' with effective date 2026-10-15 (SubRegionCode=null).
   at Stratos.Billing.Domain.Services.TaxScheduleResolver.ResolveSchedule(String taxScheduleCode, String subRegionCode, DateOnly effectiveDate) in /src/Stratos.Billing.Domain/Services/TaxScheduleResolver.cs:line 89
   at Stratos.Billing.Worker.Handlers.PostEndorsementLedgerEntryHandler.Handle(PostEndorsementLedgerEntryCommand message, IMessageHandlerContext context) in /src/Stratos.Billing.Worker/Handlers/PostEndorsementLedgerEntryHandler.cs:line 47
   at NServiceBus.InvokeHandlerTerminator.Terminate(IInvokeHandlerContext context) in /_/src/NServiceBus.Core/Pipeline/Incoming/InvokeHandlerTerminator.cs:line 32`,
    },
    {
      id: "msg-4405b3d4",
      messageId: "4405b3d4-991a-4c11-8812-b4d500ae1005",
      messageType:
        "Stratos.Core.Documents.Commands.RenderEndorsementScheduleCommand",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "document-render-worker",
      timeSent: isoMinutesAgo(123.2),
      processedAt: isoMinutesAgo(122.4),
      conversationId: CONV_2,
      sagaIds: [],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/4405b3d4-991a-4c11-8812-b4d500ae1005",
      headers: {
        "NServiceBus.MessageId": "4405b3d4-991a-4c11-8812-b4d500ae1005",
        "NServiceBus.ConversationId": CONV_2,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-end-772b",
        "x-stratos-session-id": "sess-uw-4410",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          templateId: "TMPL-COMM-END-V3",
          endorsementNumber: "END-2026-004",
          outputFormat: "PDF/A-1b",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: false,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },

    // Conversation 3: Renewal Pre-Check & Underwriting Rules (4 messages)
    {
      id: "msg-7701a111",
      messageId: "7701a111-331b-4d00-9911-b4d500af2001",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Renewals.InitiateRenewalEvaluationCommand",
      status: "successful",
      sendingEndpoint: "policy-admin-api",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(48),
      processedAt: isoMinutesAgo(47.6),
      conversationId: CONV_3,
      sagaIds: [SAGA_ID_RENEW],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/7701a111-331b-4d00-9911-b4d500af2001",
      headers: {
        "NServiceBus.MessageId": "7701a111-331b-4d00-9911-b4d500af2001",
        "NServiceBus.ConversationId": CONV_3,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-ren-310c",
        "x-stratos-session-id": "sess-batch-990",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          targetRenewalDate: "2026-11-01",
          channel: "BrokerPortalAutomated",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-7702b222",
      messageId: "7702b222-331b-4d00-9911-b4d500af2002",
      messageType:
        "Stratos.Core.Claims.Queries.FetchClaimsHistorySnapshotQuery",
      status: "successful",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "claims-bridge",
      timeSent: isoMinutesAgo(47.5),
      processedAt: isoMinutesAgo(47.1),
      conversationId: CONV_3,
      sagaIds: [SAGA_ID_RENEW],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/7702b222-331b-4d00-9911-b4d500af2002",
      headers: {
        "NServiceBus.MessageId": "7702b222-331b-4d00-9911-b4d500af2002",
        "NServiceBus.ConversationId": CONV_3,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-ren-310c",
        "x-stratos-session-id": "sess-batch-990",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          lookbackYears: 5,
          includeOpenReserves: true,
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-7703c333",
      messageId: "7703c333-331b-4d00-9911-b4d500af2003",
      messageType:
        "Stratos.Core.Claims.Replies.ClaimsHistorySnapshotReply",
      status: "successful",
      sendingEndpoint: "claims-bridge",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(47.0),
      processedAt: isoMinutesAgo(46.6),
      conversationId: CONV_3,
      sagaIds: [SAGA_ID_RENEW],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 1,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/7703c333-331b-4d00-9911-b4d500af2003",
      headers: {
        "NServiceBus.MessageId": "7703c333-331b-4d00-9911-b4d500af2003",
        "NServiceBus.ConversationId": CONV_3,
        "NServiceBus.MessageIntent": "Reply",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-ren-310c",
        "x-stratos-session-id": "sess-batch-990",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          totalClaimsCount: 1,
          incurredLossGBP: 12400.0,
          lossRatioPct: 14.2,
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
    {
      id: "msg-7704d444",
      messageId: "7704d444-331b-4d00-9911-b4d500af2004",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Renewals.PublishRenewalInviteCommand",
      status: "retryIssued",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin-api",
      timeSent: isoMinutesAgo(46.2),
      processedAt: isoMinutesAgo(45.9),
      conversationId: CONV_3,
      sagaIds: [SAGA_ID_RENEW],
      exceptionType: "System.InvalidOperationException",
      exceptionMessage:
        "Cannot publish renewal invite for policy 'OUTINT00118618' while active SoftLock 'saga-9941a-softlock-00118618' remains unreleased.",
      numberOfProcessingAttempts: 3,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/7704d444-331b-4d00-9911-b4d500af2004",
      headers: {
        "NServiceBus.MessageId": "7704d444-331b-4d00-9911-b4d500af2004",
        "NServiceBus.ConversationId": CONV_3,
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-ren-310c",
        "x-stratos-session-id": "sess-batch-990",
      },
      body: `<RenewalInvite xmlns="urn:stratos:policyadmin:renewal:v2">
  <PolicyNumber>OUTINT00118618</PolicyNumber>
  <RenewalTerm>2026-11-01/2027-10-31</RenewalTerm>
  <ProposedGrossPremium currency="GBP">18940.00</ProposedGrossPremium>
  <RequiresUnderwriterSignoff>false</RequiresUnderwriterSignoff>
</RenewalInvite>`,
      bodyContentType: "application/xml",
      bodyEditable: false,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `System.InvalidOperationException : Cannot publish renewal invite for policy 'OUTINT00118618' while active SoftLock 'saga-9941a-softlock-00118618' remains unreleased.
   at Stratos.Out.PolicyAdmin.Worker.Domain.PolicyGuard.EnsureUnlocked(PolicyAggregate policy) in /src/Stratos.Out.PolicyAdmin.Worker/Domain/PolicyGuard.cs:line 29
   at Stratos.Out.PolicyAdmin.Worker.Handlers.PublishRenewalInviteHandler.Handle(PublishRenewalInviteCommand message, IMessageHandlerContext context) in /src/Stratos.Out.PolicyAdmin.Worker/Handlers/PublishRenewalInviteHandler.cs:line 52`,
    },

    // Additional messages on other policies for /messages and /failed views
    {
      id: "msg-9001e555",
      messageId: "9001e555-882a-4901-a122-b4d500b01101",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Policies.ExpireSoftLock.ExpireSoftLockCommand",
      status: "failed",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(92),
      processedAt: isoMinutesAgo(91.5),
      conversationId: "conv-9001-other-policy",
      sagaIds: ["saga-other-00229401"],
      exceptionType: "Microsoft.Azure.Cosmos.CosmosException",
      exceptionMessage:
        "Response status code does not indicate success: PreconditionFailed (412); Substatus: 0; ETag mismatch on partition key 'OUTINT00229401' while releasing soft lock v2.",
      numberOfProcessingAttempts: 5,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/9001e555-882a-4901-a122-b4d500b01101",
      headers: {
        "NServiceBus.MessageId": "9001e555-882a-4901-a122-b4d500b01101",
        "NServiceBus.ConversationId": "conv-9001-other-policy",
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00229401",
        "x-stratos-request-id": "req-lock-229a",
        "x-stratos-session-id": "sess-uw-1109",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00229401",
          expectedLockVersion: 2,
          forceReleaseOnVersionMismatch: false,
          sagaId: "saga-other-00229401",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `Microsoft.Azure.Cosmos.CosmosException : Response status code does not indicate success: PreconditionFailed (412); Substatus: 0; ETag mismatch on partition key 'OUTINT00229401'.
   at Stratos.Infrastructure.Cosmos.PolicyDocumentRepository.UpsertWithETagAsync(PolicyAggregate policy, String expectedETag, CancellationToken ct) in /src/Stratos.Infrastructure.Cosmos/PolicyDocumentRepository.cs:line 148`,
    },
    {
      id: "msg-9002f666",
      messageId: "9002f666-771b-4120-b811-b4d500b01102",
      messageType:
        "Stratos.Core.Documents.Commands.RenderPolicyCertificateCommand",
      status: "failed",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "document-render-worker",
      timeSent: isoMinutesAgo(64),
      processedAt: isoMinutesAgo(63.2),
      conversationId: "conv-9002-doc-render",
      sagaIds: [],
      exceptionType: "System.Net.Http.HttpRequestException",
      exceptionMessage:
        "Font subsetting service returned HTTP 503 Service Unavailable (template 'TMPL-CERT-2026').",
      numberOfProcessingAttempts: 5,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/9002f666-771b-4120-b811-b4d500b01102",
      headers: {
        "NServiceBus.MessageId": "9002f666-771b-4120-b811-b4d500b01102",
        "NServiceBus.ConversationId": "conv-9002-doc-render",
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00334512",
        "x-stratos-request-id": "req-doc-334a",
        "x-stratos-session-id": "sess-uw-8821",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00334512",
          templateId: "TMPL-CERT-2026",
          watermark: "INTEGRATION TEST ONLY",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `System.Net.Http.HttpRequestException : Font subsetting service returned HTTP 503 Service Unavailable.
   at Stratos.Documents.Worker.Clients.PdfEngineClient.RenderTemplateAsync(String templateId, Object payload, CancellationToken ct) in /src/Stratos.Documents.Worker/Clients/PdfEngineClient.cs:line 112`,
    },
    {
      id: "msg-9003a777",
      messageId: "9003a777-119c-4821-9c01-b4d500b01103",
      messageType:
        "Stratos.Core.Billing.Commands.PostEndorsementLedgerEntryCommand",
      status: "archived",
      sendingEndpoint: "policy-admin",
      receivingEndpoint: "billing-ledger-worker",
      timeSent: isoMinutesAgo(340),
      processedAt: isoMinutesAgo(339),
      conversationId: "conv-9003-archived",
      sagaIds: [],
      exceptionType:
        "Stratos.Billing.Domain.Exceptions.TaxJurisdictionMappingException",
      exceptionMessage:
        "Missing IPT tax schedule mapping for legacy endorsement 'END-2025-991' on policy 'OUTINT00118618'.",
      numberOfProcessingAttempts: 5,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/failed-messages/9003a777-119c-4821-9c01-b4d500b01103",
      headers: {
        "NServiceBus.MessageId": "9003a777-119c-4821-9c01-b4d500b01103",
        "NServiceBus.ConversationId": "conv-9003-archived",
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
        "x-stratos-request-id": "req-old-109",
        "x-stratos-session-id": "sess-uw-1002",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          endorsementNumber: "END-2025-991",
          netAmountGBP: 190.0,
          taxScheduleCode: "UK-IPT-LEGACY",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: true,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: `Stratos.Billing.Domain.Exceptions.TaxJurisdictionMappingException : Missing IPT tax schedule mapping for legacy endorsement 'END-2025-991'.`,
    },
    {
      id: "msg-9004b888",
      messageId: "9004b888-221d-4012-8a44-b4d500b01104",
      messageType:
        "Stratos.Core.PolicyAdmin.Commands.Policies.BindQuoteToPolicyCommand",
      status: "resolved",
      sendingEndpoint: "policy-admin-api",
      receivingEndpoint: "policy-admin",
      timeSent: isoMinutesAgo(420),
      processedAt: isoMinutesAgo(415),
      conversationId: "conv-9004-bind",
      sagaIds: [],
      exceptionType: null,
      exceptionMessage: null,
      numberOfProcessingAttempts: 2,
      servicePulseUrl:
        "https://servicepulse.int.stratos-insure.internal/#/messages/9004b888-221d-4012-8a44-b4d500b01104",
      headers: {
        "NServiceBus.MessageId": "9004b888-221d-4012-8a44-b4d500b01104",
        "NServiceBus.ConversationId": "conv-9004-bind",
        "NServiceBus.MessageIntent": "Send",
        "Cosmos.CosmosPartitionKeyValue": "OUTINT00118618",
      },
      body: JSON.stringify(
        {
          policyNumber: "OUTINT00118618",
          quoteReference: "QT-INT-2026-8841",
          boundBy: "uw.j.kovacs@stratos-insure.internal",
        },
        null,
        2
      ),
      bodyContentType: "application/json",
      bodyEditable: false,
      lockedHeaders: [
        "NServiceBus.MessageId",
        "NServiceBus.ConversationId",
        "Cosmos.CosmosPartitionKeyValue",
      ],
      stackTrace: null,
    },
  ];
  return list;
}

for (const m of buildInitialMessages()) {
  messageStore.set(m.id, m);
}

// Build ~28 regular logs + 14 framework noise logs for OUTINT00118618 so that messages (12) + logs (28) = 40 timeline items!
function buildLogsForMainPolicy(includeNoise: boolean): LogEvent[] {
  const regularLogs: LogEvent[] = [
    // Conversation 1 HTTP entry & message logs
    {
      id: "log-101",
      timestamp: isoMinutesAgo(195.2),
      level: "Information",
      renderedMessage:
        "HTTP POST /api/v1/policies/OUTINT00118618/lock responded 200 in 74.8310 ms",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: CONV_1,
      messageId: null,
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        StatusCode: 200,
        ElapsedMs: 74.831,
        RequestPath: "/api/v1/policies/OUTINT00118618/lock",
        Operator: "uw.j.kovacs@stratos-insure.internal",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-101",
    },
    {
      id: "log-102",
      timestamp: isoMinutesAgo(195.05),
      level: "Information",
      renderedMessage:
        "Sent message AcquireSoftLockCommand 02ee40a6-723f-4511-a004-b4d500ac3188.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: CONV_1,
      messageId: "02ee40a6-723f-4511-a004-b4d500ac3188",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        MessageType: "AcquireSoftLockCommand",
        Destination: "policy-admin",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-102",
    },
    {
      id: "log-103",
      timestamp: isoMinutesAgo(194.95),
      level: "Information",
      renderedMessage:
        "Receive message AcquireSoftLockCommand 02ee40a6-723f-4511-a004-b4d500ac3188 (0.025s).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "02ee40a6-723f-4511-a004-b4d500ac3188",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        HandlerDurationSec: 0.025,
        SagaId: SAGA_ID_MAIN,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-103",
    },
    {
      id: "log-104",
      timestamp: isoMinutesAgo(194.85),
      level: "Information",
      renderedMessage:
        "PolicySoftLockSaga initialized for policy OUTINT00118618 with LockVersion 4 and 00:15:00 expiry timeout.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "02ee40a6-723f-4511-a004-b4d500ac3188",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        SagaId: SAGA_ID_MAIN,
        LockVersion: 4,
        TimeoutDelay: "00:15:00",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-104",
    },
    {
      id: "log-105",
      timestamp: isoMinutesAgo(194.75),
      level: "Information",
      renderedMessage:
        "Published event PolicySoftLockedEvent 14bf81c2-510a-4910-9a11-b4d500ac3490 to 2 subscribers.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "14bf81c2-510a-4910-9a11-b4d500ac3490",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        SubscriberCount: 2,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-105",
    },
    {
      id: "log-106",
      timestamp: isoMinutesAgo(185.0),
      level: "Information",
      renderedMessage:
        "Concurrent background rating projection touched PolicyAggregate OUTINT00118618, incrementing ETag from v4 to v5 without clearing SoftLock.",
      exception: null,
      application: "Stratos.PolicyAdmin.API",
      conversationId: CONV_1,
      messageId: null,
      requestId: "req-bg-sync-19",
      sessionId: "sess-uw-4410",
      traceId: "7a112f3577b34da6a3ce929d0e0e8811",
      properties: {
        PolicyNumber: "OUTINT00118618",
        PreviousETag: "\"0400b219-0000-0800-0000-66fd11200000\"",
        NewETag: "\"0500c901-0000-0800-0000-66fd11480000\"",
        DocumentVersion: 5,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-106",
    },
    {
      id: "log-107",
      timestamp: isoMinutesAgo(179.82),
      level: "Information",
      renderedMessage:
        "Sent message ExpireSoftLockCommand 2937a3e5-7a19-46a2-8d31-b4d500ad0478.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        SagaId: SAGA_ID_MAIN,
        Reason: "SoftLockTimeoutElapsed",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-107",
    },
    {
      id: "log-108",
      timestamp: isoMinutesAgo(179.75),
      level: "Warning",
      renderedMessage:
        "Delayed retry #1 scheduled for ExpireSoftLockCommand 2937a3e5-7a19-46a2-8d31-b4d500ad0478 due to CosmosException (412 PreconditionFailed).",
      exception:
        "Microsoft.Azure.Cosmos.CosmosException (412): ETag mismatch on partition key 'OUTINT00118618' while releasing soft lock v4.",
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        ExpectedLockVersion: 4,
        ActualDocumentVersion: 5,
        RetryAttempt: 1,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-108",
    },
    {
      id: "log-109",
      timestamp: isoMinutesAgo(179.65),
      level: "Warning",
      renderedMessage:
        "Delayed retry #3 scheduled for ExpireSoftLockCommand 2937a3e5-7a19-46a2-8d31-b4d500ad0478 due to CosmosException (412 PreconditionFailed).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        RetryAttempt: 3,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-109",
    },
    {
      id: "log-110",
      timestamp: isoMinutesAgo(179.51),
      level: "Error",
      renderedMessage:
        "Message ExpireSoftLockCommand 2937a3e5-7a19-46a2-8d31-b4d500ad0478 moved to error queue 'error' after 5 failed attempts.",
      exception: `Microsoft.Azure.Cosmos.CosmosException : Response status code does not indicate success: PreconditionFailed (412); Substatus: 0; ETag mismatch on partition key 'OUTINT00118618' while releasing soft lock v4.
   at Stratos.Infrastructure.Cosmos.PolicyDocumentRepository.UpsertWithETagAsync(PolicyAggregate policy, String expectedETag, CancellationToken ct) in /src/Stratos.Infrastructure.Cosmos/PolicyDocumentRepository.cs:line 148
   at Stratos.Out.PolicyAdmin.Worker.Handlers.ExpireSoftLockCommandHandler.Handle(ExpireSoftLockCommand message, IMessageHandlerContext context) in /src/Stratos.Out.PolicyAdmin.Worker/Handlers/ExpireSoftLockCommandHandler.cs:line 64`,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        ErrorQueue: "error",
        TotalAttempts: 5,
        CosmosActivityId: "8c12f90e-221a-4b99-8311-00219ab41e90",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-110",
    },
    {
      id: "log-111",
      timestamp: isoMinutesAgo(177.9),
      level: "Information",
      renderedMessage:
        "Receive message SyncPolicyReadModelCommand 3810c9a1-4b22-4190-9f11-b4d500ad0912 (0.019s).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: CONV_1,
      messageId: "3810c9a1-4b22-4190-9f11-b4d500ad0912",
      requestId: "req-lock-901a",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        Projection: "PolicySummaryReadModel",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-111",
    },

    // Conversation 2 logs (Endorsement & Rating & Billing failure)
    {
      id: "log-201",
      timestamp: isoMinutesAgo(125.3),
      level: "Information",
      renderedMessage:
        "HTTP POST /api/v1/policies/OUTINT00118618/endorsements responded 202 in 118.4200 ms",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: CONV_2,
      messageId: null,
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        EndorsementNumber: "END-2026-004",
        StatusCode: 202,
        ElapsedMs: 118.42,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-201",
    },
    {
      id: "log-202",
      timestamp: isoMinutesAgo(124.85),
      level: "Information",
      renderedMessage:
        "Receive message SubmitEndorsementCommand 4401d8f0-991a-4c11-8812-b4d500ae1001 (0.041s).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4401d8f0-991a-4c11-8812-b4d500ae1001",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        EndorsementNumber: "END-2026-004",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-202",
    },
    {
      id: "log-203",
      timestamp: isoMinutesAgo(124.3),
      level: "Information",
      renderedMessage:
        "Rating engine evaluated tariff COMMERCIAL-UK-2026.09 for OUTINT00118618: NetDelta=+412.50 GBP, IPT=+49.50 GBP.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4402e9a1-991a-4c11-8812-b4d500ae1002",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        TariffVersion: "COMMERCIAL-UK-2026.09",
        NetDeltaGBP: 412.5,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-203",
    },
    {
      id: "log-204",
      timestamp: isoMinutesAgo(123.7),
      level: "Information",
      renderedMessage:
        "Receive message EndorsementPricedEvent 4403f1b2-991a-4c11-8812-b4d500ae1003 (0.032s).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4403f1b2-991a-4c11-8812-b4d500ae1003",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        EndorsementNumber: "END-2026-004",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-204",
    },
    {
      id: "log-205",
      timestamp: isoMinutesAgo(122.0),
      level: "Warning",
      renderedMessage:
        "SubRegionCode is null on PostEndorsementLedgerEntryCommand for policy OUTINT00118618; falling back to strict tax schedule lookup.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4404a2c3-991a-4c11-8812-b4d500ae1004",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        TaxScheduleCode: "UK-IPT-STD-2026",
        SubRegionCode: null,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-205",
    },
    {
      id: "log-206",
      timestamp: isoMinutesAgo(121.05),
      level: "Error",
      renderedMessage:
        "Failed to post endorsement ledger entry for OUTINT00118618 (END-2026-004): Missing IPT tax schedule mapping when SubRegionCode is null.",
      exception: `Stratos.Billing.Domain.Exceptions.TaxJurisdictionMappingException : Missing IPT tax schedule mapping for endorsement 'END-2026-004' on policy 'OUTINT00118618' with effective date 2026-10-15 (SubRegionCode=null).
   at Stratos.Billing.Domain.Services.TaxScheduleResolver.ResolveSchedule(String taxScheduleCode, String subRegionCode, DateOnly effectiveDate) in /src/Stratos.Billing.Domain/Services/TaxScheduleResolver.cs:line 89`,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4404a2c3-991a-4c11-8812-b4d500ae1004",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        EndorsementNumber: "END-2026-004",
        Attempts: 10,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-206",
    },
    {
      id: "log-207",
      timestamp: isoMinutesAgo(122.45),
      level: "Information",
      renderedMessage:
        "Generated PDF/A-1b document DOC-END-2026-004.pdf (142 KB) for policy OUTINT00118618.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_2,
      messageId: "4405b3d4-991a-4c11-8812-b4d500ae1005",
      requestId: "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1122",
      properties: {
        PolicyNumber: "OUTINT00118618",
        BlobUri:
          "https://stratosintdocs.blob.core.windows.net/policies/OUTINT00118618/DOC-END-2026-004.pdf",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-207",
    },
    {
      id: "log-208",
      timestamp: isoMinutesAgo(118.0),
      level: "Information",
      renderedMessage:
        "HTTP GET /api/v1/policies/OUTINT00118618/billing-status responded 200 in 31.2040 ms",
      exception: null,
      application: "Stratos.PolicyAdmin.API",
      conversationId: CONV_2,
      messageId: null,
      requestId: "req-end-779c",
      sessionId: "sess-uw-4410",
      traceId: "99c12f3577b34da6a3ce929d0e0e1199",
      properties: {
        PolicyNumber: "OUTINT00118618",
        LedgerSyncState: "PendingRetry",
        StatusCode: 200,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-208",
    },

    // Conversation 3 logs (Renewal evaluation & blocked invite)
    {
      id: "log-301",
      timestamp: isoMinutesAgo(48.2),
      level: "Information",
      renderedMessage:
        "Scheduled batch job triggered renewal evaluation for policy OUTINT00118618 (30 days prior to expiry).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: CONV_3,
      messageId: null,
      requestId: "req-ren-310c",
      sessionId: "sess-batch-990",
      traceId: "33d12f3577b34da6a3ce929d0e0e3300",
      properties: {
        PolicyNumber: "OUTINT00118618",
        BatchId: "BATCH-REN-20261002",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-301",
    },
    {
      id: "log-302",
      timestamp: isoMinutesAgo(47.65),
      level: "Information",
      renderedMessage:
        "Receive message InitiateRenewalEvaluationCommand 7701a111-331b-4d00-9911-b4d500af2001 (0.038s).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_3,
      messageId: "7701a111-331b-4d00-9911-b4d500af2001",
      requestId: "req-ren-310c",
      sessionId: "sess-batch-990",
      traceId: "33d12f3577b34da6a3ce929d0e0e3300",
      properties: {
        PolicyNumber: "OUTINT00118618",
        SagaId: SAGA_ID_RENEW,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-302",
    },
    {
      id: "log-303",
      timestamp: isoMinutesAgo(47.15),
      level: "Information",
      renderedMessage:
        "Claims history snapshot retrieved for OUTINT00118618: 1 settled claim, 14.2% 5-year loss ratio.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_3,
      messageId: "7703c333-331b-4d00-9911-b4d500af2003",
      requestId: "req-ren-310c",
      sessionId: "sess-batch-990",
      traceId: "33d12f3577b34da6a3ce929d0e0e3300",
      properties: {
        PolicyNumber: "OUTINT00118618",
        ClaimsCount: 1,
        LossRatioPct: 14.2,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-303",
    },
    {
      id: "log-304",
      timestamp: isoMinutesAgo(46.0),
      level: "Error",
      renderedMessage:
        "Renewal invite blocked for OUTINT00118618: Active SoftLock saga-9941a-softlock-00118618 detected on aggregate.",
      exception: `System.InvalidOperationException : Cannot publish renewal invite for policy 'OUTINT00118618' while active SoftLock 'saga-9941a-softlock-00118618' remains unreleased.
   at Stratos.Out.PolicyAdmin.Worker.Domain.PolicyGuard.EnsureUnlocked(PolicyAggregate policy) in /src/Stratos.Out.PolicyAdmin.Worker/Domain/PolicyGuard.cs:line 29`,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_3,
      messageId: "7704d444-331b-4d00-9911-b4d500af2004",
      requestId: "req-ren-310c",
      sessionId: "sess-batch-990",
      traceId: "33d12f3577b34da6a3ce929d0e0e3300",
      properties: {
        PolicyNumber: "OUTINT00118618",
        BlockingSagaId: SAGA_ID_MAIN,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-304",
    },
    {
      id: "log-305",
      timestamp: isoMinutesAgo(44.5),
      level: "Information",
      renderedMessage:
        "ServiceControl operator queued manual retry for message 7704d444-331b-4d00-9911-b4d500af2004.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_3,
      messageId: null,
      requestId: "req-ren-310c",
      sessionId: "sess-batch-990",
      traceId: "33d12f3577b34da6a3ce929d0e0e3300",
      properties: {
        PolicyNumber: "OUTINT00118618",
        MessageId: "7704d444-331b-4d00-9911-b4d500af2004",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-305",
    },
    {
      id: "log-306",
      timestamp: isoMinutesAgo(35.0),
      level: "Warning",
      renderedMessage:
        "Healthcheck warning: Policy OUTINT00118618 has held SoftLock for >150 minutes (expected max 15m).",
      exception: null,
      application: "Stratos.PolicyAdmin.API",
      conversationId: CONV_1,
      messageId: null,
      requestId: "req-hc-881",
      sessionId: "sess-hc-monitor",
      traceId: "55e12f3577b34da6a3ce929d0e0e5500",
      properties: {
        PolicyNumber: "OUTINT00118618",
        LockAgeMinutes: 160,
        SagaId: SAGA_ID_MAIN,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-306",
    },
    {
      id: "log-307",
      timestamp: isoMinutesAgo(22.0),
      level: "Information",
      renderedMessage:
        "HTTP GET /api/v1/policies/OUTINT00118618/summary responded 200 in 19.4410 ms",
      exception: null,
      application: "Stratos.PolicyAdmin.API",
      conversationId: null,
      messageId: null,
      requestId: "req-ui-991",
      sessionId: "sess-uw-4410",
      traceId: "66f12f3577b34da6a3ce929d0e0e6600",
      properties: {
        PolicyNumber: "OUTINT00118618",
        StatusCode: 200,
        ElapsedMs: 19.441,
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-307",
    },
    {
      id: "log-308",
      timestamp: isoMinutesAgo(15.0),
      level: "Fatal",
      renderedMessage:
        "SLA breach alert: Unresolved DLQ messages blocking policy lifecycle transition for OUTINT00118618.",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: CONV_1,
      messageId: null,
      requestId: "req-sla-001",
      sessionId: "sess-hc-monitor",
      traceId: "77f12f3577b34da6a3ce929d0e0e7700",
      properties: {
        PolicyNumber: "OUTINT00118618",
        FailedMessageCount: 2,
        AlertChannel: "pagerduty-policy-admin-int",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-308",
    },
    {
      id: "log-309",
      timestamp: isoMinutesAgo(8.0),
      level: "Information",
      renderedMessage:
        "Underwriter portal polled lock status for OUTINT00118618 (status=LockedBySaga).",
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Api",
      conversationId: null,
      messageId: null,
      requestId: "req-ui-998",
      sessionId: "sess-uw-4410",
      traceId: "88f12f3577b34da6a3ce929d0e0e8800",
      properties: {
        PolicyNumber: "OUTINT00118618",
        LockState: "LockedBySaga",
      },
      seqUrl: "https://seq.int.stratos-insure.internal/#/events?filter=log-309",
    },
  ];

  if (!includeNoise) {
    return regularLogs;
  }

  const noiseLogs: LogEvent[] = Array.from({ length: 14 }, (_, idx) => {
    const mins = 195 - idx * 11;
    const middlewares = [
      "Executing Stratos.Out.PolicyAdmin.Worker.Host.Middleware.Validation.ValidationBehavior.Invoke",
      "Executing Stratos.Out.PolicyAdmin.Worker.Host.Middleware.Correlation.CorrelationHeaderBehavior.Invoke",
      "CosmosClient connection pool heartbeat completed (0.8ms) on partition OUTINT00118618",
      "NServiceBus.Outbox.OutboxBehavior: Checking deduplication state for incoming transport message",
    ];
    return {
      id: `log-noise-${idx + 1}`,
      timestamp: isoMinutesAgo(mins),
      level: idx % 2 === 0 ? "Debug" : "Verbose",
      renderedMessage: middlewares[idx % middlewares.length],
      exception: null,
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: idx < 5 ? CONV_1 : idx < 10 ? CONV_2 : CONV_3,
      messageId: null,
      requestId: idx < 5 ? "req-lock-901a" : "req-end-772b",
      sessionId: "sess-uw-4410",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      properties: {
        PolicyNumber: "OUTINT00118618",
        IsFrameworkNoise: true,
        MiddlewareStep: idx + 1,
      },
      seqUrl: `https://seq.int.stratos-insure.internal/#/events?filter=log-noise-${idx + 1}`,
    };
  });

  return [...regularLogs, ...noiseLogs];
}

// Related Jira tickets for OUTINT00118618
const MOCK_JIRA_TICKETS_MAIN: RelatedTicket[] = [
  {
    relation: "matchesError",
    hint: "possibleCause",
    reason:
      "Introduced strict Cosmos ETag precondition check on PolicySoftLock release in v2026.10.1.",
    ticket: {
      key: "CORE-1234",
      summary:
        "Enforce optimistic concurrency ETag check when releasing PolicySoftLock in Cosmos repository",
      issueType: "Task",
      status: "Done",
      statusCategory: "done",
      priority: "High",
      assignee: "Marek Nowak",
      components: ["policy-admin", "cosmos-persistence"],
      labels: ["concurrency", "soft-lock"],
      fixVersions: ["2026.10.1"],
      created: isoMinutesAgo(4320),
      updated: isoMinutesAgo(185),
      resolved: isoMinutesAgo(182), // right before the first failure at 179.5 mins ago!
      url: "https://jira.stratos-insure.internal/browse/CORE-1234",
      excerpt:
        "...updated PolicyDocumentRepository.UpsertWithETagAsync to throw PreconditionFailed (412) on ETag mismatch when ExpireSoftLockCommand executes...",
    },
  },
  {
    relation: "recentChange",
    hint: "possibleCause",
    reason:
      "Changed TaxScheduleResolver to reject null SubRegionCode for UK commercial endorsements.",
    ticket: {
      key: "CORE3-567",
      summary:
        "Validate regional IPT tax jurisdiction codes in billing-ledger-worker for 2026 Q4 tariff",
      issueType: "Story",
      status: "Done",
      statusCategory: "done",
      priority: "Medium",
      assignee: "Elena Rostova",
      components: ["billing-ledger-worker", "tax-engine"],
      labels: ["ipt-tax", "commercial-uk"],
      fixVersions: ["2026.10.1"],
      created: isoMinutesAgo(2880),
      updated: isoMinutesAgo(130),
      resolved: isoMinutesAgo(128), // right before the billing failure at 121 mins ago!
      url: "https://jira.stratos-insure.internal/browse/CORE3-567",
      excerpt:
        "...when SubRegionCode is null on PostEndorsementLedgerEntryCommand, TaxScheduleResolver throws TaxJurisdictionMappingException...",
    },
  },
  {
    relation: "matchesError",
    hint: "possibleFix",
    reason:
      "Allows ExpireSoftLockCommand to bypass stale read-model ETag bumps when forceReleaseOnVersionMismatch is true.",
    ticket: {
      key: "CORE-1289",
      summary:
        "Fix CosmosException (412) on ExpireSoftLockCommand when background projection increments aggregate ETag",
      issueType: "Bug",
      status: "Done",
      statusCategory: "done",
      priority: "Highest",
      assignee: "Marek Nowak",
      components: ["policy-admin"],
      labels: ["hotfix", "soft-lock"],
      fixVersions: ["2026.10.2"],
      created: isoMinutesAgo(160),
      updated: isoMinutesAgo(55),
      resolved: isoMinutesAgo(50),
      url: "https://jira.stratos-insure.internal/browse/CORE-1289",
      excerpt:
        "...workaround in INT/STG: edit ExpireSoftLockCommand body to set forceReleaseOnVersionMismatch: true or update expectedLockVersion to 5 and retry...",
    },
  },
  {
    relation: "matchesError",
    hint: "possibleFix",
    reason:
      "Adds default 'GB-ENG' fallback when SubRegionCode is omitted in PostEndorsementLedgerEntryCommand.",
    ticket: {
      key: "CORE3-601",
      summary:
        "Fallback to GB-ENG sub-region when SubRegionCode is null in PostEndorsementLedgerEntryHandler",
      issueType: "Bug",
      status: "In Review",
      statusCategory: "inProgress",
      priority: "High",
      assignee: "Elena Rostova",
      components: ["billing-ledger-worker"],
      labels: ["ipt-tax", "hotfix"],
      fixVersions: ["2026.10.2"],
      created: isoMinutesAgo(110),
      updated: isoMinutesAgo(25),
      resolved: null,
      url: "https://jira.stratos-insure.internal/browse/CORE3-601",
      excerpt:
        "...until 2026.10.2 deploys, operators can Edit & Retry PostEndorsementLedgerEntryCommand and set subRegionCode to \"GB-ENG\"...",
    },
  },
  {
    relation: "mentionsPolicy",
    hint: "related",
    reason:
      "QA tracking ticket explicitly mentions test policy OUTINT00118618 for mid-term endorsement and renewal regression.",
    ticket: {
      key: "CORE-1302",
      summary:
        "Investigate stuck soft-lock and blocked renewal invite on test policy OUTINT00118618 in INT",
      issueType: "Bug",
      status: "In Progress",
      statusCategory: "inProgress",
      priority: "High",
      assignee: "Janos Kovacs",
      components: ["policy-admin", "qa-automation"],
      labels: ["OUTINT00118618", "int-env"],
      fixVersions: [],
      created: isoMinutesAgo(40),
      updated: isoMinutesAgo(12),
      resolved: null,
      url: "https://jira.stratos-insure.internal/browse/CORE-1302",
      excerpt:
        "...policy OUTINT00118618 has an unreleased PolicySoftLockSaga (saga-9941a-softlock-00118618) causing PublishRenewalInviteCommand to fail...",
    },
  },
];

// Saga histories (including a 5-step saga with a timeout)
const MOCK_SAGAS: Record<string, SagaHistory> = {
  [SAGA_ID_MAIN]: {
    sagaId: SAGA_ID_MAIN,
    sagaType:
      "Stratos.Out.PolicyAdmin.Worker.Sagas.PolicySoftLockSaga",
    changes: [
      {
        startTime: isoMinutesAgo(195.0),
        finishTime: isoMinutesAgo(194.85),
        status: "new",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "02ee40a6-723f-4511-a004-b4d500ac3188",
          messageType:
            "Stratos.Core.PolicyAdmin.Commands.Policies.AcquireSoftLock.AcquireSoftLockCommand",
          intent: "Send",
          timeSent: isoMinutesAgo(195.0),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [
          {
            messageId: "14bf81c2-510a-4910-9a11-b4d500ac3490",
            messageType:
              "Stratos.Core.PolicyAdmin.Events.Policies.PolicySoftLockedEvent",
            intent: "Publish",
            timeSent: isoMinutesAgo(194.8),
            isTimeout: false,
            deliveryDelay: null,
            destination: "policy-admin-api",
          },
          {
            messageId: "timeout-lock-15m-001",
            messageType:
              "Stratos.Out.PolicyAdmin.Worker.Sagas.ExpireSoftLockTimeout",
            intent: "RequestTimeout",
            timeSent: isoMinutesAgo(194.8),
            isTimeout: true,
            deliveryDelay: "00:15:00",
            destination: "policy-admin",
          },
        ],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_MAIN,
            PolicyNumber: "OUTINT00118618",
            LockOwner: "uw.j.kovacs@stratos-insure.internal",
            LockState: "Active",
            LockVersion: 4,
            HeartbeatCount: 0,
            AcquireTimestampUtc: isoMinutesAgo(194.85),
            ScheduledExpiryUtc: isoMinutesAgo(179.85),
            LastError: null,
          },
          null,
          2
        ),
      },
      {
        startTime: isoMinutesAgo(189.0),
        finishTime: isoMinutesAgo(188.95),
        status: "updated",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "hb-lock-001-a910",
          messageType:
            "Stratos.Core.PolicyAdmin.Commands.Policies.RecordLockHeartbeatCommand",
          intent: "Send",
          timeSent: isoMinutesAgo(189.0),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_MAIN,
            PolicyNumber: "OUTINT00118618",
            LockOwner: "uw.j.kovacs@stratos-insure.internal",
            LockState: "Active",
            LockVersion: 4,
            HeartbeatCount: 1,
            AcquireTimestampUtc: isoMinutesAgo(194.85),
            ScheduledExpiryUtc: isoMinutesAgo(179.85),
            LastHeartbeatUtc: isoMinutesAgo(188.95),
            LastError: null,
          },
          null,
          2
        ),
      },
      {
        startTime: isoMinutesAgo(179.85),
        finishTime: isoMinutesAgo(179.8),
        status: "updated",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "timeout-lock-15m-001",
          messageType:
            "Stratos.Out.PolicyAdmin.Worker.Sagas.ExpireSoftLockTimeout",
          intent: "Timeout",
          timeSent: isoMinutesAgo(194.8),
          isTimeout: true,
          deliveryDelay: "00:15:00",
          destination: "policy-admin",
        },
        outgoingMessages: [
          {
            messageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
            messageType:
              "Stratos.Core.PolicyAdmin.Commands.Policies.ExpireSoftLock.ExpireSoftLockCommand",
            intent: "Send",
            timeSent: isoMinutesAgo(179.8),
            isTimeout: false,
            deliveryDelay: null,
            destination: "policy-admin",
          },
        ],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_MAIN,
            PolicyNumber: "OUTINT00118618",
            LockOwner: "uw.j.kovacs@stratos-insure.internal",
            LockState: "ExpiryRequested",
            LockVersion: 4,
            HeartbeatCount: 1,
            AcquireTimestampUtc: isoMinutesAgo(194.85),
            ScheduledExpiryUtc: isoMinutesAgo(179.85),
            LastHeartbeatUtc: isoMinutesAgo(188.95),
            ExpiryCommandMessageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
            LastError: null,
          },
          null,
          2
        ),
      },
      {
        startTime: isoMinutesAgo(178.05),
        finishTime: isoMinutesAgo(178.0),
        status: "updated",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "evt-dlq-notify-2937a3e5",
          messageType:
            "ServiceControl.Contracts.MessageFailedNotification",
          intent: "Publish",
          timeSent: isoMinutesAgo(178.1),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [
          {
            messageId: "3810c9a1-4b22-4190-9f11-b4d500ad0912",
            messageType:
              "Stratos.Core.PolicyAdmin.Commands.Policies.SyncPolicyReadModel.SyncPolicyReadModelCommand",
            intent: "Send",
            timeSent: isoMinutesAgo(178.0),
            isTimeout: false,
            deliveryDelay: null,
            destination: "policy-admin-api",
          },
        ],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_MAIN,
            PolicyNumber: "OUTINT00118618",
            LockOwner: "uw.j.kovacs@stratos-insure.internal",
            LockState: "FaultedOnRelease",
            LockVersion: 5,
            HeartbeatCount: 1,
            AcquireTimestampUtc: isoMinutesAgo(194.85),
            ScheduledExpiryUtc: isoMinutesAgo(179.85),
            LastHeartbeatUtc: isoMinutesAgo(188.95),
            ExpiryCommandMessageId: "2937a3e5-7a19-46a2-8d31-b4d500ad0478",
            LastError:
              "CosmosException (412 PreconditionFailed): Expected ETag v4 but found v5",
          },
          null,
          2
        ),
      },
      {
        startTime: isoMinutesAgo(415.0),
        finishTime: isoMinutesAgo(414.9),
        status: "completed",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "9004b888-221d-4012-8a44-b4d500b01104",
          messageType:
            "Stratos.Core.PolicyAdmin.Commands.Policies.BindQuoteToPolicyCommand",
          intent: "Send",
          timeSent: isoMinutesAgo(420.0),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_MAIN,
            PolicyNumber: "OUTINT00118618",
            LockOwner: "uw.j.kovacs@stratos-insure.internal",
            LockState: "CompletedArchive",
            LockVersion: 5,
            HeartbeatCount: 1,
            CompletedReason: "PriorQuoteBoundCycleCompleted",
            LastError: null,
          },
          null,
          2
        ),
      },
    ],
  },
  [SAGA_ID_RENEW]: {
    sagaId: SAGA_ID_RENEW,
    sagaType: "Stratos.Out.PolicyAdmin.Worker.Sagas.PolicyRenewalOrchestrationSaga",
    changes: [
      {
        startTime: isoMinutesAgo(47.6),
        finishTime: isoMinutesAgo(47.5),
        status: "new",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "7701a111-331b-4d00-9911-b4d500af2001",
          messageType:
            "Stratos.Core.PolicyAdmin.Commands.Renewals.InitiateRenewalEvaluationCommand",
          intent: "Send",
          timeSent: isoMinutesAgo(48.0),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [
          {
            messageId: "7702b222-331b-4d00-9911-b4d500af2002",
            messageType:
              "Stratos.Core.Claims.Queries.FetchClaimsHistorySnapshotQuery",
            intent: "Send",
            timeSent: isoMinutesAgo(47.5),
            isTimeout: false,
            deliveryDelay: null,
            destination: "claims-bridge",
          },
        ],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_RENEW,
            PolicyNumber: "OUTINT00118618",
            RenewalStage: "AwaitingClaimsHistory",
            TargetRenewalDate: "2026-11-01",
            ClaimsSnapshotReceived: false,
          },
          null,
          2
        ),
      },
      {
        startTime: isoMinutesAgo(46.6),
        finishTime: isoMinutesAgo(46.2),
        status: "updated",
        endpoint: "policy-admin",
        initiatingMessage: {
          messageId: "7703c333-331b-4d00-9911-b4d500af2003",
          messageType:
            "Stratos.Core.Claims.Replies.ClaimsHistorySnapshotReply",
          intent: "Reply",
          timeSent: isoMinutesAgo(47.0),
          isTimeout: false,
          deliveryDelay: null,
          destination: "policy-admin",
        },
        outgoingMessages: [
          {
            messageId: "7704d444-331b-4d00-9911-b4d500af2004",
            messageType:
              "Stratos.Core.PolicyAdmin.Commands.Renewals.PublishRenewalInviteCommand",
            intent: "Send",
            timeSent: isoMinutesAgo(46.2),
            isTimeout: false,
            deliveryDelay: null,
            destination: "policy-admin-api",
          },
        ],
        stateAfterChange: JSON.stringify(
          {
            SagaId: SAGA_ID_RENEW,
            PolicyNumber: "OUTINT00118618",
            RenewalStage: "PublishingRenewalInvite",
            TargetRenewalDate: "2026-11-01",
            ClaimsSnapshotReceived: true,
            CalculatedLossRatioPct: 14.2,
            ProposedGrossPremiumGBP: 18940.0,
          },
          null,
          2
        ),
      },
    ],
  },
};

function toSummary(detail: MessageDetail): MessageSummary {
  return {
    id: detail.id,
    messageId: detail.messageId,
    messageType: detail.messageType,
    status: detail.status,
    sendingEndpoint: detail.sendingEndpoint,
    receivingEndpoint: detail.receivingEndpoint,
    timeSent: detail.timeSent,
    processedAt: detail.processedAt,
    conversationId: detail.conversationId,
    sagaIds: detail.sagaIds,
    exceptionType: detail.exceptionType,
    exceptionMessage: detail.exceptionMessage,
    numberOfProcessingAttempts: detail.numberOfProcessingAttempts,
    servicePulseUrl: detail.servicePulseUrl,
  };
}

export async function mockGetConfig(): Promise<AppConfig> {
  await delay(120);
  return { ...MOCK_CONFIG };
}

export async function mockGetEndpoints(): Promise<string[]> {
  await delay(100);
  return [...MOCK_ENDPOINTS];
}

export async function mockLookupPolicy(
  policyNumber: string,
  params?: { from?: string; to?: string; includeNoise?: boolean }
): Promise<LookupResult> {
  await delay(260);
  const normalized = policyNumber.trim().toUpperCase();

  // Special policy number to test full API error state
  if (normalized === "OUTINT00500500") {
    throw new ApiProblemError({
      title: "Upstream Aggregator Timeout",
      detail:
        "The PolicyTrace backend timed out while querying ServiceControl and Seq cluster nodes for policy OUTINT00500500.",
      status: 504,
    });
  }

  const from = params?.from || isoMinutesAgo(7 * 24 * 60);
  const to = params?.to || new Date("2026-10-02T13:30:00.000Z").toISOString();
  const includeNoise = Boolean(params?.includeNoise);

  // Case 3: Policy OUTINT00334512 where Seq source returns an error, ServiceControl succeeds
  if (normalized === "OUTINT00334512") {
    const msgs = Array.from(messageStore.values())
      .filter((m) => m.headers["Cosmos.CosmosPartitionKeyValue"] === "OUTINT00334512")
      .map(toSummary);

    const items: TimelineItem[] = msgs.map((m) => ({
      kind: "message",
      timestamp: m.timeSent || from,
      message: m,
    }));

    return {
      policyNumber: normalized,
      from,
      to,
      conversationIds: ["conv-9002-doc-render"],
      items,
      truncated: { messages: false, logs: false },
      hiddenNoiseCount: 0,
      sources: {
        seq: {
          ok: false,
          error:
            "Seq query failed: Connection refused (seq.int.stratos-insure.internal:5341 — ECONNREFUSED)",
          durationMs: 3012,
        },
        serviceControl: {
          ok: true,
          error: null,
          durationMs: 142,
        },
      },
    };
  }

  // Case 2: Policy OUTINT00229401 where Jira fails and logs are truncated
  if (normalized === "OUTINT00229401") {
    const msgs = Array.from(messageStore.values())
      .filter((m) => m.headers["Cosmos.CosmosPartitionKeyValue"] === "OUTINT00229401")
      .map(toSummary);

    const sampleLog: LogEvent = {
      id: "log-229401-1",
      timestamp: isoMinutesAgo(91.5),
      level: "Error",
      renderedMessage:
        "Receive message ExpireSoftLockCommand 9001e555-882a-4901-a122-b4d500b01101 failed with CosmosException (412).",
      exception:
        "Microsoft.Azure.Cosmos.CosmosException (412): ETag mismatch on partition key 'OUTINT00229401'.",
      application: "Stratos.Out.PolicyAdmin.Worker",
      conversationId: "conv-9001-other-policy",
      messageId: "9001e555-882a-4901-a122-b4d500b01101",
      requestId: "req-lock-229a",
      sessionId: "sess-uw-1109",
      traceId: "11a92f3577b34da6a3ce929d0e0e2294",
      properties: {
        PolicyNumber: "OUTINT00229401",
        ExpectedLockVersion: 2,
      },
      seqUrl:
        "https://seq.int.stratos-insure.internal/#/events?filter=log-229401-1",
    };

    const items: TimelineItem[] = [
      ...msgs.map((m) => ({
        kind: "message" as const,
        timestamp: m.timeSent || from,
        message: m,
      })),
      {
        kind: "log" as const,
        timestamp: sampleLog.timestamp,
        log: sampleLog,
      },
    ];

    return {
      policyNumber: normalized,
      from,
      to,
      conversationIds: ["conv-9001-other-policy"],
      items,
      truncated: { messages: false, logs: true },
      hiddenNoiseCount: 6,
      sources: {
        seq: { ok: true, error: null, durationMs: 480 },
        serviceControl: { ok: true, error: null, durationMs: 115 },
      },
    };
  }

  // Default main policy OUTINT00118618
  if (normalized === "OUTINT00118618") {
    const policyMessages = Array.from(messageStore.values())
      .filter(
        (m) => m.headers["Cosmos.CosmosPartitionKeyValue"] === "OUTINT00118618"
      )
      .map(toSummary);

    const policyLogs = buildLogsForMainPolicy(includeNoise);

    const items: TimelineItem[] = [
      ...policyMessages.map((m) => ({
        kind: "message" as const,
        timestamp: m.timeSent || from,
        message: m,
      })),
      ...policyLogs.map((l) => ({
        kind: "log" as const,
        timestamp: l.timestamp,
        log: l,
      })),
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      policyNumber: normalized,
      from,
      to,
      conversationIds: [CONV_1, CONV_2, CONV_3],
      items,
      truncated: { messages: false, logs: false },
      hiddenNoiseCount: 14,
      sources: {
        seq: { ok: true, error: null, durationMs: 184 },
        serviceControl: { ok: true, error: null, durationMs: 96 },
      },
    };
  }

  // Any other valid policy number returns a clean empty state
  return {
    policyNumber: normalized,
    from,
    to,
    conversationIds: [],
    items: [],
    truncated: { messages: false, logs: false },
    hiddenNoiseCount: 0,
    sources: {
      seq: { ok: true, error: null, durationMs: 62 },
      serviceControl: { ok: true, error: null, durationMs: 49 },
    },
  };
}

export async function mockGetMessages(params?: {
  endpoint?: string;
  status?: string | string[];
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: string;
}): Promise<Paged<MessageSummary>> {
  await delay(180);
  let all = Array.from(messageStore.values()).map(toSummary);

  if (params?.endpoint) {
    all = all.filter(
      (m) =>
        m.receivingEndpoint === params.endpoint ||
        m.sendingEndpoint === params.endpoint
    );
  }

  if (params?.status) {
    const statuses = Array.isArray(params.status)
      ? params.status
      : params.status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    if (statuses.length > 0) {
      all = all.filter((m) => statuses.includes(m.status));
    }
  }

  if (params?.q) {
    const q = params.q.toLowerCase();
    all = all.filter(
      (m) =>
        m.messageType.toLowerCase().includes(q) ||
        m.messageId.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.exceptionMessage && m.exceptionMessage.toLowerCase().includes(q)) ||
        (m.exceptionType && m.exceptionType.toLowerCase().includes(q)) ||
        (m.conversationId && m.conversationId.toLowerCase().includes(q))
    );
  }

  const sortField = params?.sort === "processedAt" ? "processedAt" : "timeSent";
  const dir = params?.direction === "asc" ? 1 : -1;

  all.sort((a, b) => {
    const tA = new Date(a[sortField] || a.timeSent || 0).getTime();
    const tB = new Date(b[sortField] || b.timeSent || 0).getTime();
    return (tA - tB) * dir;
  });

  const page = Math.max(1, params?.page || 1);
  const pageSize = Math.max(1, params?.pageSize || 20);
  const start = (page - 1) * pageSize;
  const pagedItems = all.slice(start, start + pageSize);

  return {
    items: pagedItems,
    page,
    pageSize,
    totalCount: all.length,
  };
}

export async function mockGetMessage(id: string): Promise<MessageDetail> {
  await delay(140);
  const byId =
    messageStore.get(id) ||
    Array.from(messageStore.values()).find((m) => m.messageId === id);

  if (!byId) {
    throw new ApiProblemError({
      title: "Message Not Found",
      detail: `No NServiceBus message with ID '${id}' was found in ServiceControl.`,
      status: 404,
    });
  }
  return { ...byId, headers: { ...byId.headers } };
}

export async function mockGetConversation(
  conversationId: string
): Promise<ConversationGraph> {
  await delay(180);
  const msgs = Array.from(messageStore.values())
    .filter((m) => m.conversationId === conversationId)
    .sort(
      (a, b) =>
        new Date(a.timeSent || 0).getTime() -
        new Date(b.timeSent || 0).getTime()
    );

  if (msgs.length === 0) {
    throw new ApiProblemError({
      title: "Conversation Not Found",
      detail: `No messages found for conversation ID '${conversationId}'.`,
      status: 404,
    });
  }

  const nodes: ConversationGraph["nodes"] = msgs.map((m) => {
    const rawIntent = (
      m.headers["NServiceBus.MessageIntent"] || "send"
    ).toLowerCase();
    const intent: "send" | "publish" | "reply" | "unknown" =
      rawIntent === "publish"
        ? "publish"
        : rawIntent === "reply"
        ? "reply"
        : rawIntent === "send"
        ? "send"
        : "unknown";
    return {
      id: m.id,
      messageId: m.messageId,
      messageType: m.messageType,
      intent,
      status: m.status,
      sendingEndpoint: m.sendingEndpoint,
      receivingEndpoint: m.receivingEndpoint,
      timeSent: m.timeSent,
      processedAt: m.processedAt,
      sagaIds: m.sagaIds,
    };
  });

  // Build realistic directed tree edges
  const edges: Array<{ from: string; to: string }> = [];
  if (conversationId === CONV_1 && nodes.length >= 4) {
    edges.push({ from: nodes[0].id, to: nodes[1].id });
    edges.push({ from: nodes[0].id, to: nodes[2].id });
    edges.push({ from: nodes[2].id, to: nodes[3].id });
    for (let i = 4; i < nodes.length; i++) {
      edges.push({ from: nodes[2].id, to: nodes[i].id });
    }
  } else if (conversationId === CONV_2 && nodes.length >= 5) {
    edges.push({ from: nodes[0].id, to: nodes[1].id });
    edges.push({ from: nodes[1].id, to: nodes[2].id });
    edges.push({ from: nodes[2].id, to: nodes[3].id });
    edges.push({ from: nodes[2].id, to: nodes[4].id });
    for (let i = 5; i < nodes.length; i++) {
      edges.push({ from: nodes[3].id, to: nodes[i].id });
    }
  } else {
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
    }
  }

  return {
    conversationId,
    nodes,
    edges,
  };
}

export async function mockGetSaga(sagaId: string): Promise<SagaHistory> {
  await delay(180);
  const saga = MOCK_SAGAS[sagaId];
  if (!saga) {
    throw new ApiProblemError({
      title: "Saga Not Found",
      detail: `ServiceControl has no saga audit history for saga ID '${sagaId}'.`,
      status: 404,
    });
  }
  return saga;
}

export async function mockGetRelatedTickets(params: {
  policyNumber?: string;
  messageId?: string;
  from?: string;
  to?: string;
}): Promise<RelatedTicketsResult> {
  await delay(320);

  if (!MOCK_CONFIG.jira.enabled) {
    return {
      enabled: false,
      ok: true,
      error: null,
      tickets: [],
      truncated: false,
    };
  }

  // Second mock policy OUTINT00229401 returns Jira ok: false
  if (params.policyNumber?.toUpperCase() === "OUTINT00229401") {
    return {
      enabled: true,
      ok: false,
      error:
        "Jira REST API request failed: HTTP 504 Gateway Timeout from jira.stratos-insure.internal after 5000ms.",
      tickets: [],
      truncated: false,
    };
  }

  if (params.messageId) {
    const msg =
      messageStore.get(params.messageId) ||
      Array.from(messageStore.values()).find(
        (m) => m.messageId === params.messageId
      );
    if (msg && msg.messageType.includes("PostEndorsementLedgerEntryCommand")) {
      return {
        enabled: true,
        ok: true,
        error: null,
        tickets: MOCK_JIRA_TICKETS_MAIN.filter((t) =>
          ["CORE3-567", "CORE3-601", "CORE-1302"].includes(t.ticket.key)
        ),
        truncated: false,
      };
    }
    return {
      enabled: true,
      ok: true,
      error: null,
      tickets: MOCK_JIRA_TICKETS_MAIN.filter((t) =>
        ["CORE-1234", "CORE-1289", "CORE-1302"].includes(t.ticket.key)
      ),
      truncated: false,
    };
  }

  if (
    !params.policyNumber ||
    params.policyNumber.toUpperCase() === "OUTINT00118618"
  ) {
    return {
      enabled: true,
      ok: true,
      error: null,
      tickets: MOCK_JIRA_TICKETS_MAIN,
      truncated: false,
    };
  }

  return {
    enabled: true,
    ok: true,
    error: null,
    tickets: [],
    truncated: false,
  };
}

export async function mockGetLogs(params: {
  policyNumber?: string;
  conversationId?: string;
  messageId?: string;
  requestId?: string;
  sessionId?: string;
  level?: string;
  includeNoise?: boolean;
  from?: string;
  to?: string;
  count?: number;
}): Promise<LogEvent[]> {
  await delay(160);
  let logs = buildLogsForMainPolicy(Boolean(params.includeNoise));

  if (params.messageId) {
    const msg = messageStore.get(params.messageId);
    const actualMessageId = msg ? msg.messageId : params.messageId;
    logs = logs.filter((l) => l.messageId === actualMessageId);
  } else if (params.requestId) {
    logs = logs.filter((l) => l.requestId === params.requestId);
  } else if (params.sessionId) {
    logs = logs.filter((l) => l.sessionId === params.sessionId);
  } else if (params.conversationId) {
    logs = logs.filter((l) => l.conversationId === params.conversationId);
  }

  if (params.level) {
    logs = logs.filter(
      (l) => l.level.toLowerCase() === params.level?.toLowerCase()
    );
  }

  if (params.count && params.count > 0) {
    logs = logs.slice(0, params.count);
  }

  return logs;
}

function scheduleStatusSettlement(ids: string[], targetStatus: MessageStatus) {
  setTimeout(() => {
    for (const id of ids) {
      const existing = messageStore.get(id);
      if (existing && existing.status === "retryIssued") {
        existing.status = targetStatus;
        existing.processedAt = new Date().toISOString();
      }
    }
  }, 3500);
}

export async function mockRetryMessages(ids: string[]): Promise<ActionResult> {
  await delay(220);
  if (!MOCK_CONFIG.actions.retry) {
    throw new ApiProblemError({
      title: "Action Disabled",
      detail: "Retrying failed messages is disabled in this environment.",
      status: 403,
    });
  }

  const failures: Array<{ id: string; reason: string }> = [];
  const acceptedIds: string[] = [];

  for (const id of ids) {
    const msg = messageStore.get(id);
    if (!msg) {
      failures.push({ id, reason: "Message ID not found in ServiceControl" });
      continue;
    }
    if (
      msg.status !== "failed" &&
      msg.status !== "repeatedFailure" &&
      msg.status !== "archived"
    ) {
      failures.push({
        id,
        reason: `Cannot retry message in status '${msg.status}'`,
      });
      continue;
    }
    msg.status = "retryIssued";
    acceptedIds.push(id);
  }

  scheduleStatusSettlement(acceptedIds, "resolved");

  return {
    requested: ids.length,
    accepted: acceptedIds.length,
    failures,
  };
}

export async function mockArchiveMessages(
  ids: string[]
): Promise<ActionResult> {
  await delay(200);
  if (!MOCK_CONFIG.actions.archive) {
    throw new ApiProblemError({
      title: "Action Disabled",
      detail: "Archiving messages is disabled in this environment.",
      status: 403,
    });
  }

  const failures: Array<{ id: string; reason: string }> = [];
  let accepted = 0;

  for (const id of ids) {
    const msg = messageStore.get(id);
    if (!msg) {
      failures.push({ id, reason: "Message ID not found" });
      continue;
    }
    msg.status = "archived";
    accepted++;
  }

  return {
    requested: ids.length,
    accepted,
    failures,
  };
}

export async function mockUnarchiveMessage(id: string): Promise<ActionResult> {
  await delay(180);
  const msg = messageStore.get(id);
  if (!msg) {
    return {
      requested: 1,
      accepted: 0,
      failures: [{ id, reason: "Message ID not found" }],
    };
  }
  msg.status = "failed";
  return {
    requested: 1,
    accepted: 1,
    failures: [],
  };
}

export async function mockEditAndRetryMessage(
  id: string,
  payload: { body: string; headers: Record<string, string> }
): Promise<ActionResult> {
  await delay(280);
  if (!MOCK_CONFIG.actions.edit) {
    throw new ApiProblemError({
      title: "Action Disabled",
      detail: "Edit and retry is disabled in this environment.",
      status: 403,
    });
  }

  const orig = messageStore.get(id);
  if (!orig) {
    return {
      requested: 1,
      accepted: 0,
      failures: [{ id, reason: "Original message not found" }],
    };
  }
  if (!orig.bodyEditable) {
    return {
      requested: 1,
      accepted: 0,
      failures: [{ id, reason: "Message payload is not editable" }],
    };
  }

  // Mark original message as retryIssued -> then resolved, and spawn the replacement message
  orig.status = "retryIssued";
  scheduleStatusSettlement([orig.id], "resolved");

  const newGuid = `edited-${Date.now().toString(16).slice(-8)}-4b11-9a00-b4d500ed9901`;
  const newId = `msg-${newGuid.slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  const replacement: MessageDetail = {
    ...orig,
    id: newId,
    messageId: newGuid,
    status: "retryIssued",
    timeSent: nowIso,
    processedAt: nowIso,
    numberOfProcessingAttempts: 1,
    exceptionType: null,
    exceptionMessage: null,
    stackTrace: null,
    body: payload.body,
    headers: {
      ...payload.headers,
      "NServiceBus.MessageId": newGuid,
      "PolicyTrace.ReplacedMessageId": orig.messageId,
    },
  };

  messageStore.set(newId, replacement);
  scheduleStatusSettlement([newId], "successful");

  return {
    requested: 1,
    accepted: 1,
    failures: [],
  };
}
