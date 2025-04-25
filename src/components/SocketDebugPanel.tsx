// src/components/SocketDebugPanel.tsx
import React, { useState, useEffect } from 'react';
import { getSocketInstance, initializeSocket, disconnectSocket, registerSocketDebugCommands } from '../utils/socketUtils';

interface SocketDebugPanelProps {
    memberId: string | null;
    fcmToken: string | null;
}

const SocketDebugPanel: React.FC<SocketDebugPanelProps> = ({ memberId, fcmToken }) => {
    const [isVisible, setIsVisible] = useState<boolean>(false);
    const [currentMemberId, setCurrentMemberId] = useState<string>(memberId || '');
    const [currentFcmToken, setCurrentFcmToken] = useState<string>(fcmToken || '');
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [socketId, setSocketId] = useState<string | null>(null);
    const [eventName, setEventName] = useState<string>('');
    const [eventData, setEventData] = useState<string>('');
    const [logs, setLogs] = useState<string[]>([]);

    // 컴포넌트 마운트 시 디버그 명령어 등록
    useEffect(() => {
        registerSocketDebugCommands();

        // 현재 소켓 상태 확인
        const socket = getSocketInstance();
        if (socket) {
            setIsConnected(socket.connected);
            setSocketId(socket.id || null);
        }

        // 토큰 값 설정
        if (memberId) setCurrentMemberId(memberId);
        if (fcmToken) setCurrentFcmToken(fcmToken);

        return () => {
            // 컴포넌트 언마운트 시 정리 작업
        };
    }, [memberId, fcmToken]);

    // 소켓 연결 함수
    const handleConnect = () => {
        if (!currentMemberId) {
            addLog('회원 ID를 입력하세요', 'error');
            return;
        }

        try {
            const socket = initializeSocket(currentMemberId, currentFcmToken, {
                onConnect: (s) => {
                    setIsConnected(true);
                    setSocketId(s.id);
                    addLog(`소켓 연결 성공: ${s.id}`, 'success');
                },
                onDisconnect: (reason) => {
                    setIsConnected(false);
                    setSocketId(null);
                    addLog(`소켓 연결 종료: ${reason}`);
                },
                onError: (error) => {
                    setIsConnected(false);
                    addLog(`소켓 연결 오류: ${error.message}`, 'error');
                }
            });

            addLog('소켓 연결 시도 중...');
        } catch (error) {
            addLog(`소켓 초기화 오류: ${(error as Error).message}`, 'error');
        }
    };

    // 소켓 연결 해제 함수
    const handleDisconnect = () => {
        const result = disconnectSocket();
        if (result) {
            setIsConnected(false);
            setSocketId(null);
            addLog('소켓 연결이 해제되었습니다');
        } else {
            addLog('연결된 소켓이 없습니다', 'warn');
        }
    };

    // 이벤트 전송 함수
    const handleEmitEvent = () => {
        const socket = getSocketInstance();
        if (!socket) {
            addLog('소켓이 연결되지 않았습니다', 'error');
            return;
        }

        if (!eventName) {
            addLog('이벤트 이름을 입력하세요', 'error');
            return;
        }

        try {
            const data = eventData ? JSON.parse(eventData) : null;
            if (data) {
                socket.emit(eventName, data);
                addLog(`이벤트 전송: ${eventName} - ${eventData}`);
            } else {
                socket.emit(eventName);
                addLog(`이벤트 전송: ${eventName} (데이터 없음)`);
            }
        } catch (error) {
            addLog(`JSON 파싱 오류: ${(error as Error).message}`, 'error');
        }
    };

    // 로그 추가 함수
    const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${message}`;
        setLogs(prev => [...prev, formattedMessage]);

        // 콘솔에도 출력
        switch (type) {
            case 'error':
                console.error(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'success':
                console.log('%c' + formattedMessage, 'color: green');
                break;
            default:
                console.log(formattedMessage);
        }
    };

    // 패널 토글 함수
    const togglePanel = () => {
        setIsVisible(!isVisible);
    };

    return (
        <div className="socket-debug-panel" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 9999 }}>
            {!isVisible ? (
                <button
                    onClick={togglePanel}
                    style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        margin: '10px'
                    }}
                >
                    디버그 패널 열기
                </button>
            ) : (
                <div
                    style={{
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #ddd',
                        borderRadius: '5px',
                        padding: '15px',
                        margin: '10px',
                        width: '400px',
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <h3 style={{ margin: 0 }}>소켓 디버그 패널</h3>
                        <button
                            onClick={togglePanel}
                            style={{
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            닫기
                        </button>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ marginBottom: '5px' }}>
                            <label>소켓 상태: </label>
                            <span
                                style={{
                                    backgroundColor: isConnected ? '#28a745' : '#dc3545',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    fontSize: '0.9em'
                                }}
                            >
                                {isConnected ? '연결됨' : '연결 안됨'}
                            </span>
                            {socketId && <span style={{ marginLeft: '5px', fontSize: '0.8em' }}>({socketId})</span>}
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>회원 ID:</label>
                            <input
                                type="text"
                                value={currentMemberId}
                                onChange={(e) => setCurrentMemberId(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>FCM 토큰:</label>
                            <input
                                type="text"
                                value={currentFcmToken}
                                onChange={(e) => setCurrentFcmToken(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleConnect}
                                style={{
                                    backgroundColor: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flex: 1
                                }}
                            >
                                소켓 연결
                            </button>
                            <button
                                onClick={handleDisconnect}
                                style={{
                                    backgroundColor: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    flex: 1
                                }}
                            >
                                연결 해제
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>이벤트 전송</h4>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>이벤트 이름:</label>
                            <input
                                type="text"
                                value={eventName}
                                onChange={(e) => setEventName(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>이벤트 데이터 (JSON):</label>
                            <textarea
                                value={eventData}
                                onChange={(e) => setEventData(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ced4da',
                                    height: '100px'
                                }}
                            />
                        </div>

                        <button
                            onClick={handleEmitEvent}
                            style={{
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            이벤트 전송
                        </button>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                            <h4 style={{ margin: 0 }}>로그</h4>
                            <button
                                onClick={() => setLogs([])}
                                style={{
                                    backgroundColor: '#6c757d',
                                    color: 'white',
                                    border: 'none',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8em',
                                    cursor: 'pointer'
                                }}
                            >
                                지우기
                            </button>
                        </div>

                        <div
                            style={{
                                backgroundColor: '#343a40',
                                color: '#f8f9fa',
                                padding: '10px',
                                borderRadius: '4px',
                                height: '200px',
                                overflowY: 'scroll',
                                fontFamily: 'monospace',
                                fontSize: '0.9em'
                            }}
                        >
                            {logs.length === 0 ? (
                                <div style={{ color: '#adb5bd', fontStyle: 'italic' }}>로그가 없습니다</div>
                            ) : (
                                logs.map((log, index) => (
                                    <div key={index}>{log}</div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocketDebugPanel;