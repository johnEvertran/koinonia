// src/screens/CommonWebView.tsx
import React, { useRef, useState, useEffect, forwardRef } from 'react';
import './CommonWebView.css';

interface CommonWebViewProps {
    url: string;
    navigate?: (path: string, options?: any) => void;
    onLoadEnd?: () => void;
    handleCustomMessage?: (message: any) => void;
    injectedJavaScript?: string;
    enableBackHandler?: boolean;
    sharedData?: any;
    ignoreSharedData?: boolean;
    goHomeOnBack?: boolean;
}

const CommonWebView = forwardRef((props: CommonWebViewProps, ref: React.Ref<any>) => {
    const {
        url,
        navigate,
        onLoadEnd,
        handleCustomMessage,
        injectedJavaScript,
        sharedData,
        ignoreSharedData = false,
        goHomeOnBack = false,
    } = props;

    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [canGoBack, setCanGoBack] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    // React에서 ref 전달 처리
    React.useImperativeHandle(ref, () => ({
        injectJavaScript: (script: string) => {
            if (iframeRef.current && iframeRef.current.contentWindow) {
                try {
                    return iframeRef.current.contentWindow.eval(script);
                } catch (error) {
                    console.error('Script injection error:', error);
                    return false;
                }
            }
            return false;
        },
        goBack: () => {
            if (iframeRef.current && canGoBack) {
                iframeRef.current.contentWindow?.history.back();
                return true;
            }
            return false;
        }
    }));

    // 백스페이스/ESC 키 이벤트 처리
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // ESC 키가 눌렸을 때 모달 닫기
            if (event.key === 'Escape' && isModalOpen) {
                const script = `
          (function() {
            if (typeof closePhotoModal === 'function') {
              closePhotoModal();
              return true;
            }
            return false;
          })();
        `;
                const iframe = iframeRef.current;
                if (iframe && iframe.contentWindow) {
                    try {
                        iframe.contentWindow.eval(script);
                        setIsModalOpen(false);
                    } catch (error) {
                        console.error('Error closing modal:', error);
                    }
                }
            }

            // 백스페이스 키 처리
            if (event.key === 'Backspace' && !isModalOpen) {
                // 입력 필드에 포커스가 없을 때만 뒤로가기 처리
                const activeElement = document.activeElement;
                const isInputActive = activeElement instanceof HTMLInputElement ||
                    activeElement instanceof HTMLTextAreaElement ||
                    (activeElement instanceof HTMLElement && activeElement.isContentEditable);

                if (!isInputActive && canGoBack) {
                    const iframe = iframeRef.current;
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.history.back();
                        event.preventDefault();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.addEventListener('keydown', handleKeyDown);
        };
    }, [isModalOpen, canGoBack]);

    // 웹뷰 로드 완료 시 처리
    const handleIframeLoad = () => {
        setIsLoading(false);

        // 히스토리 상태 체크
        const iframe = iframeRef.current;
        if (iframe && iframe.contentWindow) {
            try {
                // 브라우저 히스토리 길이가 1보다 크면 뒤로 갈 수 있는 상태
                setCanGoBack(iframe.contentWindow.history.length > 1);
            } catch (error) {
                console.error('Error checking history state:', error);
            }
        }

        // 사용자 정의 자바스크립트 주입
        if (injectedJavaScript && iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.eval(injectedJavaScript);
            } catch (error) {
                console.error('Error injecting script:', error);
            }
        }

        // sharedData 처리
        if (sharedData && iframe && iframe.contentWindow) {
            try {
                let scriptContent;

                if (typeof sharedData === 'string' && sharedData.startsWith('data:image')) {
                    console.log('Processing base64 image');
                    scriptContent = `window.messageToForward = '${sharedData}';`;
                } else if (typeof sharedData === 'object' && sharedData.type === 'file') {
                    console.log('Processing File Data:', {
                        fileName: sharedData.fileName,
                        mimeType: sharedData.mimeType,
                        fileSize: sharedData.fileSize,
                        type: sharedData.type
                    });

                    scriptContent = `
            (function() {
              try {
                window.messageToForward = ${JSON.stringify(sharedData)};
                console.log('File data set successfully in HTML');
                return true;
              } catch(error) {
                console.error('Error setting file data:', error);
                return false;
              }
            })();
          `;
                } else if (typeof sharedData === 'object') {
                    console.log('Processing object data');
                    scriptContent = `window.messageToForward = ${JSON.stringify(sharedData)};`;
                }

                if (scriptContent) {
                    const script = `
            (function() {
              try {
                console.log('Setting messageToForward');
                ${scriptContent}
                if (typeof window.setMessageToForward === 'function') {
                  window.setMessageToForward(window.messageToForward)
                    .then(result => console.log('setMessageToForward success'))
                    .catch(error => console.error('setMessageToForward error:', error));
                }
                return true;
              } catch (error) {
                console.error('Error in script execution:', error);
                return false;
              }
            })();
          `;

                    iframe.contentWindow.eval(script);
                }
            } catch (error) {
                console.error('Error processing shared data:', error);
            }
        }

        // onLoadEnd 콜백 호출
        if (onLoadEnd) {
            onLoadEnd();
        }
    };

    // 메시지 이벤트 리스너 설정
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                // 메시지가 우리 웹뷰에서 온 것인지 확인
                if (iframeRef.current && event.source === iframeRef.current.contentWindow) {
                    let messageData;

                    // 메시지 형식에 따른 파싱
                    if (typeof event.data === 'string') {
                        try {
                            messageData = JSON.parse(event.data);
                        } catch (e) {
                            console.warn('Received non-JSON message:', event.data);
                            return;
                        }
                    } else {
                        messageData = event.data;
                    }

                    console.log('Received message from webview:', messageData);

                    // 모달 상태 추적
                    if (messageData.type === 'modalOpened') {
                        setIsModalOpen(true);
                    } else if (messageData.type === 'modalClosed') {
                        setIsModalOpen(false);
                    }

                    // 파일 저장 처리
                    if (messageData.type === 'saveFile') {
                        const { fileData, fileName } = messageData.payload;
                        handleSaveFile(fileData, fileName);
                    }

                    // 이미지 저장 처리
                    else if (messageData.type === 'saveImage') {
                        const { fileData, originalFileName, fileName } = messageData.payload;
                        const imageFileName = originalFileName || fileName || `image_${Date.now()}.png`;
                        handleSaveImage(fileData, imageFileName);
                    }

                    // 전화 걸기
                    else if (messageData.type === 'makeCall') {
                        window.open(`tel:${messageData.phoneNumber}`);
                    }

                    // SMS 보내기
                    else if (messageData.type === 'sendSMS') {
                        window.open(`sms:${messageData.phoneNumber}`);
                    }

                    // 사용자 정의 메시지 처리
                    else if (handleCustomMessage) {
                        handleCustomMessage(messageData);
                    }
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleCustomMessage]);

    // 파일 저장 처리 함수
    const handleSaveFile = (fileData: string, fileName: string) => {
        try {
            console.log('Saving file:', fileName);

            // Electron 환경에서는 Electron API를 통해 파일 저장
            if (window.electronAPI) {
                window.electronAPI.saveFile(fileData, fileName);
                return;
            }

            // 웹 환경에서는 다운로드 링크 생성
            const link = document.createElement('a');
            link.href = fileData;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error saving file:', error);
            alert('파일 저장 중 오류가 발생했습니다.');
        }
    };

    // 이미지 저장 처리 함수
    const handleSaveImage = (imageData: string, fileName: string) => {
        try {
            console.log('Saving image:', fileName);

            // Electron 환경에서는 Electron API를 통해 이미지 저장
            if (window.electronAPI) {
                window.electronAPI.saveImage(imageData, fileName);
                return;
            }

            // 웹 환경에서는 다운로드 링크 생성
            const link = document.createElement('a');
            link.href = imageData;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error saving image:', error);
            alert('이미지 저장 중 오류가 발생했습니다.');
        }
    };

    // iframe 빌드
    return (
        <div className="webview-container">
            <iframe
                ref={iframeRef}
                className="webview"
                src={url}
                onLoad={handleIframeLoad}
                title="Web Content"
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads"
            />
            {isLoading && (
                <div className="loading-container">
                    <div className="spinner"></div>
                </div>
            )}
        </div>
    );
});

CommonWebView.displayName = 'CommonWebView';

export default CommonWebView;