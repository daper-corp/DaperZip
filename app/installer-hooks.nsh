; DaperZip installer hooks (Tauri NSIS).

; After install: add the Explorer right-click menu. A per-user install
; (under %LOCALAPPDATA%) registers it for the current user; an install for
; all users (Program Files, elevated) registers it for everyone.
!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$INSTDIR\DaperZip.exe" --register-shell'
!macroend

; Before uninstall: remove the Explorer menu and "Open with" registration.
!macro NSIS_HOOK_PREUNINSTALL
  ExecWait '"$INSTDIR\DaperZip.exe" --unregister-shell'
!macroend
