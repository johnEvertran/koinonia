// src/screens/ChatRoom.tsx
import React, { useRef, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import CommonWebView from './CommonWebView.tsx';

interface ChatRoomProps {
    // React Router로 파라미터 처리
}

const ChatRoom: React.FC<ChatRoomProps> = () => {
    const { chatRoomID } = useParams<{ chatRoomID: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const webViewRef = useRef<any>(null);

    // location.state에서 timestamp 추출
    const state = location.state as { timestamp?: number } || {};
    const { timestamp = new Date().getTime() } = state;

    // URL에 타임스탬프 추가하여 캐시 방지
    const chatRoomUrl = `https://koinonia.evertran.com/chatRoom.html?chatRoomId=${chatRoomID}&t=${timestamp}`;

    useEffect(() => {
        console.log('ChatRoom mounted with URL:', chatRoomUrl);
        console.log('ChatRoom ID:', chatRoomID);

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
    }, [chatRoomUrl, chatRoomID, navigate]);

    const handleCustomMessage = async (message: any) => {
        try {
            console.log('ChatRoom received message:', message);

            // 파일 저장 처리
            if (message.type === 'saveFile') {
                if (window.electronAPI) {
                    await window.electronAPI.saveFile(message.payload.fileData, message.payload.fileName);
                } else {
                    // 웹 환경에서는 다운로드 링크 생성
                    const link = document.createElement('a');
                    link.href = message.payload.fileData;
                    link.download = message.payload.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }

            // 이미지 저장 처리
            else if (message.type === 'saveImage') {
                const { fileData, originalFileName, fileName } = message.payload;
                const imageFileName = originalFileName || fileName || `image_${Date.now()}.png`;

                if (window.electronAPI) {
                    await window.electronAPI.saveImage(fileData, imageFileName);
                } else {
                    // 웹 환경에서는 다운로드 링크 생성
                    const link = document.createElement('a');
                    link.href = fileData;
                    link.download = imageFileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }

            // 다른 유형의 메시지 처리
            else if (message.type === 'NAVIGATE_TO_HOME') {
                navigate('/');
            }
        } catch (error) {
            console.error('Error handling message in ChatRoom:', error);
        }
    };

    return (
        <CommonWebView
            ref={webViewRef}
            url={chatRoomUrl}
            navigate={navigate}
            handleCustomMessage={handleCustomMessage}
        />
    );
};

export default ChatRoom;