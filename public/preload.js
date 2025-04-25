// preload.js

const { contextBridge, ipcRenderer } = require('electron');

// 로그 함수
function logDebug(category, message, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][${category}] ${message}`, data || '');
}

// 렌더러 프로세스에 노출할 API
contextBridge.exposeInMainWorld('electronAPI', {
    // 앱 버전 얻기
    getAppVersion: () => {
        logDebug('Preload-Debug', '앱 버전 요청');
        return ipcRenderer.invoke('get-app-version');
    },

    // FCM 토큰 저장 및 가져오기
    saveFCMToken: (token) => {
        logDebug('Preload-Debug', 'FCM 토큰 저장 요청:', token);
        return ipcRenderer.invoke('save-fcm-token', token);
    },

    getFCMToken: () => {
        logDebug('Preload-Debug', 'FCM 토큰 요청');
        return ipcRenderer.invoke('get-fcm-token').then(token => {
            logDebug('Preload-Debug', 'FCM 토큰 응답 받음:', token);
            return token;
        });
    },

    // 알림 표시
    showNotification: (title, body, data = {}) => {
        logDebug('Preload-Debug', '알림 표시 요청:', { title, body, data });
        ipcRenderer.send('show-notification', title, body, data);
    },

    // FCM 메시지 처리
    handleFCMMessage: (message) => {
        logDebug('Preload-Debug', 'FCM 메시지 처리 요청:', message);
        ipcRenderer.send('fcm-message-received', message);
    },

    // 로그인 성공 처리 함수 추가
    handleLoginSuccess: (memberId, fcmToken) => {
        logDebug('Preload-Debug', '로그인 성공 이벤트 전송', { memberId, fcmToken });
        ipcRenderer.send('login-success', { memberId, fcmToken });
    },

    // 업데이트 체크
    checkForUpdate: (options = { silent: false }) => {
        logDebug('Preload-Debug', '업데이트 체크 요청:', options);
        ipcRenderer.send('check-for-update', options);
    },

    // 창 크기 관련 API - 추가
    getWindowSize: () => ipcRenderer.invoke('get-window-size'),

    // 파일 저장 다이얼로그
    showSaveDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

    // 파일 저장
    saveFile: (options) => ipcRenderer.invoke('save-file', options),

    // 파일 선택 다이얼로그
    showOpenDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

    // 디렉토리 선택 다이얼로그
    showDirectoryDialog: (options) => ipcRenderer.invoke('open-directory-dialog', options),

    // 외부 링크 열기
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // 앱 창 닫기 기능
    closeApp: () => ipcRenderer.send('close-app'),


    // 디버깅 윈도우 열기 함수 추가
    openDebugWindow: () => ipcRenderer.send('open-debug-window'),

    writeLog: (message) => {
        ipcRenderer.send('write-log', message);
    },

    // 앱 창 최소화 기능
    minimizeApp: () => ipcRenderer.send('minimize-app'),

    // 소켓 연결 상태 확인 (새로 추가)
    checkSocketStatus: () => {
        logDebug('Preload-Debug', '소켓 상태 확인 요청');
        return ipcRenderer.invoke('socket-status');
    },

    // 소켓 재연결 요청 (새로 추가)
    reconnectSocket: () => {
        logDebug('Preload-Debug', '소켓 재연결 요청');
        ipcRenderer.send('socket-reconnect');
    },

    // 로그아웃 요청 (명시적)
    logout: (memberId) => {
        logDebug('Preload-Debug', '로그아웃 요청', { memberId });
        return new Promise((resolve) => {
            // 로그아웃 응답을 한 번만 수신
            ipcRenderer.once('logout-response', (_, result) => {
                logDebug('Preload-Debug', '로그아웃 응답', result);
                resolve(result);
            });

            ipcRenderer.send('logout', { memberId });
        });
    }


});

// 렌더러 프로세스에서 수신할 이벤트
contextBridge.exposeInMainWorld('electronEvents', {
    // 기존 이벤트 리스너들...

    // 앱 초기화 이벤트
    onAppInitialized: (callback) => {
        logDebug('Preload-Debug', '앱 초기화 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', '앱 초기화 이벤트 리스너 제거');
            ipcRenderer.removeListener('app-initialized', wrappedCallback);
        };

        const wrappedCallback = (_, data) => {
            logDebug('Preload-Debug', '앱 초기화 이벤트 수신:', data);
            callback(data);
        };

        ipcRenderer.on('app-initialized', wrappedCallback);
        return removeListener;
    },

    // 알림 클릭 이벤트
    onNotificationClicked: (callback) => {
        logDebug('Preload-Debug', '알림 클릭 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', '알림 클릭 이벤트 리스너 제거');
            ipcRenderer.removeListener('notification-clicked', wrappedCallback);
        };

        const wrappedCallback = (_, data) => {
            logDebug('Preload-Debug', '알림 클릭 이벤트 수신:', data);
            callback(data);
        };

        ipcRenderer.on('notification-clicked', wrappedCallback);
        return removeListener;
    },

    // FCM 토큰 업데이트 이벤트 (추가)
    onUpdateFCMToken: (callback) => {
        logDebug('Preload-Debug', 'FCM 토큰 업데이트 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', 'FCM 토큰 업데이트 이벤트 리스너 제거');
            ipcRenderer.removeListener('update-fcm-token', wrappedCallback);
        };

        const wrappedCallback = (_, data) => {
            logDebug('Preload-Debug', 'FCM 토큰 업데이트 이벤트 수신:', data);
            callback(data);
        };

        ipcRenderer.on('update-fcm-token', wrappedCallback);
        return removeListener;
    },

    // 업데이트 가능 이벤트
    onUpdateAvailable: (callback) => {
        logDebug('Preload-Debug', '업데이트 가능 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', '업데이트 가능 이벤트 리스너 제거');
            ipcRenderer.removeListener('update-available', wrappedCallback);
        };

        const wrappedCallback = (_, info) => {
            logDebug('Preload-Debug', '업데이트 가능 이벤트 수신:', info);
            callback(info);
        };

        ipcRenderer.on('update-available', wrappedCallback);
        return removeListener;
    },

    // 업데이트 다운로드 완료 이벤트
    onUpdateDownloaded: (callback) => {
        logDebug('Preload-Debug', '업데이트 다운로드 완료 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', '업데이트 다운로드 완료 이벤트 리스너 제거');
            ipcRenderer.removeListener('update-downloaded', wrappedCallback);
        };

        const wrappedCallback = (_, info) => {
            logDebug('Preload-Debug', '업데이트 다운로드 완료 이벤트 수신:', info);
            callback(info);
        };

        ipcRenderer.on('update-downloaded', wrappedCallback);
        return removeListener;
    },

    // 세션 복구 이벤트 (새로 추가)
    onSessionRestored: (callback) => {
        logDebug('Preload-Debug', '세션 복구 이벤트 리스너 등록');
        const removeListener = () => {
            logDebug('Preload-Debug', '세션 복구 이벤트 리스너 제거');
            ipcRenderer.removeListener('session-restored', wrappedCallback);
        };

        const wrappedCallback = (_, data) => {
            logDebug('Preload-Debug', '세션 복구 이벤트 수신:', data);
            callback(data);
        };

        ipcRenderer.on('session-restored', wrappedCallback);
        return removeListener;
    }
});

// DOM이 로드된 후 필요한 설정만 추가
window.addEventListener('DOMContentLoaded', () => {
    logDebug('Preload-Debug', 'DOM 로드 완료');

    // Electron 환경 확인 로그 추가 (안전한 방식으로 __dirname 접근)
    let preloadPath = 'unknown';
    try {
        // __dirname이 있는지 안전하게 확인
        if (typeof __dirname !== 'undefined') {
            preloadPath = __dirname;
        }
    } catch (e) {
        logDebug('Preload-Debug', '__dirname 접근 오류:', e.message);
    }

    logDebug('Preload-Debug', 'Electron 환경 확인:', {
        isElectron: typeof process !== 'undefined' && process.versions && !!process.versions.electron,
        processVersions: typeof process !== 'undefined' && process.versions ? process.versions : 'not available',
        preloadPath: preloadPath
    });

    // 창 포커스 및 블러 이벤트 리스너 추가
    window.addEventListener('focus', () => {
        logDebug('Preload-Debug', '윈도우 포커스 받음');
        // 소켓 상태 확인하고 필요하면 재연결
        if (window.electronAPI && window.electronAPI.checkSocketStatus) {
            window.electronAPI.checkSocketStatus().then(status => {
                if (!status.connected) {
                    logDebug('Preload-Debug', '소켓 연결이 끊어짐, 재연결 요청');
                    window.electronAPI.reconnectSocket();
                }
            });
        }
    });

    window.addEventListener('blur', () => {
        logDebug('Preload-Debug', '윈도우 포커스 잃음');
    });
});