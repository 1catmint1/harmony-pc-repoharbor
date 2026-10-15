'use strict';
// SPDX-License-Identifier: MIT
const http = require('http');
const https = require('https');
const { TextDecoder } = require('util');
const { SaxesParser } = require('saxes');
const DAV = 'DAV:', REPORT = 'svn:';
const MAX_BYTES = 2 * 1024 * 1024;
function fail(message) { throw Error(message); }
function parseXml(xml) {
  if (Buffer.byteLength(xml) > MAX_BYTES) fail('XML响应超出2MiB上限');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) fail('不支持DTD或实体声明');
  let root, count=0; const stack=[];
  const parser=new SaxesParser({xmlns:true});
  parser.on('error', error=>{ throw error; });
  parser.on('opentag', tag=>{
    if (++count>30000 || stack.length>=48) fail('XML结构超出限制');
    const node={uri:tag.uri, name:tag.local, children:[], text:'', attrs:tag.attributes};
    if (stack.length) stack[stack.length-1].children.push(node); else root=node;
    stack.push(node);
  });
  parser.on('text', text=>{ if(stack.length) stack[stack.length-1].text+=text; });
  parser.on('cdata', text=>{ if(stack.length) stack[stack.length-1].text+=text; });
  parser.on('closetag', ()=>stack.pop());
  parser.write(xml).close();
  if (!root) fail('服务器未返回XML文档'); return root;
}
const children=(node,uri,name)=>node.children.filter(x=>x.uri===uri&&x.name===name);
const child=(node,uri,name)=>children(node,uri,name)[0];
const text=(node,uri,name)=>child(node,uri,name)?.text||'';
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function connection(input) {
  if (!input || typeof input.serverUrl!=='string') fail('请输入仓库地址');
  const url=new URL(input.serverUrl);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash) fail('仅支持不含凭据或查询参数的HTTP/HTTPS仓库地址');
  if(/%2f|%5c|%00/i.test(url.pathname)) fail('仓库地址包含无效路径');
  const username=input.username||'', password=input.password||'';
  if(typeof username!=='string'||typeof password!=='string'||username.includes(':')||/[\r\n\0]/.test(username+password)) fail('认证信息格式错误');
  if ((username||password)&&url.protocol!=='https:') fail('认证必须使用HTTPS');
  url.pathname=url.pathname.replace(/\/*$/,'/');
  return {serverUrl:url.href,username,password};
}
function segments(value) {
  if(typeof value!=='string'||value.length>4096||/[\\\0\r\n]/.test(value)) fail('路径格式错误');
  const parts=value.split('/').filter(Boolean);
  if(parts.some(x=>x==='.'||x==='..')) fail('路径不能包含上级目录');
  return parts;
}
function pathUrl(conn, relative='') {
  const base=new URL(conn.serverUrl),parts=segments(relative);
  return new URL(base.pathname+parts.map(encodeURIComponent).join('/')+(relative.endsWith('/')&&parts.length?'/':''),base.origin);
}
function revision(value) {
  const s=String(value);if(!/^(0|[1-9]\d{0,14})$/.test(s)||!Number.isSafeInteger(Number(s)))fail('版本号必须是非负整数');return s;
}
function transport(conn,url,method,headers={},body,options={}) {
  if(url.origin!==new URL(conn.serverUrl).origin) fail('禁止跨站点发送仓库请求');
  return new Promise((resolve,reject)=>{
    const requestHeaders={'User-Agent':'RepoHarbor/1.0',...headers};
    if(conn.username)requestHeaders.Authorization='Basic '+Buffer.from(conn.username+':'+conn.password).toString('base64');
    if(body!==undefined)requestHeaders['Content-Length']=Buffer.byteLength(body);
    const req=(url.protocol==='https:'?https:http).request(url,{method,headers:requestHeaders,agent:false,...(options.ca?{ca:options.ca}:{})},res=>{
      const chunks=[];let size=0;
      res.on('data',chunk=>{size+=chunk.length;if(size>(options.maxBytes||MAX_BYTES)){const error=Error('响应超出允许大小');reject(error);req.destroy(error);return;}chunks.push(chunk);});
      res.on('error',reject);
      res.on('end',()=>{
        try {const bytes=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,bytes,body:new TextDecoder('utf-8',{fatal:true}).decode(bytes)});}
        catch {reject(Error('服务器响应不是有效UTF-8文本'));}
      });
    });
    req.on('error',reject);
    const abort=()=>req.destroy(Error('请求已取消'));
    if(options.signal?.aborted){abort();return;}
    options.signal?.addEventListener('abort',abort,{once:true});
    const deadline=setTimeout(()=>req.destroy(Error('请求超时')),options.timeout||20000);deadline.unref?.();
    req.on('close',()=>{clearTimeout(deadline);options.signal?.removeEventListener('abort',abort);});
    req.setTimeout(options.timeout||20000,()=>req.destroy(Error('请求超时')));
    if(body!==undefined)req.write(body);req.end();
  });
}
function accepted(reply,codes) {
  if(!codes.includes(reply.status))fail(reply.status===401?'认证失败或需要重新输入凭据':reply.status>=300&&reply.status<400?'仓库重定向，请核对后使用最终地址':`仓库返回HTTP ${reply.status}`);
}
function decodePath(path) {try{return path.split('/').map(decodeURIComponent).join('/');}catch{fail('服务器返回无效URL编码');}}
function parseDirectory(xml, requestedUrl) {
  const root=parseXml(xml);if(root.uri!==DAV||root.name!=='multistatus')fail('服务器不是DAV目录响应');
  const current=decodePath(requestedUrl.pathname).replace(/\/+$/,'');const items=[],seen=new Set();
  for(const response of children(root,DAV,'response')) {
    const href=text(response,DAV,'href').trim();if(!href)continue;
    const target=new URL(href,requestedUrl);
    if(target.origin!==requestedUrl.origin)fail('目录响应包含跨站点链接');
    const decoded=decodePath(target.pathname).replace(/\/+$/,'');
    if(decoded===current)continue;
    if(!decoded.startsWith(current+'/'))fail('目录响应越出当前路径');
    const name=decoded.slice(current.length+1);
    if(!name||name.includes('/')||name==='.'||name==='..'||/[\\\0\r\n]/.test(name))fail('服务器返回非直接子项');
    let props;
    for(const status of children(response,DAV,'propstat'))if(/^HTTP\/\d(?:\.\d)? 200(?: |$)/.test(text(status,DAV,'status').trim()))props=child(status,DAV,'prop');
    if(!props)continue;
    const isDirectory=Boolean(child(child(props,DAV,'resourcetype')||{children:[]},DAV,'collection'));
    if(seen.has(name))fail('服务器返回重复目录项');seen.add(name);
    items.push({name,href:name+(isDirectory?'/':''),isDirectory});
  }
  return items.sort((a,b)=>Number(b.isDirectory)-Number(a.isDirectory)||a.name.localeCompare(b.name));
}
function parseLogs(xml) {
  const root=parseXml(xml);if(root.uri!==REPORT||root.name!=='log-report')fail('服务器未返回SVN日志');
  return children(root,REPORT,'log-item').map(item=>({revision:revision(text(item,DAV,'version-name')),author:text(item,DAV,'creator-displayname'),date:text(item,REPORT,'date'),message:text(item,DAV,'comment')}));
}
class DavClient {
  constructor(input,options={}){this.conn=connection(input);this.options=options;}
  request(url,method,headers,body){return transport(this.conn,url,method,headers,body,this.options);}
  async discover() {
    const base=new URL(this.conn.serverUrl),reply=await this.request(base,'OPTIONS',{'Content-Type':'text/xml; charset=utf-8'},'<?xml version="1.0"?><D:options xmlns:D="DAV:"><D:activity-collection-set/></D:options>');accepted(reply,[200,204]);
    const h=reply.headers;
    if(!h['svn-repository-root']||!h['svn-me-resource']||!h['svn-rev-root-stub']||!h['svn-youngest-rev'])fail('需要支持HTTPv2发现头的Apache Subversion服务器');
    const resource=value=>{const u=new URL(value,base);if(u.origin!==base.origin||u.search||u.hash||u.username||u.password)fail('SVN发现头包含无效资源');return u;};
    const root=resource(h['svn-repository-root']),me=resource(h['svn-me-resource']),revRoot=resource(h['svn-rev-root-stub']);
    const configured=decodePath(base.pathname).replace(/\/+$/,''),repo=decodePath(root.pathname).replace(/\/+$/,'');
    if(configured!==repo&&!configured.startsWith(repo+'/'))fail('配置路径不属于SVN仓库');
    return {root,me,revRoot,relative:configured.slice(repo.length).replace(/^\//,''),head:revision(h['svn-youngest-rev'])};
  }
  async test(){const d=await this.discover();return {head:d.head,message:'已连接Apache Subversion HTTPv2，HEAD r'+d.head};}
  async list(relative='/') {
    const url=pathUrl(this.conn,relative),reply=await this.request(url,'PROPFIND',{Depth:'1','Content-Type':'text/xml; charset=utf-8'},'<?xml version="1.0"?><D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/><D:displayname/></D:prop></D:propfind>');
    accepted(reply,[207]);return parseDirectory(reply.body,url);
  }
  async file(relative,rev) {
    if(!segments(relative).length)fail('请选择文件');
    let url=pathUrl(this.conn,relative);
    if(rev!==undefined&&rev!=='') {
      const d=await this.discover();const repoPath=[...segments(d.relative),...segments(relative)].map(encodeURIComponent).join('/');
      url=new URL(d.revRoot.pathname.replace(/\/*$/,'/')+revision(rev)+'/'+repoPath,d.revRoot.origin);
    }
    const reply=await this.request(url,'GET');accepted(reply,[200]);if(reply.body.includes('\0'))fail('不支持预览二进制文件');return reply.body;
  }
  async log(relative='/',limit=50) {
    const count=Number(limit);if(!Number.isInteger(count)||count<1||count>200)fail('日志条数必须为1至200');
    const d=await this.discover(),target=[...segments(d.relative),...segments(relative)].join('/');
    const body=`<?xml version="1.0"?><S:log-report xmlns:S="${REPORT}"><S:start-revision>${d.head}</S:start-revision><S:end-revision>0</S:end-revision><S:limit>${count}</S:limit><S:path>${escapeXml(target)}</S:path><S:revprop>svn:author</S:revprop><S:revprop>svn:date</S:revprop><S:revprop>svn:log</S:revprop></S:log-report>`;
    // Match ra_serf/log.c: REPORT uses a stable revision URL, not !svn/me.
    const stableRoot=new URL(d.revRoot.pathname.replace(/\/*$/,'/')+d.head+'/',d.revRoot.origin);
    const reply=await this.request(stableRoot,'REPORT',{'Content-Type':'text/xml; charset=utf-8'},body);accepted(reply,[200]);return parseLogs(reply.body);
  }
}
module.exports={DavClient,parseXml,parseDirectory,parseLogs,connection,pathUrl,revision,transport,escapeXml};
