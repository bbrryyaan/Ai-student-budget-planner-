import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export const ACCESS_COOKIE_NAME = "access_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  return process.env.JWT_SECRET;
};

export const signAccessToken = (userId) =>
  jwt.sign({ id: userId, jti: randomUUID() }, jwtSecret(), { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (userId) =>
  jwt.sign({ id: userId, tokenType: "refresh", jti: randomUUID() }, jwtSecret(), {
    expiresIn: REFRESH_TOKEN_TTL,
  });

export const verifyJwt = (token) => jwt.verify(token, jwtSecret());

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
});

export const getAccessCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: FIFTEEN_MINUTES_MS,
});

export const getRefreshCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: SEVEN_DAYS_MS,
});

export const setAuthCookies = ({ res, accessToken, refreshToken }) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());
};

export const clearAuthCookies = (res) => {
  res.clearCookie(ACCESS_COOKIE_NAME, baseCookieOptions());
  res.clearCookie(REFRESH_COOKIE_NAME, baseCookieOptions());
};
