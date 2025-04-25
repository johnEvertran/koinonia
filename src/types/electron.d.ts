// src/types/electron.d.ts

/**
 * Electron API 타입 정의
 * 이 파일은 TypeScript에게 window.electronAPI 및 window.electronEvents의 타입을 알려줍니다.
 */

// 메인 프로세스에 요청을 보낼 수 있는 함수들
interface ElectronAPI {
    // 앱 초기화 이벤트 리스너
    onAppInitialized: (callback: (data: any) => void) => () => void;

    // 앱 버전 가져오기
    getAppVersion: () => Promise<string>;

    // FCM 토큰 저장 및 조회
    saveFCMToken: (token: string) => Promise<boolean>;
    getFCMToken: () => Promise<string | null>;

    // 시스템 알림 표시
    showNotification: (title: string, body: string, data?: any) => void;

    // 알림 클릭 이벤트 리스너
    onNotificationClicked: (callback: (data: any) => void) => () => void;

    // 업데이트 체크
    checkForUpdate: (silent?: boolean) => Promise<{
        currentVersion: string;
        latestVersion?: string;
        updateAvailable: boolean;
    }>;

    // 업데이트 이벤트 리스너
    onUpdateAvailable: (callback: (info: any) => void) => () => void;
    onUpdateDownloaded: (callback: (info: any) => void) => () => void;

    // 파일 처리 기능
    saveFile: (fileData: string, fileName: string) => Promise<boolean>;
    saveImage: (imageData: string, fileName: string) => Promise<boolean>;
    convertToBase64: (uri: string) => Promise<string>;

    // 파일 다이얼로그
    openFileDialog: (options?: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        multiple?: boolean;
    }) => Promise<string[] | null>;

    openDirectoryDialog: (options?: { title?: string }) => Promise<string | null>;

    saveFileDialog: (options?: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<string | null>;

    // 외부 링크 열기
    openExternal: (url: string) => Promise<boolean>;

    // 로그 기록 (선택적)
    logError?: (message: string, details?: any) => void;

    // 메인 프로세스에 로그 쓰기 요청
    writeLog: (message: string) => void;
}

// 메인 프로세스로부터 이벤트를 수신할 수 있는 리스너들
interface ElectronEvents {
    // 앱 초기화 데이터
    onAppInitialized: (callback: (data: any) => void) => () => void;

    // 알림 클릭
    onNotificationClicked: (callback: (data: any) => void) => () => void;

    // FCM 토큰 업데이트
    onUpdateFCMToken: (callback: (data: { token: string; memberId: string }) => void) => () => void;

    // 업데이트 가능 이벤트
    onUpdateAvailable: (callback: (info: any) => void) => () => void;

    // 업데이트 다운로드 완료 이벤트
    onUpdateDownloaded: (callback: (info: any) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        electronEvents?: ElectronEvents;
        fs?: {
            readFile: (path: string, options?: { encoding?: string }) => Promise<any>;
            writeFile: (path: string, data: any, options?: { encoding?: string }) => Promise<void>;
        };
    }
}

export { };
