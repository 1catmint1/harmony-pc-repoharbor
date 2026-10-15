'use strict';
// SPDX-License-Identifier: MIT
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {connection}=require('./dav-client.cjs');
class ConnectionStore {
  constructor(file){this.file=file;this.items=[];this.load();}
  load(){
    if(!fs.existsSync(this.file))return;
    if(fs.statSync(this.file).size>256*1024)throw Error('连接配置文件超出上限');
    const list=JSON.parse(fs.readFileSync(this.file,'utf8'));
    if(!Array.isArray(list)||list.length>100)throw Error('连接配置格式错误');
    const ids=new Set();
    this.items=list.map(item=>{const value=this.normalize(item);if(ids.has(value.id))throw Error('连接ID重复');ids.add(value.id);return value;});
    if(list.some(x=>Object.hasOwn(x,'password')))this.persist(this.items);
  }
  normalize(item){
    if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>120)throw Error('连接名称需为1至120个字符');
    const checked=connection({...item,password:''});
    const id=item.id||crypto.randomUUID();if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,80}$/.test(id))throw Error('连接ID格式错误');
    return {id,name:item.name.trim(),serverUrl:checked.serverUrl,username:checked.username};
  }
  persist(items){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.'+crypto.randomUUID()+'.tmp';let fd;
    try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(items,null,2)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,this.file);}
    finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
  }
  list(){return this.items.map(x=>({...x}));}
  save(item){const value=this.normalize(item),next=this.list();const pos=next.findIndex(x=>x.id===value.id);if(pos<0){if(next.length>=100)throw Error('最多保存100个连接');next.push(value);}else next[pos]=value;this.persist(next);this.items=next;return this.list();}
  delete(id){const next=this.items.filter(x=>x.id!==id);this.persist(next);this.items=next;return this.list();}
}
module.exports={ConnectionStore};
