// Where the Chromium binary lives. This used to be one hard-coded Playwright
// path; Playwright deletes old builds when it updates, and the day chromium-1223
// went away every render died with a bare ENOENT. Resolve it at call time
// instead: explicit env var, then the newest Playwright build, then whatever
// Chrome/Chromium the machine already has.
const fs=require('fs'),path=require('path');

const isFile=p=>{try{return !!p&&fs.statSync(p).isFile();}catch(e){return false;}};

// Playwright's cache: <root>/chromium-1234/chrome-win64/chrome.exe and the
// linux/mac layouts of the same thing. Highest build number first.
function playwrightBuilds(){
  const root=process.platform==='win32'
    ?path.join(process.env.LOCALAPPDATA||'','ms-playwright')
    :process.platform==='darwin'
      ?path.join(process.env.HOME||'','Library','Caches','ms-playwright')
      :path.join(process.env.HOME||'','.cache','ms-playwright');
  let dirs=[];
  try{dirs=fs.readdirSync(root);}catch(e){return [];}
  const num=d=>parseInt(d.replace(/\D/g,''),10)||0;
  return dirs.filter(d=>/^chromium(_headless_shell)?-\d+$/.test(d))
    .sort((a,b)=>num(b)-num(a))
    .flatMap(d=>['chrome-win64/chrome.exe','chrome-linux/chrome',
                 'chrome-linux/headless_shell',
                 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']
      .map(rel=>path.join(root,d,...rel.split('/'))));
}

function installedBrowsers(){
  if(process.platform==='win32'){
    // Program Files is not always on C: — this machine keeps it on D:, which is
    // exactly why a literal "C:/Program Files/..." fallback would have been
    // useless here. Read the real locations out of the environment.
    const bases=[process.env.ProgramW6432,process.env.ProgramFiles,
                 process.env['ProgramFiles(x86)'],process.env.LOCALAPPDATA]
      .filter(Boolean);
    const rels=['Google/Chrome/Application/chrome.exe',
                'Chromium/Application/chrome.exe',
                'Microsoft/Edge/Application/msedge.exe'];
    return bases.flatMap(b=>rels.map(r=>path.join(b,...r.split('/'))));
  }
  if(process.platform==='darwin')return [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  // Docker image installs this one from apt (see Dockerfile).
  return ['/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable','/snap/bin/chromium'];
}

let found=null;
function chromePath(){
  if(found)return found;
  const env=process.env.SPAMGEN_CHROME;
  if(env){
    if(isFile(env))return found=env;
    throw new Error('SPAMGEN_CHROME points at nothing: '+env);
  }
  const tried=[...playwrightBuilds(),...installedBrowsers()];
  const hit=tried.find(isFile);
  if(hit)return found=hit;
  throw new Error('Chromium not found. Install Chrome or set SPAMGEN_CHROME.'+
    ' Looked at:\n'+tried.join('\n'));
}
module.exports={chromePath};
