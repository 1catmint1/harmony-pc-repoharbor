// RepoHarbor: HTTPv2 Subversion repository browser. SPDX-License-Identifier: MIT
const {app,BrowserWindow,ipcMain,screen}=require('electron');
const path=require('path');
const {DavClient}=require('./dav-client.cjs');
const {ConnectionStore}=require('./connection-store.cjs');
// Preserve the existing connection profile directory while fixing application branding.
const profileDirectory=app.getPath('userData');
app.setName('RepoHarbor');
app.setPath('userData',profileDirectory);
app.disableHardwareAcceleration();
let mainWindow,store;
const sessions=new Map();
function checked(event){if(!mainWindow||event.sender!==mainWindow.webContents)throw Error('无效窗口请求');}
function resolveConnection(input){const saved=store.list().find(x=>x.id===input.id);if(!saved)throw Error('连接已删除，请重新选择');return {...saved,password:sessions.get(saved.id)||''};}
function handle(name,body){ipcMain.handle(name,async(event,...args)=>{try{checked(event);return {success:true,...await body(...args)};}catch(error){return {success:false,message:error.message};}});}
app.whenReady().then(()=>{
 try{store=new ConnectionStore(path.join(app.getPath('userData'),'repo-harbor-connections.json'));}
 catch(error){console.error('[RepoHarbor] 配置读取失败，原文件保留');store=null;}
 const {width,height}=screen.getPrimaryDisplay().workAreaSize;
 mainWindow=new BrowserWindow({width:Math.floor(width*.9),height:Math.floor(height*.85),title:'RepoHarbor',frame:true,transparent:false,resizable:true,webPreferences:{nodeIntegration:true,contextIsolation:false,webSecurity:true,webviewTag:false,nodeIntegrationInSubFrames:false}});
 mainWindow.webContents.setWindowOpenHandler?.(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==require('url').pathToFileURL(path.join(__dirname,'index.html')).href)event.preventDefault();});
 mainWindow.loadFile(path.join(__dirname,'index.html'));
});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>sessions.clear());
handle('config:get-connections',async()=>{if(!store)throw Error('配置文件无法读取，请备份后修复');return {connections:store.list()};});
handle('config:save-connection',async input=>{if(!store)throw Error('配置不可写');const connections=store.save(input),saved=connections.find(x=>x.id===input.id)||connections[connections.length-1];sessions.set(saved.id,input.password||'');return {connections};});
handle('config:delete-connection',async id=>{const connections=store.delete(id);sessions.delete(id);return {connections};});
handle('svn:test-connection',async input=>({...(await new DavClient(input).test())}));
handle('svn:list-dir',async(input,relative)=>({items:await new DavClient(resolveConnection(input)).list(relative)}));
handle('svn:get-file',async(input,relative,revision)=>({content:await new DavClient(resolveConnection(input)).file(relative,revision)}));
handle('svn:get-log',async(input,relative,limit)=>({logs:await new DavClient(resolveConnection(input)).log(relative,limit)}));
