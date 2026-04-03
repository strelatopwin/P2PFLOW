import { NextResponse } from "next/server";
import { API_ERROR_CODE, type ApiErrorCode } from "./api-error-codes";

export function jsonError(status: number, code: ApiErrorCode) {
  return NextResponse.json({ errorCode: code }, { status });
}

export function responseJsonError(status: number, code: ApiErrorCode) {
  return Response.json({ errorCode: code }, { status });
}

export function jsonServerError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "Server error";
  return NextResponse.json(
    { errorCode: API_ERROR_CODE.SERVER_ERROR, error: message },
    { status: 500 },
  );
}

export function responseServerError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "Server error";
  return Response.json(
    { errorCode: API_ERROR_CODE.SERVER_ERROR, error: message },
    { status: 500 },
  );
}
