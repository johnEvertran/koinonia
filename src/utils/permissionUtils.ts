// src/utils/permissionUtils.ts

/**
 * Electron 환경에서의 권한 관리
 * 웹 환경과 데스크톱 환경에서 필요한 권한 관리를 처리합니다.
 */

/**
 * 초기 권한 요청
 * Electron에서는 주로 알림 권한만 필요합니다.
 */
export const requestInitialPermissions = async (): Promise<boolean> => {
    try {
        console.log("[Permission] 초기 권한 요청 시작");

        // 알림 권한 확인 및 요청
        if ('Notification' in window) {
            let permissionStatus = Notification.permission;

            // 아직 결정되지 않은 경우 권한 요청
            if (permissionStatus === 'default') {
                permissionStatus = await Notification.requestPermission();
            }

            console.log("[Permission] 알림 권한 상태:", permissionStatus);

            // 거부된 경우 안내
            if (permissionStatus === 'denied') {
                console.log("[Permission] 알림 권한이 거부됨");

                if (window.electronAPI) {
                    const openSettings = confirm(
                        "앱을 제대로 사용하기 위해서는 알림 권한이 필요합니다. 설정에서 권한을 허용하시겠습니까?"
                    );

                    if (openSettings) {
                        // OS별 설정 페이지 열기
                        if (navigator.platform.includes('Mac')) {
                            await window.electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.notifications');
                        } else if (navigator.platform.includes('Win')) {
                            await window.electronAPI.openExternal('ms-settings:notifications');
                        } else {
                            await window.electronAPI.openExternal('about:preferences#privacy');
                        }
                    }
                }

                return false;
            }

            return permissionStatus === 'granted';
        }

        // Notification API가 없는 환경
        console.log("[Permission] 알림 API를 지원하지 않는 환경");
        return true;

    } catch (error) {
        console.warn("[Permission] 권한 요청 중 오류:", error);
        return false;
    }
};

/**
 * 스토리지 권한 요청
 * Electron 데스크톱 환경에서는 별도의 스토리지 권한이 필요 없습니다.
 */
export const requestStoragePermission = async (): Promise<boolean> => {
    // Electron에서는 기본적으로 파일 시스템 접근이 가능하므로 항상 true 반환
    console.log("[Permission] Electron 환경에서는 별도의 스토리지 권한이 필요 없음");
    return true;
};

/**
 * 미디어 권한 요청 (카메라, 마이크)
 * 필요한 경우 브라우저의 미디어 장치 접근 권한 요청
 */
export const requestMediaPermission = async (
    options: { video?: boolean; audio?: boolean } = { video: true, audio: true }
): Promise<boolean> => {
    try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            // 미디어 장치 접근 요청
            const stream = await navigator.mediaDevices.getUserMedia(options);

            // 스트림 정리 (이미 권한 획득 완료)
            stream.getTracks().forEach(track => track.stop());

            console.log("[Permission] 미디어 권한 획득 성공");
            return true;
        }

        console.log("[Permission] 미디어 API를 지원하지 않는 환경");
        return false;

    } catch (error) {
        console.warn("[Permission] 미디어 권한 요청 중 오류:", error);

        // 권한 거부 시 사용자에게 안내
        if (error instanceof Error && error.name === 'NotAllowedError') {
            if (window.electronAPI) {
                const openSettings = confirm(
                    "미디어 장치 접근 권한이 거부되었습니다. 설정에서 권한을 허용하시겠습니까?"
                );

                if (openSettings) {
                    // OS별 설정 페이지 열기
                    if (navigator.platform.includes('Mac')) {
                        await window.electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera');
                    } else if (navigator.platform.includes('Win')) {
                        await window.electronAPI.openExternal('ms-settings:privacy-webcam');
                    } else {
                        await window.electronAPI.openExternal('about:preferences#privacy');
                    }
                }
            }
        }

        return false;
    }
};

/**
 * 파일 저장 다이얼로그 열기
 * Electron에서 파일 저장 위치 선택 다이얼로그 표시
 */
export const showSaveDialog = async (
    options: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
    } = {}
): Promise<string | null> => {
    if (window.electronAPI) {
        return await window.electronAPI.saveFileDialog(options);
    }

    console.warn("[Permission] Electron API가 없음. 파일 저장 다이얼로그를 열 수 없습니다.");
    return null;
};

/**
 * 파일 열기 다이얼로그 열기
 * Electron에서 파일 선택 다이얼로그 표시
 */
export const showOpenDialog = async (
    options: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        multiple?: boolean;
    } = {}
): Promise<string[] | null> => {
    if (window.electronAPI) {
        return await window.electronAPI.openFileDialog(options);
    }

    console.warn("[Permission] Electron API가 없음. 파일 열기 다이얼로그를 열 수 없습니다.");
    return null;
};

/**
 * 폴더 선택 다이얼로그 열기
 * Electron에서 폴더 선택 다이얼로그 표시
 */
export const showSelectFolderDialog = async (
    options: {
        title?: string;
    } = {}
): Promise<string | null> => {
    if (window.electronAPI) {
        return await window.electronAPI.openDirectoryDialog(options);
    }

    console.warn("[Permission] Electron API가 없음. 폴더 선택 다이얼로그를 열 수 없습니다.");
    return null;
};

/**
 * 현재 권한 상태 확인
 * 현재 사용 가능한 권한 상태를 반환합니다.
 */
export const checkPermissions = async (): Promise<{
    notifications: string;
    media?: { video: boolean; audio: boolean };
}> => {
    const result: any = {
        notifications: 'Notification' in window ? Notification.permission : 'unsupported'
    };

    // 미디어 장치 권한 확인 (지원되는 경우만)
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();

            // 카메라와 마이크 장치 확인
            const hasCamera = devices.some(device => device.kind === 'videoinput' && device.deviceId !== '');
            const hasMic = devices.some(device => device.kind === 'audioinput' && device.deviceId !== '');

            result.media = {
                video: hasCamera,
                audio: hasMic
            };
        } catch (error) {
            console.warn("[Permission] 미디어 장치 열거 중 오류:", error);
            result.media = {
                video: false,
                audio: false
            };
        }
    }

    return result;
};