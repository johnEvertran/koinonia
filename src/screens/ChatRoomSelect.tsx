// src/screens/ChatRoomSelect.tsx
import React, { useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CommonWebView from './CommonWebView.tsx';

interface ChatRoomSelectProps {
  // 웹 앱이므로 React Router 사용
}

const ChatRoomSelect: React.FC<ChatRoomSelectProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const webViewRef = useRef<any>(null);
  const processedRef = useRef<boolean>(false);

  // location.state에서 전달된 데이터 추출
  const state = location.state as { sharedData?: any; timestamp?: number } || {};
  const { sharedData, timestamp = new Date().getTime() } = state;

  // URL에 타임스탬프 추가하여 캐시 방지
  const chatRoomSelectUrl = `https://koinonia.evertran.com/chatRoomSelect?t=${Date.now()}&timestamp=${timestamp}`;

  useEffect(() => {
    console.log('ChatRoomSelect mounted with URL:', chatRoomSelectUrl);
    console.log('Shared data:', sharedData);

    return () => {
      processedRef.current = false;
    };
  }, [chatRoomSelectUrl, sharedData]);

  const onLoadEnd = () => {
    if (sharedData && webViewRef.current && !processedRef.current) {
      processedRef.current = true;

      setTimeout(() => {
        try {
          let scriptContent;

          if (typeof sharedData === 'string' && sharedData.startsWith('data:image')) {
            console.log('Processing base64 image');
            scriptContent = `window.messageToForward = '${sharedData}';`;
          } else if (typeof sharedData === 'object' && sharedData.type === 'file') {
            const fileData = {
              type: 'file',
              uri: `data:${sharedData.mimeType};base64,${sharedData.data}`,
              fileName: sharedData.fileName,
              fileSize: sharedData.fileSize,
              mimeType: sharedData.mimeType
            };

            console.log('Processing File Data:', {
              fileName: fileData.fileName,
              mimeType: fileData.mimeType,
              fileSize: fileData.fileSize,
              type: fileData.type
            });

            scriptContent = `
              (function() {
                try {
                  window.messageToForward = ${JSON.stringify(fileData)};
                  console.log('File data set successfully in HTML');
                  return true;
                } catch(error) {
                  console.error('Error setting file data:', error);
                  return false;
                }
              })();
            `;
          } else if (typeof sharedData === 'object' && sharedData.type === 'url') {
            console.log('Processing URL data');
            scriptContent = `window.messageToForward = ${JSON.stringify(sharedData)};`;
          } else if (Array.isArray(sharedData)) {
            console.log('Processing multiple images');
            scriptContent = `window.messageToForward = ${JSON.stringify(sharedData)};`;
          } else {
            console.log('Processing other data type');
            scriptContent = `window.messageToForward = ${JSON.stringify(sharedData)};`;
          }

          if (scriptContent && webViewRef.current) {
            const script = `
              (function() {
                try {
                  console.log('Setting messageToForward in ChatRoomSelect');
                  ${scriptContent}
                  if (typeof window.setMessageToForward === 'function') {
                    window.setMessageToForward(window.messageToForward)
                      .then(result => console.log('setMessageToForward success'))
                      .catch(error => console.error('setMessageToForward error:', error));
                  }
                  return true;
                } catch (error) {
                  console.error('Error in script execution:', error);
                  processedRef.current = false;
                  return false;
                }
              })();
            `;

            webViewRef.current.injectJavaScript(script);
          }
        } catch (error) {
          console.error('Error in onLoadEnd:', error);
          processedRef.current = false;
        }
      }, 1000);
    }
  };

  const handleCustomMessage = (message: any) => {
    if (message.type === 'NAVIGATE_TO_CHATROOM') {
      navigate(`/chatroom/${message.chatRoomId}`, {
        state: {
          timestamp: new Date().getTime()
        }
      });
    }
  };

  // 뒤로가기 처리를 위한 키 이벤트 리스너 추가
  useEffect(() => {
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
  }, [navigate]);

  return (
    <CommonWebView
      ref={webViewRef}
      url={chatRoomSelectUrl}
      navigate={navigate}
      sharedData={sharedData}
      onLoadEnd={onLoadEnd}
      handleCustomMessage={handleCustomMessage}
      ignoreSharedData={true}  // 백버튼에서 sharedData 관련 분기는 무시
      goHomeOnBack={true}      // 뒤로 갈 페이지가 없으면 홈으로 이동
    />
  );
};

export default ChatRoomSelect;