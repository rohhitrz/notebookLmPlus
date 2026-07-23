import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";
import { NotFoundError } from "./errors";

export function apiHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Invalid request", issues: err.issues },
          { status: 400 },
        );
      }
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (err instanceof NotFoundError) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      console.error("[api] unhandled error", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
