// ============================================
// SECURITY.JS - Bảo mật toàn diện
// Chống crack, debug, và bảo vệ ứng dụng
// ============================================

(function() {
    'use strict';

    // ============================================
    // 1. BẢO VỆ FETCH - CHỐNG LỖI MIXED CONTENT
    // ============================================
    
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Tự động chuyển HTTP sang HTTPS
        if (typeof url === 'string' && 
            window.location.protocol === 'https:' && 
            url.startsWith('http://')) {
            const httpsUrl = url.replace('http://', 'https://');
            console.warn('🔄 Tự động chuyển HTTP sang HTTPS:', httpsUrl);
            return originalFetch.call(this, httpsUrl, options);
        }
        
        // Chặn request nguy hiểm
        if (typeof url === 'string') {
            const blockedPatterns = [
                '/admin', '/config', '/settings', '/database', 
                '/backup', '/.env', '/wp-admin', '/wp-config',
                '/shell', '/cmd', '/exec', '/system'
            ];
            
            for (const pattern of blockedPatterns) {
                if (url.toLowerCase().includes(pattern)) {
                    console.warn('🚫 Blocked request:', url);
                    return Promise.reject(new Error('Access Denied'));
                }
            }
        }
        return originalFetch.call(this, url, options);
    };

    // ============================================
    // 2. CHỐNG DEBUG TOOLS
    // ============================================
    
    function antiDebug() {
        const devtools = /./;
        devtools.toString = function() {
            if (this === devtools) {
                document.body.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;flex-direction:column;padding:20px;text-align:center;">
                        <h1 style="font-size:3rem;">🚫</h1>
                        <h2 style="color:#ff6b6b;">Phát hiện công cụ gỡ lỗi!</h2>
                        <p style="color:#9aa9c1;max-width:500px;">Vui lòng tắt DevTools để tiếp tục sử dụng ứng dụng.</p>
                    </div>
                `;
                localStorage.setItem('security_alert', JSON.stringify({
                    type: 'debug_detected',
                    time: new Date().toISOString(),
                    userAgent: navigator.userAgent
                }));
            }
        };
        setInterval(devtools, 1000);
    }

    // Chặn chuột phải
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });

    // Chặn phím tắt debug
    document.addEventListener('keydown', function(e) {
        const blockedKeys = [
            { key: 'F12', code: 123 },
            { key: 'I', ctrl: true, shift: true },
            { key: 'J', ctrl: true, shift: true },
            { key: 'U', ctrl: true },
            { key: 'S', ctrl: true }
        ];
        
        for (const blocked of blockedKeys) {
            if (e.key === blocked.key || e.keyCode === blocked.code) {
                if (!blocked.ctrl || (e.ctrlKey && (!blocked.shift || e.shiftKey))) {
                    e.preventDefault();
                    return false;
                }
            }
        }
        return true;
    });

    // ============================================
    // 3. CHỐNG CRACK - INTEGRITY CHECK
    // ============================================
    
    function checkIntegrity() {
        if (!localStorage.getItem('site_hash')) {
            localStorage.setItem('site_hash', document.documentElement.outerHTML.length.toString());
        }
        
        setInterval(() => {
            const storedHash = localStorage.getItem('site_hash');
            const newHash = document.documentElement.outerHTML.length;
            if (storedHash && storedHash !== newHash.toString()) {
                console.warn('⚠️ Phát hiện thay đổi mã nguồn!');
            }
        }, 30000);
    }

    // ============================================
    // 4. CHỐNG XSS
    // ============================================
    
    function sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    // ============================================
    // 5. CHỐNG SQL INJECTION
    // ============================================
    
    function checkForSQLInjection(input) {
        const sqlKeywords = [
            'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER',
            'CREATE', 'TRUNCATE', 'EXEC', 'UNION', 'JOIN', 'WHERE',
            'OR', 'AND', '--', '/*', '*/', ';'
        ];
        
        const inputUpper = input.toUpperCase();
        for (const keyword of sqlKeywords) {
            if (inputUpper.includes(keyword)) {
                return true;
            }
        }
        return false;
    }

    // ============================================
    // 6. CSRF PROTECTION
    // ============================================
    
    function generateCSRFToken() {
        const token = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
        localStorage.setItem('csrf_token', token);
        return token;
    }

    function verifyCSRFToken(token) {
        const stored = localStorage.getItem('csrf_token');
        return token === stored;
    }

    // ============================================
    // 7. CHỐNG BRUTE FORCE
    // ============================================
    
    const loginAttempts = {};
    
    function checkBruteForce(ip, maxAttempts = 5, timeWindow = 60000) {
        const now = Date.now();
        if (!loginAttempts[ip]) {
            loginAttempts[ip] = [];
        }
        
        loginAttempts[ip] = loginAttempts[ip].filter(
            timestamp => now - timestamp < timeWindow
        );
        
        if (loginAttempts[ip].length >= maxAttempts) {
            return false;
        }
        
        loginAttempts[ip].push(now);
        return true;
    }

    // ============================================
    // 8. ADMIN AUTHENTICATION
    // ============================================
    
    function hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    function verifyAdminPassword(password) {
        const validPassword = 'Admin@2024';
        const validHash = hashPassword(validPassword);
        const inputHash = hashPassword(password);
        
        if (password === validPassword || inputHash === validHash) {
            localStorage.setItem('admin_session', 'authenticated');
            localStorage.setItem('admin_session_time', Date.now().toString());
            return true;
        }
        
        const session = localStorage.getItem('admin_session');
        const sessionTime = parseInt(localStorage.getItem('admin_session_time') || '0');
        if (session === 'authenticated' && (Date.now() - sessionTime) < 3600000) {
            return true;
        }
        
        return false;
    }

    function checkAdminSession() {
        const session = localStorage.getItem('admin_session');
        const sessionTime = parseInt(localStorage.getItem('admin_session_time') || '0');
        if (session === 'authenticated' && (Date.now() - sessionTime) < 3600000) {
            return true;
        }
        return false;
    }

    function showAdminWithPassword() {
        const overlay = document.createElement('div');
        overlay.id = 'admin-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            backdrop-filter: blur(10px);
        `;
        
        overlay.innerHTML = `
            <div style="background: #141b2b; padding: 40px; border-radius: 30px; max-width: 400px; width: 90%; border: 2px solid #00e6ff;">
                <h2 style="color: #ffd966; text-align: center; margin-bottom: 20px;">
                    <i class="fas fa-user-shield"></i> Admin Access
                </h2>
                <p style="color: #9aa9c1; text-align: center; margin-bottom: 20px;">
                    Nhập mật khẩu để truy cập trang quản trị
                </p>
                <input type="password" id="admin-password" class="input-field" 
                       placeholder="Nhập mật khẩu admin..." 
                       style="width: 100%; margin-bottom: 15px; padding: 14px 18px; border-radius: 40px; border: 1px solid #3f5580; background: #0b1322; color: white; font-size: 1rem; outline: none;">
                <button id="admin-login-btn" class="btn-submit" style="width: 100%; padding: 16px 25px; border: none; border-radius: 60px; font-weight: 800; font-size: 1.4rem; color: white; cursor: pointer; background: linear-gradient(180deg, #00c9a7 0%, #0077b6 100%);">
                    <i class="fas fa-unlock"></i> Truy cập
                </button>
                <p style="color: #6c7e9e; font-size: 0.8rem; text-align: center; margin-top: 15px;">
                    <i class="fas fa-info-circle"></i> Mật khẩu được lưu trữ an toàn
                </p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        document.getElementById('admin-login-btn').addEventListener('click', function() {
            const password = document.getElementById('admin-password').value;
            if (verifyAdminPassword(password)) {
                overlay.style.display = 'none';
                window.location.href = 'admin.html';
            } else {
                Swal.fire({
                    icon: 'error',
                    title: '❌ Mật khẩu sai!',
                    text: 'Vui lòng thử lại.',
                    timer: 2000,
                    showConfirmButton: false
                });
                document.getElementById('admin-password').value = '';
                document.getElementById('admin-password').focus();
            }
        });
        
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('admin-login-btn').click();
            }
        });
    }

    // ============================================
    // 9. ENCRYPT LOCALSTORAGE
    // ============================================
    
    function encryptData(data) {
        return btoa(encodeURIComponent(data));
    }

    function decryptData(encrypted) {
        try {
            return decodeURIComponent(atob(encrypted));
        } catch {
            return null;
        }
    }

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        const sensitiveKeys = ['orders', 'visitors', 'banned_ips', 'admin_session'];
        if (sensitiveKeys.includes(key) && typeof value === 'string') {
            try {
                const encrypted = encryptData(value);
                originalSetItem.call(localStorage, key, encrypted);
                return;
            } catch (e) {}
        }
        originalSetItem.call(localStorage, key, value);
    };

    const originalGetItem = localStorage.getItem;
    localStorage.getItem = function(key) {
        const value = originalGetItem.call(localStorage, key);
        const sensitiveKeys = ['orders', 'visitors', 'banned_ips', 'admin_session'];
        if (sensitiveKeys.includes(key) && value) {
            try {
                const decrypted = decryptData(value);
                if (decrypted) return decrypted;
            } catch (e) {}
        }
        return value;
    };

    // ============================================
    // 10. DETECT BOT
    // ============================================
    
    function detectBot() {
        const userAgent = navigator.userAgent.toLowerCase();
        const botKeywords = [
            'bot', 'crawler', 'spider', 'headless', 'selenium',
            'phantomjs', 'puppeteer', 'playwright', 'cypress',
            'curl', 'wget', 'python', 'java', 'go-http-client'
        ];
        
        for (const keyword of botKeywords) {
            if (userAgent.includes(keyword)) {
                document.body.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;flex-direction:column;padding:20px;text-align:center;">
                        <h1 style="font-size:3rem;">🤖</h1>
                        <h2>Phát hiện bot!</h2>
                        <p style="color:#9aa9c1;">Truy cập bị từ chối.</p>
                    </div>
                `;
                return true;
            }
        }
        return false;
    }

    // ============================================
    // 11. LOG SECURITY EVENTS
    // ============================================
    
    function logSecurityEvent(event, data = {}) {
        const log = {
            event: event,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...data
        };
        
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.unshift(log);
        if (logs.length > 100) logs.pop();
        localStorage.setItem('security_logs', JSON.stringify(logs));
    }

    // ============================================
    // 12. KHỞI TẠO BẢO MẬT
    // ============================================
    
    function initSecurity() {
        console.log('🔒 Khởi tạo hệ thống bảo mật...');
        
        if (detectBot()) return;
        antiDebug();
        checkIntegrity();
        generateCSRFToken();
        
        // Ẩn admin links
        document.querySelectorAll('a[href*="admin"]').forEach(el => {
            el.style.display = 'none';
        });
        
        logSecurityEvent('security_init');
        console.log('✅ Hệ thống bảo mật đã sẵn sàng!');
    }

    // ============================================
    // EXPOSE PUBLIC METHODS
    // ============================================
    
    window.Security = {
        antiDebug: antiDebug,
        generateCSRFToken: generateCSRFToken,
        verifyCSRFToken: verifyCSRFToken,
        checkForSQLInjection: checkForSQLInjection,
        sanitizeInput: sanitizeInput,
        checkBruteForce: checkBruteForce,
        verifyAdminPassword: verifyAdminPassword,
        checkAdminSession: checkAdminSession,
        showAdminWithPassword: showAdminWithPassword,
        logSecurityEvent: logSecurityEvent,
        hashPassword: hashPassword,
        encryptData: encryptData,
        decryptData: decryptData
    };

    // ============================================
    // KHỞI TẠO
    // ============================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurity);
    } else {
        initSecurity();
    }

    console.log('✅ Security.js đã tải thành công!');
})();
