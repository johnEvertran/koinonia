// src/types/env.d.ts

/**
 * 환경 변수 타입 정의
 */

declare namespace NodeJS {
    interface ProcessEnv {
        // 기본 환경 변수
        NODE_ENV: 'development' | 'production' | 'test';

        // 앱 관련 환경 변수
        REACT_APP_VERSION: string;
        REACT_APP_API_URL: string;
        REACT_APP_BASE_URL: string;

        // FCM 관련 환경 변수
        REACT_APP_FCM_SERVER_KEY?: string;
        REACT_APP_FCM_VAPID_KEY?: string;

        // 개발 관련 환경 변수
        REACT_APP_DEBUG_MODE?: 'true' | 'false';
        REACT_APP_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';

        // Electron 특정 환경 변수
        ELECTRON_WEBPACK_APP_URL?: string;
        ELECTRON_START_URL?: string;
    }
}

// 환경 타입 (개발/프로덕션)
export type Environment = 'development' | 'production' | 'test';

// 로그 레벨 타입
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 플랫폼 타입
export type Platform = 'windows' | 'mac' | 'linux' | 'web';