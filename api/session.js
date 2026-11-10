import {verifyStaffSession} from '../server/auth.mjs';
import {query} from '../server/store.mjs';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method !== 'GET')return res.status(405).json({error:'Method not allowed'});
  try {
    const identity=await verifyStaffSession(req);
    const facilities=await query(
      `SELECT f.id,f.code,f.display_name,m.role
        FROM tl_memberships m
        INNER JOIN tl_facilities f ON f.id=m.facility_id
        WHERE m.clerk_user_id=$1 AND m.active=true
        ORDER BY f.display_name`,
      [identity.userId]
    );
    return res.status(200).json({user_id:identity.userId,facilities});
  }catch(e) {
    const status=Number(e?.statusCode);
    if(status>=400&&status<600)return res.status(status).json({error:e.message});
    console.error('TrustLedger session endpoint',e?.code||e?.name||'unknown');
    return res.status(500).json({error:'Unable to load workspace'});
  }
}
