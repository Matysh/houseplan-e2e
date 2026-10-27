import test from 'node:test';
import assert from 'node:assert/strict';
import {HeldConfigReply} from '../tests/lib/held-config-reply.mjs';
const route=()=>{const client=[],upstream=[];const server={send:x=>upstream.push(x),onMessage:f=>{server.incoming=f;}};const socket={connectToServer:()=>server,send:x=>client.push(x),onMessage:f=>{socket.outgoing=f;}};return {socket,server,client,upstream};};
test('holds only the real matching result; auth, events and other batch results survive',async()=>{
 const r=route(),hold=new HeldConfigReply();hold.attach(r.socket);const reached=hold.arm();
 r.socket.outgoing('{"type":"auth","access_token":"synthetic"}');
 r.socket.outgoing('{"id":7,"type":"houseplan/config/set","expected_rev":4,"config":{"spaces":[]}}');
 r.server.incoming(JSON.stringify([{id:8,type:'result',success:true},{id:7,type:'result',success:true,result:{rev:5}},{id:2,type:'event',event:{changed:true}}]));
 assert.deepEqual((await reached).reply,{success:true,errorCode:undefined});
 assert.equal(r.upstream[1],'{"id":7,"type":"houseplan/config/set","expected_rev":4,"config":{"spaces":[]}}');
 assert.deepEqual(JSON.parse(r.client[0]).map(x=>x.id),[8,2]);assert.equal(hold.writes.length,1);assert.equal(JSON.stringify(hold.writes).includes('synthetic'),false);
 hold.release();assert.equal(JSON.parse(r.client[1])[0].result.rev,5);assert.throws(()=>hold.release(),/no real HA reply/);
});
test('stale CAS touches only one chosen request and retains the actual server rejection',async()=>{
 const r=route(),hold=new HeldConfigReply();hold.attach(r.socket);const reached=hold.arm({staleRevision:true});
 r.socket.outgoing('{"id":3,"type":"houseplan/config/set","expected_rev":10,"config":{"keep":"same"}}');
 r.socket.outgoing('{"id":4,"type":"houseplan/config/get"}');
 assert.deepEqual(JSON.parse(r.upstream[0]),{id:3,type:'houseplan/config/set',expected_rev:9,config:{keep:'same'}});
 assert.equal(r.upstream[1],'{"id":4,"type":"houseplan/config/get"}');
 r.server.incoming('{"id":3,"type":"result","success":false,"error":{"code":"conflict","message":"real refusal"}}');
 assert.equal((await reached).reply.errorCode,'conflict');assert.equal(r.client.length,0);hold.release();assert.equal(JSON.parse(r.client[0]).error.message,'real refusal');
});
test('same numeric id from a second connection cannot satisfy the held response',async()=>{
 const a=route(),b=route(),hold=new HeldConfigReply();hold.attach(a.socket);hold.attach(b.socket);hold.arm();
 a.socket.outgoing('{"id":5,"type":"houseplan/config/set","expected_rev":2}');
 b.server.incoming('{"id":5,"type":"result","success":true}');assert.equal(b.client.length,1);assert.throws(()=>hold.release(),/no real HA reply/);
 a.server.incoming('{"id":5,"type":"result","success":true}');hold.release();assert.equal(a.client.length,1);
});