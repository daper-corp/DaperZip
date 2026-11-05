// Korean is the source language; English is a lookup table keyed by the Korean text.
(function () {
  const EN = {
    "열기": "Open", "풀기": "Extract", "새로 압축": "New", "추가": "Add", "삭제": "Delete", "테스트": "Test",
    "보기": "View", "정보": "Info", "설정": "Settings", "검색": "Search", "이름": "Name", "크기": "Size",
    "압축 크기": "Packed", "수정한 날짜": "Modified", "종류": "Type", "파일 폴더": "Folder", "파일": "File",
    "압축 파일 열기": "Open archive", "압축 파일을 고릅니다": "Browse for an archive",
    "새로 압축하기": "Create archive", "파일과 폴더를 압축합니다": "Compress files and folders",
    "압축 풀기": "Extract", "압축 파일을 골라 바로 풉니다": "Pick archives and extract",
    "여기로 끌어다 놓으세요": "Drop files here",
    "압축 파일을 놓으면 열고, 다른 파일을 놓으면 새로 압축합니다.": "Drop an archive to open it, or other files to compress them.",
    "최근 파일": "Recent files", "놓으면 압축 파일에 추가합니다": "Drop to add to the archive",
    "놓으면 열거나 압축합니다": "Drop to open or compress",
    "여기에 풀기 (스마트)": "Smart extract here", "여기에 풀기": "Extract here",
    "'{name}' 폴더에 풀기": "Extract to '{name}'", "다른 폴더에 풀기...": "Extract to...",
    "선택한 항목 풀기...": "Extract selected...",
    "비밀번호": "Password", "비밀번호 입력": "Enter password", "비밀번호 확인": "Confirm password",
    "비밀번호 표시": "Show password", "비밀번호가 일치하지 않습니다.": "Passwords do not match.",
    "'{name}'은(는) 암호화되어 있습니다.": "'{name}' is encrypted.",
    "비밀번호가 틀렸습니다. 다시 입력하세요.": "Wrong password. Please try again.",
    "확인": "OK", "취소": "Cancel", "닫기": "Close", "찾아보기": "Browse", "예": "Yes", "아니요": "No",
    "압축 형식": "Format", "압축 레벨": "Level", "저장 (압축 안 함)": "Store", "빠름": "Fastest", "보통": "Normal",
    "높음": "Maximum", "최고": "Ultra", "분할 압축": "Split", "분할 안 함": "No split",
    "파일 이름도 암호화": "Encrypt file names", "AES-256 암호화 (권장)": "AES-256 encryption (recommended)",
    "끝나면 폴더 열기": "Open folder when done", "압축 파일 위치와 이름": "Archive location and name",
    "압축할 항목 {n}개": "{n} item(s) to compress", "압축": "Compress", "풀 위치": "Destination",
    "같은 이름의 파일이 있으면": "If a file already exists", "덮어쓰기": "Overwrite", "건너뛰기": "Skip",
    "이름 바꿔서 저장": "Keep both (rename)", "압축 푸는 중": "Extracting", "압축하는 중": "Compressing",
    "삭제하는 중": "Deleting", "검사하는 중": "Testing", "파일 준비 중": "Preparing files", "준비 중...": "Preparing...",
    "오류": "Error", "완료": "Done", "자세히": "Details",
    "압축 파일에 오류가 없습니다.": "No errors found in the archive.",
    "선택한 항목 {n}개를 압축 파일에서 삭제할까요?": "Delete {n} selected item(s) from the archive?",
    "항목 {n}개를 '{name}'에 추가할까요?": "Add {n} item(s) to '{name}'?",
    "이름 바꾸기": "Rename", "새 이름": "New name", "모두 선택": "Select all", "새 창": "New window",
    "압축 파일 정보": "Archive info", "형식": "Format", "파일 수": "Files", "폴더 수": "Folders",
    "원본 크기": "Original size", "압축률": "Ratio", "방식": "Method", "솔리드": "Solid", "암호화": "Encrypted",
    "경로": "Path", "주석": "Comment", "분할 압축 파일": "Multi-volume", "수정 가능": "Writable",
    "일반": "General", "언어": "Language", "시스템 언어": "System language", "테마": "Theme",
    "시스템 설정": "System", "밝게": "Light", "어둡게": "Dark", "엔진": "Engine",
    "7-Zip 경로 (비우면 자동)": "7-Zip path (empty = auto)",
    "ZIP 파일 이름 인코딩": "ZIP file name encoding", "자동 (권장)": "Auto (recommended)",
    "한국어 CP949 (한글이 깨질 때)": "Korean CP949 (for broken Korean names)",
    "열어 본 파일이 바뀌면 압축 파일에 반영할지 묻기": "Ask to update the archive when an opened file changes",
    "Windows 탐색기 통합": "Windows Explorer integration",
    "오른쪽 클릭 메뉴에 DaperZip 추가": "Add DaperZip to the right-click menu",
    "압축 파일 '연결 프로그램'에 DaperZip 등록": "Register DaperZip in 'Open with' for archives",
    "기본 앱 설정 열기": "Open default apps", "Windows에서만 사용할 수 있습니다.": "Available on Windows only.",
    "Mac/Linux에서는 Finder·파일 관리자의 '다음으로 열기'로 DaperZip을 고를 수 있습니다.": "On macOS/Linux, choose DaperZip from 'Open With' in Finder or your file manager.",
    "Windows 11에서는 '추가 옵션 표시' 안에 나타납니다.": "On Windows 11 it appears under 'Show more options'.",
    "7-Zip을 찾을 수 없습니다": "7-Zip not found",
    "항목 {n}개": "{n} items", "{n}개 선택": "{n} selected", "형식 {t}": "{t}",
    "'{name}' 파일이 바뀌었습니다. 압축 파일에도 반영할까요?": "'{name}' was modified. Update it in the archive?",
    "반영": "Update", "이 형식은 수정할 수 없습니다.": "This format cannot be modified.",
    "끌어서 꺼낼 준비가 되었습니다. 다시 끌어 놓으세요.": "Ready. Drag again to drop the files.",
    "검색 결과 없음": "No matches", "빈 폴더": "Empty folder", "상위 폴더": "Up", "뒤로": "Back", "앞으로": "Forward",
    "압축 파일": "Archives", "모든 파일": "All files", "압축할 파일 고르기": "Choose files to compress",
    "폴더 고르기": "Choose folder", "파일을 고르기": "Choose files", "폴더 추가": "Add folder",
    "파일 추가": "Add files", "압축 파일이 이미 있습니다. 파일을 추가할까요?": "The archive already exists. Add the files to it?",
    "DaperZip 정보": "About DaperZip", "버전": "Version",
    "압축 엔진: 7-Zip (LGPL)": "Engine: 7-Zip (LGPL)", "라이선스: MIT": "License: MIT",
    "압축 파일을 열 수 없습니다": "Cannot open archive", "작업 실패": "Operation failed",
    "취소했습니다.": "Cancelled.", "풀기 완료": "Extracted", "압축 완료": "Compressed",
    "폴더 열기": "Open folder", "새 이름을 입력하세요": "Enter a new name", "속성": "Properties",
    "선택한 항목": "Selected items",
    "복사": "Copy", "붙여넣기": "Paste", "붙여넣을 파일이 없습니다.": "No files on the clipboard.",
    "{n}개 항목을 복사했습니다. 탐색기에서 붙여넣기(Ctrl+V)하면 풀립니다.": "Copied {n} item(s). Paste (Ctrl+V) in your file manager to extract them.",
    "업데이트": "Update", "나중에": "Later", "이 버전 건너뛰기": "Skip this version", "현재 버전": "Current version",
    "새 버전 {v}이(가) 있습니다. 지금 업데이트할까요?": "Version {v} is available. Update now?",
    "업데이트 받는 중": "Downloading update", "업데이트를 확인할 수 없습니다.": "Could not check for updates.",
    "시작할 때 새 버전 확인": "Check for updates at startup", "지금 확인": "Check now", "최신 버전입니다.": "You have the latest version.",
    "모든 사용자용으로 설치되어 설치 프로그램이 관리합니다.": "Installed for all users; managed by the installer.",
    "파일 이름 (Mac 호환)": "File names (Mac compatibility)",
    "Mac에서 자모가 분리된 한글 이름을 정상으로 고치기 (NFC)": "Fix decomposed (NFD) names made on macOS",
    "Mac 전용 파일(.DS_Store, __MACOSX, ._*) 제외": "Skip macOS files (.DS_Store, __MACOSX, ._*)",
    "옛 Windows 방식으로 이름을 저장한 ZIP입니다. 한글이 깨지지 않도록 자동으로 변환했습니다.": "This ZIP stores names in a legacy Windows code page; DaperZip converted them automatically.", "전체": "All", "새로 고침": "Refresh", "탐색기에서 보기": "Show in folder",
  };
  let lang = "ko";
  window.i18n = {
    /** "system" follows the OS/browser language: Korean → ko, otherwise en. */
    set(l) {
      if (l !== "ko" && l !== "en") l = /^ko\b/i.test(navigator.language || "") ? "ko" : "en";
      lang = l;
      document.documentElement.lang = lang;
    },
    get lang() { return lang; },
  };
  window.t = function (s, vars) {
    let out = lang === "en" && EN[s] ? EN[s] : s;
    if (vars) for (const k in vars) out = out.split("{" + k + "}").join(vars[k]);
    return out;
  };
})();
