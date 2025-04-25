// src/screens/Celebrate.tsx
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CommonWebView from './CommonWebView.tsx';

interface CelebrateProps {
    // React Router로 파라미터 처리
}

const Celebrate: React.FC<CelebrateProps> = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // location.state에서 url 추출
    const state = location.state as { url?: string } || {};
    const { url = 'https://koinonia.evertran.com/celebration' } = state;

    // 타임스탬프 추가하여 캐시 방지
    const celebrateUrl = `${url}?t=${new Date().getTime()}`;

    useEffect(() => {
        console.log('Celebrate mounted with URL:', celebrateUrl);

        // 뒤로가기 키 이벤트 리스너 설정
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                // 입력 필드에 포커스가 없을 때만 뒤로가기 처리
                const activeElement = document.activeElement;
                const isInputActive = activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement ||
                    (activeElement instanceof HTMLElement && activeElement.isContentEditable);

                if (!isInputActive) {
                    navigate('/');
                    e.preventDefault();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [celebrateUrl, navigate]);

    const handleCustomMessage = async (message: any) => {
        try {
            console.log('Celebrate received message:', message);

            // 필요한 경우 메시지 처리 로직 추가
            if (message.type === 'NAVIGATE_TO_HOME') {
                navigate('/');
            }
        } catch (error) {
            console.error('Error handling message in Celebrate:', error);
        }
    };

    return (
        <CommonWebView
            url={celebrateUrl}
            navigate={navigate}
            handleCustomMessage={handleCustomMessage}
        />
    );
};

export default Celebrate;