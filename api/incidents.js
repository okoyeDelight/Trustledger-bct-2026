import { verifyStaffSession } from '../server/auth.mjs';
import { query } from '../server/store.mjs';
import { UUID_RE, canRead, canReport, validateManualReport } from '../server/policy.mjs';

const send = (res,status,body) => res.status(status).json(body);
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  try {
    if (!['GET','POST'].includes(req.method))
      return send(res,405,{error:'Method not allowed'});
    if (req.method === 'POST') {
      const origin=process.env.TRUSTLEDGER_PUBLIC_ORIGIN;
      if (!origin || req.headers.origin !== origin)
        return send(res,403,{error:'Origin not permitted'});
    }
    const user=await verifyStaffSession(req);
    const id=req.query?.facility;
    if (typeof id !== 'string' || !UUID_RE.test(id))
      return send(res,400,{error:'A valid facility is required'});
    const member=await query(
      'SELECT role FROM tl_memberships WHERE facility_id=$1 AND clerk_user_id=$2 AND active=true',
      [id,user.userId]
    );
    const role=member[0]?.role;
    if (!canRead(role)) return send(res,403,{error:'No facility access'});
    if (req.method === 'GET') {
      const items=await query(
        'SELECT id,origin,category,title,description,severity,status,reported_by,created_at,updated_at FROM tl_incidents WHERE facility_id=$1 ORDER BY created_at DESC LIMIT 100',
        [id]
      );
      return send(res,200,{facility_id:id,role,incidents:items});
    }
    if (!canReport(role))
      return send(res,403,{error:'Reporting is restricted to operators and administrators'});
    const payload=typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const report=validateManualReport(payload);
    if (!report) return send(res,400,{error:'Provide category, title (5–160 characters) and description (10–3000 characters)'});
    // A single data-modifying statement creates the incident and audit event atomically.
    const inserted=await query(
      `WITH created AS (
         INSERT INTO tl_incidents(facility_id,origin,category,title,description,reported_by)
         VALUES($1,'staff',$2,$3,$4,$5)
         RETURNING id,facility_id,origin,category,title,description,status,reported_by,created_at
       ), recorded AS (
         INSERT INTO tl_incident_events(facility_id,incident_id,event_type,actor_clerk_user_id,details)
         SELECT facility_id,id,'created',$5,jsonb_build_object('source','staff_report') FROM created
         RETURNING id
       )
       SELECT created.* FROM created JOIN recorded ON true`,
      [id,report.category,report.title,report.description,user.userId]
    );
    return send(res,201,{incident:inserted[0]});
  } catch(e) {
    const status=Number(e?.statusCode);
    if (status>=400 && status<600) return send(res,status,{error:e.message});
    if (e instanceof SyntaxError) return send(res,400,{error:'Invalid JSON'});
    console.error('TrustLedger API failure',e?.code||e?.name||'unknown');
    return send(res,500,{error:'Unable to complete request'});
  }
}
