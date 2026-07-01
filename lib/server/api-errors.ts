import { NextResponse } from "next/server";
import { AccessDeniedError } from "@/lib/server/access-control";
import { UnauthenticatedError } from "@/lib/server/auth";
import { StorageAdapterUnavailableError } from "@/lib/server/storage-runtime";

export function apiErrorResponse(error: unknown) {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: { code: "unauthenticated", message: error.message } }, { status: 401 });
  }

  if (error instanceof AccessDeniedError) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "You do not have access to this store scope." } },
      { status: 403 },
    );
  }

  if (error instanceof StorageAdapterUnavailableError) {
    return NextResponse.json(
      { error: { code: "storage_adapter_unavailable", message: error.message } },
      { status: 501 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: "internal_server_error", message: "Unexpected server error." } },
    { status: 500 },
  );
}

export function withApiErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiErrorResponse(error);
    }
  };
}
