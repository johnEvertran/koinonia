/// <reference types="react-scripts" />

/**
 * React Scripts 타입 확장 파일
 * Create React App에서 자동으로 생성되는 파일이나, 필요한 사용자 정의 타입 선언을 추가할 수 있습니다.
 */

// SVG 이미지 가져오기를 위한 타입 선언
declare module '*.svg' {
    import * as React from 'react';

    export const ReactComponent: React.FunctionComponent<React.SVGProps<
        SVGSVGElement
    > & { title?: string }>;

    const src: string;
    export default src;
}

// PNG 이미지 가져오기를 위한 타입 선언
declare module '*.png' {
    const content: string;
    export default content;
}

// JPG 이미지 가져오기를 위한 타입 선언
declare module '*.jpg' {
    const content: string;
    export default content;
}

// JPEG 이미지 가져오기를 위한 타입 선언
declare module '*.jpeg' {
    const content: string;
    export default content;
}

// GIF 이미지 가져오기를 위한 타입 선언
declare module '*.gif' {
    const content: string;
    export default content;
}

// JSON 파일 가져오기를 위한 타입 선언
declare module '*.json' {
    const value: any;
    export default value;
}