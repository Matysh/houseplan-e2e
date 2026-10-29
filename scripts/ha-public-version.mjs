// Record the isolated fixture's actual HA version and installed frontend identity.
// No auth file, token or config response enters this receipt.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const endpoint=new URL('/api/websocket',process.env.HA_URL||'http://127.0.0.1:8123');
if(!['127.0.0.1','localhost'].includes(endpoint.hostname))throw Error('Expected isolated local HA fixture');
endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
const greeting=await new Promise((resolve,reject)=>{
  const socket=new WebSocket(endpoint);
  let done=false;
  const finish=(error,value)=>{
    if(done)return;done=true;clearTimeout(deadline);socket.close();
    if(error)reject(error);else resolve(value);
  };
  const deadline=setTimeout(()=>finish(Error('HA public greeting deadline exceeded')),10000);
  socket.addEventListener('error',()=>finish(Error('HA public greeting socket failed')));
  socket.addEventListener('close',()=>{if(!done)finish(Error('HA closed before public greeting'));});
  socket.addEventListener('message',event=>{
    try{
      const value=JSON.parse(event.data);
      if(value.type!=='auth_required'||typeof value.ha_version!=='string'
        ||!/^\d+\.\d+\.\d+[a-z0-9.-]*$/i.test(value.ha_version))throw Error('Unexpected HA greeting');
      finish(null,{type:value.type,ha_version:value.ha_version});
    }catch(error){finish(error);}
  });
});
const installed=JSON.parse(readFileSync('run/.e2e-houseplan.json','utf8'));
const manifestPath='run/custom_components/houseplan/frontend/houseplan-assets.json';
// The upgrade fixture first installs the previous stable, which can predate
// chunk manifests. Record its absence; source-target proof checks the real hash.
const bytes=existsSync(manifestPath)?readFileSync(manifestPath):null;
const manifest=bytes?JSON.parse(bytes):null;
const record={source:'public unauthenticated WebSocket greeting',...greeting,
  configuredImage:process.env.HA_VERSION,product:{ref:installed.ref,installed:installed.installed,version:installed.version,bundle:installed.bundle},
  frontendFingerprint:manifest?.fingerprint??null,
  manifestSha256:bytes?createHash('sha256').update(bytes).digest('hex'):null,authMessagesSent:0};
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/ha-public-version.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record));
