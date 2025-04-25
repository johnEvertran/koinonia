// public/electron.js (메인 프로세스)
const {
    app,
    BrowserWindow,
    ipcMain,
    Notification,
    dialog,
    shell,
    Menu
} = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const isDev = !app.isPackaged;
const { autoUpdater } = require('electron-updater');
// 창 상태 관리자 임포트
const WindowStateManager = require('./windowStateManager');
// Socket.IO 클라이언트 추가
const io = require('socket.io-client');

// 소켓 참조 유지
let socket = null;

// 로그 설정
const logPath = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
}

const logFile = path.join(logPath, 'app.log');
console.log('로그 파일 경로:', logFile);

// 로그 함수 수정 - 민감 정보 마스킹
function writeLog(message) {
    try {
        const timestamp = new Date().toISOString();

        // 민감 정보 마스킹
        let safeMessage = message;

        // JWT 토큰 마스킹 (예: eyJhbGc...부분만 표시)
        if (typeof safeMessage === 'string' && safeMessage.includes('eyJhbGciOiJ')) {
            safeMessage = safeMessage.replace(/(eyJhbGciOiJ[A-Za-z0-9_-]{5})[A-Za-z0-9_-]+/g, '$1...[마스킹됨]');
        }

        // FCM 토큰 마스킹
        if (typeof safeMessage === 'string' && safeMessage.includes('electron-fcm-')) {
            safeMessage = safeMessage.replace(/(electron-fcm-[0-9]{5})[0-9A-Za-z-]+/g, '$1...[마스킹됨]');
        }

        // 로그 파일에 저장 (개발 환경에서만 상세 로그)
        fs.appendFileSync(logFile, `${timestamp}: ${safeMessage}\n`);

        // 콘솔에는 간략한 로그만 출력
        if (isDev) {
            console.log(safeMessage);
        }
    } catch (error) {
        console.error('로그 작성 중 오류 발생:', error);
    }
}

// 자동 업데이트 설정
function setupAutoUpdater() {
    if (isDev) {
        writeLog('[Updater] 개발 환경에서는 업데이트 검사를 건너뜁니다');
        return;
    }

    // 로그 설정
    autoUpdater.logger = {
        info: (message) => writeLog(`[Updater-Info] ${message}`),
        warn: (message) => writeLog(`[Updater-Warn] ${message}`),
        error: (message) => writeLog(`[Updater-Error] ${message}`)
    };

    // 자동 다운로드 및 앱 종료 시 설치 활성화
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    // 이벤트 핸들러 등록
    autoUpdater.on('checking-for-update', () => {
        writeLog('[Updater] 업데이트 확인 중...');
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'checking' });
        }
    });

    autoUpdater.on('update-available', (info) => {
        writeLog(`[Updater] 업데이트 가능: ${JSON.stringify(info)}`);
        if (mainWindow) {
            mainWindow.webContents.send('update-available', info);
            mainWindow.webContents.send('update-status', {
                status: 'available',
                version: info.version
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        writeLog(`[Updater] 업데이트 없음: ${JSON.stringify(info)}`);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', {
                status: 'not-available',
                currentVersion: appVersion
            });
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const logMessage = `[Updater] 다운로드 진행: ${progressObj.percent.toFixed(2)}%`;
        writeLog(logMessage);
        if (mainWindow) {
            mainWindow.webContents.send('update-progress', progressObj);
            mainWindow.webContents.send('update-status', {
                status: 'downloading',
                progress: progressObj
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        writeLog(`[Updater] 업데이트 다운로드 완료: ${JSON.stringify(info)}`);
        if (mainWindow) {
            mainWindow.webContents.send('update-downloaded', info);
            mainWindow.webContents.send('update-status', {
                status: 'downloaded',
                version: info.version
            });

            // 사용자에게 업데이트 설치 여부 확인
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                buttons: ['지금 재시작', '나중에'],
                defaultId: 0,
                title: '업데이트 준비 완료',
                message: '새 버전이 다운로드되었습니다. 지금 재시작하여 설치하시겠습니까?',
                detail: `버전 ${info.version}의 새로운 기능이 설치됩니다.`
            }).then(({ response }) => {
                if (response === 0) {
                    writeLog('[Updater] 사용자가 업데이트 설치 승인');
                    autoUpdater.quitAndInstall(false, true);
                } else {
                    writeLog('[Updater] 사용자가 업데이트 설치 연기');
                }
            });
        }
    });

    autoUpdater.on('error', (error) => {
        writeLog(`[Updater] 오류 발생: ${error.message}`);
        if (mainWindow) {
            mainWindow.webContents.send('update-error', error.message);
            mainWindow.webContents.send('update-status', {
                status: 'error',
                error: error.message
            });
        }
    });

    writeLog('[Updater] 자동 업데이트 초기화 완료');
}

// 업데이트 확인 함수
function checkForUpdates(silent = false) {
    if (isDev) {
        writeLog('[Updater] 개발 환경에서는 업데이트 확인을 수행하지 않습니다');
        return;
    }

    writeLog(`[Updater] 업데이트 확인 시작 (silent: ${silent})`);

    try {
        autoUpdater.checkForUpdates();
    } catch (error) {
        writeLog(`[Updater] 업데이트 확인 오류: ${error.message}`);

        if (!silent && mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '업데이트 확인 실패',
                message: '업데이트를 확인하는 중 오류가 발생했습니다.',
                detail: error.message
            });
        }
    }
}

// 업데이트 설치 함수
function installUpdate() {
    writeLog('[Updater] 수동 업데이트 설치 요청');
    autoUpdater.quitAndInstall(false, true);
}

// fs 함수 프로미스화
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

// 메인 윈도우 참조 유지
let mainWindow;

// 창 상태 관리자 생성
const windowStateManager = new WindowStateManager({
    defaultWidth: 412,
    defaultHeight: 850
});

// FCM 토큰 저장 경로
const tokenFilePath = path.join(app.getPath('userData'), 'fcm_token.json');

// 앱 버전 정보
const appVersion = app.getVersion();

// FCM 토큰 저장 함수 - 보안 강화
function saveFCMToken(token) {
    try {
        const safeToken = token || '';
        const maskedToken = safeToken.substring(0, 15) + '...[마스킹됨]';
        writeLog(`[FCM-Debug] 토큰 저장 시도: ${maskedToken}`);

        // 기존 토큰 확인
        let existingToken = null;
        try {
            if (fs.existsSync(tokenFilePath)) {
                const data = JSON.parse(fs.readFileSync(tokenFilePath, 'utf8'));
                existingToken = data.token;
                // 기존 토큰도 마스킹
                const maskedExisting = existingToken ?
                    existingToken.substring(0, 15) + '...[마스킹됨]' : 'none';
                writeLog(`[FCM-Debug] 기존 토큰: ${maskedExisting}`);
            }
        } catch (e) {
            writeLog(`[FCM-Debug] 기존 토큰 읽기 실패: ${e.message}`);
        }

        // 파일에 암호화하여 저장
        const encryptedData = encryptData(JSON.stringify({
            token: safeToken,
            updatedAt: new Date().toISOString()
        }));

        fs.writeFileSync(tokenFilePath, encryptedData);
        writeLog(`[FCM-Debug] FCM 토큰 저장 성공`);
        return true;
    } catch (error) {
        writeLog(`[FCM-Debug] FCM 토큰 저장 오류: ${error.message}`);
        return false;
    }
}

// FCM 토큰 로드 함수 - 복호화 추가
function loadFCMToken() {
    try {
        if (fs.existsSync(tokenFilePath)) {
            const encryptedData = fs.readFileSync(tokenFilePath, 'utf8');
            const decryptedData = decryptData(encryptedData);
            const data = JSON.parse(decryptedData);

            // 마스킹된 토큰만 로그에 출력
            const maskedToken = data.token ?
                data.token.substring(0, 15) + '...[마스킹됨]' : 'none';
            writeLog(`[FCM-Debug] FCM 토큰 로드됨: ${maskedToken}`);

            return data.token;
        }
    } catch (error) {
        writeLog(`[FCM-Debug] FCM 토큰 로드 오류: ${error.message}`);
    }
    return null;
}

// 간단한 암호화 함수 - 데이터 보호
function encryptData(data) {
    try {
        // 앱 고유 식별자를 암호화 키로 사용 (보안을 위해 앱 ID와 머신 ID 조합)
        const key = crypto.createHash('sha256')
            .update(app.getPath('userData') + app.getVersion() + app.getName())
            .digest('hex')
            .substring(0, 32); // AES-256에는 32바이트 키 필요

        const iv = crypto.randomBytes(16); // 초기화 벡터
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);

        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // IV와 암호화된 데이터 결합
        return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
        writeLog(`[암호화] 데이터 암호화 실패: ${error.message}`);
        // 암호화 실패 시 원본 반환 (보안 레벨 저하지만 기능은 유지)
        return data;
    }
}

// 복호화 함수
function decryptData(encryptedData) {
    try {
        // 암호화 되지 않은 레거시 데이터인 경우
        if (!encryptedData.includes(':')) {
            return encryptedData;
        }

        const key = crypto.createHash('sha256')
            .update(app.getPath('userData') + app.getVersion() + app.getName())
            .digest('hex')
            .substring(0, 32);

        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const encryptedText = parts[1];

        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        writeLog(`[복호화] 데이터 복호화 실패: ${error.message}`);
        // 복호화 실패 시 빈 문자열 반환
        return '{}';
    }
}

// 사용자 정보 저장 - 보안 강화
async function saveUserInfo(memberId, fcmToken) {
    try {
        const memberInfoPath = path.join(app.getPath('userData'), 'member_info.json');

        const userData = {
            memberId,
            fcmToken,
            lastLogin: new Date().toISOString()
        };

        // 데이터 암호화
        const encryptedData = encryptData(JSON.stringify(userData));

        await writeFileAsync(memberInfoPath, encryptedData);
        writeLog(`사용자 정보 안전하게 저장됨`);
        return true;
    } catch (error) {
        writeLog(`사용자 정보 저장 오류: ${error.message}`);
        return false;
    }
}

// 사용자 정보 로드 - 복호화 추가
function loadUserInfo() {
    try {
        const memberInfoPath = path.join(app.getPath('userData'), 'member_info.json');

        if (fs.existsSync(memberInfoPath)) {
            const encryptedData = fs.readFileSync(memberInfoPath, 'utf8');
            const decryptedData = decryptData(encryptedData);
            return JSON.parse(decryptedData);
        }
    } catch (error) {
        writeLog(`사용자 정보 로드 오류: ${error.message}`);
    }
    return null;
}

// 소켓 초기화 함수
async function initSocket(memberId, fcmToken) {
    // 기존 소켓 연결 해제
    if (socket) {
        writeLog(`[Socket] 기존 소켓 연결 해제`);
        socket.disconnect();
        socket = null;
    }

    writeLog(`[Socket] 소켓 초기화 시작: memberId=${memberId}, fcmToken=${fcmToken || 'none'}`);

    try {
        // 웹사이트에서 쿠키 가져오기
        const cookies = await mainWindow.webContents.session.cookies.get({
            url: 'https://koinonia.evertran.com'
        });

        // 'saveLogin' 쿠키 찾기 (JWT 토큰)
        const authCookie = cookies.find(cookie => cookie.name === 'saveLogin');
        let authToken = null;

        if (authCookie) {
            authToken = authCookie.value;
            writeLog(`[Socket] 인증 쿠키 발견: ${authToken}`);
        } else {
            writeLog(`[Socket] 인증 쿠키를 찾을 수 없음. 쿠키 목록:`, cookies.map(c => c.name).join(', '));
        }

        // 소켓 연결 (쿠키 전송 활성화)
        socket = io('https://koinonia.evertran.com', {
            auth: {
                token: authToken  // 웹사이트에서 발급받은 JWT 토큰
            },
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            timeout: 30000
        });

        // 소켓 이벤트 리스너 설정
        socket.on('connect', () => {
            writeLog(`[Socket] 연결 성공: id=${socket.id}`);

            // 연결 후 FCM 토큰 등록
            if (fcmToken && fcmToken.startsWith('electron-fcm-')) {
                socket.emit('register-fcm-token', fcmToken);
                writeLog(`[Socket] FCM 토큰 등록: ${fcmToken}`);
            }
        });

        socket.on('connect_error', (error) => {
            writeLog(`[Socket] 연결 오류: ${error.message}`);

            // 인증 실패 시 내부 오류 검사
            if (error.message === 'Authentication failed') {
                writeLog(`[Socket] 인증 실패 - 웹사이트에서 로그인이 필요할 수 있습니다`);
            }
        });

        // FCM 알림 이벤트 처리
        socket.on('fcm-notification', (notification) => {
            writeLog(`[Socket] FCM 알림 수신:`, notification);
            showFCMNotification(notification);
        });

        writeLog(`[Socket] 소켓 초기화 완료`);
        return socket;
    } catch (error) {
        writeLog(`[Socket] 소켓 초기화 오류: ${error.message}`);
        return null;
    }
}

// FCM 알림 표시 함수 - 커스텀 알림창 사용
function showFCMNotification(notification) {
    try {
        let title = '새 메시지';
        let body = '새로운 알림이 도착했습니다.';
        let chatRoomID = null;
        let data = {};

        // 알림 데이터 추출
        if (notification) {
            writeLog(`[FCM] 알림 데이터 수신: ${JSON.stringify(notification)}`);

            // 채팅방 이름을 제목으로 사용
            if (notification.title) {
                title = notification.title;
            }

            // 보낸 사람 이름을 내용으로 사용
            if (notification.body) {
                body = notification.body;
            }

            // 채팅방 ID 추출
            if (notification.data && notification.data.chatRoomID) {
                chatRoomID = notification.data.chatRoomID;
            } else if (notification.chatRoomID) {
                chatRoomID = notification.chatRoomID;
            }

            // 데이터 추출
            if (notification.data) {
                data = notification.data;
            } else {
                // 기본 데이터 필드가 없으면 전체 객체를 데이터로 사용
                const { title: t, body: b, ...restData } = notification;
                data = restData;
            }
        }

        // 메시지 길이 제한 (약 50자)
        if (body && body.length > 50) {
            body = body.substring(0, 47) + '...';
        }

        writeLog(`[FCM] 알림 표시: ${title} - ${body}`);

        // 알림 클릭 시 콜백 함수
        // FCM 알림 표시 함수에서 클릭 이벤트 핸들러 부분
        const onNotificationClick = () => {
            writeLog(`[FCM] 알림 클릭됨`);
            if (mainWindow) {
                // 창이 최소화되어 있으면 복원
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();

                // 채팅방 ID가 있으면 채팅방으로 이동
                if (chatRoomID) {
                    // React Native 앱의 URL 형식을 참고하여 타임스탬프 추가
                    const timestamp = Date.now();
                    const chatRoomUrl = `https://koinonia.evertran.com/chatRoom.html?chatRoomId=${chatRoomID}&t=${timestamp}`;

                    writeLog(`[FCM] 채팅방 URL로 이동: ${chatRoomUrl}`);

                    // 네비게이션 이벤트 발송 (웹뷰에서 처리할 수 있도록)
                    mainWindow.webContents.send('notification-clicked', {
                        ...data,
                        chatRoomID: chatRoomID,
                        timestamp: timestamp
                    });

                    // URL 로드
                    mainWindow.loadURL(chatRoomUrl);
                } else {
                    writeLog(`[FCM] 채팅방 ID가 없어 이동할 수 없음`);
                }
            } else {
                writeLog(`[FCM] 메인 윈도우가 없어 이동할 수 없음`);
            }
        };

        // 커스텀 알림 표시
        showCustomNotification(title, body, onNotificationClick);

        return true;
    } catch (error) {
        writeLog(`[FCM] 알림 생성 중 오류 발생: ${error.message}`);
        writeLog(`[FCM] 오류 상세: ${error.stack}`);
        return false;
    }
}

// 개선된 커스텀 알림 창 함수
function showCustomNotification(title, body, onClick) {
    try {
        // 이전 알림창이 있다면 닫기
        const existingNotifications = BrowserWindow.getAllWindows()
            .filter(win => win.getTitle() === 'custom-notification');

        existingNotifications.forEach(win => {
            if (!win.isDestroyed()) win.close();
        });

        // 아이콘 경로 설정
        let iconPath = path.join(__dirname, '../assets/icon.png');
        let iconExists = fs.existsSync(iconPath);

        // 첫 번째 경로가 존재하지 않으면 다른 경로도 시도
        if (!iconExists) {
            const alternativePaths = [
                path.join(__dirname, 'assets/icon.png'),
                path.join(__dirname, 'icon.png'),
                path.join(app.getAppPath(), 'assets/icon.png')
            ];

            for (const altPath of alternativePaths) {
                if (fs.existsSync(altPath)) {
                    iconPath = altPath;
                    iconExists = true;
                    writeLog(`[Notification] 대체 아이콘 경로 사용: ${iconPath}`);
                    break;
                }
            }
        }

        if (!iconExists) {
            writeLog(`[Notification] 아이콘 파일을 찾을 수 없음`);
        } else {
            writeLog(`[Notification] 아이콘 파일 경로: ${iconPath}`);
        }

        const notificationWindow = new BrowserWindow({
            width: 300,
            height: 80,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            show: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false // 로컬 파일 접근 허용
            }
        });

        notificationWindow.setTitle('custom-notification');

        // 화면 우측 하단에 위치
        const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;
        notificationWindow.setPosition(width - 310, height - 90);

        // Base64로 인코딩된 이미지를 사용하여 이미지 로딩 문제 해결
        let iconBase64 = '';
        if (iconExists) {
            try {
                const iconData = fs.readFileSync(iconPath);
                iconBase64 = Buffer.from(iconData).toString('base64');
                writeLog(`[Notification] 아이콘 Base64 인코딩 완료 (${iconBase64.length} 바이트)`);
            } catch (err) {
                writeLog(`[Notification] 아이콘 파일 읽기 오류: ${err.message}`);
                iconExists = false;
            }
        }

        // 알림 HTML 생성
        const notificationHtml = `
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        overflow: hidden;
                        margin: 0;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        height: 100vh;
                        display: flex;
                        background-color: rgba(62, 62, 62, 0.9);
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        cursor: pointer;
                        color: white;
                    }
                    #container {
                        display: flex;
                        width: 100%;
                        padding: 12px;
                    }
                    #icon {
                        width: 32px;
                        height: 32px;
                        margin-right: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 50%;
                        flex-shrink: 0;
                        overflow: hidden;
                        background-color: #4caf50;
                    }
                    #icon img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                    }
                    #content {
                        flex-grow: 1;
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }
                    #title {
                        font-weight: bold;
                        margin-bottom: 4px;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-size: 14px;
                    }
                    #body {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        font-size: 12px;
                        opacity: 0.9;
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    body {
                        animation: fadeIn 0.2s ease-out;
                    }
                </style>
            </head>
            <body onclick="window.close()">
                <div id="container">
                    <div id="icon">
                        ${iconBase64
                ? `<img src="data:image/png;base64,${iconBase64}" alt="알림">`
                : `<div style="color: white; font-weight: bold; font-size: 16px;">K</div>`
            }
                    </div>
                    <div id="content">
                        <div id="title">${title.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                        <div id="body">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                    </div>
                </div>
                <script>
                    document.body.addEventListener('click', () => {
                        try {
                            require('electron').ipcRenderer.send('custom-notification-clicked');
                        } catch (e) {
                            console.error('Error sending click event:', e);
                            window.close();
                        }
                    });
                    
                    setTimeout(() => {
                        window.close();
                    }, 5000);
                </script>
            </body>
            </html>
        `;

        // 알림 표시
        notificationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(notificationHtml)}`);

        notificationWindow.once('ready-to-show', () => {
            notificationWindow.show();
            writeLog(`[Notification] 알림창 표시됨`);
        });

        // 클릭 이벤트 처리
        ipcMain.once('custom-notification-clicked', () => {
            writeLog(`[Notification] 알림창 클릭됨`);
            if (onClick) onClick();
            if (!notificationWindow.isDestroyed()) {
                notificationWindow.close();
            }
        });

        // 5초 후 자동으로 닫기
        setTimeout(() => {
            if (notificationWindow && !notificationWindow.isDestroyed()) {
                notificationWindow.close();
            }
        }, 5500);

        return notificationWindow;
    } catch (error) {
        writeLog(`[Notification] 커스텀 알림 표시 오류: ${error.message}`);
        // 실패 시 기본 알림으로 폴백
        try {
            const notification = new Notification({
                title: title,
                body: body,
                silent: false
            });
            notification.show();
            notification.on('click', onClick);
            return notification;
        } catch (fallbackError) {
            writeLog(`[Notification] 기본 알림 표시도 실패: ${fallbackError.message}`);
            return null;
        }
    }
}

// 윈도우 복원 처리 함수 (파일 상단에 추가)
async function handleWindowRestore() {
    // 소켓 연결 상태 확인 및 필요시 재연결
    checkAndReconnectSocket();

    // 세션 상태 확인 및 필요시 복구
    checkAndRestoreSession();
}

// 윈도우 포커스 처리 함수 (파일 상단에 추가)
async function handleWindowFocus() {
    // 소켓 연결 상태 확인 및 필요시 재연결
    checkAndReconnectSocket();

    // 하트비트 전송
    if (currentMemberId) {
        sendHeartbeat(currentMemberId);
    }
}

// 소켓 연결 상태 확인 및 재연결 (파일 상단에 추가)
function checkAndReconnectSocket() {
    if (currentMemberId && (!socket || !socket.connected)) {
        writeLog(`[Socket] 소켓 연결 끊김 감지, 재연결 시도...`);

        // FCM 토큰 로드
        const token = loadFCMToken();

        // 소켓 초기화
        initSocket(currentMemberId, token)
            .then(newSocket => {
                if (newSocket) {
                    writeLog(`[Socket] 소켓 재연결 성공`);
                } else {
                    writeLog(`[Socket] 소켓 재연결 실패`);
                }
            })
            .catch(error => {
                writeLog(`[Socket] 소켓 재연결 오류: ${error.message}`);
            });
    }
}

// 세션 상태 확인 및 복구 (파일 상단에 추가)
async function checkAndRestoreSession() {
    if (!currentMemberId) {
        // 로그인 상태가 아니면 세션 정보를 로드해봄
        const userInfo = loadUserInfo();
        if (userInfo && userInfo.memberId) {
            writeLog(`[Session] 저장된 세션 정보 발견: memberId=${userInfo.memberId}`);
            currentMemberId = userInfo.memberId;

            // 웹 컨텐츠에 세션 복구 알림
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('session-restored', {
                    memberId: userInfo.memberId
                });
            }

            // 서버에 활성 상태 알림 (하트비트)
            sendHeartbeat(userInfo.memberId);
        }
    } else {
        // 이미 로그인 상태면 하트비트 전송
        sendHeartbeat(currentMemberId);
    }
}

// 하트비트 함수 구현 (파일 상단에 추가)
async function sendHeartbeat(memberId) {
    if (!memberId) {
        writeLog('[Heartbeat] 하트비트를 보낼 memberId가 없음');
        return false;
    }

    try {
        writeLog(`[Heartbeat] 서버에 하트비트 전송 시작: memberId=${memberId}`);

        const response = await fetch('https://koinonia.evertran.com/api/members/heartbeat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                memberId,
                platform: 'electron'
            }),
        });

        if (response.ok) {
            const result = await response.json();
            writeLog(`[Heartbeat] 전송 성공: ${JSON.stringify(result)}`);
            return true;
        } else {
            writeLog(`[Heartbeat] 전송 실패: HTTP ${response.status}`);
            return false;
        }
    } catch (error) {
        writeLog(`[Heartbeat] 전송 오류: ${error.message}`);
        return false;
    }
}


let debugWindow = null;

// createWindow 함수 내에 윈도우 이벤트 핸들러 추가 (기존 함수 수정)
function createWindow() {
    writeLog('메인 윈도우 생성 시작');

    // 저장된 창 상태 로드
    const windowState = windowStateManager.loadState();
    writeLog(`저장된 창 크기: ${windowState.width}x${windowState.height}`);

    // 스플래시 윈도우 생성
    const splashWindow = new BrowserWindow({
        width: 500,         // 가로 넓게
        height: 300,        // 세로 낮게
        transparent: false,
        frame: false,
        alwaysOnTop: true,
        center: true,
        resizable: false,   // 크기 고정 (옵션)
        skipTaskbar: true,  // 작업 표시줄에 안 보이게 (옵션)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });


    const splashPath = path.join(__dirname, './splash.html');
    writeLog(`스플래시 화면 경로: ${splashPath}`);
    try {
        splashWindow.loadURL(`file://${splashPath}`);
        writeLog('스플래시 화면 로드 성공');
    } catch (error) {
        writeLog(`스플래시 화면 로드 오류: ${error}`);
    }

    // 빈 메뉴 생성 (메뉴바 숨기기)
    Menu.setApplicationMenu(null);

    // 메인 윈도우 생성 - 저장된 크기로 설정
    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        minWidth: 320,
        minHeight: 500,
        show: false,
        center: true,
        frame: true,
        autoHideMenuBar: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 창 최소화 이벤트
    mainWindow.on('minimize', () => {
        writeLog('메인 윈도우 최소화됨');
    });

    // 창 복원 이벤트 (최소화에서 복원될 때)
    mainWindow.on('restore', () => {
        writeLog('메인 윈도우 복원됨');
        handleWindowRestore();
    });

    // 창이 포커스를 받을 때 이벤트
    mainWindow.on('focus', () => {
        writeLog('메인 윈도우 포커스 받음');
        handleWindowFocus();
    });

    // 창이 포커스를 잃을 때 이벤트
    mainWindow.on('blur', () => {
        writeLog('메인 윈도우 포커스 잃음');
    });

    // React 앱 로드
    // 항상 이 URL을 띄우기
    const indexPath = 'https://koinonia.evertran.com';

    try {
        mainWindow.loadURL(indexPath);
        writeLog('메인 윈도우 로드 시도 완료');
    } catch (error) {
        writeLog(`메인 윈도우 로드 오류: ${error}`);
    }

    // 창 크기가 변경될 때마다 상태 저장 (제한 설정: 500ms마다)
    let windowResizeTimeout;
    mainWindow.on('resize', () => {
        clearTimeout(windowResizeTimeout);
        windowResizeTimeout = setTimeout(() => {
            windowStateManager.saveState(mainWindow);
        }, 500);
    });

    // 개발자 도구 설정
    //mainWindow.webContents.openDevTools({ mode: 'right' }); / / 오른쪽에 표시

    // 로드 실패 처리
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        writeLog(`페이지 로드 실패: ${errorCode} - ${errorDescription}`);

        // 대체 경로 시도
        if (!isDev) {
            writeLog('대체 경로 시도 중...');
            const alternativePaths = [
                path.join(__dirname, '../index.html'),
                path.join(__dirname, './index.html'),
                path.join(__dirname, '../build/index.html'),
                path.join(app.getAppPath(), 'build/index.html')
            ];

            for (const altPath of alternativePaths) {
                writeLog(`대체 경로 확인: ${altPath} (존재: ${fs.existsSync(altPath)})`);
            }

            // 첫 번째 대체 경로 시도
            const firstAltPath = `file://${alternativePaths[0]}`;
            writeLog(`첫 번째 대체 경로 시도: ${firstAltPath}`);
            mainWindow.loadURL(firstAltPath);
        }
    });

    // 메인 윈도우 로드 완료 후 처리
    mainWindow.once('ready-to-show', () => {
        writeLog('메인 윈도우 로드 완료 (ready-to-show)');
        // 스플래시 화면 닫고 메인 윈도우 표시 (로딩 효과를 위해 딜레이)
        setTimeout(() => {
            splashWindow.destroy();
            mainWindow.show();
            writeLog('메인 윈도우 표시됨');
        }, 2000);
    });

    // 창이 닫힐 때 이벤트
    mainWindow.on('close', () => {
        writeLog('메인 윈도우 닫힘');
        // 창 크기 저장
        windowStateManager.saveState(mainWindow);
    });

    // 창이 닫힌 후 이벤트
    mainWindow.on('closed', () => {
        writeLog('메인 윈도우 종료됨');
        // 소켓 연결 해제
        if (socket) {
            socket.disconnect();
            socket = null;
            writeLog('[Socket] 앱 종료로 인한 소켓 연결 해제');
        }
        mainWindow = null;
    });

    // electron.js에서 로그인 페이지가 로드될 때
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.insertCSS(`
            /* 전체 스크롤바 숨기기 */
            ::-webkit-scrollbar {
                display: none !important;
            }
            html, body {
                overflow: hidden !important;
            }
        `);

        // 기존 로그인 감지 코드도 아래처럼 유지
        mainWindow.webContents.executeJavaScript(`
            (function() {
                const originalSetItem = localStorage.setItem;
                localStorage.setItem = function(key, value) {
                    originalSetItem.call(this, key, value);
                    if (key === 'memberID' && value) {
                        const token = localStorage.getItem('token') || '';
                        if (window.electronAPI && window.electronAPI.handleLoginSuccess) {
                            window.electronAPI.handleLoginSuccess(value, token);
                        }
                    }
                };
    
                const existingMemberId = localStorage.getItem('memberID');
                if (existingMemberId && window.electronAPI && window.electronAPI.handleLoginSuccess) {
                    window.electronAPI.handleLoginSuccess(existingMemberId, localStorage.getItem('token') || '');
                }
            })();
        `);
    });

    // 외부 링크는 기본 브라우저로 열기
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:') || url.startsWith('http:')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}


app.on('ready', () => {
    writeLog('앱 준비 완료 (app.ready)');
    createWindow();

    // 자동 업데이트 설정 및 초기화
    setupAutoUpdater();

    // 앱 시작 후 일정 시간이 지난 후 자동 업데이트 확인 (사용자 경험 향상을 위해)
    setTimeout(() => {
        if (!isDev) {
            writeLog('[Updater] 시작 후 자동 업데이트 확인');
            checkForUpdates(true); // silent 모드로 실행
        }
    }, 10000); // 10초 후 실행

    const { globalShortcut } = require('electron');

    globalShortcut.register('CommandOrControl+F12', () => {
        if (debugWindow) {
            debugWindow.focus();
        } else {
            createDebugWindow();
        }
    });
});

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
    writeLog('모든 창 닫힘');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// macOS에서 앱 아이콘 클릭 시 창이 없으면 새로 생성
app.on('activate', () => {
    writeLog('앱 활성화');
    if (mainWindow === null) {
        createWindow();
    }
});


// 마지막 로그인한 사용자 ID 저장 변수
let currentMemberId = null;

// 로그인 성공 이벤트 핸들러에서 currentMemberId 업데이트
ipcMain.on('login-success', async (event, { memberId, fcmToken }) => {
    // 민감 정보 마스킹
    const maskedMemberId = memberId ? String(memberId).substring(0, 2) + '***' : 'none';
    writeLog(`[FCM-Debug] 로그인 성공: memberID=${maskedMemberId}`);

    // 현재 로그인된 멤버 ID 저장
    currentMemberId = memberId;

    // FCM 토큰 가져오기 또는 생성
    let token = loadFCMToken();

    // 기존 토큰이 없거나 Electron 형식이 아닌 경우 새로 생성
    const isElectronToken = token && token.startsWith('electron-fcm-');

    if (!token || !isElectronToken) {
        const { v4: uuidv4 } = require('uuid');
        const timestamp = Date.now();
        token = `electron-fcm-${timestamp}-${uuidv4().substring(0, 10)}`;

        // 마스킹된 토큰만 로그에 출력
        const maskedToken = token.substring(0, 15) + '...[마스킹됨]';
        writeLog(`[FCM-Debug] 새 FCM 토큰 생성: ${maskedToken}`);

        saveFCMToken(token);
    }

    // 서버에 토큰 전송
    try {
        writeLog(`[FCM-Debug] 서버에 토큰 전송 시작`);

        const response = await fetch('https://koinonia.evertran.com/api/members/update-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                memberId,
                deviceInfo: {
                    platform: 'electron',
                    osType: process.platform,
                    deviceName: `Electron-${process.platform}`
                }
            }),
        });

        if (response.ok) {
            writeLog(`[FCM-Debug] 서버에 토큰 전송 성공`);
        } else {
            writeLog(`[FCM-Debug] 서버에 토큰 전송 실패: HTTP ${response.status}`);
        }
    } catch (error) {
        writeLog(`[FCM-Debug] 서버에 토큰 전송 오류: ${error.message}`);
    }

    // 소켓 초기화
    initSocket(memberId, token);

    // 메인 윈도우로 토큰 업데이트 이벤트 전송
    if (mainWindow) {
        writeLog(`[FCM-Debug] 토큰 업데이트 이벤트 전송`);
        mainWindow.webContents.send('update-fcm-token', {
            token: token,
            memberId: memberId
        });
    } else {
        writeLog('[FCM-Debug] 메인 윈도우가 없어 토큰 업데이트 이벤트를 전송할 수 없음');
    }

    // 사용자 정보 안전하게 저장
    await saveUserInfo(memberId, token);
});

// 로그아웃 함수 추가
async function logoutFromServer(memberId) {
    if (!memberId) {
        writeLog('[Logout] 로그아웃할 memberId가 없음');
        return false;
    }

    try {
        writeLog(`[Logout] 서버에 로그아웃 요청 시작: memberId=${memberId}`);

        const response = await fetch('https://koinonia.evertran.com/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                memberId,
                platform: 'electron'
            }),
        });

        if (response.ok) {
            const result = await response.json();
            writeLog(`[Logout] 서버 로그아웃 성공: ${JSON.stringify(result)}`);
            return true;
        } else {
            writeLog(`[Logout] 서버 로그아웃 실패: HTTP ${response.status}`);
            return false;
        }
    } catch (error) {
        writeLog(`[Logout] 서버 로그아웃 오류: ${error.message}`);
        return false;
    }
}

// 앱 종료 전 로그아웃 처리 이벤트 추가
app.on('before-quit', async (event) => {
    writeLog('[App] 앱 종료 이벤트 발생');

    // 현재 로그인된 사용자가 있는 경우
    if (currentMemberId) {
        writeLog(`[App] 로그인된 사용자 확인됨: 로그아웃 처리 시작`);
        event.preventDefault(); // 앱 종료를 일시적으로 방지

        // 서버에 로그아웃 요청
        await logoutFromServer(currentMemberId);

        // 소켓 연결 해제
        if (socket) {
            socket.disconnect();
            socket = null;
            writeLog('[Socket] 앱 종료로 인한 소켓 연결 해제');
        }

        // 로그아웃 작업 완료 후 앱 종료
        writeLog('[App] 로그아웃 처리 완료, 앱 종료 진행');
        app.exit(0);
    } else {
        writeLog('[App] 로그인된 사용자 없음, 앱 종료 진행');
    }
});


// 명시적인 로그아웃 핸들러 추가
ipcMain.on('logout', async (event, data) => {
    writeLog('[Logout] 명시적 로그아웃 요청 받음');

    // 현재 로그인된 사용자 ID 사용 또는 매개변수로 받은 ID 사용
    const memberId = data?.memberId || currentMemberId;

    if (memberId) {
        // 서버 로그아웃 처리
        await logoutFromServer(memberId);

        // 현재 멤버 ID 초기화
        currentMemberId = null;

        // 로그아웃 성공 응답
        if (event && event.reply) {
            event.reply('logout-response', { success: true });
        }
    } else {
        writeLog('[Logout] 로그아웃할 memberId가 없음');
        if (event && event.reply) {
            event.reply('logout-response', { success: false, error: 'No member ID found' });
        }
    }
});


// 앱 닫기 요청 처리
ipcMain.on('close-app', () => {
    writeLog('앱 닫기 요청 받음');
    if (mainWindow) {
        mainWindow.close();
    }
});

// IPC 이벤트 리스너 추가
ipcMain.on('open-debug-window', () => {
    if (debugWindow) {
        debugWindow.focus();
    } else {
        createDebugWindow();
    }
});

// 창 최소화 요청 처리
ipcMain.on('minimize-app', () => {
    writeLog('앱 최소화 요청 받음');
    if (mainWindow) {
        mainWindow.minimize();
    }
});

// 창 크기 정보 요청 처리
ipcMain.handle('get-window-size', () => {
    if (mainWindow) {
        const bounds = mainWindow.getBounds();
        return {
            width: bounds.width,
            height: bounds.height
        };
    }
    return windowStateManager.loadState();
});

// FCM 토큰 저장 요청
ipcMain.handle('save-fcm-token', (event, token) => {
    writeLog(`FCM 토큰 저장 요청: ${token}`);
    const success = saveFCMToken(token);
    return success;
});

// FCM 토큰 가져오기 요청
ipcMain.handle('get-fcm-token', () => {
    writeLog('FCM 토큰 요청 받음');
    const token = loadFCMToken();
    writeLog(`[FCM-Debug] 요청에 응답하는 FCM 토큰: ${token || 'none'}`);
    return token;
});

// 알림 표시 요청
ipcMain.on('show-notification', (event, title, body, data = {}) => {
    writeLog(`알림 표시 요청: ${title}`);

    // Notification 객체 생성
    const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, '../assets/icon.png'),
        silent: false,  // 알림 소리 활성화
        urgency: 'normal', // 긴급성 수준
        timeoutType: 'default', // 기본 타임아웃
        toastXml: null // Windows에서 추가 설정 가능
    });

    // 알림 표시
    notification.show();

    // 알림 클릭 이벤트
    notification.on('click', () => {
        writeLog('알림 클릭됨');
        if (mainWindow) {
            // 창이 최소화되어 있으면 복원
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // 채팅방 ID가 있으면 네비게이션 이벤트 발송
            if (data && (data.chatRoomID || data.chatRoomId || data.roomId || data.chat_id)) {
                mainWindow.webContents.send('notification-clicked', data);
                writeLog(`알림 클릭 이벤트 발송: ${JSON.stringify(data)}`);
            }
        }
    });
});

ipcMain.on('write-log', (event, message) => {
    writeLog(message);  // 메인 프로세스의 writeLog 함수
});

// FCM 메시지 수신 처리
ipcMain.on('fcm-message-received', (event, message) => {
    writeLog(`FCM 메시지 수신: ${JSON.stringify(message)}`);

    // 메시지 데이터 추출
    let title = '새 메시지';
    let body = '새로운 알림이 도착했습니다.';
    let data = {};

    // 메시지 형식에 따라 데이터 추출
    if (message) {
        if (message.notification) {
            // Firebase 표준 형식
            title = message.notification.title || title;
            body = message.notification.body || body;

            // 데이터 포함 여부 확인
            if (message.data) {
                data = message.data;
            }
        } else if (message.title && message.body) {
            // 직접 형식
            title = message.title;
            body = message.body;

            // 데이터 추출
            if (message.data) {
                data = message.data;
            } else {
                // 데이터가 특정 필드에 없으면 메시지 전체를 데이터로 간주
                const { title, body, ...restData } = message;
                data = restData;
            }
        }
    }

    // 알림 생성
    const notification = new Notification({
        title: title,
        body: body,
        icon: path.join(__dirname, '../assets/icon.png'),
        silent: false,
        timeoutType: 'default' // 시스템 기본 시간 동안 알림 표시
    });

    writeLog(`알림 표시: ${title} - ${body}`);
    notification.show();

    // 알림 클릭 이벤트
    notification.on('click', () => {
        writeLog('FCM 알림 클릭됨');
        if (mainWindow) {
            // 창이 최소화되어 있으면 복원
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();

            // 채팅방 ID나 관련 데이터가 있으면 네비게이션 이벤트 발송
            if (data) {
                mainWindow.webContents.send('notification-clicked', data);
                writeLog(`알림 클릭 이벤트 발송: ${JSON.stringify(data)}`);
            }
        }
    });
});


// 업데이트 확인 요청 처리 (개선된 버전)
ipcMain.on('check-for-update', (event, { silent = false } = {}) => {
    writeLog(`업데이트 확인 요청 (silent: ${silent})`);

    if (isDev) {
        writeLog('[Updater] 개발 환경에서는 업데이트 확인을 수행하지 않습니다');
        event.reply('update-check-result', {
            currentVersion: appVersion,
            updateAvailable: false,
            silent
        });
        return;
    }

    try {
        // 업데이트 체크 시작을 알림
        event.reply('update-status', { status: 'checking' });

        // 실제 업데이트 체크 로직
        autoUpdater.checkForUpdates().then(checkResult => {
            if (checkResult && checkResult.updateInfo) {
                writeLog(`[Updater] 업데이트 정보 수신: ${JSON.stringify(checkResult.updateInfo)}`);
            }
        }).catch(error => {
            writeLog(`[Updater] 업데이트 확인 오류: ${error.message}`);

            if (!silent) {
                dialog.showMessageBox(mainWindow, {
                    type: 'error',
                    title: '업데이트 확인 실패',
                    message: '업데이트를 확인하는 중 오류가 발생했습니다.',
                    detail: error.message
                });
            }

            event.reply('update-status', {
                status: 'error',
                error: error.message
            });
        });
    } catch (error) {
        writeLog(`[Updater] 업데이트 확인 중 예외 발생: ${error.message}`);

        if (!silent) {
            dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: '업데이트 확인 실패',
                message: '업데이트를 확인하는 중 오류가 발생했습니다.',
                detail: error.message
            });
        }

        event.reply('update-status', {
            status: 'error',
            error: error.message
        });
    }
});


// 업데이트 설치 요청 처리
ipcMain.on('install-update', () => {
    writeLog('[Updater] 사용자가 업데이트 설치 요청');

    // 다운로드된 업데이트가 있는지 확인
    if (autoUpdater.isUpdaterActive()) {
        writeLog('[Updater] 업데이트 설치 및 앱 재시작 진행');

        // 앱 종료 후 업데이트 설치 및 재시작
        // forceRunAfter: 설치 후 앱 자동 실행
        // allowAutoRunAfter: 재시작 허용
        autoUpdater.quitAndInstall(false, true);
    } else {
        writeLog('[Updater] 설치할 업데이트가 없음');

        if (mainWindow) {
            dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: '업데이트 정보',
                message: '현재 설치할 수 있는 업데이트가 없습니다.',
                detail: '나중에 다시 시도하거나 수동으로 업데이트를 확인해주세요.'
            });
        }
    }
});

// 앱 버전 요청
ipcMain.handle('get-app-version', () => {
    writeLog('앱 버전 요청');
    return appVersion;
});

// 파일 저장 다이얼로그
ipcMain.handle('save-file-dialog', async (event, options = {}) => {
    writeLog('파일 저장 다이얼로그 요청');
    const { defaultPath, filters = [] } = options;

    const result = await dialog.showSaveDialog(mainWindow, {
        title: options.title || '파일 저장',
        defaultPath: defaultPath,
        filters: filters.length > 0 ? filters : [
            { name: '모든 파일', extensions: ['*'] }
        ],
        properties: ['createDirectory']
    });

    return result.canceled ? null : result.filePath;
});

// 파일 저장
ipcMain.handle('save-file', async (event, { filePath, buffer }) => {
    writeLog(`파일 저장 요청: ${filePath}`);
    try {
        // 디렉토리가 없으면 생성
        const dirname = path.dirname(filePath);
        if (!fs.existsSync(dirname)) {
            await mkdirAsync(dirname, { recursive: true });
        }

        await writeFileAsync(filePath, buffer);
        writeLog('파일 저장 성공');
        return { success: true, filePath };
    } catch (error) {
        writeLog(`파일 저장 오류: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// 파일 선택 다이얼로그
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
    writeLog('파일 선택 다이얼로그 요청');
    const { filters = [], multiple = false } = options;

    const result = await dialog.showOpenDialog(mainWindow, {
        title: options.title || '파일 선택',
        filters: filters.length > 0 ? filters : [
            { name: '모든 파일', extensions: ['*'] }
        ],
        properties: [
            'openFile',
            ...(multiple ? ['multiSelections'] : [])
        ]
    });

    return result.canceled ? null : result.filePaths;
});

// 디렉토리 선택 다이얼로그
ipcMain.handle('open-directory-dialog', async (event, options = {}) => {
    writeLog('디렉토리 선택 다이얼로그 요청');
    const result = await dialog.showOpenDialog(mainWindow, {
        title: options.title || '폴더 선택',
        properties: ['openDirectory', 'createDirectory']
    });

    return result.canceled ? null : result.filePaths[0];
});

// 외부 링크 열기
ipcMain.handle('open-external', async (event, url) => {
    writeLog(`외부 링크 열기 요청: ${url}`);
    try {
        await shell.openExternal(url);
        return true;
    } catch (error) {
        writeLog(`외부 링크 열기 오류: ${error.message}`);
        return false;
    }
});

// Socket 관련 IPC 이벤트 추가
ipcMain.handle('socket-status', () => {
    if (socket) {
        return {
            connected: socket.connected,
            id: socket.id
        };
    }
    return { connected: false, id: null };
});

ipcMain.on('socket-emit', (event, { eventName, data }) => {
    if (!socket) {
        writeLog(`[Socket] 이벤트 전송 실패 (${eventName}): 소켓이 초기화되지 않음`);
        return;
    }

    if (!socket.connected) {
        writeLog(`[Socket] 이벤트 전송 실패 (${eventName}): 소켓이 연결되지 않음`);
        return;
    }

    try {
        socket.emit(eventName, data);
        writeLog(`[Socket] 이벤트 전송: ${eventName}`);
    } catch (error) {
        writeLog(`[Socket] 이벤트 전송 오류 (${eventName}): ${error.message}`);
    }
});

ipcMain.on('socket-reconnect', (event) => {
    if (!socket) {
        writeLog(`[Socket] 재연결 실패: 소켓이 초기화되지 않음`);
        return;
    }

    try {
        socket.connect();
        writeLog(`[Socket] 재연결 시도 중...`);
    } catch (error) {
        writeLog(`[Socket] 재연결 오류: ${error.message}`);
    }
});

// 자동 업데이트 이벤트
autoUpdater.on('update-available', (info) => {
    writeLog(`업데이트 가능: ${JSON.stringify(info)}`);
    if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
    }
});

autoUpdater.on('update-downloaded', (info) => {
    writeLog(`업데이트 다운로드 완료: ${JSON.stringify(info)}`);
    if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
    }
});

autoUpdater.on('error', (error) => {
    writeLog(`Auto Updater 오류: ${error.message}`);
});