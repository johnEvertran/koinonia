// src/types/app.d.ts

/**
 * 앱 전반에서 사용되는 공통 타입 정의
 */

// FCM 알림 타입
export interface FCMNotification {
    title: string;
    body: string;
    data?: {
        chatRoomID?: string;
        chatRoomId?: string;
        roomId?: string;
        chat_id?: string;
        click_action?: string;
        targetUrl?: string;
        [key: string]: any;
    };
}

// 업데이트 확인 결과 타입
export interface UpdateCheckResult {
    currentVersion: string;
    latestVersion?: string;
    updateAvailable: boolean;
    updateUrl?: string;
    error?: string;
}

// 파일 저장 결과 타입
export interface SaveFileResult {
    success: boolean;
    filePath?: string;
    shareData?: string;
    error?: string;
}

// 회원 정보 타입
export interface MemberInfo {
    memberId: string;
    nickname?: string;
    profile?: string;
    serverFcmToken?: string;
    [key: string]: any;
}

// 웹뷰 메시지 타입
export interface WebViewMessage {
    type: string;
    payload?: any;
    [key: string]: any;
}

// 채팅방 정보 타입
export interface ChatRoomInfo {
    id: string;
    title: string;
    lastMessage?: string;
    timestamp?: number;
    unreadCount?: number;
    participants?: number;
    [key: string]: any;
}

// 공유 데이터 타입
export interface SharedData {
    type: 'file' | 'url' | 'text' | 'image';
    content?: string;
    uri?: string;
    data?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    isMap?: boolean;
    title?: string;
    address?: string;
    url?: string;
    [key: string]: any;
}

// 라우트 매개변수 타입
export interface RouteParams {
    chatRoomID?: string;
    url?: string;
    timestamp?: number;
    sharedData?: SharedData;
}