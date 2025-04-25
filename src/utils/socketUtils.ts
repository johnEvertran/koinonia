// src/utils/socketUtils.ts
import { Socket } from 'socket.io-client';
import io from 'socket.io-client';

// 로깅 함수
const logDebug = (category: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const text = `[${timestamp}][${category}] ${message}` + (data !== undefined ? ` ${JSON.stringify(data)}` : '');
    console.log(text);
    window.electronAPI?.writeLog(text);
};

// 소켓 인스턴스 저장
let socketInstance: Socket | null = null;

interface SocketEvents {
    onConnect?: (socket: Socket) => void;
    onDisconnect?: (reason: string) => void;
    onError?: (error: Error) => void;
    onReconnect?: (attempt: number) => void;
    onMessage?: (message: any) => void;
    onNotification?: (notification: any) => void;
}

// 소켓 초기화 함수
export const initializeSocket = (memberId: string, fcmToken?: string | null, events?: SocketEvents): Socket => {
    if (socketInstance && socketInstance.connected) {
        logDebug('Socket', '이미 연결된 소켓이 있습니다. 기존 소켓을 반환합니다.', { id: socketInstance.id });
        return socketInstance;
    }

    logDebug('Socket', '소켓 초기화 시작', { memberId, fcmToken });

    // 소켓 생성
    const socket = io('https://koinonia.evertran.com', {
        auth: { memberID: memberId },
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        timeout: 30000
    });

    socketInstance = socket;

    // 기본 이벤트 리스너
    socket.on('connect', () => {
        logDebug('Socket', '소켓 연결 성공', { id: socket.id });

        // FCM 토큰 등록
        if (fcmToken && fcmToken.startsWith('electron-fcm-')) {
            socket.emit('register-fcm-token', fcmToken);
            logDebug('Socket', 'FCM 토큰 등록', { token: fcmToken });
        }

        events?.onConnect?.(socket);
    });

    socket.on('connect_error', (error) => {
        logDebug('Socket', '연결 오류', { error: error.message });
        events?.onError?.(error);
    });

    socket.on('disconnect', (reason) => {
        logDebug('Socket', '연결 종료', { reason });
        events?.onDisconnect?.(reason);
    });

    socket.on('reconnect', (attempt) => {
        logDebug('Socket', '재연결 성공', { attempt, id: socket.id });
        events?.onReconnect?.(attempt);
    });

    // FCM 관련 이벤트
    socket.on('request-fcm-token', () => {
        logDebug('Socket', 'FCM 토큰 요청 수신');
        if (fcmToken && fcmToken.startsWith('electron-fcm-')) {
            socket.emit('register-fcm-token', fcmToken);
            logDebug('Socket', '서버 요청에 응답하여 FCM 토큰 전송', { token: fcmToken });
        }
    });

    socket.on('fcm-notification', (notification) => {
        logDebug('Socket', 'FCM 알림 수신', notification);

        if (window.electronAPI) {
            const title = notification.title || '새 메시지';
            const body = notification.body || notification.message || '새 메시지가 도착했습니다';
            const data = notification.data || notification;
            window.electronAPI.showNotification(title, body, data);
        }

        events?.onNotification?.(notification);
    });

    return socket;
};

// 소켓 연결 해제
export const disconnectSocket = (): boolean => {
    if (socketInstance) {
        logDebug('Socket', '소켓 연결 해제 시작');
        socketInstance.disconnect();
        socketInstance = null;
        return true;
    }
    return false;
};

// 현재 소켓 인스턴스 가져오기
export const getSocketInstance = (): Socket | null => {
    return socketInstance;
};

// 콘솔에서 소켓 디버깅 함수 등록
export const registerSocketDebugCommands = () => {
    // @ts-ignore - 전역 객체 확장
    window.socketDebug = {
        initialize: (memberId: string, fcmToken?: string) => {
            return initializeSocket(memberId, fcmToken);
        },
        disconnect: disconnectSocket,
        getInstance: getSocketInstance,
        emit: (eventName: string, data?: any) => {
            if (!socketInstance) {
                console.error('소켓이 연결되지 않았습니다');
                return false;
            }
            socketInstance.emit(eventName, data);
            return true;
        },
        status: () => {
            return socketInstance ?
                { connected: socketInstance.connected, id: socketInstance.id } :
                { connected: false, id: null };
        }
    };

    console.log(`
    === Socket 디버깅 도구 사용법 ===
    
    콘솔에서 아래 명령어를 사용하여 소켓을 제어할 수 있습니다:
    
    1. 소켓 초기화 및 연결:
       > window.socketDebug.initialize('회원ID', 'FCM토큰')
    
    2. 소켓 연결 해제:
       > window.socketDebug.disconnect()
    
    3. 이벤트 전송:
       > window.socketDebug.emit('이벤트명', {데이터})
    
    4. 소켓 상태 확인:
       > window.socketDebug.status()
    
    5. 현재 소켓 인스턴스 가져오기:
       > window.socketDebug.getInstance()
    `);
};

// FCM 토큰으로 소켓 재연결하는 함수
export const reconnectWithToken = (memberId: string, fcmToken: string): Socket | null => {
    disconnectSocket();
    if (memberId && fcmToken) {
        return initializeSocket(memberId, fcmToken);
    }
    return null;
};

// 소켓 상태 모니터링 함수
export const monitorSocketStatus = (
    interval = 30000,
    onStatus?: (status: { connected: boolean, id: string | null }) => void
) => {
    const checkStatus = () => {
        const status = {
            connected: socketInstance?.connected || false,
            id: socketInstance?.id || null
        };

        logDebug('Socket-Monitor', '소켓 상태 확인', status);
        onStatus?.(status);

        return status;
    };

    // 초기 상태 확인
    checkStatus();

    // 정기적으로 상태 확인
    const intervalId = setInterval(checkStatus, interval);

    // 정리 함수 반환
    return () => clearInterval(intervalId);
};

// 소켓 재연결 시도 함수
export const attemptReconnect = () => {
    if (!socketInstance) {
        logDebug('Socket', '재연결 시도 실패: 소켓 인스턴스가 없음');
        return false;
    }

    if (socketInstance.connected) {
        logDebug('Socket', '이미 연결되어 있음, 재연결 필요 없음');
        return true;
    }

    try {
        logDebug('Socket', '소켓 재연결 시도 중...');
        socketInstance.connect();
        return true;
    } catch (error) {
        logDebug('Socket', '소켓 재연결 오류', { error: (error as Error).message });
        return false;
    }
};

// 소켓 연결 상태에 따라 자동으로 재연결하는 함수
export const setupAutoReconnect = (checkInterval = 30000) => {
    const intervalId = setInterval(() => {
        if (socketInstance && !socketInstance.connected) {
            logDebug('Socket-AutoReconnect', '연결이 끊어진 소켓 발견, 재연결 시도 중...');
            attemptReconnect();
        }
    }, checkInterval);

    return () => clearInterval(intervalId);
};

// FCM 토큰 등록 함수
export const registerFCMToken = (token: string) => {
    if (!socketInstance || !socketInstance.connected) {
        logDebug('Socket', 'FCM 토큰 등록 실패: 소켓이 연결되지 않음');
        return false;
    }

    if (!token || !token.startsWith('electron-fcm-')) {
        logDebug('Socket', 'FCM 토큰 등록 실패: 유효하지 않은 토큰', { token });
        return false;
    }

    try {
        socketInstance.emit('register-fcm-token', token);
        logDebug('Socket', 'FCM 토큰 등록됨', { token });
        return true;
    } catch (error) {
        logDebug('Socket', 'FCM 토큰 등록 오류', { error: (error as Error).message });
        return false;
    }
};

// 전역 타입 확장 - 기존 타입과 호환되게 수정
declare global {
    interface Window {
        // electronAPI는 이미 electron.d.ts에서 정의되어 있으므로 제거
        // electronAPI?: { ... } - 이 부분 제거

        socketDebug?: {
            initialize: (memberId: string, fcmToken?: string) => Socket;
            disconnect: () => boolean;
            getInstance: () => Socket | null;
            emit: (eventName: string, data?: any) => boolean;
            status: () => { connected: boolean; id: string | null };
        };
        _debugSocket?: Socket;
        _checkAppStatus?: () => { fcmToken: string | null; memberId: string | null; socketConnected: boolean; socketId: string | null };
    }
}