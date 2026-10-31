import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import type { FastifyInstance } from "fastify";
import { pool, one, ensure, transaction, audit } from "../db.js";
import { accessibleJob } from "../modules/field.js";
import { accessibleTicket } from "../modules/service.js";
import { allow } from "./auth.js";
import { Params } from "../../../../packages/contracts/src/index.js";
export const uploadDir = resolve(process.env.UPLOAD_DIR || "data/uploads");
export const evidenceStorage = { writeFile };
export async function fileRoutes(app: FastifyInstance) {
  await mkdir(uploadDir, { recursive: true });
  app.delete(
    "/api/evidence/:id",
    { schema: { params: Params } },
    async (req) => {
      allow(req, ["admin", "technician"]);
      const { id } = req.params as { id: string };
      const filename = await transaction(async (db) => {
        const file = await one(db, "SELECT * FROM evidence WHERE id=$1", [id]);
        ensure(file, "Signature not found.", 404);
        ensure(
          file.kind === "signature",
          "Only signatures can be removed here.",
          400,
        );
        const parent = file.job_id
          ? await accessibleJob(db, req.user, file.job_id)
          : await accessibleTicket(db, req.user, file.ticket_id, true);
        const visit = file.visit_id
          ? await one(db, "SELECT * FROM visits WHERE id=$1 FOR UPDATE", [
              file.visit_id,
            ])
          : null;
        ensure(
          file.job_id
            ? parent.status === "in_progress"
            : visit?.status === "in_progress" &&
                !["closed", "cancelled", "awaiting_confirmation"].includes(
                  parent.status,
                ),
          "Completed signatures cannot be removed. Only the current visit can be corrected.",
        );
        if (visit && req.user.role === "technician")
          ensure(
            await one(
              db,
              "SELECT 1 FROM visit_crew WHERE visit_id=$1 AND user_id=$2",
              [visit.id, req.user.id],
            ),
            "This visit belongs to another technician.",
            403,
          );
        const removed = await one(
          db,
          "DELETE FROM evidence WHERE id=$1 RETURNING filename",
          [id],
        );
        ensure(removed, "Signature has already been removed.", 404);
        await audit(
          db,
          req.user.id,
          "project",
          parent.project_id,
          "signature.removed",
          { evidence_id: id },
        );
        return removed.filename;
      });
      await unlink(resolve(uploadDir, filename)).catch((error) =>
        app.log.error(
          { error, filename },
          "Removed signature file could not be cleaned up",
        ),
      );
      return { removed: true };
    },
  );
  for (const target of ["jobs", "tickets"])
    app.post(
      `/api/${target}/:id/evidence`,
      { schema: { params: Params } },
      async (req) => {
        allow(req, ["admin", "technician"]);
        const { id } = req.params as { id: string };
        await transaction((db) =>
          target === "jobs"
            ? accessibleJob(db, req.user, id)
            : accessibleTicket(db, req.user, id, true),
        );
        const file = await req.file();
        ensure(file, "Choose a photo or signature file.", 400);
        const kind = (file.fields.kind as { value?: string })?.value;
        ensure(
          kind === "photo" || kind === "signature",
          "Evidence kind must be photo or signature.",
          400,
        );
        const bytes = await file.toBuffer();
        const orderLine =
            (file.fields.order_line_id as { value?: string })?.value || null,
          assetId = (file.fields.asset_id as { value?: string })?.value || null;
        const uuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        ensure(
          (!orderLine || uuid.test(orderLine)) &&
            (!assetId || uuid.test(assetId)),
          "Choose a valid installed component.",
          400,
        );
        ensure(
          !assetId || orderLine,
          "Select the component for this serial.",
          400,
        );
        ensure(
          !file.file.truncated && bytes.length <= 8 * 1024 * 1024,
          "File exceeds the 8 MB limit.",
          413,
        );
        const png = bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        const webp =
          bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP";
        ensure(png || jpeg || webp, "Use a PNG, JPEG or WebP image.", 415);
        ensure(
          kind !== "signature" || png,
          "Signatures must be PNG images.",
          415,
        );
        let normalized: Buffer;
        try {
          normalized = await sharp(bytes, {
            limitInputPixels: 20000000,
            failOn: "error",
          })
            .rotate()
            .toBuffer();
        } catch {
          ensure(
            false,
            "The image could not be decoded. Use a valid image under 20 megapixels.",
            415,
          );
        }
        ensure(
          normalized.length <= 8 * 1024 * 1024,
          "The decoded image exceeds the 8 MB limit. Resize it and retry.",
          413,
        );
        const mime = png ? "image/png" : jpeg ? "image/jpeg" : "image/webp",
          filename = `${randomUUID()}.${png ? "png" : jpeg ? "jpg" : "webp"}`,
          path = resolve(uploadDir, filename);
        try {
          await evidenceStorage.writeFile(path, normalized, { flag: "wx" });
        } catch (error) {
          await unlink(path).catch(() => {});
          ensure(
            false,
            (error as any).code === "ENOSPC"
              ? "Photo storage is full. Nothing was saved; contact the administrator and retry."
              : "Photo storage is unavailable. Nothing was saved; retry after storage is restored.",
            503,
          );
        }
        try {
          return await transaction(async (db) => {
            const job =
              target === "jobs"
                ? await accessibleJob(db, req.user, id)
                : await accessibleTicket(db, req.user, id, true);
            const visit =
              target === "tickets"
                ? await one(
                    db,
                    "SELECT v.id FROM visits v WHERE v.ticket_id=$1 AND v.status='in_progress' AND ($2::uuid IS NULL OR EXISTS(SELECT 1 FROM visit_crew c WHERE c.visit_id=v.id AND c.user_id=$2)) ORDER BY v.starts_at DESC LIMIT 1 FOR UPDATE",
                    [id, req.user.role === "technician" ? req.user.id : null],
                  )
                : null;
            ensure(
              target === "jobs"
                ? job.status === "in_progress"
                : visit &&
                    !["closed", "cancelled", "awaiting_confirmation"].includes(
                      job.status,
                    ),
              "Start the assigned visit before saving evidence. Completed evidence cannot be changed.",
            );

            if (orderLine) {
              const line = await one(
                db,
                "SELECT l.id FROM order_lines l JOIN orders o ON o.id=l.order_id WHERE l.id=$1 AND o.project_id=$2",
                [orderLine, job.project_id],
              );
              ensure(
                line,
                "Photo component belongs to another installation.",
                400,
              );
              if (assetId)
                ensure(
                  await one(
                    db,
                    "SELECT id FROM assets WHERE id=$1 AND order_line_id=$2",
                    [assetId, orderLine],
                  ),
                  "Photo serial does not belong to this component.",
                  400,
                );
            }
            const hash = createHash("sha256").update(normalized).digest("hex");
            const duplicate = await one(
              db,
              "SELECT id,kind,size_bytes,order_line_id,asset_id FROM evidence WHERE (job_id=$1 OR ticket_id=$1) AND kind=$2 AND visit_id IS NOT DISTINCT FROM $3::uuid AND diagnosis_revision IS NOT DISTINCT FROM $4::integer AND order_line_id IS NOT DISTINCT FROM $5::uuid AND asset_id IS NOT DISTINCT FROM $6::uuid AND content_hash=$7",
              [
                id,
                kind,
                visit?.id || null,
                target === "tickets" ? job.diagnosis_revision : null,
                orderLine,
                assetId,
                hash,
              ],
            );
            if (duplicate) {
              await unlink(path);
              return { ...duplicate, deduplicated: true };
            }
            const row = await one(
              db,
              "INSERT INTO evidence(job_id,ticket_id,visit_id,kind,filename,mime,size_bytes,uploaded_by,diagnosis_revision,order_line_id,asset_id,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,kind,size_bytes,order_line_id,asset_id",
              [
                target === "jobs" ? id : null,
                target === "tickets" ? id : null,
                visit?.id || null,
                kind,
                filename,
                mime,
                normalized.length,
                req.user.id,
                target === "tickets" ? job.diagnosis_revision : null,
                orderLine,
                assetId,
                hash,
              ],
            );
            await audit(
              db,
              req.user.id,
              "project",
              job.project_id,
              "evidence.saved",
              { kind, evidence_id: row.id },
            );
            return row;
          });
        } catch (e) {
          await unlink(path).catch(() => {});
          throw e;
        }
      },
    );
  app.get(
    "/api/evidence/:id",
    { schema: { params: Params } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const file = await one(
        pool,
        "SELECT e.*,j.technician_id FROM evidence e LEFT JOIN jobs j ON j.id=e.job_id WHERE e.id=$1",
        [id],
      );
      ensure(file, "Evidence not found", 404);
      allow(req, [
        "admin",
        "technician",
        "sales",
        "support",
        "surveyor",
        "coordinator",
      ]);
      if (file.ticket_id)
        await accessibleTicket(pool, req.user, file.ticket_id);
      ensure(
        file.ticket_id ||
          req.user.role !== "technician" ||
          file.technician_id === req.user.id ||
          (await one(
            pool,
            "SELECT 1 FROM job_crew WHERE job_id=$1 AND user_id=$2",
            [file.job_id, req.user.id],
          )),
        "This evidence belongs to another technician’s job.",
        403,
      );
      reply
        .type(file.mime)
        .header("Content-Disposition", "inline")
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff");
      return reply.send(createReadStream(resolve(uploadDir, file.filename)));
    },
  );
}
