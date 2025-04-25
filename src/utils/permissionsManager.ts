// src/utils/permissionsManager.ts
import { v4 as uuidv4 } from 'uuid';

// 설정 인터페이스
interface FCMConfig {
    onMessage?: (message: any) => void;
    onBackgroundMessage?: (message: any) => void;
    onNotification?: (notification: any) => void;
    handleNavigation?: (notification: any) => void;
}

// 결과 인터페이스
interface FCMInitResult {
    success: boolean;
    token?: string | null;
    error?: Error | any;
    unsubscribeMessage?: () => void;
    permissions?: any;
}

/**
 * Electron 환경에서 FCM 리스너 설정 함수
 * 실제 Firebase는 사용하지 않고 Electron 자체 알림 시스템으로 대체
 */
const setupFCMListeners = (config: FCMConfig = {}) => {
    // config가 undefined인 경우 빈 객체로 초기화
    const safeConfig = config || {};

    // 알림 클릭 이벤트 리스너 설정
    let unsubscribeClickListener: (() => void) | undefined;

    if (window.electronAPI) {
        // 알림 클릭 이벤트 리스너
        unsubscribeClickListener = window.electronAPI.onNotificationClicked(notification => {
            console.log('[FCM] 알림 클릭됨:', notification);

            if (safeConfig.onBackgroundMessage) {
                safeConfig.onBackgroundMessage({ data: notification });
            }

            if (safeConfig.handleNavigation) {
                safeConfig.handleNavigation({ data: notification });
            }
        });
    }

    // 언마운트 시 리스너 해제 함수 반환
    return () => {
        if (unsubscribeClickListener) {
            unsubscribeClickListener();
        }
    };
};

/**
 * Electron 환경에서 권한 및 FCM 초기화
 * React Native용 코드를 Electron에 맞게 변환
 */
export const initializePermissionsAndFCM = async (config: FCMConfig = {}): Promise<FCMInitResult> => {
    console.log('[Permission & FCM] 초기화 시작');

    try {
        // Electron 환경 확인
        if (window.electronAPI) {
            console.log('[Permission & FCM] Electron 환경 감지됨');

            // 1. 알림 권한 확인/요청 (웹 환경에서도 필요)
            let notificationPermission = 'default';

            if ('Notification' in window) {
                notificationPermission = Notification.permission;

                // 권한이 결정되지 않은 경우 요청
                if (notificationPermission === 'default') {
                    notificationPermission = await Notification.requestPermission();
                }

                console.log('[Permission] 알림 권한 상태:', notificationPermission);
            }

            // 권한이 거부된 경우 처리
            if (notificationPermission === 'denied') {
                console.log('[Permission] 알림 권한 거부됨');

                // 브라우저에서 알림 권한 거부됨 알림
                if (confirm('알림 기능을 사용하려면 알림 권한이 필요합니다. 설정에서 권한을 허용하시겠습니까?')) {
                    // Electron에서는 설정 페이지 열기
                    await window.electronAPI.openExternal('about:preferences#privacy');
                }

                return {
                    success: false,
                    error: new Error('알림 권한 거부됨'),
                    permissions: {
                        notifications: 'denied'
                    }
                };
            }

            // 2. Electron FCM 토큰 생성/가져오기
            let fcmToken;

            try {
                // 저장된 토큰 확인
                const storedToken = localStorage.getItem('electron_fcm_token');

                if (storedToken) {
                    fcmToken = storedToken;
                    console.log('[FCM] 저장된 토큰 사용:', fcmToken);
                } else {
                    // 새 토큰 생성 (실제 FCM이 아닌 고유 ID 생성)
                    fcmToken = `electron-fcm-${uuidv4()}`;
                    localStorage.setItem('electron_fcm_token', fcmToken);
                    console.log('[FCM] 새 토큰 생성:', fcmToken);
                }
            } catch (tokenError) {
                console.error('[FCM] 토큰 생성/저장 오류:', tokenError);
                // 메모리에만 저장
                fcmToken = `electron-fcm-${uuidv4()}`;
            }

            // 3. FCM 리스너 설정
            const unsubscribeMessage = setupFCMListeners(config);

            // 4. 초기 알림 확인 (앱이 알림으로 시작된 경우)
            try {
                const initialData = await window.electronAPI.getInitialNotification();

                if (initialData) {
                    console.log('[FCM] 초기 알림 데이터:', initialData);

                    if (config.onBackgroundMessage) {
                        config.onBackgroundMessage({ data: initialData });
                    }

                    if (config.handleNavigation) {
                        config.handleNavigation({ data: initialData });
                    }
                }
            } catch (initialError) {
                console.warn('[FCM] 초기 알림 확인 오류:', initialError);
                // 계속 진행
            }

            return {
                success: true,
                token: fcmToken,
                unsubscribeMessage,
                permissions: {
                    notifications: notificationPermission
                }
            };
        }
        // 웹 환경 (Electron API 없음)
        else {
            console.log('[Permission & FCM] 웹 환경 감지됨');

            // 웹 환경에서는 제한된 기능만 지원
            let webNotificationPermission = 'default';

            if ('Notification' in window) {
                webNotificationPermission = Notification.permission;

                if (webNotificationPermission === 'default') {
                    webNotificationPermission = await Notification.requestPermission();
                }
            }

            // 웹용 임시 토큰 생성 (실제 FCM 아님)
            const webToken = `web-${uuidv4().substring(0, 8)}`;

            return {
                success: webNotificationPermission === 'granted',
                token: webNotificationPermission === 'granted' ? webToken : null,
                permissions: {
                    notifications: webNotificationPermission
                }
            };
        }
    } catch (error) {
        console.error('[Permission & FCM] 초기화 오류:', error);
        return {
            success: false,
            error
        };
    }
};

/**
 * 시스템 알림 표시
 * @param title 알림 제목
 * @param body 알림 내용
 * @param data 추가 데이터
 */
export const showNotification = (title: string, body: string, data: any = {}): boolean => {
    try {
        // Electron 환경 확인
        if (window.electronAPI) {
            // Electron 알림 API 사용
            window.electronAPI.showNotification(title, body, data);
            return true;
        }
        // 웹 환경에서 표준 알림 API 사용
        else if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, { body });

            // 알림 클릭 처리
            notification.onclick = () => {
                console.log('[Notification] 웹 알림 클릭됨:', data);
                // 필요한 처리 추가
            };

            return true;
        }

        console.warn('[Notification] 알림을 표시할 수 없음');
        return false;
    } catch (error) {
        console.error('[Notification] 알림 표시 오류:', error);
        return false;
    }
};

/**
 * 권한 확인 함수
 * @returns 권한 상태 객체
 */
export const checkPermissions = async (): Promise<{ notifications: string }> => {
    // Electron에서는 간소화된 권한 확인
    if ('Notification' in window) {
        return {
            notifications: Notification.permission
        };
    }

    return {
        notifications: 'unsupported'
    };
};

/**
 * 권한 요청 함수
 * @returns 권한 부여 성공 여부
 */
export const requestPermissions = async (): Promise<boolean> => {
    try {
        if ('Notification' in window && Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }

        return Notification.permission === 'granted';
    } catch (error) {
        console.error('[Permission] 권한 요청 오류:', error);
        return false;
    }
};