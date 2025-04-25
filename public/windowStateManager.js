// public/windowStateManager.js

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

/**
 * 창 상태 관리 모듈
 * - 창 크기와 위치를 저장하고 복원하는 기능 제공
 */
class WindowStateManager {
    constructor(options) {
        // 기본 옵션
        this.options = Object.assign({
            defaultWidth: 412,   // 기본 너비
            defaultHeight: 850,  // 기본 높이
            fileName: 'window-state.json' // 상태 저장 파일명
        }, options);

        // 상태 파일 경로
        this.filePath = path.join(app.getPath('userData'), this.options.fileName);

        // 상태 초기화 (기본값으로)
        this.state = {
            width: this.options.defaultWidth,
            height: this.options.defaultHeight
        };

        // 저장된 상태 로드
        this.loadState();
    }

    /**
     * 저장된 창 상태 불러오기
     */
    loadState() {
        try {
            if (fs.existsSync(this.filePath)) {
                const savedState = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));

                // 저장된 값이 유효한지 확인
                if (savedState.width && savedState.height) {
                    // 최소 크기 제한 적용
                    this.state.width = Math.max(savedState.width, 320);
                    this.state.height = Math.max(savedState.height, 500);
                }
            }
        } catch (error) {
            console.error('창 상태 불러오기 실패:', error);
            // 오류 발생 시 기본값 사용
        }

        return this.state;
    }

    /**
     * 현재 창 상태 저장
     * @param {Electron.BrowserWindow} win - 브라우저 창
     */
    saveState(win) {
        if (!win) return;

        try {
            // 창이 최대화되어 있지 않은 경우에만 크기 저장
            if (!win.isMaximized() && !win.isMinimized() && !win.isFullScreen()) {
                const bounds = win.getBounds();
                this.state.width = bounds.width;
                this.state.height = bounds.height;
            }

            // 파일에 상태 저장
            fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('창 상태 저장 실패:', error);
        }
    }
}

module.exports = WindowStateManager;