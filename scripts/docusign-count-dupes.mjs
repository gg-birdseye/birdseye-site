import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

function b64(i){return Buffer.from(i).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
const c={ik:process.env.DOCUSIGN_INTEGRATION_KEY,uid:process.env.DOCUSIGN_USER_ID,acct:process.env.DOCUSIGN_ACCOUNT_ID,tid:process.env.DOCUSIGN_TEMPLATE_ID,key:process.env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g,"\n"),oauth:"https://account-d.docusign.com",api:"https://demo.docusign.net/restapi"};
const n=Math.floor(Date.now()/1000); const u=b64(JSON.stringify({alg:"RS256",typ:"JWT"}))+"."+b64(JSON.stringify({iss:c.ik,sub:c.uid,aud:"account-d.docusign.com",iat:n,exp:n+3600,scope:"signature impersonation"}));
const s=createSign("RSA-SHA256"); s.update(u); s.end();
const t=(await fetch(c.oauth+"/oauth/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:u+"."+b64(s.sign(c.key))})}).then(r=>r.json())).access_token;
const h={Authorization:"Bearer "+t};
const r=await fetch(c.api+"/v2.1/accounts/"+c.acct+"/templates/"+c.tid+"/recipients?include_tabs=true",{headers:h}).then(r=>r.json());
const tabs=r.signers?.[0]?.tabs?.textTabs??[];
const counts=new Map();
for(const tab of tabs){const l=tab.tabLabel??"?";counts.set(l,(counts.get(l)??0)+1);}
console.log("Total text tabs:", tabs.length);
for(const [l,n] of [...counts.entries()].sort((a,b)=>b[1]-a[1])) if(n>1) console.log(`  ${l}: ${n}`);
