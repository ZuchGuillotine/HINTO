export function resolveCorsAllowOrigin(
  configuredOrigin: string,
  requestOrigin: string | undefined,
): string {
  if (configuredOrigin === '*') {
    return '*';
  }

  const allowedOrigins = configuredOrigin
    .split(/[,\s]+/u)
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0] ?? configuredOrigin;
}
