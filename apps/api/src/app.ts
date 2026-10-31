import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { auth } from "./plugins/auth.js";
import { customerPortalRoutes } from "./modules/customer-portal.js";
import { fileRoutes } from "./plugins/files.js";
import { routes } from "./routes.js";
import { pool, AppError } from "./db.js";
export async function buildApp(
  options: { logger?: boolean; staticRoot?: string } = {},
) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 1024 * 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  });
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: "1 minute",
  });
  await app.register(multipart, {
    limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 4 },
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "SunPower Operations API", version: "0.1.0" },
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "solar_session" },
        },
      },
    },
  });
  await auth(app);
  // /api/ is excluded from old offline navigation fallbacks, so stale clients can reach this repair page.
  app.get("/api/refresh-app", (_req, reply) =>
    reply
      .type("text/html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Update SunPower</title><style>body{font:18px system-ui,sans-serif;background:#f5f6f8;color:#132e3b;margin:0;padding:40px 20px}main{max-width:560px;margin:40px auto}button{font:inherit;background:#132e3b;color:white;padding:14px 22px;border:0;border-radius:8px;cursor:pointer}button:focus-visible{outline:3px solid #237b98;outline-offset:4px}</style><script src="/api/refresh-app.js" defer></script></head><body><main><h1>Load the latest SunPower app</h1><p>Save any unfinished forms in your other app tabs before continuing.</p><p>This replaces the outdated offline app connection. Your saved customers, stock, photos, payments and sign-in stay unchanged.</p><button id="refresh-app" type="button">Load latest app</button><p id="result" role="status"></p></main></body></html>`,
      ),
  );
  app.get("/api/refresh-app.js", (_req, reply) =>
    reply
      .type("application/javascript")
      .send(
        `document.getElementById('refresh-app').addEventListener('click',async()=>{const button=document.getElementById('refresh-app');const status=document.getElementById('result');button.disabled=true;status.textContent='Loading the latest app…';try{if('serviceWorker' in navigator){const registration=await navigator.serviceWorker.getRegistration('/');if(registration&&registration.scope===location.origin+'/')await registration.unregister();}location.replace('/?app-updated='+Date.now());}catch(error){status.textContent='The update could not finish. Close other SunPower tabs and try again.';button.disabled=false;}});`,
      ),
  );
  await app.register(swaggerUi, { routePrefix: "/api/docs" });
  app.get("/api/health", async () => {
    await pool.query("SELECT 1");
    return { status: "ok", database: "connected" };
  });
  await routes(app);
  await customerPortalRoutes(app);
  await fileRoutes(app);
  app.setErrorHandler((error, req, reply) => {
    const e = error as any;
    if (e instanceof AppError)
      return reply
        .status(e.statusCode)
        .send({ error: { code: e.code, message: e.message } });
    if (e.validation)
      return reply.status(400).send({
        error: {
          code: "VALIDATION",
          message: "Check the submitted fields.",
          fields: e.validation.map((v: any) => ({
            path: v.instancePath || v.params?.missingProperty || "",
            message: v.message,
          })),
        },
      });
    if (e.code === "23505")
      return reply.status(409).send({
        error: {
          code: "DUPLICATE",
          message: "That serial, reference or record already exists.",
        },
      });
    if (e.code === "23503")
      return reply.status(400).send({
        error: {
          code: "REFERENCE",
          message: "A referenced record no longer exists.",
        },
      });
    if (e.statusCode && e.statusCode < 500)
      return reply
        .status(e.statusCode)
        .send({ error: { code: "REQUEST", message: e.message } });
    req.log.error(e);
    return reply.status(500).send({
      error: {
        code: "INTERNAL",
        message: "The change could not be saved. Please retry.",
      },
    });
  });
  const root = options.staticRoot || resolve("apps/web/dist");
  if (existsSync(root)) {
    await app.register(staticPlugin, { root, index: false });
    app.get("/", (_req, reply) =>
      reply.type("text/html").sendFile("index.html"),
    );
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.status(404).send({
            error: { code: "NOT_FOUND", message: "API route not found" },
          })
        : reply.type("text/html").sendFile("index.html"),
    );
  }
  return app;
}
