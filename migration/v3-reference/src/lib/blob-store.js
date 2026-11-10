import { get,put } from '@vercel/blob';
export const PATH_LIVE='askf/v3/live.json';
export const PATH_STATUS='askf/v3/status.json';
export async function readJSON(path){
 const response=await get(path,{access:'private'});
 if(!response)return null;
 if(response.statusCode!==200)throw Error('Blob okunamadı: HTTP '+response.statusCode);
 const value=await new Response(response.stream).json();
 return value;
}
export async function writeJSON(path,value){
 return await put(path,JSON.stringify(value),{
  access:'private',addRandomSuffix:false,allowOverwrite:true,
  contentType:'application/json; charset=utf-8',cacheControlMaxAge:60,
 });
}