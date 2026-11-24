'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let workerModule;
test('load Worker module', async () => {
  workerModule = await import('../workers/runway-transfer/src/index.mjs');
  assert.equal(typeof workerModule.handleRequest, 'function');
});

const ORIGIN = 'https://editor.example.com';
const env = {
  RUNWAY_API_KEY: 'test-runway-key',
  GEED_SUPABASE_URL: 'https://example.supabase.co',
  GEED_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  GEED_APP_ORIGINS: ORIGIN
};
const uploadPayload = {
  uploadUrl: 'https://runway-uploads-prod.s3.amazonaws.com/upload',
  fields: { key: 'ephemeral/test.mp4', policy: 'signed-policy' },
  runwayUri: 'runway://ephemeral/test'
};
function jsonResponse(value, status=200) {
  return new Response(JSON.stringify(value), {status,headers:{'content-type':'application/json'}});
}
function request(path, options={}) {
  return new Request('https://geed-runway-transfer.workers.dev'+path, {
    ...options,
    headers: { origin: ORIGIN, ...(options.headers||{}) }
  });
}
function fakeFetch(upstreamStatus=200, payload=uploadPayload) {
  const calls=[];
  const fetchImpl=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/auth/v1/user'))return jsonResponse({id:'user-123'});
    if(String(url)==='https://api.dev.runwayml.com/v1/uploads')return jsonResponse(payload,upstreamStatus);
    throw new Error('Unexpected fetch target');
  };
  return {fetchImpl,calls};
}

test('health reports readiness without exposing API key', async () => {
  const response=await workerModule.handleRequest(request('/health'),env,async()=>{throw new Error('No fetch expected')});
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.available,true);
  assert.equal(data.maxUploadBytes,200*1024*1024);
  assert.equal(data.expiresInSeconds,86400);
  assert.equal(JSON.stringify(data).includes('test-runway-key'),false);
});

test('rejects origins not present in the exact allowlist', async () => {
  const req=new Request('https://geed-runway-transfer.workers.dev/health',{headers:{origin:'https://evil.example'}});
  const response=await workerModule.handleRequest(req,env,async()=>{throw new Error('No fetch expected')});
  assert.equal(response.status,403);
});

test('answers browser CORS preflight only for allowed origins', async () => {
  const response=await workerModule.handleRequest(request('/upload-session',{method:'OPTIONS'}),env);
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN);
  assert.match(response.headers.get('access-control-allow-headers'),/authorization/i);
});

test('requires a signed-in Geed session', async () => {
  const {fetchImpl}=fakeFetch();
  const response=await workerModule.handleRequest(request('/upload-session',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({filename:'clip.mp4',contentType:'video/mp4',size:1000})
  }),env,fetchImpl);
  assert.equal(response.status,401);
});

test('validates file size, MIME type, and extension before calling Runway', async () => {
  for (const file of [
    {filename:'small.mp4',contentType:'video/mp4',size:511},
    {filename:'large.mp4',contentType:'video/mp4',size:200*1024*1024+1},
    {filename:'bad.mov',contentType:'video/quicktime',size:1000},
    {filename:'wrong.webm',contentType:'video/mp4',size:1000}
  ]) {
    const {fetchImpl,calls}=fakeFetch();
    const response=await workerModule.handleRequest(request('/upload-session',{
      method:'POST',headers:{authorization:'Bearer valid-token','content-type':'application/json'},
      body:JSON.stringify(file)
    }),env,fetchImpl);
    assert.ok(response.status===400||response.status===413);
    assert.equal(calls.some(call=>call.url==='https://api.dev.runwayml.com/v1/uploads'),false);
  }
});

test('creates an ephemeral Runway session only after verifying the Supabase user', async () => {
  const {fetchImpl,calls}=fakeFetch();
  const response=await workerModule.handleRequest(request('/upload-session',{
    method:'POST',headers:{authorization:'Bearer valid-token','content-type':'application/json'},
    body:JSON.stringify({filename:'finished-video.mp4',contentType:'video/mp4',size:1024})
  }),env,fetchImpl);
  const data=await response.json();
  assert.equal(response.status,200);
  assert.equal(data.runwayUri,uploadPayload.runwayUri);
  assert.equal(data.uploadUrl,uploadPayload.uploadUrl);
  const runwayCall=calls.find(call=>call.url==='https://api.dev.runwayml.com/v1/uploads');
  assert.ok(runwayCall);
  assert.equal(runwayCall.options.headers.authorization,'Bearer test-runway-key');
  assert.equal(runwayCall.options.headers['X-Runway-Version'],'2024-11-06');
  assert.deepEqual(JSON.parse(runwayCall.options.body),{filename:'finished-video.mp4',type:'ephemeral'});
  assert.equal(JSON.stringify(data).includes('test-runway-key'),false);
});

test('rejects upload URLs outside documented Runway upload hosts', async () => {
  const malicious={...uploadPayload,uploadUrl:'https://attacker.example/upload'};
  const {fetchImpl}=fakeFetch(200,malicious);
  const response=await workerModule.handleRequest(request('/upload-session',{
    method:'POST',headers:{authorization:'Bearer valid-token','content-type':'application/json'},
    body:JSON.stringify({filename:'finished-video.mp4',contentType:'video/mp4',size:1024})
  }),env,fetchImpl);
  assert.equal(response.status,502);
  assert.equal((await response.json()).code,'INVALID_RUNWAY_SESSION');
});

test('maps Runway credit and rate-limit failures without exposing provider internals', async () => {
  for (const [upstreamStatus,expectedStatus,expectedCode] of [
    [402,402,'RUNWAY_CREDITS_REQUIRED'],
    [429,429,'RUNWAY_RATE_LIMITED']
  ]) {
    const {fetchImpl}=fakeFetch(upstreamStatus,{error:'sensitive raw provider detail'});
    const response=await workerModule.handleRequest(request('/upload-session',{
      method:'POST',headers:{authorization:'Bearer valid-token','content-type':'application/json'},
      body:JSON.stringify({filename:'finished-video.webm',contentType:'video/webm',size:1024})
    }),env,fetchImpl);
    assert.equal(response.status,expectedStatus);
    const data=await response.json();
    assert.equal(data.code,expectedCode);
    assert.equal(JSON.stringify(data).includes('sensitive raw provider detail'),false);
  }
});

test('filename normalizer accepts matching video types and rejects malformed inputs', async () => {
  const safe=workerModule.normalizeFileMetadata({filename:'clip.webm',contentType:'video/webm',size:512});
  const bad=workerModule.normalizeFileMetadata({filename:'clip.mp4',contentType:'video/webm',size:512});
  assert.equal(safe.filename,'clip.webm');
  assert.equal(bad.code,'INVALID_FILENAME');
});

test('upload host allowlist accepts Runway S3 upload hosts only', async () => {
  assert.equal(workerModule.isValidRunwayUploadUrl('https://runway-uploads-prod.s3.amazonaws.com/upload'),true);
  assert.equal(workerModule.isValidRunwayUploadUrl('https://attacker.example/upload'),false);
});
