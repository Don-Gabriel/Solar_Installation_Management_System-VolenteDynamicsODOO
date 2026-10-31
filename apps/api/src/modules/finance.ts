import { audit, ensure, one, pool, type Db } from "../db.js";

async function lockInvoice(db: Db, id: string) {
  ensure(
    await one(db, "SELECT id FROM invoices WHERE id=$1 FOR UPDATE", [id]),
    "Invoice not found",
    404,
  );
  return one(db, "SELECT * FROM invoice_balances WHERE id=$1", [id]);
}
export async function ledger(id: string) {
  const invoice = await one(
    pool,
    "SELECT * FROM invoice_balances WHERE id=$1",
    [id],
  );
  ensure(invoice, "Invoice not found", 404);
  const [corrections, credits, refunds, payments, children] = await Promise.all(
    [
      pool.query(
        "SELECT * FROM invoice_corrections WHERE invoice_id=$1 ORDER BY created_at",
        [id],
      ),
      pool.query(
        "SELECT * FROM credit_notes WHERE invoice_id=$1 ORDER BY issued_at",
        [id],
      ),
      pool.query(
        "SELECT * FROM refunds WHERE invoice_id=$1 ORDER BY created_at",
        [id],
      ),
      pool.query(
        "SELECT p.*,r.reason AS reversal_reason,r.created_at AS reversed_at FROM payments p LEFT JOIN payment_reversals r ON r.payment_id=p.id WHERE p.invoice_id=$1 ORDER BY p.paid_at",
        [id],
      ),
      pool.query(
        "SELECT i.*,coalesce((SELECT json_agg(l) FROM invoice_lines l WHERE l.invoice_id=i.id),'[]') AS lines FROM invoice_balances i WHERE parent_invoice_id=$1 ORDER BY issued_at",
        [id],
      ),
    ],
  );
  return {
    invoice,
    corrections: corrections.rows,
    credits: credits.rows,
    refunds: refunds.rows,
    payments: payments.rows,
    replacements: children.rows,
  };
}
export async function requestCorrection(
  db: Db,
  actor: string,
  id: string,
  b: any,
) {
  const i = await lockInvoice(db, id);
  ensure(
    b.credit_minor <= i.net_total_minor,
    "Credit exceeds the remaining invoice value.",
  );
  const lines = b.replacement_lines || [];
  ensure(
    !lines.length || b.credit_minor === i.net_total_minor,
    "A replacement invoice requires a full credit of the remaining original balance.",
  );
  ensure(
    lines.reduce(
      (s: number, l: any) => s + l.quantity * l.unit_price_minor,
      0,
    ) <= 1000000000000,
    "Replacement invoice is too large.",
  );
  const r = await one(
    db,
    "INSERT INTO invoice_corrections(invoice_id,reason,credit_minor,replacement_lines,requested_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [id, b.reason, b.credit_minor, JSON.stringify(lines), actor],
  );
  await audit(db, actor, "invoice", id, "correction.requested", {
    correction_id: r.id,
    ...b,
  });
  return r;
}
export async function reviewCorrection(
  db: Db,
  actor: string,
  id: string,
  b: any,
) {
  const peek = await one(
    db,
    "SELECT invoice_id FROM invoice_corrections WHERE id=$1",
    [id],
  );
  ensure(peek, "Correction not found", 404);
  const i = await lockInvoice(db, peek.invoice_id);
  const c = await one(
    db,
    "SELECT * FROM invoice_corrections WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(c.status === "pending", "Correction already reviewed.");
  ensure(
    c.requested_by !== actor,
    "Another accounts officer or administrator must review this request.",
    403,
  );
  let replacement = null;
  if (b.approved) {
    ensure(
      c.credit_minor <= i.net_total_minor,
      "Invoice balance changed. Request a fresh correction.",
    );
    ensure(
      !c.replacement_lines.length || c.credit_minor === i.net_total_minor,
      "Invoice balance changed. Request a fresh full correction.",
    );
    await db.query(
      "INSERT INTO credit_notes(invoice_id,correction_id,amount_minor,reason) VALUES($1,$2,$3,$4)",
      [i.id, id, c.credit_minor, c.reason],
    );
    if (c.replacement_lines.length) {
      const total = c.replacement_lines.reduce(
        (s: number, l: any) => s + l.quantity * l.unit_price_minor,
        0,
      );
      replacement = await one(
        db,
        "INSERT INTO invoices(order_id,kind,total_minor,parent_invoice_id) VALUES($1,'correction',$2,$3) RETURNING *",
        [i.order_id, total, i.id],
      );
      for (const l of c.replacement_lines)
        await db.query(
          "INSERT INTO invoice_lines(invoice_id,description,quantity,unit_price_minor) VALUES($1,$2,$3,$4)",
          [replacement.id, l.description, l.quantity, l.unit_price_minor],
        );
    }
  }
  await db.query(
    "UPDATE invoice_corrections SET status=$2,reviewed_by=$3,review_note=$4,reviewed_at=now(),replacement_invoice_id=$5 WHERE id=$1",
    [
      id,
      b.approved ? "approved" : "rejected",
      actor,
      b.note,
      replacement?.id || null,
    ],
  );
  await audit(db, actor, "invoice", i.id, "correction.reviewed", {
    correction_id: id,
    ...b,
    replacement_invoice_id: replacement?.id,
  });
  return { id, status: b.approved ? "approved" : "rejected", replacement };
}
export async function verifyPayment(db: Db, actor: string, id: string, b: any) {
  const p = await one(db, "SELECT * FROM payments WHERE id=$1", [id]);
  ensure(p, "Payment not found", 404);
  const i = await lockInvoice(db, p.invoice_id);
  const current = await one(
    db,
    "SELECT * FROM payments WHERE id=$1 FOR UPDATE",
    [id],
  );
  ensure(current.status === "pending", "Payment is no longer pending.");
  if (b.approved)
    ensure(
      p.amount_minor <= i.net_total_minor - i.paid_minor,
      "Verified payment would exceed the outstanding balance.",
    );
  await db.query(
    "UPDATE payments SET status=$2,verified_by=$3,verified_at=now(),verification_note=$4 WHERE id=$1",
    [id, b.approved ? "verified" : "rejected", actor, b.note],
  );
  await audit(db, actor, "invoice", i.id, "payment.verified", {
    payment_id: id,
    ...b,
  });
  return { id, status: b.approved ? "verified" : "rejected" };
}
export async function reversePayment(
  db: Db,
  actor: string,
  id: string,
  b: any,
) {
  const p = await one(db, "SELECT * FROM payments WHERE id=$1", [id]);
  ensure(p, "Payment not found", 404);
  const i = await lockInvoice(db, p.invoice_id);
  ensure(p.status === "verified", "Only verified receipts can be reversed.");
  ensure(
    !(await one(db, "SELECT id FROM payment_reversals WHERE payment_id=$1", [
      id,
    ])),
    "Receipt already reversed.",
  );
  ensure(
    i.paid_minor >= p.amount_minor,
    "This receipt has already funded a refund; it cannot be reversed again.",
  );
  const r = await one(
    db,
    "INSERT INTO payment_reversals(payment_id,reason,created_by) VALUES($1,$2,$3) RETURNING *",
    [id, b.reason, actor],
  );
  await audit(db, actor, "invoice", i.id, "payment.reversed", {
    payment_id: id,
    reason: b.reason,
  });
  return r;
}
export async function refund(db: Db, actor: string, id: string, b: any) {
  const i = await lockInvoice(db, id);
  ensure(
    b.amount_minor <= i.paid_minor - i.net_total_minor,
    "Refund exceeds the customer credit balance. Approve a credit note first.",
  );
  const r = await one(
    db,
    "INSERT INTO refunds(invoice_id,amount_minor,reference,reason,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
    [id, b.amount_minor, b.reference, b.reason, actor],
  );
  await audit(db, actor, "invoice", id, "refund.recorded", {
    ...b,
    refund_id: r.id,
  });
  return r;
}
