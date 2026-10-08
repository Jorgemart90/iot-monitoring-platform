const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const base='http://localhost:3000/api/v1/auth/';
 const file='/tmp/iot-session-check.json';
 if(process.argv[2]==='prepare'){
  const r=await fetch(base+'login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.MASTER_USERNAME,password:process.env.MASTER_PASSWORD})});assert.equal(r.status,200);
  fs.writeFileSync(file,JSON.stringify({body:await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]}),{mode:0o600});console.log('Session created for restart check');
 }else{
  const saved=JSON.parse(fs.readFileSync(file));
  const headers={Authorization:`Bearer ${saved.body.access_token}`};
  assert.equal((await fetch(base+'me',{headers})).status,200);
  const list=await fetch(base+'sessions',{headers});assert.equal(list.status,200);assert.ok((await list.json()).length);
  const r=await fetch(base+'refresh',{method:'POST',headers:{Cookie:saved.cookie}});assert.equal(r.status,200);
  assert.equal((await fetch(base+'logout',{method:'POST',headers})).status,204);
  fs.unlinkSync(file);console.log('PASS: access token, stored sessions and refresh survive gateway restart');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
