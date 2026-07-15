const CATALOG_TABLES = [
  "pending_store_signups",
  "standalone_checkout_requests",
  "stripe_subscription_states",
];

const COLUMN_SQL = `
  select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = any($1::text[])
  order by table_name, ordinal_position
`;

const CONSTRAINT_SQL = `
  select
    relation.relname as table_name,
    constraint_row.conname as name,
    constraint_row.contype as type,
    constraint_row.convalidated as validated,
    pg_get_constraintdef(constraint_row.oid) as definition
  from pg_constraint constraint_row
  join pg_class relation on relation.oid = constraint_row.conrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = any($1::text[])
  order by relation.relname, constraint_row.conname
`;

const INDEX_SQL = `
  select
    table_relation.relname as table_name,
    index_relation.relname as name,
    index_row.indisunique as unique_index,
    index_row.indisvalid as valid_index,
    pg_get_indexdef(index_row.indexrelid) as definition,
    pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
  from pg_index index_row
  join pg_class table_relation on table_relation.oid = index_row.indrelid
  join pg_namespace namespace on namespace.oid = table_relation.relnamespace
  join pg_class index_relation on index_relation.oid = index_row.indexrelid
  where namespace.nspname = 'public'
    and table_relation.relname = any($1::text[])
  order by table_relation.relname, index_relation.relname
`;

function normalized(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function columnKey(tableName, columnName) {
  return `${tableName}.${columnName}`;
}

function columnReady(columns, tableName, columnName, dataType, nullable, defaultCheck = () => true) {
  const column = columns.get(columnKey(tableName, columnName));
  return Boolean(
    column
      && column.data_type === dataType
      && column.is_nullable === (nullable ? "YES" : "NO")
      && defaultCheck(normalized(column.column_default)),
  );
}

function defaultIs(expected) {
  return (value) => value === `'${expected}'::text` || value === expected || value === `'${expected}'`;
}

function defaultIsNow(value) {
  return value === "now()" || value === "current_timestamp";
}

function constraintReady(constraints, tableName, type, requiredFragments) {
  return constraints.some((constraint) => {
    if (constraint.table_name !== tableName || constraint.type !== type || constraint.validated !== true) return false;
    const definition = normalized(constraint.definition);
    return requiredFragments.every((fragment) => definition.includes(fragment));
  });
}

function indexReady(indexes, tableName, name, { unique = false, definition = [], predicate = [] } = {}) {
  const index = indexes.find((candidate) => candidate.table_name === tableName && candidate.name === name);
  if (!index || index.valid_index !== true || (unique && index.unique_index !== true)) return false;
  const definitionText = normalized(index.definition);
  const predicateText = normalized(index.predicate);
  return definition.every((fragment) => definitionText.includes(fragment))
    && predicate.every((fragment) => predicateText.includes(fragment));
}

export function evaluateStandaloneBillingSchema({ columnRows = [], constraintRows = [], indexRows = [] } = {}) {
  const columns = new Map(columnRows.map((row) => [columnKey(row.table_name, row.column_name), row]));
  const constraints = constraintRows;
  const indexes = indexRows;
  const noDefault = (value) => value === "";

  const checks = {
    pendingSignupBillingIntervalColumn: columnReady(
      columns,
      "pending_store_signups",
      "billing_interval",
      "text",
      false,
      defaultIs("month"),
    ),
    pendingSignupSessionColumn: columnReady(
      columns,
      "pending_store_signups",
      "provider_checkout_session_id",
      "text",
      true,
      noDefault,
    ),
    pendingSignupCheckoutExpiryColumn: columnReady(
      columns,
      "pending_store_signups",
      "checkout_expires_at",
      "timestamp with time zone",
      true,
      noDefault,
    ),
    pendingSignupCancellationReasonColumn: columnReady(
      columns,
      "pending_store_signups",
      "cancellation_reason",
      "text",
      true,
      noDefault,
    ),
    pendingSignupBillingIntervalConstraint: constraintReady(
      constraints,
      "pending_store_signups",
      "c",
      ["billing_interval", "'month'", "'year'"],
    ),
    pendingSignupSessionUniqueIndex: indexReady(
      indexes,
      "pending_store_signups",
      "pending_store_signups_checkout_session_uidx",
      {
        unique: true,
        definition: ["(provider_checkout_session_id)"],
        predicate: ["provider_checkout_session_id is not null"],
      },
    ),
    pendingSignupPendingEmailUniqueIndex: indexReady(
      indexes,
      "pending_store_signups",
      "pending_store_signups_pending_email_uidx",
      {
        unique: true,
        definition: ["(owner_email_normalized)"],
        predicate: ["status", "'pending'"],
      },
    ),

    checkoutRequestIdColumn: columnReady(columns, "standalone_checkout_requests", "id", "text", false, noDefault),
    checkoutRequestCompanyColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "company_id",
      "text",
      false,
      noDefault,
    ),
    checkoutRequestStoreColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "store_id",
      "text",
      false,
      noDefault,
    ),
    checkoutRequestRequestedForColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "requested_for_user_id",
      "text",
      true,
      noDefault,
    ),
    checkoutRequestCreatedByColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "created_by_user_id",
      "text",
      true,
      noDefault,
    ),
    checkoutRequestBillingIntervalColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "billing_interval",
      "text",
      false,
      noDefault,
    ),
    checkoutRequestAmountColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "amount_cents",
      "integer",
      false,
      noDefault,
    ),
    checkoutRequestStatusColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "status",
      "text",
      false,
      defaultIs("pending"),
    ),
    checkoutRequestSessionColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "provider_checkout_session_id",
      "text",
      true,
      noDefault,
    ),
    checkoutRequestSubscriptionColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "provider_subscription_id",
      "text",
      true,
      noDefault,
    ),
    checkoutRequestExpiryColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "expires_at",
      "timestamp with time zone",
      false,
      (value) => value.includes("now()") && value.includes("1 day"),
    ),
    checkoutRequestActivatedAtColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "activated_at",
      "timestamp with time zone",
      true,
      noDefault,
    ),
    checkoutRequestCancellationReasonColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "cancellation_reason",
      "text",
      true,
      noDefault,
    ),
    checkoutRequestCreatedAtColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "created_at",
      "timestamp with time zone",
      false,
      defaultIsNow,
    ),
    checkoutRequestUpdatedAtColumn: columnReady(
      columns,
      "standalone_checkout_requests",
      "updated_at",
      "timestamp with time zone",
      false,
      defaultIsNow,
    ),
    checkoutRequestPrimaryKey: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "p",
      ["primary key (id)"],
    ),
    checkoutRequestCompanyForeignKey: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "f",
      ["foreign key (company_id)", "references companies(id)", "on delete cascade"],
    ),
    checkoutRequestStoreForeignKey: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "f",
      ["foreign key (store_id)", "references stores(id)", "on delete cascade"],
    ),
    checkoutRequestRequestedForForeignKey: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "f",
      ["foreign key (requested_for_user_id)", "references users(id)", "on delete set null"],
    ),
    checkoutRequestCreatedByForeignKey: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "f",
      ["foreign key (created_by_user_id)", "references users(id)", "on delete set null"],
    ),
    checkoutRequestBillingIntervalConstraint: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "c",
      ["billing_interval", "'month'", "'year'"],
    ),
    checkoutRequestOfferConstraint: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "c",
      ["billing_interval", "amount_cents", "'month'", "14900", "'year'", "129900"],
    ),
    checkoutRequestStatusConstraint: constraintReady(
      constraints,
      "standalone_checkout_requests",
      "c",
      ["status", "'pending'", "'activated'", "'cancelled'", "'expired'"],
    ),
    checkoutRequestSessionUniqueIndex: indexReady(
      indexes,
      "standalone_checkout_requests",
      "standalone_checkout_requests_session_uidx",
      {
        unique: true,
        definition: ["(provider_checkout_session_id)"],
        predicate: ["provider_checkout_session_id is not null"],
      },
    ),
    checkoutRequestCompanyStatusIndex: indexReady(
      indexes,
      "standalone_checkout_requests",
      "standalone_checkout_requests_company_status_idx",
      { definition: ["(company_id, status, created_at desc)"] },
    ),
    checkoutRequestExpiryIndex: indexReady(
      indexes,
      "standalone_checkout_requests",
      "standalone_checkout_requests_expiry_idx",
      { definition: ["(status, expires_at)"], predicate: ["status", "'pending'"] },
    ),

    subscriptionStateIdColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "provider_subscription_id",
      "text",
      false,
      noDefault,
    ),
    subscriptionStateReferenceColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "checkout_reference_id",
      "text",
      false,
      noDefault,
    ),
    subscriptionStateCustomerColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "provider_customer_id",
      "text",
      true,
      noDefault,
    ),
    subscriptionStateStatusColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "status",
      "text",
      false,
      noDefault,
    ),
    subscriptionStatePeriodStartColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "current_period_start",
      "timestamp with time zone",
      true,
      noDefault,
    ),
    subscriptionStatePeriodEndColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "current_period_end",
      "timestamp with time zone",
      true,
      noDefault,
    ),
    subscriptionStateEventIdColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "provider_event_id",
      "text",
      false,
      noDefault,
    ),
    subscriptionStateEventCreatedColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "provider_event_created_at",
      "timestamp with time zone",
      false,
      noDefault,
    ),
    subscriptionStateReceivedAtColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "received_at",
      "timestamp with time zone",
      false,
      defaultIsNow,
    ),
    subscriptionStateUpdatedAtColumn: columnReady(
      columns,
      "stripe_subscription_states",
      "updated_at",
      "timestamp with time zone",
      false,
      defaultIsNow,
    ),
    subscriptionStatePrimaryKey: constraintReady(
      constraints,
      "stripe_subscription_states",
      "p",
      ["primary key (provider_subscription_id)"],
    ),
    subscriptionStateStatusConstraint: constraintReady(
      constraints,
      "stripe_subscription_states",
      "c",
      ["status", "'active'", "'trialing'", "'past_due'", "'cancelled'"],
    ),
    subscriptionStateReferenceIndex: indexReady(
      indexes,
      "stripe_subscription_states",
      "stripe_subscription_states_reference_idx",
      { definition: ["(checkout_reference_id, provider_subscription_id)"] },
    ),
  };

  const failed = Object.entries(checks)
    .filter(([, pass]) => !pass)
    .map(([name]) => name);
  return { ready: failed.length === 0, checks, failed };
}

export async function readStandaloneBillingSchemaReadiness(query) {
  // This helper also runs against a single checked-out pg Client in the guarded
  // migration job, so keep the catalog reads sequential rather than relying on
  // the deprecated concurrent Client query queue.
  const columnResult = await query(COLUMN_SQL, [CATALOG_TABLES]);
  const constraintResult = await query(CONSTRAINT_SQL, [CATALOG_TABLES]);
  const indexResult = await query(INDEX_SQL, [CATALOG_TABLES]);
  return evaluateStandaloneBillingSchema({
    columnRows: columnResult.rows,
    constraintRows: constraintResult.rows,
    indexRows: indexResult.rows,
  });
}
