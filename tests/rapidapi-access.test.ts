import {describe,expect,it} from 'vitest';
import app,{type Env} from '../src/index';
const env={APP_ENV:'test',RAPIDAPI_PROXY_SECRET:'fictitious-test-only'} as Env;
const get=(path:string,secret?:string,customEnv:Env=env,method='GET')=>app.fetch(new Request('https://example.test'+path,{method,headers:secret?{'x-rapidapi-proxy-secret':secret}:{}}),customEnv);
describe('dedicated RapidAPI access',()=>{
 it('fails closed until a secret is configured and rejects invalid credentials',async()=>{
  expect((await get('/rapidapi/health',undefined,{} as Env)).status).toBe(503);
  expect((await get('/rapidapi/health')).status).toBe(403);
  expect((await get('/rapidapi/health','wrong')).status).toBe(403);
 });
 it('serves the canonical health response through the authenticated prefix',async()=>{
  const response=await get('/rapidapi/health',env.RAPIDAPI_PROXY_SECRET);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({status:'ok',service:'Rede Girassol API'});
 });
 it('never exposes administration, the dashboard or arbitrary paths through the gateway prefix',async()=>{
  for(const path of ['/admin/imports','/admin/import','/dashboard','/v1/plans','/openapi.json','/unknown'])
   expect((await get('/rapidapi'+path,env.RAPIDAPI_PROXY_SECRET)).status).toBe(404);
  expect((await get('/rapidapi/health',env.RAPIDAPI_PROXY_SECRET,env,'POST')).status).toBe(405);
 });
 it('leaves the existing public health and dashboard accessible without the gateway secret',async()=>{
  expect((await get('/health')).status).toBe(200);
  expect((await get('/')).status).toBe(200);
 });
 it('passes parameters through and never returns the secret in the response',async()=>{
  const response=await get('/rapidapi/v1/support-guide?q=test',env.RAPIDAPI_PROXY_SECRET);
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain(env.RAPIDAPI_PROXY_SECRET);
 });
});
