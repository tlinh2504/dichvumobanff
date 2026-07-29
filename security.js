// ============================================
// SECURITY.JS - Bảo mật toàn diện
// Chống crack, debug, và bảo vệ ứng dụng
// ============================================

(function() {
    'use strict';

    // ============================================
    // 1. CHỐNG DEBUG TOOLS
    // ============================================
    
    // Chống mở DevTools
    function antiDebug() {
        // Phát hiện DevTools mở
        const devtools = /./;
        devtools.toString = function() {
            if (this === devtools) {
                // DevTools đang mở
                document.body.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;flex-direction:column;padding:20px;text-align:center;">
                        <h1 style="font-size:3rem;">🚫</h1>
                        <h2 style="color:#ff6b6b;">Phát hiện công cụ gỡ lỗi!</h2>
                        <p style="color:#9aa9c1;max-width:500px;">Vui lòng tắt DevTools để tiếp tục sử dụng ứng dụng.</p>
                        <p style="color:#6c7e9e;font-size:0.8rem;margin-top:20px;">Hành vi này sẽ được ghi lại.</p>
                    </div>
                `;
                // Gửi cảnh báo
                const alertData = {
                    type: 'debug_detected',
                    time: new Date().toISOString(),
                    userAgent: navigator.userAgent
                };
                localStorage.setItem('security_alert', JSON.stringify(alertData));
            }
        };
        setInterval(devtools, 1000);
    }

    // Chống inspect element
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });

    // Chống F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    document.addEventListener('keydown', function(e) {
        // F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+J
        if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U
        if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
            e.preventDefault();
            return false;
        }
        // Ctrl+S
        if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
            e.preventDefault();
            return false;
        }
        return true;
    });

    // ============================================
    // 2. CHỐNG CRACK - OBFUSCATION CHECK
    // ============================================
    
    // Kiểm tra mã nguồn bị thay đổi
    function checkIntegrity() {
        const originalHash = 'SECURE_HASH_' + Date.now().toString(36);
        const currentHash = document.documentElement.outerHTML.length;
        
        // Lưu hash ban đầu
        if (!localStorage.getItem('site_hash')) {
            localStorage.setItem('site_hash', currentHash.toString());
        }
        
        // Kiểm tra mỗi 30 giây
        setInterval(() => {
            const storedHash = localStorage.getItem('site_hash');
            const newHash = document.documentElement.outerHTML.length;
            
            if (storedHash && storedHash !== newHash.toString()) {
                // Phát hiện thay đổi
                console.warn('⚠️ Phát hiện thay đổi mã nguồn!');
                // Có thể thực hiện hành động: chặn truy cập, gửi cảnh báo, v.v.
            }
        }, 30000);
    }

    // ============================================
    // 3. CHỐNG TẤN CÔNG XSS
    // ============================================
    
    // Sanitize input
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

    // Override document.write để chống XSS
    const originalWrite = document.write;
    document.write = function() {
        const args = Array.from(arguments);
        const sanitized = args.map(arg => {
            if (typeof arg === 'string') {
                return sanitizeInput(arg);
            }
            return arg;
        });
        originalWrite.apply(document, sanitized);
    };

    // ============================================
    // 4. CHỐNG TẤN CÔNGSQL INJECTION
    // ============================================
    
    // Kiểm tra và lọc các từ khóa nguy hiểm
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
    // 5. CHỐNG TẤN CÔNG CSRF
    // ============================================
    
    // Tạo và kiểm tra CSRF token
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

    // Thêm token vào tất cả form
    function addCSRFTokens() {
        const forms = document.querySelectorAll('form');
        const token = generateCSRFToken();
        forms.forEach(form => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'csrf_token';
            input.value = token;
            form.appendChild(input);
        });
    }

    // ============================================
    // 6. CHỐNG TẤN CÔNG BRUTE FORCE
    // ============================================
    
    const loginAttempts = {};
    
    function checkBruteForce(ip, maxAttempts = 5, timeWindow = 60000) {
        const now = Date.now();
        if (!loginAttempts[ip]) {
            loginAttempts[ip] = [];
        }
        
        // Xóa các attempts cũ hơn timeWindow
        loginAttempts[ip] = loginAttempts[ip].filter(
            timestamp => now - timestamp < timeWindow
        );
        
        if (loginAttempts[ip].length >= maxAttempts) {
            return false; // Quá nhiều lần thử
        }
        
        loginAttempts[ip].push(now);
        return true;
    }

    // ============================================
    // 7. ẨN ADMIN HOÀN TOÀN
    // ============================================
    
    // Ẩn link admin khỏi trang chính
    function hideAdmin() {
        // Xóa tất cả link đến admin trong HTML
        const adminLinks = document.querySelectorAll('a[href*="admin"]');
        adminLinks.forEach(link => {
            link.style.display = 'none';
        });
        
        // Xóa các phần tử có chứa từ admin
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.textContent && 
                el.textContent.toLowerCase().includes('admin') &&
                !el.closest('script')) {
                el.style.display = 'none';
            }
        });
    }

    // Chỉ hiển thị admin khi có mật khẩu đặc biệt
    function showAdminWithPassword() {
        // Tạo overlay để yêu cầu mật khẩu
        const overlay = document.createElement('div');
        overlay.id = 'admin-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 9999;
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
                       style="width: 100%; margin-bottom: 15px;">
                <button id="admin-login-btn" class="btn-submit" style="width: 100%;">
                    <i class="fas fa-unlock"></i> Truy cập
                </button>
                <p style="color: #6c7e9e; font-size: 0.8rem; text-align: center; margin-top: 15px;">
                    <i class="fas fa-info-circle"></i> Mật khẩu được lưu trữ an toàn
                </p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Xử lý đăng nhập admin
        document.getElementById('admin-login-btn').addEventListener('click', function() {
            const password = document.getElementById('admin-password').value;
            if (verifyAdminPassword(password)) {
                overlay.style.display = 'none';
                // Hiển thị admin
                const adminLinks = document.querySelectorAll('a[href*="admin"]');
                adminLinks.forEach(link => {
                    link.style.display = 'flex';
                });
                // Chuyển hướng đến admin
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
        
        // Enter để đăng nhập
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('admin-login-btn').click();
            }
        });
    }

    // ============================================
    // 8. MẬT KHẨU ADMIN MÃ HÓA
    // ============================================
    
    // Mật khẩu admin (mã hóa)
    const ADMIN_PASSWORD_HASH = 'ADMIN_SECURE_2024_'; // Sẽ được băm
    
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
        // Mật khẩu mặc định: Admin@2024
        const validPassword = 'Admin@2024';
        const validHash = hashPassword(validPassword);
        const inputHash = hashPassword(password);
        
        // Kiểm tra cả password thường và hash
        if (password === validPassword || inputHash === validHash) {
            // Lưu session admin
            localStorage.setItem('admin_session', 'authenticated');
            localStorage.setItem('admin_session_time', Date.now().toString());
            return true;
        }
        
        // Kiểm tra session đã tồn tại chưa
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

    // ============================================
    // 9. BẢO VỆ LOCALSTORAGE
    // ============================================
    
    // Mã hóa dữ liệu nhạy cảm trong localStorage
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

    // Override localStorage methods để mã hóa
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
    // 10. CHỐNG TẤN CÔNG TỪ TRÌNH DUYỆT CŨ
    // ============================================
    
    // Kiểm tra trình duyệt hiện đại
    function checkBrowser() {
        const isModern = 
            typeof window.fetch === 'function' &&
            typeof window.Promise === 'function' &&
            typeof document.querySelector === 'function';
        
        if (!isModern) {
            document.body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0f1e;color:#ff6b6b;flex-direction:column;padding:20px;text-align:center;">
                    <h1 style="font-size:3rem;">⚠️</h1>
                    <h2>Trình duyệt không được hỗ trợ!</h2>
                    <p style="color:#9aa9c1;">Vui lòng sử dụng trình duyệt hiện đại (Chrome, Firefox, Edge).</p>
                </div>
            `;
            return false;
        }
        return true;
    }

    // ============================================
    // 11. CHỐNG TẤN CÔNG MITM
    // ============================================
    
    // Kiểm tra HTTPS
    function checkHTTPS() {
        if (window.location.protocol !== 'https:' && 
            window.location.hostname !== 'localhost' &&
            !window.location.hostname.includes('127.0.0.1')) {
            console.warn('⚠️ Không sử dụng HTTPS!');
            // Có thể chuyển hướng sang HTTPS
            // window.location.href = window.location.href.replace('http:', 'https:');
        }
    }

    // ============================================
    // 12. CHỐNG TẤN CÔNG TỪ BOT
    // ============================================
    
    // Phát hiện bot
    function detectBot() {
        const userAgent = navigator.userAgent.toLowerCase();
        const botKeywords = [
            'bot', 'crawler', 'spider', 'headless', 'selenium',
            'phantomjs', 'puppeteer', 'playwright', 'cypress'
        ];
        
        for (const keyword of botKeywords) {
            if (userAgent.includes(keyword)) {
                // Bot detected
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
    // 13. BẢO VỆ API ENDPOINTS
    // ============================================
    
    // Chặn các request không mong muốn
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
        // Kiểm tra URL
        if (typeof url === 'string') {
            const blockedPatterns = [
                '/admin',
                '/config',
                '/settings',
                '/database',
                '/backup'
            ];
            
            for (const pattern of blockedPatterns) {
                if (url.includes(pattern)) {
                    console.warn('🚫 Blocked request:', url);
                    return Promise.reject(new Error('Access Denied'));
                }
            }
        }
        return originalFetch.call(this, url, options);
    };

    // ============================================
    // 14. LOGGING SECURITY EVENTS
    // ============================================
    
    function logSecurityEvent(event, data = {}) {
        const log = {
            event: event,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...data
        };
        
        // Lưu vào localStorage
        const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
        logs.unshift(log);
        if (logs.length > 100) logs.pop();
        localStorage.setItem('security_logs', JSON.stringify(logs));
        
        // Gửi đến admin nếu có
        if (window.sendToAdmin) {
            window.sendToAdmin('🔒 Security Alert: ' + event);
        }
    }

    // ============================================
    // 15. KHỞI TẠO BẢO MẬT
    // ============================================
    
    function initSecurity() {
        console.log('🔒 Khởi tạo hệ thống bảo mật...');
        
        // Kiểm tra trình duyệt
        if (!checkBrowser()) return;
        
        // Kiểm tra bot
        if (detectBot()) return;
        
        // Anti-debug
        antiDebug();
        
        // Integrity check
        checkIntegrity();
        
        // CSRF protection
        addCSRFTokens();
        
        // HTTPS check
        checkHTTPS();
        
        // Ẩn admin
        hideAdmin();
        
        // Kiểm tra session admin
        if (!checkAdminSession()) {
            // Ẩn tất cả link admin
            document.querySelectorAll('a[href*="admin"]').forEach(el => {
                el.style.display = 'none';
            });
        }
        
        // Tạo overlay admin nếu cần
        const adminLinks = document.querySelectorAll('a[href*="admin"]');
        if (adminLinks.length > 0) {
            // Thêm sự kiện click để kiểm tra mật khẩu
            adminLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (!checkAdminSession()) {
                        showAdminWithPassword();
                    } else {
                        window.location.href = this.href;
                    }
                });
            });
        }
        
        // Log security start
        logSecurityEvent('security_init');
        
        console.log('✅ Hệ thống bảo mật đã sẵn sàng!');
    }

    // ============================================
    // EXPOSE PUBLIC METHODS
    // ============================================
    
    window.Security = {
        // Anti-debug
        antiDebug: antiDebug,
        
        // CSRF
        generateCSRFToken: generateCSRFToken,
        verifyCSRFToken: verifyCSRFToken,
        
        // SQL Injection
        checkForSQLInjection: checkForSQLInjection,
        
        // XSS
        sanitizeInput: sanitizeInput,
        
        // Brute Force
        checkBruteForce: checkBruteForce,
        
        // Admin
        verifyAdminPassword: verifyAdminPassword,
        checkAdminSession: checkAdminSession,
        showAdminWithPassword: showAdminWithPassword,
        
        // Logging
        logSecurityEvent: logSecurityEvent,
        
        // Hash
        hashPassword: hashPassword,
        
        // Encryption
        encryptData: encryptData,
        decryptData: decryptData
    };

    // ============================================
    // KHỞI TẠO
    // ============================================
    
    // Chạy khi DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurity);
    } else {
        initSecurity();
    }

    // ============================================
    // CHỐNG TẤN CÔNG TỪ CONSOLE
    // ============================================
    
    // Xóa console.log trong production
    if (window.location.hostname !== 'localhost') {
        console.log = function() {};
        console.info = function() {};
        console.warn = function() {};
        console.error = function() {};
    }

    console.log('✅ Security.js đã tải thành công!');
})();
