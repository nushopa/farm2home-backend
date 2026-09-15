module.exports = {
  ACCESS_COOKIE_NAME: "access_token",
  REFRESH_COOKIE_NAME: "refresh_token",
  ACCESS_TOKEN_TTL_MS: 24 * 60 * 60 * 1000, // 24h
  ACCESS_TOKEN_TTL_JWT: "24h",
  REFRESH_TOKEN_TTL_MS: 24 * 60 * 60 * 1000, // 30 days
  AUTH_HEADER_PREFIX: "Bearer ",
};
