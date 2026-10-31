import { audit, ensure, one, type Db } from '../db.js';
export async function receiveStock(db:Db,userId:string,b:any){
 const p=await one(db,'SELECT * FROM products WHERE id=$1 FOR UPDATE',[b.product_id]);ensure(p,'Product not found',404);ensure(p.kind!=='service','Services cannot be received into stock.');
 const serials=b.serials.map((s:string)=>s.trim().toUpperCase());ensure(new Set(serials).size===serials.length,'Duplicate serials in this receipt.');ensure(p.kind==='serialized'?serials.length===b.quantity:serials.length===0,'Serialized stock needs exactly one unique serial per unit; quantity stock needs none.');
 const receipt=await one(db,'INSERT INTO receipts(product_id,supplier,reference,quantity,unit_cost_minor,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[p.id,b.supplier,b.reference,b.quantity,b.unit_cost_minor,userId]);
 for(const s of serials)await db.query('INSERT INTO assets(product_id,receipt_id,serial,cost_minor) VALUES($1,$2,$3,$4)',[p.id,receipt.id,s,b.unit_cost_minor]);
 await db.query('UPDATE products SET stock_qty=stock_qty+$2,stock_value_minor=stock_value_minor+$3 WHERE id=$1',[p.id,b.quantity,b.quantity*b.unit_cost_minor]);
 await db.query('INSERT INTO stock_movements(product_id,receipt_id,quantity,value_minor) VALUES($1,$2,$3,$4)',[p.id,receipt.id,b.quantity,b.quantity*b.unit_cost_minor]);await audit(db,userId,'receipt',receipt.id,'stock.received');return receipt;
}
async function packingOrder(db:Db,id:string){const o=await one(db,'SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id]);ensure(o,'Order not found',404);ensure(o.status==='packing','This order has already left the warehouse.');return o;}
export async function reserveStock(db:Db,userId:string,id:string){
 const order=await packingOrder(db,id);
 const paid=await one(db,"SELECT coalesce(sum(p.amount_minor),0)::bigint AS total FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.order_id=$1 AND i.kind='installation'",[id]);ensure(paid.total>=order.minimum_advance_minor,'Record the minimum advance before reserving warehouse stock.');
 const lines=(await db.query("SELECT * FROM order_lines WHERE order_id=$1 AND kind<>'service' ORDER BY product_id",[id])).rows;
 for(const l of lines){if(l.reserved)continue;const p=await one(db,'SELECT * FROM products WHERE id=$1 FOR UPDATE',[l.product_id]);ensure(p.stock_qty-p.reserved_qty>=l.quantity,`Not enough ${l.description}. Need ${l.quantity}; available ${p.stock_qty-p.reserved_qty}. Receive stock and retry.`);await db.query('UPDATE products SET reserved_qty=reserved_qty+$2 WHERE id=$1',[p.id,l.quantity]);await db.query('UPDATE order_lines SET reserved=true WHERE id=$1',[l.id]);}
 await audit(db,userId,'project',order.project_id,'stock.reserved');return {reserved:true};
}
export async function scanAsset(db:Db,userId:string,id:string,b:any){
 const order=await packingOrder(db,id);
 const asset=await one(db,'SELECT * FROM assets WHERE serial=$1 FOR UPDATE',[b.serial.trim().toUpperCase()]);ensure(asset,'Unknown serial. Receive this device into stock first.',404);
 const line=await one(db,'SELECT * FROM order_lines WHERE order_id=$1 AND product_id=$2',[id,asset.product_id]);ensure(line,'This product is not included in this order.');ensure(line.reserved,'Reserve this order’s stock before scanning.');ensure(asset.status==='available','This serial has already been allocated or shipped.');
 const {count}=await one(db,'SELECT count(*)::integer AS count FROM assets WHERE order_line_id=$1',[line.id]);ensure(count<line.quantity,'All required devices of this type are already scanned.');
 await db.query("UPDATE assets SET order_line_id=$2,status='allocated' WHERE id=$1",[asset.id,line.id]);await audit(db,userId,'project',order.project_id,'serial.scanned',{serial:asset.serial});return {...asset,status:'allocated'};
}
export async function dispatchOrder(db:Db,userId:string,id:string){
 const order=await one(db,'SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id]);ensure(order,'Order not found',404);if(order.status!=='packing')return order;
 const lines=(await db.query("SELECT * FROM order_lines WHERE order_id=$1 AND kind<>'service' ORDER BY product_id",[id])).rows;
 for(const l of lines){ensure(l.reserved,`Reserve ${l.description} before dispatch.`);const p=await one(db,'SELECT * FROM products WHERE id=$1 FOR UPDATE',[l.product_id]);let cost:number;
  if(l.kind==='serialized'){const assets=(await db.query('SELECT * FROM assets WHERE order_line_id=$1 AND status=\'allocated\' FOR UPDATE',[l.id])).rows;ensure(assets.length===l.quantity,`Scan all ${l.quantity} ${l.description} before dispatch.`);cost=assets.reduce((s,a)=>s+a.cost_minor,0);}else{cost=Number((BigInt(p.stock_value_minor)*BigInt(l.quantity)+BigInt(Math.floor(p.stock_qty/2)))/BigInt(p.stock_qty));}
  await db.query('UPDATE products SET stock_qty=stock_qty-$2,reserved_qty=reserved_qty-$2,stock_value_minor=stock_value_minor-$3 WHERE id=$1',[p.id,l.quantity,cost]);await db.query('UPDATE order_lines SET material_cost_minor=$2 WHERE id=$1',[l.id,cost]);
  await db.query('INSERT INTO stock_movements(product_id,order_id,quantity,value_minor) VALUES($1,$2,$3,$4)',[p.id,id,-l.quantity,-cost]);await db.query("UPDATE assets SET status='dispatched' WHERE order_line_id=$1",[l.id]);
 }
 await db.query("UPDATE orders SET status='dispatched',dispatched_at=now() WHERE id=$1",[id]);await db.query("UPDATE projects SET stage='dispatched' WHERE id=$1",[order.project_id]);await audit(db,userId,'project',order.project_id,'order.dispatched');return {status:'dispatched'};
}
export async function deliverOrder(db:Db,userId:string,id:string){
 const o=await one(db,'SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id]);ensure(o,'Order not found',404);if(o.status==='delivered')return o;ensure(o.status==='dispatched','Dispatch the order before recording delivery.');
 const delivered=await one(db,"UPDATE orders SET status='delivered',delivered_at=now() WHERE id=$1 RETURNING *",[id]);
 const lines=(await db.query('SELECT * FROM order_lines WHERE order_id=$1 AND warranty_months>0',[id])).rows;
 for(const l of lines){const assets=(await db.query('SELECT * FROM assets WHERE order_line_id=$1',[l.id])).rows;
  for(const a of (assets.length?assets:[{id:null}]))await db.query("INSERT INTO warranties(order_line_id,asset_id,quantity,starts_at,expires_at,policy_months) VALUES($1,$2,$3,$4,$4::timestamptz+make_interval(months=>$5),$5)",[l.id,a.id,a.id?1:l.quantity,delivered.delivered_at,l.warranty_months]);
 }
 await db.query("UPDATE assets SET status='delivered' WHERE order_line_id IN (SELECT id FROM order_lines WHERE order_id=$1)",[id]);await db.query("UPDATE projects SET stage='delivered' WHERE id=$1",[o.project_id]);await audit(db,userId,'project',o.project_id,'delivery.confirmed',{warranty_started_at:delivered.delivered_at});return delivered;
}
