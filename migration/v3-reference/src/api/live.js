import {readJSON,PATH_LIVE} from '../lib/blob-store.js';
export default async function handler(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=120');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{
  const feed=await readJSON(PATH_LIVE);
  if(!feed)return res.status(200).json({schema:3,status:'not_configured',provenance:'not_verified',source:'Kocaeli ASKF',matches:[]});
  return res.status(200).json(feed);
 }catch(err){console.error('ASKF_BLOB_LIVE_READ_FAILED',String(err?.message||err));return res.status(503).json({schema:3,status:'error',provenance:'not_verified',matches:[]});}
}