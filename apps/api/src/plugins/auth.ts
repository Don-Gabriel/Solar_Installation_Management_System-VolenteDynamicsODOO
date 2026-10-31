import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { pool, one, ensure, AppError, transaction, audit } from "../db.js";
import { Type } from "typebox";
import {
  Login,
  type User,
  type Role,
} from "../../../../packages/contracts/src/index.js";
declare module "fastify" {
  interface FastifyRequest {
    user: User;
    csrfToken: string;
    demoOperatorId: string | null;
  }
}
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const secure = process.env.COOKIE_SECURE === "true";
export function allow(req: FastifyRequest, roles: Role[]) {
  ensure(
    req.user && roles.includes(req.user.role),
    "Your role cannot perform this action.",
    403,
  );
}
export async function auth(app: FastifyInstance) {
  app.decorateRequest("user");
  app.decorateRequest("csrfToken", "");
  app.decorateRequest("demoOperatorId", null);
  const demoEnabled = () =>
    process.env.DEMO_TOOLS === "true" && process.env.NODE_ENV !== "production";
  const dummy = await argon2.hash(randomBytes(32));
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!req.url.startsWith("/api/")) return;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      const origins = (
        process.env.APP_ORIGINS ||
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3001,http://localhost:3001"
      ).split(",");
      ensure(
        origins.includes(req.headers.origin),
        "Request origin is not allowed.",
        403,
      );
    }
    if (
      [
        "/api/login",
        "/api/health",
        "/api/enquiries/public",
        "/api/refresh-app",
        "/api/refresh-app.js",
      ].includes(req.url.split("?")[0])
    )
      return;
    const token = req.cookies.solar_session;
    ensure(token, "Sign in to continue.", 401);
    const session = await one(
      pool,
      "SELECT u.id,u.name,u.email,u.role,s.csrf_token,s.demo_operator_id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active",
      [digest(token)],
    );
    ensure(session, "Your session has expired. Sign in again.", 401);
    req.user = {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    };
    req.csrfToken = session.csrf_token;
    if (demoEnabled()) {
      const operator =
        session.demo_operator_id ||
        (session.role === "admin" ? session.id : null);
      if (
        operator &&
        (await one(
          pool,
          "SELECT id FROM users WHERE id=$1 AND active AND role='admin'",
          [operator],
        ))
      )
        req.demoOperatorId = operator;
    }
    if (session.role === "customer") {
      const route = req.routeOptions.url;
      ensure(
        [
          "/api/me",
          "/api/logout",
          "/api/demo-users",
          "/api/demo-switch",
          "/api/customer/home",
          "/api/customer/notifications/:id/read",
        ].includes(route || ""),
        "Customer accounts can only open their own solar service portal.",
        403,
      );
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
      ensure(
        req.headers["x-csrf-token"] === session.csrf_token,
        "Refresh the page before submitting this change.",
        403,
      );
    if (req.url.startsWith("/api/docs")) allow(req, ["admin"]);
  });
  app.post(
    "/api/login",
    {
      schema: { body: Login, tags: ["Access"] },
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === "test" ? 100 : 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const body = req.body as { email: string; password: string };
      const user = await one(
        pool,
        "SELECT * FROM users WHERE lower(email)=lower($1) AND active",
        [body.email],
      );
      const valid = await argon2.verify(
        user?.password_hash || dummy,
        body.password,
      );
      if (!user || !valid)
        throw new AppError(
          401,
          "Email or password is incorrect.",
          "INVALID_CREDENTIALS",
        );
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(32).toString("hex");
      await pool.query(
        "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')",
        [digest(token), user.id, csrf],
      );
      reply.setCookie("solar_session", token, {
        httpOnly: true,
        secure,
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        csrfToken: csrf,
        canSwitchDemoUser: demoEnabled() && user.role === "admin",
      };
    },
  );
  app.get("/api/me", async (req) => ({
    user: req.user,
    csrfToken: req.csrfToken,
    canSwitchDemoUser: !!req.demoOperatorId,
  }));
  app.get("/api/demo-users", async (req) => {
    ensure(
      req.demoOperatorId,
      "Demo switching requires an administrator's demo session.",
      403,
    );
    return (
      await pool.query(
        "SELECT id,name,email,role FROM users WHERE active ORDER BY role,name",
      )
    ).rows;
  });
  app.post(
    "/api/demo-switch",
    {
      schema: {
        body: Type.Object(
          { user_id: Type.String({ format: "uuid" }) },
          { additionalProperties: false },
        ),
      },
    },
    async (req, reply) => {
      ensure(
        req.demoOperatorId,
        "Demo switching requires an administrator's demo session.",
        403,
      );
      const token = randomBytes(32).toString("hex"),
        csrf = randomBytes(32).toString("hex");
      const user = await transaction(async (db) => {
        const old = await one(
          db,
          "SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
          [digest(req.cookies.solar_session || "")],
        );
        ensure(
          old,
          "This session has already changed. Refresh to continue.",
          401,
        );
        ensure(
          await one(
            db,
            "SELECT id FROM users WHERE id=$1 AND active AND role='admin' FOR SHARE",
            [req.demoOperatorId],
          ),
          "Demo operator is unavailable.",
          403,
        );
        const target = await one(
          db,
          "SELECT id,name,email,role FROM users WHERE id=$1 AND active FOR SHARE",
          [(req.body as any).user_id],
        );
        ensure(target, "Choose an active demo user.", 404);
        await db.query("DELETE FROM sessions WHERE token_hash=$1", [
          old.token_hash,
        ]);
        await db.query(
          "INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,demo_operator_id) VALUES($1,$2,$3,now()+interval '12 hours',$4)",
          [digest(token), target.id, csrf, req.demoOperatorId],
        );
        await audit(
          db,
          req.demoOperatorId!,
          "user",
          target.id,
          "demo.user_switched",
          { from: req.user.id, to: target.id },
        );
        return target;
      });
      reply.setCookie("solar_session", token, {
        httpOnly: true,
        secure,
        sameSite: "strict",
        path: "/",
        maxAge: 43200,
      });
      return { user, csrfToken: csrf, canSwitchDemoUser: true };
    },
  );
  app.post("/api/logout", async (req, reply) => {
    await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
      digest(req.cookies.solar_session || ""),
    ]);
    reply.clearCookie("solar_session", { path: "/" });
    return { ok: true };
  });
}
