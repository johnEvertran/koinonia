// src/utils/fcmNavigationHelper.ts
import { NavigateFunction } from 'react-router-dom';

/**
 * FCM 알림 페이로드에서 채팅방 ID를 추출
 * @param remoteMessage FCM 알림 메시지 객체
 * @returns 채팅방 ID 또는 null
 */
export const extractChatRoomId = (remoteMessage: any): string | null => {
    if (!remoteMessage) return null;

    try {
        const data = remoteMessage.data || {};

        // 다양한 형태의 채팅방 ID 필드명 지원
        return data.chatRoomId ||
            data.chatRoomID ||
            data.roomId ||
            data.chat_id ||
            data.chat_room_id ||
            (data.params && data.params.roomId) ||
            null;
    } catch (error) {
        console.error('[FCM] 알림에서 채팅방 ID 추출 실패:', error);
        return null;
    }
};

/**
 * 알림에서 celebration 액션 확인
 * @param remoteMessage FCM 알림 메시지 객체
 * @returns { isCelebration: boolean, targetUrl: string | null }
 */
export const checkCelebrationAction = (remoteMessage: any): { isCelebration: boolean, targetUrl: string | null } => {
    if (!remoteMessage) return { isCelebration: false, targetUrl: null };

    try {
        const data = remoteMessage.data || {};

        const isCelebration = data.click_action === 'CELEBRATION_NOTIFICATION_CLICK';
        const targetUrl = data.targetUrl || 'https://koinonia.evertran.com/celebration';

        return { isCelebration, targetUrl };
    } catch (error) {
        console.error('[FCM] 알림에서 celebration 확인 실패:', error);
        return { isCelebration: false, targetUrl: null };
    }
};

/**
 * 알림 클릭 시 채팅방으로 네비게이션
 * @param remoteMessage FCM 알림 메시지 객체
 * @param navigate React Router의 navigate 함수
 * @param setInitialNotification 초기 알림 설정 함수 (앱 시작 시)
 */
export const handleNotificationNavigation = (
    remoteMessage: any,
    navigate?: NavigateFunction,
    setInitialNotification?: (notification: any) => void
) => {
    // Celebration 알림인지 확인
    const { isCelebration, targetUrl } = checkCelebrationAction(remoteMessage);

    if (isCelebration) {
        if (navigate) {
            console.log('[FCM] 네비게이션으로 축하 페이지 이동:', targetUrl);
            navigate('/celebrate', { state: { url: targetUrl } });
        } else if (setInitialNotification) {
            console.log('[FCM] 초기 알림으로 축하 페이지 설정');
            setInitialNotification(remoteMessage);
        }
        return;
    }

    // 채팅방 ID 추출
    const chatRoomId = extractChatRoomId(remoteMessage);

    if (!chatRoomId) {
        console.log('[FCM] 알림에 채팅방 ID가 없음');
        return;
    }

    console.log('[FCM] 알림에서 채팅방 ID 추출됨:', chatRoomId);

    // navigate 함수가 사용 가능한 경우
    if (navigate) {
        console.log('[FCM] 네비게이션으로 채팅방 이동:', chatRoomId);
        navigate(`/chatroom/${chatRoomId}`, {
            state: { timestamp: Date.now() }
        });
    }
    // 앱이 시작 중인 경우 (네비게이션이 아직 준비되지 않음)
    else if (setInitialNotification) {
        console.log('[FCM] 초기 알림으로 채팅방 설정:', chatRoomId);
        setInitialNotification(remoteMessage);
    }
};

/**
 * 알림을 통한 딥 링크 처리
 * @param url 딥 링크 URL
 * @param navigate React Router의 navigate 함수
 */
export const handleDeepLink = (
    url: string,
    navigate: NavigateFunction
) => {
    try {
        console.log('[FCM] 딥 링크 처리:', url);

        // URL 파싱
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

        // 채팅방 딥 링크 처리
        if (pathParts[0] === 'chatroom' && pathParts[1]) {
            const roomId = pathParts[1];
            console.log('[FCM] 채팅방 딥 링크 감지:', roomId);

            navigate(`/chatroom/${roomId}`, {
                state: { timestamp: Date.now() }
            });
            return true;
        }

        // 축하 페이지 딥 링크 처리
        if (pathParts[0] === 'celebration') {
            console.log('[FCM] 축하 페이지 딥 링크 감지');

            navigate('/celebrate', {
                state: { url: url }
            });
            return true;
        }

        console.log('[FCM] 처리할 수 없는 딥 링크:', url);
        return false;
    } catch (error) {
        console.error('[FCM] 딥 링크 처리 오류:', error);
        return false;
    }
};