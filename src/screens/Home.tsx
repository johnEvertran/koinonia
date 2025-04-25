// src/screens/Home.tsx
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '../utils/fcmUtils';
import CommonWebView from './CommonWebView.tsx';
import './Home.css';

interface HomeProps {
    fcmToken?: string | null;
    initialNotification?: any;
}

const Home: React.FC<HomeProps> = ({ fcmToken, initialNotification }) => {
    const navigate = useNavigate();
    const [url, setUrl] = useState('https://koinonia.evertran.com');
    const [memberID, setMemberID] = useState<string | null>(null);
    const [pendingSharedData, setPendingSharedData] = useState<any>(null);
    const [isWebViewReady, setIsWebViewReady] = useState(false);
    const [currentFcmToken, setCurrentFcmToken] = useState<string | null>(fcmToken || null);
    const isProcessingRef = useRef<boolean>(false);
    const initialNotificationProcessed = useRef<boolean>(false);

    // 초기 알림 처리
    useEffect(() => {
        const processInitialNotification = () => {
            // 이미 처리했거나 알림 데이터가 없는 경우 생략
            if (initialNotificationProcessed.current || !initialNotification) {
                return;
            }

            console.log('[Home] 초기 알림 처리:', JSON.stringify(initialNotification));

            try {
                const data = initialNotification.data || {};
                const chatRoomID = data.chatRoomID || data.chatRoomId || data.roomId || data.chat_id;

                if (chatRoomID) {
                    console.log('[Home] 초기 알림에서 채팅방으로 이동:', chatRoomID);

                    // 웹뷰가 준비되면 채팅방으로 이동
                    if (isWebViewReady) {
                        setTimeout(() => {
                            navigate(`/chatroom/${chatRoomID}`, {
                                state: { timestamp: Date.now() }
                            });
                            initialNotificationProcessed.current = true;
                        }, 1000);
                    } else {
                        console.log('[Home] 웹뷰가 준비되지 않음, 준비 후 이동 예정');
                    }
                }
            } catch (error) {
                console.error('[Home] 초기 알림 처리 중 오류:', error);
            }
        };

        // 컴포넌트 마운트 후 약간 지연시켜 처리
        const timer = setTimeout(processInitialNotification, 1000);

        return () => clearTimeout(timer);
    }, [initialNotification, isWebViewReady, navigate]);

    // 웹뷰가 준비되면 초기 알림 처리 재시도
    useEffect(() => {
        if (isWebViewReady && initialNotification && !initialNotificationProcessed.current) {
            const data = initialNotification.data || {};
            const chatRoomID = data.chatRoomID || data.chatRoomId || data.roomId || data.chat_id;

            if (chatRoomID) {
                console.log('[Home] 웹뷰 준비됨, 초기 알림에서 채팅방으로 이동:', chatRoomID);
                setTimeout(() => {
                    navigate(`/chatroom/${chatRoomID}`, {
                        state: { timestamp: Date.now() }
                    });
                    initialNotificationProcessed.current = true;
                }, 1000);
            }
        }
    }, [isWebViewReady, initialNotification, navigate]);

    // Electron API를 통한 알림 설정
    useEffect(() => {
        const setupNotifications = async () => {
            console.log('[Home] 알림 설정 중...');

            try {
                // Electron 환경 확인
                if (window.electronAPI) {
                    // 알림 클릭 이벤트 리스너 설정
                    const removeNotificationListener = window.electronAPI.onNotificationClicked((data) => {
                        console.log('[FCM] 알림 클릭됨:', JSON.stringify(data));

                        const chatRoomID = data.chatRoomID || data.chatRoomId || data.roomId || data.chat_id;

                        if (data.click_action === 'CELEBRATION_NOTIFICATION_CLICK') {
                            navigate('/celebrate', {
                                state: { url: data.targetUrl || 'https://koinonia.evertran.com/celebration' }
                            });
                            return;
                        }

                        if (chatRoomID) {
                            navigate(`/chatroom/${chatRoomID}`, {
                                state: { timestamp: Date.now() }
                            });
                        }
                    });

                    return () => {
                        removeNotificationListener();
                    };
                } else {
                    console.log('[Home] Electron 환경이 아님, 웹 알림 설정');

                    // 웹 환경에서의 알림 설정 (Notification API)
                    if ('Notification' in window) {
                        if (Notification.permission !== 'granted') {
                            const permission = await Notification.requestPermission();
                            console.log('[Home] 알림 권한:', permission);
                        }
                    }
                }
            } catch (error) {
                console.error('[Home] 알림 설정 중 오류:', error);
            }
        };

        setupNotifications();
    }, [navigate]);

    // 채팅방 선택 화면으로 이동하는 이벤트 처리
    useEffect(() => {
        const handleNavigateToChatRoomSelection = (sharedData: any) => {
            console.log('[Home] 채팅방 선택으로 이동 이벤트:', sharedData);
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            try {
                const timestamp = new Date().getTime();
                setUrl(`https://koinonia.evertran.com/chatRoomSelect?timestamp=${timestamp}`);
                setPendingSharedData(sharedData);
            } catch (error) {
                console.error('[Home] NavigateToChatRoomSelection 오류:', error);
            } finally {
                setTimeout(() => {
                    isProcessingRef.current = false;
                }, 1000);
            }
        };

        // 채팅방 선택 이벤트 예제 - Electron에서는 다른 방식으로 구현 필요
        // 예: window.addEventListener('navigate-to-chatroom-selection', ...)

        // 클린업 함수
        return () => {
            // 필요한 이벤트 리스너 제거
        };
    }, []);

    // 웹뷰 로드 완료 핸들러
    const handleWebViewLoadEnd = () => {
        setIsWebViewReady(true);
    };

    // 로그인 성공 처리
    const processLoginSuccess = async (message: any) => {
        try {
            const { memberId, serverFcmToken } = message.payload || {};
            console.log('[Home] 로그인 성공 처리 - fcmToken:', currentFcmToken);
            console.log('[Home] 로그인 성공 처리 - serverFcmToken:', serverFcmToken);
            console.log('[Home] 로그인 성공 처리 - memberId:', memberId);

            if (!memberId || String(memberId).trim() === '') {
                console.error('[Home] 유효하지 않은 memberId:', message.payload);
                return;
            }

            setMemberID(memberId);

            // FCM 토큰이 변경된 경우 서버에 업데이트
            if (currentFcmToken && currentFcmToken !== serverFcmToken) {
                try {
                    // Electron 환경에서는 서버 API를 직접 호출
                    const result = await fetch('https://your-server-api.com/update-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            token: currentFcmToken,
                            memberId: memberId
                        }),
                    });

                    console.log('[Home] 토큰 업데이트 결과:', await result.json());
                } catch (error) {
                    console.error('[Home] 토큰 업데이트 오류:', error);
                }
            } else {
                console.log('[Home] 토큰이 최신 상태이거나 사용할 수 없음');
            }
        } catch (error) {
            console.error('[Home] 로그인 성공 처리 중 오류:', error);
        }
    };

    // 웹뷰에서 받은 메시지 처리
    const handleCustomMessage = async (message: any) => {
        try {
            console.log('[Home] 웹뷰 메시지 수신:', JSON.stringify(message, null, 2));

            if (message.type === 'loginSuccess') {
                if (!isWebViewReady) {
                    console.log('[Home] 웹뷰가 준비되지 않음, 로그인 메시지 건너뜀');
                    return;
                }
                await processLoginSuccess(message);
            } else if (message.type === 'NAVIGATE_TO_CHATROOM') {
                navigate(`/chatroom/${message.chatRoomId}`, {
                    state: { timestamp: Date.now() }
                });
            } else if (message.type === 'CELEBRATION_NOTIFICATION_CLICK') {
                navigate('/celebrate', {
                    state: { url: message.targetUrl || 'https://koinonia.evertran.com/celebration' }
                });
            } else {
                console.log('[Home] 로그인이 아닌 메시지 수신:', message);
            }
        } catch (error) {
            console.error('[Home] 커스텀 메시지 처리 중 오류:', error);
        }
    };

    return (
        <div className="home-container">
            <CommonWebView
                url={url}
                navigate={navigate}
                handleCustomMessage={handleCustomMessage}
                sharedData={pendingSharedData}
                onLoadEnd={handleWebViewLoadEnd}
            />
        </div>
    );
};

export default Home;