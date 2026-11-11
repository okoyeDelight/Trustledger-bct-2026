import {catalog} from "@/lib/catalog";
import {answer,rejection} from "@/lib/responses";
export const runtime="nodejs";
export async function GET(){
 try{
  const c=await catalog();
  return answer({source_system:c.source_system,facility_id:c.facility_id,
    source_revision:c.source_revision,episode_count:c.episode_count,
    replay_interval_seconds:c.replay_interval_seconds,
    dataset_summaries:c.dataset_summaries, organizer_archive_sha256:c.organizer_archive_sha256,
    timestamp_note:c.timestamp_note});
 }catch{return rejection("Source catalog has not been prepared.",503);}
}
