import { pool, one, ensure } from '../db.js';
import type { User } from '../../../../packages/contracts/src/index.js';
const financeRoles=['admin','accounts','sales'];
export const projectSelect=`SELECT p.*,c.name AS customer_name,c.phone,s.address,u.name AS owner_name,
 o.id AS order_id,j.id AS job_id,j.status AS job_status,j.scheduled_at,t.name AS technician_name
 FROM projects p JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id
 LEFT JOIN users u ON u.id=p.owner_id LEFT JOIN orders o ON o.project_id=p.id LEFT JOIN jobs j ON j.order_id=o.id LEFT JOIN users t ON t.id=j.technician_id`;
export async function listProjects(user:User,q:any){const search=`%${q.search||''}%`,page=q.page||1,limit=q.limit||50;
 const where=` WHERE (c.name ILIKE $1 OR c.phone ILIKE $1 OR s.address ILIKE $1 OR p.number::text ILIKE $1) AND ($2::text IS NULL OR p.stage=$2) AND ($3::uuid IS NULL OR j.technician_id=$3)`;
 const args=[search,q.status||null,user.role==='technician'?user.id:null];
 const rows=(await pool.query(`${projectSelect}${where} ORDER BY p.created_at DESC,p.id LIMIT $4 OFFSET $5`,[...args,limit,(page-1)*limit])).rows;
 const count=await one(pool,`SELECT count(*)::integer AS total FROM (${projectSelect}${where}) result`,args);return {items:rows,total:count.total,page,limit};
}
export async function projectDetail(user:User,id:string){
 const project=await one(pool,`${projectSelect} WHERE p.id=$1`,[id]);ensure(project,'Project not found',404);
 const job=await one(pool,'SELECT * FROM jobs WHERE order_id=$1',[project.order_id||null]);ensure(user.role!=='technician'||job?.technician_id===user.id,'This job is assigned to another technician.',403);
 const [surveys,quotes,orders,evidence,warranties,invoices,audit,subsidy,assets]=await Promise.all([
 pool.query('SELECT s.*,u.name AS surveyed_by_name FROM surveys s JOIN users u ON u.id=s.surveyed_by WHERE project_id=$1 ORDER BY created_at DESC,id DESC',[id]),
 pool.query("SELECT q.*,coalesce((SELECT json_agg(l ORDER BY l.description) FROM quote_lines l WHERE l.quote_id=q.id),'[]') AS lines FROM quotes q WHERE project_id=$1 ORDER BY version DESC",[id]),
 pool.query("SELECT o.*,coalesce((SELECT json_agg(l ORDER BY l.description) FROM order_lines l WHERE l.order_id=o.id),'[]') AS lines FROM orders o WHERE project_id=$1",[id]),
 pool.query('SELECT id,kind,mime,size_bytes,created_at FROM evidence WHERE job_id=$1 ORDER BY created_at DESC',[job?.id||null]),
 pool.query('SELECT w.*,a.serial,p.name AS product_name FROM warranties w LEFT JOIN assets a ON a.id=w.asset_id JOIN order_lines l ON l.id=w.order_line_id JOIN products p ON p.id=l.product_id WHERE l.order_id=$1',[project.order_id||null]),
 pool.query("SELECT i.*,coalesce((SELECT sum(amount_minor) FROM payments WHERE invoice_id=i.id),0)::bigint AS paid_minor,coalesce((SELECT json_agg(l) FROM invoice_lines l WHERE l.invoice_id=i.id),'[]') AS lines,coalesce((SELECT json_agg(p ORDER BY p.paid_at) FROM payments p WHERE p.invoice_id=i.id),'[]') AS payments FROM invoices i WHERE i.order_id=$1 ORDER BY issued_at",[project.order_id||null]),
 pool.query('SELECT a.*,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 40',[id]),
 pool.query('SELECT * FROM subsidies WHERE project_id=$1',[id]),
 pool.query('SELECT a.id,a.serial,a.status,a.order_line_id,p.name AS product_name FROM assets a JOIN products p ON p.id=a.product_id JOIN order_lines l ON l.id=a.order_line_id WHERE l.order_id=$1',[project.order_id||null])]);
 const order=orders.rows[0]||null;const canFinance=financeRoles.includes(user.role);
 if(!canFinance){if(order){delete order.total_minor;delete order.minimum_advance_minor;order.lines.forEach((l:any)=>{delete l.unit_price_minor;delete l.material_cost_minor;});}if(job){delete job.hourly_rate_minor;delete job.labour_cost_minor;}}
 return {project,surveys:surveys.rows,quotes:canFinance?quotes.rows:[],order,job,evidence:evidence.rows,warranties:warranties.rows,invoices:canFinance?invoices.rows:[],audit:canFinance?audit.rows:audit.rows.map(({detail,...a})=>a),subsidy:subsidy.rows[0]||null,assets:assets.rows};
}
export async function dashboard(user:User){
 const rows=await listProjects(user,{limit:100});const counts=(await pool.query('SELECT stage,count(*)::integer AS count FROM projects GROUP BY stage')).rows;
 const jobs=(await pool.query(`${projectSelect} WHERE j.status<>'completed' AND ($1::uuid IS NULL OR j.technician_id=$1) ORDER BY j.scheduled_at NULLS LAST LIMIT 6`,[user.role==='technician'?user.id:null])).rows;
 const stock=(await pool.query("SELECT id,name,sku,stock_qty-reserved_qty AS available FROM products WHERE kind<>'service' AND stock_qty-reserved_qty<5 ORDER BY stock_qty-reserved_qty LIMIT 5")).rows;
 const tickets=await one(pool,"SELECT count(*)::integer AS count FROM tickets WHERE status<>'closed'");
 return {projects:rows.items.slice(0,6),counts:user.role==='technician'?Object.entries(rows.items.reduce((a:any,p:any)=>{a[p.stage]=(a[p.stage]||0)+1;return a;},{})).map(([stage,count])=>({stage,count})):counts,jobs,low_stock:user.role==='technician'?[]:stock,open_tickets:user.role==='technician'?null:tickets.count,finance:financeRoles.includes(user.role)?await financeSummary('month'):null};
}
export async function financeSummary(period:string){
 const interval=period==='today'?'day':period==='week'?'week':period==='all'?null:'month';
 // A project cohort by confirmation date; collections also show actual period cash separately.
 const rows=(await pool.query(`SELECT p.id AS project_id,p.number,c.name AS customer_name,p.stage,o.confirmed_at,o.total_minor AS order_value_minor,
 (SELECT coalesce(sum(i.total_minor),0)::bigint FROM invoices i WHERE i.order_id=o.id) AS invoiced_minor,
 (SELECT coalesce(sum(pay.amount_minor),0)::bigint FROM payments pay JOIN invoices i ON i.id=pay.invoice_id WHERE i.order_id=o.id) AS collected_minor,
 (SELECT coalesce(sum(l.material_cost_minor),0)::bigint FROM order_lines l WHERE l.order_id=o.id) AS material_cost_minor,
 coalesce(j.labour_cost_minor,0) AS labour_cost_minor,
 (SELECT coalesce(sum(t.parts_cost_minor+t.labour_cost_minor),0)::bigint FROM tickets t JOIN warranties w ON w.id=t.warranty_id JOIN order_lines l ON l.id=w.order_line_id WHERE l.order_id=o.id) AS service_cost_minor
 FROM orders o JOIN projects p ON p.id=o.project_id JOIN sites s ON s.id=p.site_id JOIN customers c ON c.id=s.customer_id LEFT JOIN jobs j ON j.order_id=o.id
 WHERE ($1::text IS NULL OR o.confirmed_at>=date_trunc($1::text,now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata') ORDER BY o.confirmed_at DESC`,[interval])).rows;
 const jobs=rows.map(r=>({...r,outstanding_minor:r.invoiced_minor-r.collected_minor,direct_cost_minor:r.material_cost_minor+r.labour_cost_minor+r.service_cost_minor,contribution_minor:r.stage==='completed'?r.invoiced_minor-r.material_cost_minor-r.labour_cost_minor-r.service_cost_minor:null}));
 const cash=await one(pool,"SELECT coalesce(sum(amount_minor),0)::bigint AS total FROM payments WHERE ($1::text IS NULL OR paid_at>=date_trunc($1::text,now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')",[interval]);
 const purchases=await one(pool,"SELECT coalesce(sum(quantity*unit_cost_minor),0)::bigint AS total FROM receipts WHERE ($1::text IS NULL OR created_at>=date_trunc($1::text,now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')",[interval]);
 const payroll=(await pool.query('SELECT j.id,j.order_id,p.id AS project_id,p.number,u.name,j.labour_minutes,j.hourly_rate_minor,j.labour_cost_minor,tp.paid_at,tp.reference FROM jobs j JOIN users u ON u.id=j.technician_id JOIN orders o ON o.id=j.order_id JOIN projects p ON p.id=o.project_id LEFT JOIN technician_payments tp ON tp.job_id=j.id WHERE j.status=\'completed\' ORDER BY j.finished_at DESC')).rows;
 return {period,jobs,payroll,cash_received_minor:cash.total,purchases_minor:purchases.total,invoiced_minor:jobs.reduce((s,j)=>s+j.invoiced_minor,0),outstanding_minor:jobs.reduce((s,j)=>s+j.outstanding_minor,0),completed_contribution_minor:jobs.reduce((s,j)=>s+(j.contribution_minor||0),0)};
}
export async function passports(search:string){return (await pool.query(`SELECT w.*,a.serial,a.status AS asset_status,p.name AS product_name,c.name AS customer_name,c.phone,pr.id AS project_id,pr.number,
 (now()>=w.starts_at AND now()<w.expires_at) AS covered FROM warranties w LEFT JOIN assets a ON a.id=w.asset_id JOIN order_lines l ON l.id=w.order_line_id JOIN products p ON p.id=l.product_id JOIN orders o ON o.id=l.order_id JOIN projects pr ON pr.id=o.project_id JOIN sites s ON s.id=pr.site_id JOIN customers c ON c.id=s.customer_id
 WHERE (coalesce(a.serial,'') ILIKE $1 OR c.name ILIKE $1 OR c.phone ILIKE $1) ORDER BY w.starts_at DESC LIMIT 100`,[`%${search}%`])).rows;}
export async function ticketList(){return (await pool.query(`SELECT t.*,a.serial,p.name AS product_name,c.name AS customer_name,pr.id AS project_id,pr.number AS project_number,w.expires_at,na.serial AS replacement_serial FROM tickets t JOIN warranties w ON w.id=t.warranty_id LEFT JOIN assets a ON a.id=w.asset_id LEFT JOIN assets na ON na.id=t.replacement_asset_id JOIN order_lines l ON l.id=w.order_line_id JOIN products p ON p.id=l.product_id JOIN orders o ON o.id=l.order_id JOIN projects pr ON pr.id=o.project_id JOIN sites s ON s.id=pr.site_id JOIN customers c ON c.id=s.customer_id ORDER BY t.opened_at DESC LIMIT 100`)).rows;}
