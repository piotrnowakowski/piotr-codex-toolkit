import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Copied into the project by init-project.mjs so imports resolve its pinned dependencies.
const root=dirname(fileURLToPath(import.meta.url)),out=join(root,'out');
const [command='all',argument]=process.argv.slice(2);
assert(['check','review','still','render','export','verify','all'].includes(command),'Unknown command');
const finalFile=join(out,'motion-video.mp4');
mkdirSync(out,{recursive:true});
const save=(file,value)=>writeFileSync(join(out,file),JSON.stringify(value,null,2)+'\n','utf8');
const load=file=>JSON.parse(readFileSync(join(out,file),'utf8'));
function sourceHash(){
 const hash=createHash('sha256');
 const extensions=new Set(['.html','.js','.mjs','.json','.css','.glsl','.svg','.png','.jpg','.jpeg','.webp','.woff','.woff2','.ttf','.otf','.wav','.mp3','.mp4']);
 function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(['node_modules','out','.git'].includes(entry.name))continue;
  const path=join(dir,entry.name);
  assert(!entry.isSymbolicLink(),`Freeze linked assets locally before rendering: ${path}`);
  if(entry.isDirectory())walk(path);
  else if(extensions.has(extname(entry.name).toLowerCase()))hash.update(relative(root,path).replaceAll('\\','/')+'\0').update(readFileSync(path)).update('\0');
 }}walk(root);return hash.digest('hex');
}
function run(program,args){
 const result=spawnSync(program,args,{encoding:'utf8',maxBuffer:8*1024*1024});
 if(result.error)throw new Error(`${program} is required on PATH: ${result.error.message}`);
 assert.equal(result.status,0,`${program} failed:\n${result.stderr}`);
 return result;
}
const ffmpeg=args=>run('ffmpeg',['-y','-hide_banner','-loglevel','error',...args]);
const probe=path=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path]).stdout);
function metadata(value){
 assert(value&&typeof value==='object','window.VIDEO is required');
 for(const key of ['width','height','fps','duration'])assert(Number.isFinite(value[key])&&value[key]>0,`Invalid VIDEO.${key}`);
 assert(Number.isInteger(value.width)&&value.width%2===0&&Number.isInteger(value.height)&&value.height%2===0,'H.264 yuv420p needs even integer dimensions');
 assert(Math.abs(value.duration*value.fps-Math.round(value.duration*value.fps))<1e-6,'Duration must contain a whole number of frames');
 assert.equal(typeof value.audio,'boolean','VIDEO.audio must explicitly be true or false');
 return {...value,frames:Math.round(value.duration*value.fps)};
}
async function open(){
 const args=process.platform==='win32'?['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']:[];
 const browser=await chromium.launch({args}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!=='http://motion.local'){errors.push(`External request blocked: ${url.origin}`);return route.abort();}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  const rel=relative(root,path);
  if(rel.startsWith('..')||rel.includes(':')){errors.push('Asset escaped the project');return route.abort();}
  try{await route.fulfill({path});}catch(error){errors.push(`Missing asset ${url.pathname}: ${error.message}`);await route.abort();}
 });
 try{
  await page.goto('http://motion.local/index.html?render=1');
  await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
  const video=metadata(await page.evaluate(()=>window.VIDEO));
  await page.setViewportSize({width:video.width,height:video.height});
  assert.deepEqual(errors,[],'Composition errors');return {browser,page,video,errors};
 }catch(error){await browser.close();throw new Error(`${error.message}\n${errors.join('\n')}`);}
}
async function frame(page,t,path){await page.evaluate(t=>window.renderAt(t),t);return page.screenshot({path});}
async function check(page,video){
 const checks=[],test=(name,ok)=>{checks.push({name,ok});assert(ok,name);};
 test('Unique element ids',await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.length===new Set(ids).size;}));
 const shots=await page.evaluate(()=>[...document.querySelectorAll('[data-shot]')].map(e=>({id:e.id,start:Number(e.dataset.start),duration:Number(e.dataset.duration)})));
 test('At least one timed scene',shots.length>0);
 for(let i=0;i<shots.length;i++){
  const s=shots[i],previousEnd=i?shots[i-1].start+shots[i-1].duration:0;
  test(`${s.id}: finite, contiguous timing`,!!s.id&&Number.isFinite(s.start)&&s.duration>0&&Number.isFinite(s.duration)&&Math.abs(s.start-previousEnd)<1e-7);
  for(const t of [s.start,Math.max(s.start,s.start+s.duration-1/video.fps)]){
   await page.evaluate(t=>renderAt(t),t);
   const visible=await page.evaluate(()=>[...document.querySelectorAll('[data-shot]')].filter(e=>{const c=getComputedStyle(e);return c.visibility!=='hidden'&&c.display!=='none';}).map(e=>e.id));
   test(`${s.id}: correct scene at ${t.toFixed(3)}s`,visible.length===1&&visible[0]===s.id);
  }
  const t=s.start+s.duration/2;
  const first=await frame(page,t);await page.evaluate(t=>renderAt(t),t<video.duration/2?video.duration-1/video.fps:0);const second=await frame(page,t);
  test(`${s.id}: deterministic after seeking`,first.equals(second));
  const layout=await page.evaluate(()=>{
   const elements=[...document.querySelectorAll('[data-shot]')].filter(e=>getComputedStyle(e).visibility==='visible').flatMap(e=>[...e.querySelectorAll('[data-check-bounds]')]);
   const rectangles=elements.map(el=>{const range=document.createRange();range.selectNodeContents(el);return {el,r:range.getBoundingClientRect(),label:el.id||el.textContent.trim()};}).filter(x=>x.r.width>0&&Number(getComputedStyle(x.el).opacity)>.01);
   const bounds=rectangles.filter(({r})=>r.left<VIDEO.width*.05||r.right>VIDEO.width*.95||r.top<VIDEO.height*.05||r.bottom>VIDEO.height*.95).map(x=>x.label);
   const overlaps=[];
   for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){
    const a=rectangles[i],b=rectangles[j];if(a.el.hasAttribute('data-allow-overlap')||b.el.hasAttribute('data-allow-overlap')||a.el.contains(b.el)||b.el.contains(a.el))continue;
    if(Math.min(a.r.right,b.r.right)>Math.max(a.r.left,b.r.left)+1&&Math.min(a.r.bottom,b.r.bottom)>Math.max(a.r.top,b.r.top)+1)overlaps.push(`${a.label} / ${b.label}`);
   }return {bounds,overlaps};
  });
  test(`${s.id}: marked text inside safe area (${layout.bounds.join('; ')})`,layout.bounds.length===0);
  test(`${s.id}: marked text does not overlap (${layout.overlaps.join('; ')})`,layout.overlaps.length===0);
 }
 test('Scenes cover the complete duration',Math.abs(shots.at(-1).start+shots.at(-1).duration-video.duration)<1e-7);
 save('checks.json',checks);console.log(`${checks.length} composition checks passed`);return shots;
}
async function review(page,video,shots){
 const hash=sourceHash(),dir=join(out,`review-${hash.slice(0,12)}`);mkdirSync(dir,{recursive:true});
 const times=[...new Set(shots.flatMap(s=>[s.start+Math.min(.4,s.duration/3),s.start+s.duration/2,s.start+s.duration-1/video.fps]))].sort((a,b)=>a-b);
 for(let i=0;i<times.length;i++)await frame(page,times[i],join(dir,`${String(i).padStart(4,'0')}.png`));
 const rows=Math.ceil(times.length/4);
 // Preserve buffered tiles when PNG colour metadata changes between scenes.
 ffmpeg(['-reinit_filter','0','-framerate','1','-i',join(dir,'%04d.png'),'-vf',`scale=480:-2,format=rgb24,tile=4x${rows}`,'-frames:v','1','-update','1',join(out,'contact-sheet.jpg')]);
 save('review.json',{sourceHash:hash,samples:times,directory:dir,contactSheet:join(out,'contact-sheet.jpg')});
 console.log(`Review ${join(out,'contact-sheet.jpg')} and individual samples`);
}
async function render(page,video){
 const hash=sourceHash(),dir=join(out,`frames-${hash.slice(0,12)}`);mkdirSync(dir,{recursive:true});
 for(let i=0;i<video.frames;i++){
  await frame(page,i/video.fps,join(dir,`${String(i).padStart(6,'0')}.png`));
  if(i%120===0)console.log(`frame ${i}/${video.frames}`);
 }
 if(video.audio){
  const wav=await page.evaluate(()=>window.renderAudio());assert.equal(typeof wav,'string','renderAudio must return a base64 PCM WAV');
  writeFileSync(join(out,'audio.wav'),Buffer.from(wav,'base64'));
  const info=probe(join(out,'audio.wav'));assert(info.streams.some(s=>s.codec_type==='audio'),'WAV has no audio stream');
  assert(Math.abs(Number(info.format.duration)-video.duration)<=1/video.fps,'Audio must cover the full film');
 }
 assert.equal(sourceHash(),hash,'Source changed during rendering; render again');
 save('render.json',{sourceHash:hash,video,directory:dir,completedFrames:video.frames});
}
function verify(){
 const manifest=load('render.json'),video=manifest.video;
 assert.equal(manifest.sourceHash,sourceHash(),'Source changed after rendering; render the current project');
 const info=probe(finalFile),v=info.streams.find(s=>s.codec_type==='video'),a=info.streams.find(s=>s.codec_type==='audio');
 assert(v,'No video stream');assert.equal(v.width,video.width);assert.equal(v.height,video.height);
 assert.equal(v.codec_name,'h264');assert.equal(v.pix_fmt,'yuv420p');assert.equal(Number(v.nb_frames),video.frames);
 const [num,den]=v.r_frame_rate.split('/').map(Number);assert(Math.abs(num/den-video.fps)<.001,'Unexpected frame rate');
 assert(Math.abs(Number(info.format.duration)-video.duration)<=1/video.fps+.03,'Unexpected encoded duration');
 ffmpeg(['-i',finalFile,'-f','null','-']);
 let audio=null;
 if(video.audio){
  assert(a,'Expected encoded audio');assert.equal(a.codec_name,'aac');
  const result=run('ffmpeg',['-hide_banner','-i',finalFile,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=10:print_format=json','-f','null','-']);
  const json=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);assert(json,'No encoded loudness measurements');
  audio=JSON.parse(json[0]);assert(Number.isFinite(Number(audio.input_i))&&Number(audio.input_i)>-40,'Soundtrack is silent or too quiet');
  assert(Number.isFinite(Number(audio.input_tp))&&Number(audio.input_tp)<=-1,'Encoded true peak exceeds -1 dBTP; reduce the limiter ceiling and export again');
 }else assert(!a,'Silent video unexpectedly contains an audio stream');
 save('verification.json',{file:finalFile,sourceHash:manifest.sourceHash,video:v,audioStream:a??null,loudness:audio,decodePassed:true});
 console.log(`Verified ${finalFile}${audio?` · ${audio.input_i} LUFS · ${audio.input_tp} dBTP`:''}`);
}
function encode(){
 const manifest=load('render.json'),video=metadata(manifest.video);
 assert.equal(manifest.sourceHash,sourceHash(),'Source changed after rendering; render the current project');
 assert.equal(manifest.completedFrames,video.frames,'Incomplete render');
 for(let i=0;i<video.frames;i++)assert(existsSync(join(manifest.directory,`${String(i).padStart(6,'0')}.png`)),`Missing frame ${i}; render again`);
 const args=['-reinit_filter','0','-framerate',String(video.fps),'-i',join(manifest.directory,'%06d.png')];
 if(video.audio)args.push('-i',join(out,'audio.wav'),'-map','0:v:0','-map','1:a:0','-af','loudnorm=I=-16:TP=-2.5:LRA=10,aresample=48000,alimiter=limit=0.70:level=false','-c:a','aac','-b:a','192k','-ar','48000');
 else args.push('-an');
 args.push('-frames:v',String(video.frames),'-c:v','libx264','-preset','medium','-crf','18','-profile:v','high','-pix_fmt','yuv420p','-t',String(video.duration),'-movflags','+faststart',finalFile);
 ffmpeg(args);verify();
}
if(command==='export')encode();
else if(command==='verify')verify();
else{
 const {browser,page,video,errors}=await open();
 try{
  if(command==='still'){
   const t=Number(argument);assert(Number.isFinite(t)&&t>=0&&t<video.duration,'Still time must be inside the film');
   await frame(page,t,join(out,`still-${t}.png`));
  }
  if(['check','review','all'].includes(command)){
   const shots=await check(page,video);if(command!=='check')await review(page,video,shots);
  }
  if(command==='render'||command==='all')await render(page,video);
  assert.deepEqual(errors,[],'Composition errors during render');
 }finally{await browser.close();}
 if(command==='all')encode();
}
