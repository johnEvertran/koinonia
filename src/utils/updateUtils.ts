// src/utils/updateUtils.ts

interface UpdateCheckResult {
    currentVersion: string;
    latestVersion?: string;
    updateAvailable: boolean;
    updateUrl?: string;
    error?: string;
}

// 디버깅 로그 함수
const logDebug = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][Update-Utils-Debug] ${message}`, data !== undefined ? data : '');
};

// 업데이트 확인 간격 (24시간)
const UPDATE_INTERVAL = 24 * 60 * 60 * 1000;

// 최신 버전 정보를 가져오는 API URL
const LATEST_VERSION_API = 'https://koinonia.evertran.com/api/latest-version';

/**
 * 앱 업데이트 확인 함수
 * @param silent true인 경우 사용자에게 알림을 표시하지 않음
 * @returns 업데이트 확인 결과
 */
export const checkForUpdate = async (silent: boolean = false): Promise<UpdateCheckResult> => {
    try {
        logDebug('업데이트 확인 시작', { silent });

        // Electron 환경 체크
        if (window.electronAPI) {
            // localStorage에서 마지막 업데이트 확인 시간 가져오기
            const cached = localStorage.getItem('lastUpdateCheck');
            const now = Date.now();
            logDebug('캐시 데이터 확인', { cached: cached ? '있음' : '없음' });

            // 현재 앱 버전 가져오기
            const currentVersion = await window.electronAPI.getAppVersion();
            logDebug('현재 앱 버전:', currentVersion);

            // 캐시된 결과가 있고 아직 유효한 경우
            if (cached) {
                const cacheData = JSON.parse(cached);
                const cacheAge = now - cacheData.timestamp;
                logDebug('캐시 데이터 분석', {
                    cacheTimestamp: new Date(cacheData.timestamp).toISOString(),
                    cacheAge: `${Math.floor(cacheAge / 1000 / 60 / 60)}시간 ${Math.floor((cacheAge / 1000 / 60) % 60)}분`,
                    latestVersion: cacheData.latestVersion,
                    updateUrl: cacheData.updateUrl
                });

                if (cacheAge < UPDATE_INTERVAL) {
                    logDebug('캐시된 결과 사용 (24시간 이내)');

                    const needsUpdate = cacheData.latestVersion &&
                        compareVersions(currentVersion, cacheData.latestVersion) < 0;

                    logDebug('업데이트 필요 여부 확인', {
                        needsUpdate,
                        currentVersion,
                        latestVersion: cacheData.latestVersion,
                        compareResult: cacheData.latestVersion ?
                            compareVersions(currentVersion, cacheData.latestVersion) : 'N/A'
                    });

                    if (needsUpdate && !silent) {
                        logDebug('업데이트 알림 표시', { updateUrl: cacheData.updateUrl });
                        showUpdateAlert(cacheData.updateUrl);
                    }

                    return {
                        currentVersion,
                        latestVersion: cacheData.latestVersion,
                        updateAvailable: needsUpdate,
                        updateUrl: cacheData.updateUrl
                    };
                } else {
                    logDebug('캐시 만료됨, 새로운 업데이트 확인 필요');
                }
            }

            // 캐시가 없거나 만료된 경우 API 호출
            try {
                logDebug('API 호출 시작', { url: LATEST_VERSION_API });
                const startTime = Date.now();

                const response = await fetch(LATEST_VERSION_API);
                const elapsed = Date.now() - startTime;

                logDebug(`API 응답 (${elapsed}ms)`, {
                    status: response.status,
                    ok: response.ok,
                    contentType: response.headers.get('content-type')
                });

                if (!response.ok) {
                    throw new Error('API 응답 오류: ' + response.status);
                }

                const data = await response.json();
                logDebug('API 응답 데이터', data);

                const { latestVersion, updateUrl } = data;

                // 버전 비교
                const compareResult = compareVersions(currentVersion, latestVersion);
                const needsUpdate = compareResult < 0;

                logDebug('버전 비교 결과', {
                    currentVersion,
                    latestVersion,
                    compareResult,
                    needsUpdate
                });

                // 캐시 저장
                const cacheData = {
                    timestamp: now,
                    latestVersion,
                    updateUrl,
                };
                localStorage.setItem('lastUpdateCheck', JSON.stringify(cacheData));
                logDebug('업데이트 정보 캐시 저장됨');

                // 업데이트가 필요하고 silent 모드가 아니면 알림 표시
                if (needsUpdate && !silent) {
                    logDebug('업데이트 알림 표시', { updateUrl });
                    showUpdateAlert(updateUrl);
                }

                return {
                    currentVersion,
                    latestVersion,
                    updateAvailable: needsUpdate,
                    updateUrl
                };
            } catch (apiError) {
                const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
                logDebug('API 호출 오류:', errorMessage);

                // 이전 캐시된 결과가 있다면 그것을 사용
                if (cached) {
                    logDebug('API 오류로 캐시된 데이터 사용');
                    const cacheData = JSON.parse(cached);

                    const needsUpdate = cacheData.latestVersion &&
                        compareVersions(currentVersion, cacheData.latestVersion) < 0;

                    return {
                        currentVersion,
                        latestVersion: cacheData.latestVersion,
                        updateAvailable: needsUpdate,
                        updateUrl: cacheData.updateUrl,
                        error: 'API 오류, 캐시된 결과 사용'
                    };
                }

                throw apiError;
            }
        } else {
            // 웹 환경에서는 버전 체크 불가능
            logDebug('웹 환경에서는 버전 확인이 제한됨');
            return {
                currentVersion: '1.0.0', // 웹 환경에서는 버전 정보 없음
                updateAvailable: false
            };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('업데이트 확인 오류:', errorMessage);

        return {
            currentVersion: await getCurrentVersion(),
            updateAvailable: false,
            error: errorMessage
        };
    }
};

/**
 * 현재 앱 버전 가져오기
 */
const getCurrentVersion = async (): Promise<string> => {
    if (window.electronAPI) {
        try {
            logDebug('현재 앱 버전 요청');
            const version = await window.electronAPI.getAppVersion();
            logDebug('현재 앱 버전 응답:', version);
            return version;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logDebug('버전 정보 가져오기 오류:', errorMessage);
        }
    }
    logDebug('기본 버전 사용: 1.0.0');
    return '1.0.0'; // 기본값
};

/**
 * 버전 문자열 비교 함수
 * @returns 음수: v1 < v2, 0: v1 == v2, 양수: v1 > v2
 */
const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = i < parts1.length ? parts1[i] : 0;
        const part2 = i < parts2.length ? parts2[i] : 0;

        if (part1 !== part2) {
            return part1 - part2;
        }
    }

    return 0;
};

/**
 * 업데이트 알림 표시
 */
const showUpdateAlert = (updateUrl: string | { windows: string, mac: string }) => {
    if (!window.electronAPI) {
        logDebug('Electron API 없음, 업데이트 알림을 표시할 수 없음');
        return;
    }

    // 플랫폼에 맞는 URL 선택
    let url: string;
    if (typeof updateUrl === 'string') {
        url = updateUrl;
    } else {
        // 플랫폼 감지 (OS 정보는 preload.js를 통해 제공됨)
        const platform = navigator.platform.toLowerCase();
        url = platform.includes('mac') ? updateUrl.mac : updateUrl.windows;
        logDebug('플랫폼별 URL 선택', { platform, url });
    }

    logDebug('업데이트 알림 표시', { url });

    // window.confirm() 형식으로 변경하거나, Electron의 대화상자 API 사용
    if (window.confirm('새 버전이 사용 가능합니다. 지금 다운로드하시겠습니까?')) {
        logDebug('사용자가 업데이트 다운로드를 수락함');
        // 브라우저로 URL 열기
        window.electronAPI.openExternal(url)
            .then(() => logDebug('업데이트 URL 열기 성공'))
            .catch(err => logDebug('업데이트 URL 열기 실패', err));
    } else {
        logDebug('사용자가 업데이트 다운로드를 거부함');
    }
};

/**
 * 업데이트 리스너 설정
 * @param onUpdateAvailable 업데이트 가능 시 콜백
 * @param onUpdateDownloaded 업데이트 다운로드 완료 시 콜백
 * @returns 리스너 제거 함수
 */
export const setupUpdateListeners = (
    onUpdateAvailable?: (info: any) => void,
    onUpdateDownloaded?: (info: any) => void
): () => void => {
    logDebug('업데이트 이벤트 리스너 설정');

    // Electron 환경 체크와 electronEvents 존재 확인
    if (!window.electronAPI || !window.electronEvents) {
        logDebug('Electron 환경이 아니어서 업데이트 리스너를 설정할 수 없습니다.');
        return () => { };
    }

    // 업데이트 가능 이벤트 리스너
    let removeAvailableListener: () => void = () => { };
    if (onUpdateAvailable && window.electronEvents.onUpdateAvailable) {
        logDebug('업데이트 가능 이벤트 리스너 등록');
        removeAvailableListener = window.electronEvents.onUpdateAvailable((info) => {
            logDebug('업데이트 가능 이벤트 수신', info);
            onUpdateAvailable(info);
        });
    }

    // 업데이트 다운로드 완료 이벤트 리스너
    let removeDownloadedListener: () => void = () => { };
    if (onUpdateDownloaded && window.electronEvents.onUpdateDownloaded) {
        logDebug('업데이트 다운로드 완료 이벤트 리스너 등록');
        removeDownloadedListener = window.electronEvents.onUpdateDownloaded((info) => {
            logDebug('업데이트 다운로드 완료 이벤트 수신', info);
            onUpdateDownloaded(info);
        });
    }

    // 클린업 함수 반환
    return () => {
        logDebug('업데이트 이벤트 리스너 제거');
        removeAvailableListener();
        removeDownloadedListener();
    };
};

/**
 * 업데이트 확인 캐시 초기화
 */
export const resetUpdateCheck = (): void => {
    try {
        logDebug('업데이트 확인 캐시 초기화');
        localStorage.removeItem('lastUpdateCheck');
        logDebug('업데이트 확인 캐시 초기화 완료');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logDebug('캐시 초기화 오류:', errorMessage);
    }
};

// 외부에서 사용할 수 있는 유틸리티 함수들 내보내기
export default {
    checkForUpdate,
    setupUpdateListeners,
    resetUpdateCheck
};