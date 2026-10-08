const assert = require('node:assert/strict');
const mqtt = require('mqtt');
const delay = ms => new Promise(r => setTimeout(r, ms));
const hosts = {auth:'api-gateway:3000',devices:'device-service:3001',rules:'alerts-service:3003',alerts:'alerts-service:3003',analytics:'analytics-service:3002',notifications:'notification-service:3004',users:'api-gateway:3000'};
let checks=0;
async function req(path, actor, method='GET', body, expected=200, cookie) {
 const r=await fetch(`http://${hosts[path.split('/')[0]]}/api/v1/${path}`,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${actor.access_token}`} : {}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,expected,`${method} ${path}: ${r.status} ${r.status===expected?'':await r.text()}`); checks++;
 const data=await r.text(); return {body:data?JSON.parse(data):null,cookie:r.headers.get('set-cookie')};
}
async function main(){
 const master=(await req('auth/login',null,'POST',{username:process.env.MASTER_USERNAME,password:process.env.MASTER_PASSWORD})).body;
 assert.equal(master.user.role,'MASTER');
 await req('auth/login',null,'POST',{username:process.env.MASTER_USERNAME,password:'incorrect'},401);
 await req('devices',null,'GET',undefined,401);
 const da=await req('auth/demo',null,'POST',{},201), db=await req('auth/demo',null,'POST',{},201);
 let a=da.body,b=db.body;
 assert.equal(a.user.role,'DEMO'); assert.match(da.cookie,/HttpOnly/i);assert.match(da.cookie,/SameSite=Lax/i);
 await req('users',a,'GET',undefined,403);await req('users',master);
 const me=(await req('auth/me',a)).body;
 await req(`auth/sessions/${me.sessionId}`,b,'DELETE',undefined,404);
 const devices=[];
 for(let i=0;i<3;i++) devices.push((await req('devices',a,'POST',{name:`E2E sensor ${i}`,type:'MULTI_SENSOR'},201)).body);
 await req('devices',a,'POST',{name:'over quota',type:'MULTI_SENSOR'},403);
 const id=devices[0].id;
 for(const method of ['GET','PATCH','DELETE'])await req(`devices/${id}`,b,method,method==='PATCH'?{name:'forbidden'}:undefined,404);
 assert.equal((await req('devices',b)).body.data.length,0);
 await req(`devices/${id}`,master);
 await req(`devices/${id}`,a,'PATCH',{location:'E2E'});
 for(const suffix of ['metrics','readings']) await req(`analytics/devices/${id}/${suffix}`,b,'GET',undefined,404);
 const rules=[];
 for(let i=0;i<3;i++)rules.push((await req('rules',a,'POST',{name:`E2E rule ${i}`,deviceId:id,metricField:'temperature',condition:'GREATER_THAN',threshold:35,severity:'HIGH'},201)).body);
 await req('rules',a,'POST',{name:'over quota',metricField:'temperature',condition:'GREATER_THAN',threshold:35,severity:'HIGH'},403);
 assert.equal((await req('rules',b)).body.data.length,0);
 await req(`rules/${rules[0].id}`,b,'GET',undefined,404);
 console.log('PASS: MASTER/DEMO, roles, device/rule quotas and ownership');
 const streams=[];
 for(const actor of [a,b,master]){
  const abort=new AbortController();const response=await fetch('http://notification-service:3004/api/v1/notifications/stream',{headers:{Authorization:`Bearer ${actor.access_token}`},signal:abort.signal});assert.equal(response.status,200);
  const state={abort,text:''};state.done=(async()=>{try{for await(const chunk of response.body)state.text+=Buffer.from(chunk).toString()}catch(e){if(e.name!=='AbortError')throw e}})();streams.push(state);
 }
 try{
 const client=await mqtt.connectAsync('mqtt://mosquitto:1883');
 await client.publishAsync(`iot/devices/${id}/data`,JSON.stringify({deviceId:id,temperature:42,humidity:60,pressure:1013,timestamp:new Date().toISOString()}),{qos:1});await client.endAsync();
 let alert;
 for(let i=0;i<30;i++){const list=(await req('alerts',a)).body.data;alert=list.find(x=>x.deviceId===id);if(alert&&streams[0].text.includes(alert.id)&&streams[2].text.includes(alert.id))break;await delay(1000)}
 assert.ok(alert,'MQTT must produce an alert');assert.ok(streams[0].text.includes(alert.id),'Owner receives SSE');assert.ok(streams[2].text.includes(alert.id),'MASTER receives SSE');assert.ok(!streams[1].text.includes(alert.id),'Other DEMO does not receive SSE');
 assert.equal((await req('alerts',b)).body.data.length,0);await req(`alerts/${alert.id}`,b,'GET',undefined,404);
 await req(`alerts/${alert.id}/acknowledge`,a,'PATCH',{});await req(`alerts/${alert.id}/resolve`,a,'PATCH',{});
 const readings=(await req(`analytics/devices/${id}/readings`,a)).body;assert.ok(readings.data.length>0);
 const metrics=(await req(`analytics/devices/${id}/metrics`,a)).body;assert.ok(Object.keys(metrics).length>0);
 console.log('PASS: MQTT -> Kafka -> readings/metrics -> alerts -> isolated SSE; acknowledge/resolve');
 }finally{for(const s of streams)s.abort.abort();await Promise.all(streams.map(s=>s.done))}
 const oldCookie=da.cookie.split(';')[0];const refreshed=await req('auth/refresh',null,'POST',{},200,oldCookie);assert.notEqual(refreshed.cookie.split(';')[0],oldCookie);a=refreshed.body;
 await req('auth/refresh',null,'POST',{},401,oldCookie);await req('auth/me',a);
 await req('auth/logout',a,'POST',{},204);await req('auth/me',a,'GET',undefined,401);await req('devices',a,'GET',undefined,401);await req('auth/refresh',null,'POST',{},401,refreshed.cookie.split(';')[0]);
 const bm=(await req('auth/me',b)).body;await req(`auth/sessions/${bm.sessionId}`,b,'DELETE',undefined,204);await req('auth/me',b,'GET',undefined,401);
 await req('auth/logout',master,'POST',{},204);
 console.log(`PASS: refresh rotation, stale refresh rejection, logout, session revocation. ${checks} HTTP checks passed.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
