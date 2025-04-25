// src/utils/fileUtils.ts

/**
 * URI를 Base64로 변환하는 함수
 * Electron 환경에서는 Node.js의 fs 모듈을 활용할 수 있지만, 
 * 여기서는 브라우저 호환성을 위해 Fetch API를 사용합니다.
 */
export const convertUriToBase64 = async (uri: string): Promise<string | null> => {
    try {
        console.log('[FileUtils] URI를 Base64로 변환 시작:', uri);

        // Electron 환경 확인
        if (window.electronAPI) {
            return await window.electronAPI.convertToBase64(uri);
        }

        // 웹 환경에서는 Fetch API 사용
        const response = await fetch(uri);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // data:image/jpeg;base64, 부분 제거
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[FileUtils] URI를 Base64로 변환 중 오류:', error);
        return null;
    }
};

/**
 * Base64 데이터에서 파일 저장하기
 */
export const saveFileFromBase64 = async (base64Data: string, fileName: string): Promise<boolean> => {
    try {
        console.log('[FileUtils] Base64에서 파일 저장 시작:', fileName);

        // Electron 환경 확인
        if (window.electronAPI) {
            return await window.electronAPI.saveFile(base64Data, fileName);
        }

        // 웹 환경에서는 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;
    } catch (error) {
        console.error('[FileUtils] 파일 저장 중 오류:', error);
        return false;
    }
};

/**
 * Base64 데이터에서 이미지 저장하기
 */
export const saveImageBase64File = async (base64Data: string, fileName: string): Promise<boolean> => {
    try {
        console.log('[FileUtils] Base64에서 이미지 저장 시작:', fileName);

        // Electron 환경 확인
        if (window.electronAPI) {
            return await window.electronAPI.saveImage(base64Data, fileName);
        }

        // 웹 환경에서는 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = base64Data;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;
    } catch (error) {
        console.error('[FileUtils] 이미지 저장 중 오류:', error);
        return false;
    }
};

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Electron 환경에서 추가적인 파일 시스템 기능
export const electronFileUtils = {
    // 파일 선택 다이얼로그 열기
    openFileDialog: async (options: {
        title?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
        multiple?: boolean;
    } = {}): Promise<string[] | null> => {
        if (window.electronAPI) {
            return await window.electronAPI.openFileDialog(options);
        }
        return null;
    },

    // 디렉토리 선택 다이얼로그 열기
    openDirectoryDialog: async (options: {
        title?: string;
    } = {}): Promise<string | null> => {
        if (window.electronAPI) {
            return await window.electronAPI.openDirectoryDialog(options);
        }
        return null;
    },

    // 파일 저장 다이얼로그 열기
    saveFileDialog: async (options: {
        title?: string;
        defaultPath?: string;
        filters?: Array<{ name: string; extensions: string[] }>;
    } = {}): Promise<string | null> => {
        if (window.electronAPI) {
            return await window.electronAPI.saveFileDialog(options);
        }
        return null;
    }
};