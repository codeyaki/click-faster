# Click Faster

모든 웹 페이지의 HTML 동영상에서 화면을 누르거나 클릭해 설정한 배속으로 빠르게 재생하는 브라우저 확장입니다.

## 주요 기능

- 기본 동작: 동영상 화면을 누르고 있는 동안 2배속으로 재생하고, 놓으면 원래 재생 속도로 복구합니다.
- 설정 가능한 배속: 1배속부터 16배속까지 0.1 단위로 조정합니다.
- 클릭 전환 모드: 한 번 클릭하면 빠른 속도로 전환하고 다시 클릭하면 원래 속도로 돌아갑니다.
- 전체 사이트 대상: `<all_urls>`와 `all_frames`로 주입되어 일반 페이지와 iframe 안의 HTML 동영상까지 처리합니다.
- 동영상 위에 다른 요소가 덮여 있어도 클릭 위치 아래의 동영상을 찾아 적용합니다.

## 설치

### GitHub Releases에서 설치

1. [최신 릴리스](https://github.com/codeyaki/click-faster/releases/latest)에서 `click-faster-버전-dev.zip` 파일을 내려받습니다.
2. ZIP 파일의 압축을 풉니다.
3. Chrome, Edge, Brave에서는 확장 관리 화면의 개발자 모드를 켜고 `압축해제된 확장 프로그램 로드`로 압축을 푼 폴더를 선택합니다.
4. Firefox에서는 `about:debugging#/runtime/this-firefox`에서 `임시 부가 기능 로드`를 누르고 압축을 푼 폴더의 `manifest.json`을 선택합니다.
5. 이미 열려 있던 동영상 페이지는 새로고침합니다.

### Chrome, Edge, Brave

1. 브라우저에서 확장 관리 화면을 엽니다.
2. 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램 로드`를 선택합니다.
4. 이 프로젝트 폴더를 선택합니다.

### Firefox

1. 주소창에 `about:debugging#/runtime/this-firefox`를 입력합니다.
2. `임시 부가 기능 로드`를 선택합니다.
3. 이 프로젝트의 `manifest.json` 파일을 선택합니다.

### Safari

Safari는 WebExtension 변환 과정이 필요합니다. Xcode의 Safari Web Extension Converter로 이 프로젝트를 변환한 뒤 서명해서 사용합니다.

## 사용

확장을 설치한 뒤 동영상 화면을 누르고 있으면 설정한 배속으로 재생됩니다. 팝업에서 배속, 작동 방식, 속도 표시 여부를 바꿀 수 있습니다.

## 개발

정적 WebExtension 프로젝트라 별도 번들링은 필요하지 않습니다.

```sh
npm test
```

아이콘과 릴리스 패키지를 다시 만들 때는 다음 명령을 사용합니다.

```sh
npm run generate:icons
npm run package:extension
```

`dist/click-faster-버전-dev.zip`은 GitHub Releases에서 내려받아 개발자 모드로 설치하는 사용자용 패키지입니다. `dist/click-faster-버전-store.zip`은 스토어 업로드용으로 `manifest.json`이 ZIP 최상위에 들어갑니다.

## 배포 준비 자료

- [개인정보 처리방침](PRIVACY.md)
- [스토어 등록 자료](docs/store-listing.md)

## 제한 사항

- 확장 프로그램이 주입될 수 없는 브라우저 내부 페이지, 확장 스토어, 일부 DRM 플레이어 페이지에서는 동작하지 않을 수 있습니다.
- HTML `<video>`가 아닌 자체 렌더링 플레이어는 브라우저가 제공하는 `playbackRate`를 직접 바꿀 수 없습니다.
