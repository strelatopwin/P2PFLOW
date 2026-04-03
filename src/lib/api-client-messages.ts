type ApiErrorPayload = {
  errorCode?: string;
  error?: string;
};

export function apiErrorMessageFromPayload(
  payload: ApiErrorPayload,
  t: (key: string, values?: Record<string, string | number>) => string,
  has: (key: string) => boolean,
): string {
  const code = payload.errorCode;
  if (code && has(code)) {
    return t(code);
  }
  return payload.error ?? t("SERVER_ERROR");
}
