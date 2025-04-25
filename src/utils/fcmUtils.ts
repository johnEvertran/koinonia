// src/utils/fcmUtils.ts

/**
 * FCM 관련 유틸리티 함수들
 */

// 타입 정의
type FCMConfig = {
    onMessage?: (message: any) => void;
    onToken?: (token: string) => void;
    onNotificationClicked?: (data: any) => void;
};

type FCMInitResult = {
    success: boolean;
    token?: string;
    error?: string;
};

// 디버깅 로그 함수
const logDebug = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][FCM-Utils-Debug] ${message}`, data !== undefined ? data : '');
};

/**
 * Electron FCM 초기화 함수
 */
export const initializeElectronFCM = async (config: FCMConfig): Promise<FCMInitResult> => {
    logDebug('Electron FCM 초기화 시작', config);

    try {
        // Electron 환경 체크
        if (!window.electronAPI) {
            logDebug('Electron API를 찾을 수 없음');
            return { success: false, error: 'Electron API를 찾을 수 없음' };
        }

        // FCM 토큰 가져오기
        let token = await window.electronAPI.getFCMToken();
        logDebug('기존 FCM 토큰 조회 결과:', token);

        // 토큰이 없으면 새로 생성
        if (!token) {
            logDebug('기존 토큰 없음, 새 토큰 생성');

            // 새 토큰 생성 로직
            const timestamp = Date.now();
            const randomChars = Math.random().toString(36).substring(2, 12);
            token = `electron-fcm-${timestamp}-${randomChars}`;

            logDebug('새로 생성한 토큰:', token);

            // 토큰 저장
            const success = await window.electronAPI.saveFCMToken(token);
            if (!success) {
                logDebug('토큰 저장 실패');
                return { success: false, error: '토큰 저장 실패' };
            }

            logDebug('토큰 저장 성공');
        }

        // 로컬 스토리지에도 저장 (웹뷰와 상태 공유)
        localStorage.setItem('fcm_token', token);
        logDebug('토큰을 localStorage에 저장:', token);

        // 토큰 콜백 호출
        if (config.onToken) {
            logDebug('onToken 콜백 호출:', token);
            config.onToken(token);
        }

        // 알림 클릭 이벤트 리스너 설정
        if (config.onNotificationClicked && window.electronEvents) {
            logDebug('알림 클릭 이벤트 리스너 등록');
            const removeListener = window.electronEvents.onNotificationClicked((data: any) => {
                logDebug('알림 클릭 이벤트 수신:', data);
                config.onNotificationClicked!(data);
            });

            // 클린업 함수 등록 (실제로는 사용하지 않음)
            window.addEventListener('beforeunload', () => {
                logDebug('알림 클릭 이벤트 리스너 제거 (beforeunload)');
                removeListener();
            });
        }

        logDebug('Electron FCM 초기화 완료');
        return { success: true, token };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('Electron FCM 초기화 오류:', errorMessage);
        return { success: false, error: errorMessage };
    }
};

/**
 * FCM 토큰을 서버에 등록하는 함수
 */
/**
 * FCM 토큰을 서버에 등록하는 함수
 */
export const sendTokenToServer = async (token: string, memberId: string): Promise<boolean> => {
    try {
        console.log('[FCM] 서버에 토큰 전송 시작:', { token, memberId });
        const response = await fetch('https://koinonia.evertran.com/api/members/update-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                token,
                memberId,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('[FCM] 서버에 토큰 전송 성공:', result);
        return true;
    } catch (error) {
        console.error('[FCM] 서버에 토큰 전송 실패:', error);
        return false;
    }
}
/**
 * FCM 토큰 유효성 확인
 */
export const validateFCMToken = (token: string | null): boolean => {
    if (!token) return false;

    // 기존 형식 (68afaede-6f72-47fd-b97c-45c5298c4577)과 
    // 새 형식 (1744922226288-7n7fwv12qla) 모두 허용
    const isOldFormat = /^electron-fcm-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token);
    const isNewFormat = /^electron-fcm-\d+-[a-z0-9]{10}$/.test(token);

    return isOldFormat || isNewFormat;
};

export default {
    initializeElectronFCM,
    sendTokenToServer,
    validateFCMToken
};