import {readJSON,PATH_STATUS} from '../lib/blob-store.js';
import {scheduleDescription} from '../lib/daily-logic.js';
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=120');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const status=await readJSON(PATH_STATUS);
  return res.status(200).json(status||{schema:1,state:'awaiting_first_run',lastSuccess:null,lastAttempt:null,lastError:null,schedule:scheduleDescription()});
 }catch(err){console.error('ASKF_BLOB_STATUS_READ_FAILED',String(err?.message||err));return res.status(503).json({schema:1,state:'error',lastSuccess:null,lastError:'Sunucu kayıtları geçici olarak okunamadı.'});}
}