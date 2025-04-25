// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// React 18 방식으로 루트 생성 및 렌더링
const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// 데스크톱 앱에서는 ServiceWorker가 필요 없으므로 제외

// 콘솔 로그 설정 - 개발 환경에서만 자세한 로그 표시
if (process.env.NODE_ENV === 'production') {
    // 프로덕션 환경에서는 중요한 로그만 표시
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    // 로그 필터링 설정 (필요한 경우)
    console.log = (...args) => {
        // 중요한 로그는 유지 (예: '[FCM]', '[Error]' 등으로 시작하는 로그)
        if (
            typeof args[0] === 'string' &&
            (args[0].startsWith('[FCM]') ||
                args[0].startsWith('[Error]') ||
                args[0].startsWith('[Critical]'))
        ) {
            originalConsoleLog(...args);
        }
    };

    // 에러와 경고는 항상 표시
    console.error = (...args) => {
        originalConsoleError(...args);
    };

    console.warn = (...args) => {
        originalConsoleWarn(...args);
    };
}

// 글로벌 에러 핸들러 설정
window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);

    // Electron API가 있는 경우 에러 로깅 (선택 사항)
    if (window.electronAPI) {
        // window.electronAPI.logError(event.error.toString());
    }
});

// 미처리된 Promise 예외 처리
window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
});