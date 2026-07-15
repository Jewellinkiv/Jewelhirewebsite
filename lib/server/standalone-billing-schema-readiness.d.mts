export interface StandaloneBillingSchemaReadiness {
  ready: boolean;
  checks: Record<string, boolean>;
  failed: string[];
}

export interface CatalogQueryResult {
  rows: Record<string, unknown>[];
}

export type CatalogQuery = (sql: string, values?: unknown[]) => Promise<CatalogQueryResult>;

export function evaluateStandaloneBillingSchema(input?: {
  columnRows?: Record<string, unknown>[];
  constraintRows?: Record<string, unknown>[];
  indexRows?: Record<string, unknown>[];
}): StandaloneBillingSchemaReadiness;

export function readStandaloneBillingSchemaReadiness(
  query: CatalogQuery,
): Promise<StandaloneBillingSchemaReadiness>;
