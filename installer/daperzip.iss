; DaperZip installer (Inno Setup 6).
;
; A single custom screen replaces the classic wizard:
;   install scope (all users = default / just me), location, Explorer menu,
;   desktop shortcut, and one big "Install" button; then progress and done.
;
; Build (CI does this):  ISCC /DAppVersion=0.1.1 installer\daperzip.iss
;
; Command-line switches (besides Inno's standard /SILENT, /VERYSILENT, /DIR=…):
;   /ALLUSERS | /CURRENTUSER   install scope (all users needs admin rights);
;                              interactive Setup without either asks for
;                              admin rights at start
;   /DZUPDATE                  started by DaperZip's updater: restart the app
;                              when done

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#define AppName "DaperZip"
#define AppExe "DaperZip.exe"
#define Root ".."

[Setup]
AppId={{13371C5E-DE99-47B0-8A62-96AC45691B98}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Daper
AppPublisherURL=https://dapercorp.com
AppSupportURL=https://zip.dapercorp.com
AppUpdatesURL=https://github.com/daper-corp/DaperZip/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableDirPage=yes
DisableReadyPage=yes
DisableFinishedPage=no
; An interactive Setup asks for administrator rights (UAC) as soon as it
; starts (see InitializeSetup) and the elevated copy installs for all users.
; If UAC is cancelled or refused, this window opens without elevation and
; installs "Just me". Silent runs (DaperZip's updater, winget, CI) skip this
; and choose the scope with /ALLUSERS or /CURRENTUSER.
; Note: Inno (6.4+) blocks [Code] from running the setup .exe itself before
; installing (error 5), which is what broke "all users" before; Setup re-runs
; itself through cmd.exe instead (RunSetupAgain).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
WizardSizePercent=115,113
SetupIconFile={#Root}\app\icons\icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
OutputDir={#Root}\dist
OutputBaseFilename={#AppName}_{#AppVersion}_x64-setup
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
ShowLanguageDialog=no
LanguageDetectionMethod=uilanguage

[Languages]
Name: "ko"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
ko.SetupTitle=DaperZip 설치
en.SetupTitle=DaperZip Setup
ko.Subtitle=버전 {#AppVersion} · 7-Zip 26.04 엔진
en.Subtitle=Version {#AppVersion} · 7-Zip 26.04 engine
ko.ScopeLabel=설치 대상
en.ScopeLabel=Install for
ko.ScopeAll=모든 사용자 (권장)
en.ScopeAll=All users (recommended)
ko.ScopeAllNote=관리자 권한으로 설치
en.ScopeAllNote=Requires administrator rights
ko.ScopeMe=나만 사용
en.ScopeMe=Just me
ko.ScopeMeNote=이 계정에만 설치
en.ScopeMeNote=Only this account
ko.DirLabel=설치 위치
en.DirLabel=Location
ko.Change=변경
en.Change=Change
ko.TaskMenu=탐색기 오른쪽 클릭 메뉴 추가
en.TaskMenu=Add to the Explorer right-click menu
ko.TaskDesktop=바탕 화면 바로 가기 만들기
en.TaskDesktop=Create a desktop shortcut
ko.Install=설치
en.Install=Install
ko.Footer=MIT 라이선스 · zip.dapercorp.com
en.Footer=MIT License · zip.dapercorp.com
ko.Installing=설치하는 중...
en.Installing=Installing...
ko.Done=설치가 끝났습니다
en.Done=Installation complete
ko.DoneNote=탐색기에서 압축 파일을 오른쪽 클릭하면 DaperZip 메뉴를 쓸 수 있습니다.
en.DoneNote=Right-click an archive in Explorer to use the DaperZip menu.
ko.Launch=DaperZip 실행
en.Launch=Open DaperZip
ko.Close=닫기
en.Close=Close
ko.NeedAdmin=관리자 권한을 얻지 못해 "나만 사용"으로 설치합니다. 모든 사용자에게 설치하려면 설치 프로그램을 다시 실행하고 사용자 계정 컨트롤에서 "예"를 누르세요.
en.NeedAdmin=Administrator rights were not granted, so DaperZip installs for this account only. To install for all users, run Setup again and click "Yes" in User Account Control.
ko.Failed=설치하지 못했습니다 (코드 %1).
en.Failed=Installation failed (code %1).
ko.Browse=설치할 폴더를 고르세요.
en.Browse=Choose the installation folder.
ko.SetDefault=기본 앱으로 설정
en.SetDefault=Set as default app
ko.SetDefaultNote=Windows 기본 앱 화면에서 DaperZip을 선택하면 압축 파일이 DaperZip으로 열립니다.
en.SetDefaultNote=Choose DaperZip in Windows Default apps to open archives with DaperZip.

[Tasks]
Name: "contextmenu"; Description: "{cm:TaskMenu}"
Name: "desktopicon"; Description: "{cm:TaskDesktop}"

[Files]
Source: "{#Root}\target\release\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Root}\vendor\7zip\windows-x64\7z.exe"; DestDir: "{app}\7zip"; Flags: ignoreversion
Source: "{#Root}\vendor\7zip\windows-x64\7z.dll"; DestDir: "{app}\7zip"; Flags: ignoreversion
Source: "{#Root}\vendor\7zip\License.txt"; DestDir: "{app}\7zip"; Flags: ignoreversion
Source: "{#Root}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Root}\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: NeedsWebView2
Source: "logo-52.bmp"; Flags: dontcopy
Source: "logo-78.bmp"; Flags: dontcopy
Source: "logo-104.bmp"; Flags: dontcopy

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; Parameters: "/silent /install"; StatusMsg: "WebView2"; Flags: waituntilterminated; Check: NeedsWebView2
; "Open with" + Default Apps registration (Windows still asks the user to
; choose the actual default). Writes HKCU for a per-user install and HKLM
; for an all-users install.
Filename: "{app}\{#AppExe}"; Parameters: "--register-assoc"; Flags: runhidden waituntilterminated
; The app registers the menu for this user (per-user install) or for
; everyone (Program Files install).
Filename: "{app}\{#AppExe}"; Parameters: "--register-shell"; Flags: runhidden waituntilterminated; Tasks: contextmenu
; After an update started from the app, bring the app back.
Filename: "{app}\{#AppExe}"; Flags: nowait runasoriginaluser; Check: IsUpdate

[UninstallRun]
Filename: "{app}\{#AppExe}"; Parameters: "--unregister-shell"; Flags: runhidden waituntilterminated; RunOnceId: "UnregisterShell"

[Code]
const
  WebView2Key = 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2KeyWow = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  UninstKey = 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{13371C5E-DE99-47B0-8A62-96AC45691B98}_is1';
  Accent = $ED6F2F;      // #2F6FED in BGR
  AccentSoft = $FEF3EE;  // #EEF3FE
  Ink = $30221C;         // #1C2230
  Muted = $85736B;       // #6B7385
  Line = $E1D6CF;        // #CFD6E1
  PillIdle = $F6F4F3;    // #F3F4F6
  DWMWA_WINDOW_CORNER_PREFERENCE = 33;
  DWMWCP_ROUND = 2;

var
  OptionsPage: TWizardPage;
  ScopeAllCard, ScopeMeCard: TPanel;
  ScopeAll, ScopeMe: TNewRadioButton;
  ScopeAllTitle, ScopeAllNote, ScopeMeTitle, ScopeMeNote: TLabel;
  DirEdit: TNewEdit;
  MenuCheck, DesktopCheck: TNewCheckBox;
  InstallBtn, LaunchBtn: TPanel;
  InstallBtnLabel, LaunchBtnLabel: TLabel;
  DirTouched: Boolean;
  ElevatedDone: Boolean;
  ElevationRefused: Boolean;
  InstalledAllUsers: Boolean;
  DonePanel: TPanel;
  FooterText: TNewStaticText;
  StatusText, ErrorText: TNewStaticText;
  Marquee: TNewProgressBar;

// ---------------------------------------------------------------- win32

function CreateRoundRectRgn(X1, Y1, X2, Y2, W, H: Integer): Integer;
  external 'CreateRoundRectRgn@gdi32.dll stdcall';
function SetWindowRgn(hWnd: HWND; hRgn: Integer; bRedraw: Integer): Integer;
  external 'SetWindowRgn@user32.dll stdcall';
function DwmSetWindowAttribute(hwnd: HWND; dwAttribute: Cardinal;
  var pvAttribute: Integer; cbAttribute: Cardinal): Integer;
  external 'DwmSetWindowAttribute@dwmapi.dll stdcall';

// ---------------------------------------------------------------- helpers

function HasParam(const Name: String): Boolean;
var
  I: Integer;
begin
  Result := False;
  for I := 1 to ParamCount do
    if CompareText(ParamStr(I), Name) = 0 then
      Result := True;
end;

function IsUpdate: Boolean;
begin
  Result := HasParam('/DZUPDATE');
end;

function NeedsWebView2: Boolean;
var
  V: String;
begin
  Result := not (
    (RegQueryStringValue(HKLM, WebView2KeyWow, 'pv', V) and (V <> '') and (V <> '0.0.0.0')) or
    (RegQueryStringValue(HKLM, WebView2Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0')) or
    (RegQueryStringValue(HKCU, WebView2Key, 'pv', V) and (V <> '') and (V <> '0.0.0.0')));
end;

function AllUsersDir: String;
begin
  Result := ExpandConstant('{commonpf64}\{#AppName}');
end;

function UserDir: String;
begin
  Result := ExpandConstant('{localappdata}\Programs\{#AppName}');
end;

// Run this setup .exe again with Params and wait. Inno Setup (6.4+) refuses
// to let [Code] Exec, ShellExec or copy the setup .exe itself before the
// installation starts (it fails with error 5), so go through cmd.exe. With
// /ALLUSERS the new copy elevates through Inno's own UAC prompt; if UAC is
// cancelled it exits with code 2.
function RunSetupAgain(const Params: String; AsOriginalUser: Boolean; var Code: Integer): Boolean;
var
  CmdParams: String;
begin
  CmdParams := '/S /C ""' + ExpandConstant('{srcexe}') + '" ' + Params + '"';
  if AsOriginalUser then
    Result := ExecAsOriginalUser(ExpandConstant('{cmd}'), CmdParams, '', SW_HIDE, ewWaitUntilTerminated, Code)
  else
    Result := Exec(ExpandConstant('{cmd}'), CmdParams, '', SW_HIDE, ewWaitUntilTerminated, Code);
end;

// Clip a control to a rounded rectangle. The corners become transparent to
// the white form background, giving the flat controls a rounded look.
procedure RoundControl(C: TWinControl; Radius: Integer);
begin
  if (C <> nil) and (C.Width > 0) and (C.Height > 0) then
    SetWindowRgn(C.Handle,
      CreateRoundRectRgn(0, 0, C.Width + 1, C.Height + 1, Radius, Radius), 1);
end;

// Windows 11 rounded window corners; harmless on Windows 10.
procedure RoundWindow;
var
  Pref: Integer;
begin
  Pref := DWMWCP_ROUND;
  DwmSetWindowAttribute(WizardForm.Handle, DWMWA_WINDOW_CORNER_PREFERENCE,
    Pref, SizeOf(Pref));
end;

function NewLabel(Parent: TWinControl; const Text: String; X, Y, W: Integer;
  Size: Integer; Color: TColor; Bold: Boolean): TNewStaticText;
begin
  Result := TNewStaticText.Create(WizardForm);
  Result.Parent := Parent;
  Result.Caption := Text;
  Result.AutoSize := True;
  Result.WordWrap := W > 0;
  Result.Left := X;
  Result.Top := Y;
  if W > 0 then Result.Width := W;
  Result.Font.Size := Size;
  Result.Font.Color := Color;
  if Bold then Result.Font.Style := [fsBold];
end;

// A flat blue button (native buttons cannot be coloured).
function NewPrimaryButton(Parent: TWinControl; const Text: String; X, Y, W, H: Integer;
  OnClick: TNotifyEvent; var Lbl: TLabel): TPanel;
begin
  Result := TPanel.Create(WizardForm);
  Result.Parent := Parent;
  Result.SetBounds(X, Y, W, H);
  Result.BevelOuter := bvNone;
  Result.ParentBackground := False;
  Result.Color := Accent;
  Result.Cursor := crHand;
  Result.OnClick := OnClick;
  RoundControl(Result, ScaleY(10));
  Lbl := TLabel.Create(WizardForm);
  Lbl.Parent := Result;
  Lbl.AutoSize := False;
  Lbl.SetBounds(0, 0, W, H);
  Lbl.Alignment := taCenter;
  Lbl.Layout := tlCenter;
  Lbl.Caption := Text;
  Lbl.Font.Color := clWhite;
  Lbl.Font.Size := 11;
  Lbl.Font.Style := [fsBold];
  Lbl.Transparent := True;
  Lbl.Cursor := crHand;
  Lbl.OnClick := OnClick;
end;

procedure AddHeader(Parent: TWinControl);
var
  Logo: TBitmapImage;
  Size: Integer;
  F: String;
begin
  Size := ScaleY(52);
  if Size >= 96 then F := 'logo-104.bmp'
  else if Size >= 70 then F := 'logo-78.bmp'
  else F := 'logo-52.bmp';
  ExtractTemporaryFile(F);
  Logo := TBitmapImage.Create(WizardForm);
  Logo.Parent := Parent;
  Logo.SetBounds(ScaleX(32), ScaleY(24), Size, Size);
  Logo.Stretch := True;
  Logo.Bitmap.LoadFromFile(ExpandConstant('{tmp}\') + F);
  NewLabel(Parent, '{#AppName}', ScaleX(32) + Size + ScaleX(14), ScaleY(24), 0, 18, Ink, True);
  NewLabel(Parent, CustomMessage('Subtitle'), ScaleX(32) + Size + ScaleX(15), ScaleY(24) + ScaleY(36), 0, 9, Muted, False);
end;

// ---------------------------------------------------------------- scope buttons

procedure PaintScope;
begin
  if ScopeAll.Checked then
  begin
    ScopeAllCard.Color := Accent;
    ScopeAllTitle.Font.Color := clWhite;
    ScopeAllNote.Font.Color := AccentSoft;
    ScopeMeCard.Color := PillIdle;
    ScopeMeTitle.Font.Color := Ink;
    ScopeMeNote.Font.Color := Muted;
  end else begin
    ScopeAllCard.Color := PillIdle;
    ScopeAllTitle.Font.Color := Ink;
    ScopeAllNote.Font.Color := Muted;
    ScopeMeCard.Color := Accent;
    ScopeMeTitle.Font.Color := clWhite;
    ScopeMeNote.Font.Color := AccentSoft;
  end;
  if not DirTouched then
  begin
    if ScopeAll.Checked then DirEdit.Text := AllUsersDir
    else DirEdit.Text := UserDir;
  end;
end;

// The two radios sit on separate buttons, so keep them exclusive by hand.
procedure ScopeClick(Sender: TObject);
var
  C: TControl;
begin
  C := TControl(Sender);
  if (C <> ScopeAllCard) and (C <> ScopeMeCard) then
    C := C.Parent;
  ScopeAll.Checked := C = ScopeAllCard;
  ScopeMe.Checked := not ScopeAll.Checked;
  PaintScope;
end;

function NewScopeButton(Parent: TWinControl; X, Y, W, H: Integer; const Title, Note: String;
  var Radio: TNewRadioButton; var TitleLbl, NoteLbl: TLabel): TPanel;
begin
  Result := TPanel.Create(WizardForm);
  Result.Parent := Parent;
  Result.SetBounds(X, Y, W, H);
  Result.BevelOuter := bvNone;
  Result.ParentBackground := False;
  Result.Color := PillIdle;
  Result.Cursor := crHand;
  Result.OnClick := @ScopeClick;
  // Fully rounded ends: the corner ellipse is as tall as the button.
  RoundControl(Result, H);
  // The radio carries the checked state; the whole pill is the button.
  Radio := TNewRadioButton.Create(WizardForm);
  Radio.Parent := Result;
  Radio.Visible := False;
  Radio.Caption := Title;
  Radio.OnClick := @ScopeClick;
  TitleLbl := TLabel.Create(WizardForm);
  TitleLbl.Parent := Result;
  TitleLbl.AutoSize := False;
  TitleLbl.SetBounds(ScaleX(16), H div 2 - ScaleY(19), W - ScaleX(32), ScaleY(18));
  TitleLbl.Alignment := taCenter;
  TitleLbl.Layout := tlCenter;
  TitleLbl.Caption := Title;
  TitleLbl.Font.Size := 10;
  TitleLbl.Font.Style := [fsBold];
  TitleLbl.Font.Color := Ink;
  TitleLbl.Transparent := True;
  TitleLbl.Cursor := crHand;
  TitleLbl.OnClick := @ScopeClick;
  NoteLbl := TLabel.Create(WizardForm);
  NoteLbl.Parent := Result;
  NoteLbl.AutoSize := False;
  NoteLbl.SetBounds(ScaleX(16), H div 2 + ScaleY(1), W - ScaleX(32), ScaleY(16));
  NoteLbl.Alignment := taCenter;
  NoteLbl.Layout := tlCenter;
  NoteLbl.Caption := Note;
  NoteLbl.Font.Size := 8;
  NoteLbl.Font.Color := Muted;
  NoteLbl.Transparent := True;
  NoteLbl.Cursor := crHand;
  NoteLbl.OnClick := @ScopeClick;
end;

procedure DirEditChange(Sender: TObject);
begin
  DirTouched := True;
end;

procedure BrowseClick(Sender: TObject);
var
  D: String;
begin
  D := DirEdit.Text;
  if BrowseForFolder(CustomMessage('Browse'), D, True) then
  begin
    if CompareText(ExtractFileName(RemoveBackslashUnlessRoot(D)), '{#AppName}') <> 0 then
      D := AddBackslash(D) + '{#AppName}';
    DirEdit.Text := D;
    DirTouched := True;
  end;
end;

// ---------------------------------------------------------------- install

function TaskList: String;
begin
  Result := '';
  if MenuCheck.Checked then Result := 'contextmenu';
  if DesktopCheck.Checked then
  begin
    if Result <> '' then Result := Result + ',';
    Result := Result + 'desktopicon';
  end;
end;

procedure ShowDone(const AppDir: String); forward;

// Our buttons live in the wizard's bottom strip, where Next/Cancel were.
function StripMargin: Integer;
begin
  // same side margin as the page content
  Result := ScaleX(32);
end;

function StripLift: Integer;
begin
  // extra breathing room between the bottom controls and the window edge
  Result := ScaleY(10);
end;

function StripTop(H: Integer): Integer;
begin
  Result := WizardForm.CancelButton.Top + (WizardForm.CancelButton.Height - H) div 2 - StripLift;
end;

function NewStripButton(const Text: String; W: Integer; OnClick: TNotifyEvent; var Lbl: TLabel): TPanel;
var
  H: Integer;
begin
  H := ScaleY(38);
  Result := NewPrimaryButton(WizardForm, Text, WizardForm.ClientWidth - StripMargin - W, StripTop(H), W, H, OnClick, Lbl);
  Result.BringToFront;
end;

procedure BeginWait;
begin
  ErrorText.Caption := '';
  InstallBtn.Visible := False;
  StatusText.Visible := True;
  Marquee.Visible := True;
  WizardForm.Refresh;
end;

procedure EndWait(Ok: Boolean);
begin
  StatusText.Visible := False;
  Marquee.Visible := False;
  if Ok then
    ShowDone(DirEdit.Text)
  else
    InstallBtn.Visible := True;
end;

function SilentParams(const Scope: String): String;
begin
  Result := Scope + ' /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /LANG=' + ActiveLanguage +
    ' /DIR="' + DirEdit.Text + '" /TASKS="' + TaskList + '"';
end;

// The chosen scope differs from how this Setup runs, so run a silent copy
// with that scope and wait: "All users" from a non-elevated window asks UAC
// (Inno's own prompt); "Just me" from the elevated window runs as the
// account that started Setup, so the per-user install lands in its profile.
procedure InstallOtherScope(AllUsers: Boolean);
var
  Code: Integer;
  Ok: Boolean;
begin
  BeginWait;
  if AllUsers then
    Ok := RunSetupAgain(SilentParams('/ALLUSERS'), False, Code)
  else
    Ok := RunSetupAgain(SilentParams('/CURRENTUSER'), True, Code);
  if Ok and (Code = 0) then
  begin
    InstalledAllUsers := AllUsers;
    EndWait(True);
    exit;
  end;
  if AllUsers and (not Ok or (Code = 2)) then
  begin
    // UAC cancelled or refused: offer the per-user install instead.
    ErrorText.Caption := CustomMessage('NeedAdmin');
    ScopeAll.Checked := False;
    ScopeMe.Checked := True;
    DirTouched := False;
    PaintScope;
  end
  else
    ErrorText.Caption := FmtMessage(CustomMessage('Failed'), [IntToStr(Code)]);
  EndWait(False);
end;

procedure InstallClick(Sender: TObject);
begin
  ErrorText.Caption := '';
  if ScopeAll.Checked <> IsAdminInstallMode then
  begin
    InstallOtherScope(ScopeAll.Checked);
    exit;
  end;
  // The scope matches this process: normal install right here.
  InstalledAllUsers := ScopeAll.Checked;
  WizardForm.DirEdit.Text := DirEdit.Text;
  WizardSelectTasks('!contextmenu,!desktopicon');
  if TaskList <> '' then WizardSelectTasks(TaskList);
  WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure LaunchClick(Sender: TObject);
var
  Code: Integer;
  Exe: String;
begin
  if ElevatedDone then Exe := AddBackslash(DirEdit.Text) + '{#AppExe}'
  else Exe := ExpandConstant('{app}\{#AppExe}');
  ExecAsOriginalUser(Exe, '', '', SW_SHOWNORMAL, ewNoWait, Code);
  if ElevatedDone then WizardForm.Close
  else WizardForm.NextButton.OnClick(WizardForm.NextButton);
end;

procedure CloseClick(Sender: TObject);
begin
  WizardForm.Close;
end;

// Windows does not let an installer set the default handler silently, so
// open the user-facing Default Apps page for DaperZip instead.
procedure OpenDefaultAppsClick(Sender: TObject);
var
  Uri: String;
  Code: Integer;
begin
  if InstalledAllUsers then
    Uri := 'ms-settings:defaultapps?registeredAppMachine={#AppName}'
  else
    Uri := 'ms-settings:defaultapps?registeredAppUser={#AppName}';
  // Open Settings in the original user's session even when Setup is elevated.
  if not ExecAsOriginalUser(ExpandConstant('{cmd}'), '/C start "" "' + Uri + '"', '',
    SW_HIDE, ewNoWait, Code) then
    ShellExec('open', Uri, '', '', SW_SHOWNORMAL, ewNoWait, Code);
end;

function NewDefaultAppsButton(Parent: TWinControl; X, Y, W: Integer): TNewButton;
begin
  Result := TNewButton.Create(WizardForm);
  Result.Parent := Parent;
  Result.Caption := CustomMessage('SetDefault');
  Result.SetBounds(X, Y, W, ScaleY(30));
  Result.OnClick := @OpenDefaultAppsClick;
end;

// Done screen for the elevated path (the normal path uses wpFinished).
procedure ShowDone(const AppDir: String);
var
  CloseBtn: TNewButton;
  Lbl: TLabel;
begin
  ElevatedDone := True;
  DonePanel := TPanel.Create(WizardForm);
  DonePanel.Parent := OptionsPage.Surface;
  DonePanel.SetBounds(0, 0, OptionsPage.Surface.ClientWidth, OptionsPage.Surface.ClientHeight);
  DonePanel.BevelOuter := bvNone;
  DonePanel.ParentBackground := False;
  DonePanel.Color := clWhite;
  AddHeader(DonePanel);
  NewLabel(DonePanel, CustomMessage('Done'), ScaleX(32), ScaleY(110), 0, 13, Ink, True);
  NewLabel(DonePanel, CustomMessage('DoneNote'), ScaleX(32), ScaleY(140), DonePanel.ClientWidth - ScaleX(64), 9, Muted, False);
  NewDefaultAppsButton(DonePanel, ScaleX(32), ScaleY(184), ScaleX(190));
  NewLabel(DonePanel, CustomMessage('SetDefaultNote'), ScaleX(32), ScaleY(222),
    DonePanel.ClientWidth - ScaleX(64), 8, Muted, False);
  InstallBtn.Visible := False;
  FooterText.Visible := False;
  LaunchBtn := NewStripButton(CustomMessage('Launch'), ScaleX(170), @LaunchClick, Lbl);
  CloseBtn := TNewButton.Create(WizardForm);
  CloseBtn.Parent := WizardForm;
  CloseBtn.Caption := CustomMessage('Close');
  CloseBtn.SetBounds(StripMargin, StripTop(WizardForm.CancelButton.Height), WizardForm.CancelButton.Width, WizardForm.CancelButton.Height);
  CloseBtn.OnClick := @CloseClick;
end;

// ---------------------------------------------------------------- layout

procedure BuildOptionsPage;
var
  S: TNewNotebookPage;
  W, X, Y, Half: Integer;
  Browse: TNewButton;
begin
  OptionsPage := CreateCustomPage(wpWelcome, '', '');
  S := OptionsPage.Surface;
  W := S.ClientWidth;
  X := ScaleX(32);
  AddHeader(S);

  Y := ScaleY(100);
  NewLabel(S, CustomMessage('ScopeLabel'), X, Y, 0, 8, Muted, True);
  Y := Y + ScaleY(20);
  Half := (W - 2 * X - ScaleX(10)) div 2;
  ScopeAllCard := NewScopeButton(S, X, Y, Half, ScaleY(54), CustomMessage('ScopeAll'), CustomMessage('ScopeAllNote'), ScopeAll, ScopeAllTitle, ScopeAllNote);
  ScopeMeCard := NewScopeButton(S, X + Half + ScaleX(10), Y, Half, ScaleY(54), CustomMessage('ScopeMe'), CustomMessage('ScopeMeNote'), ScopeMe, ScopeMeTitle, ScopeMeNote);

  Y := Y + ScaleY(68);
  NewLabel(S, CustomMessage('DirLabel'), X, Y, 0, 8, Muted, True);
  Y := Y + ScaleY(20);
  DirEdit := TNewEdit.Create(WizardForm);
  DirEdit.Parent := S;
  DirEdit.SetBounds(X, Y, W - 2 * X - ScaleX(90), ScaleY(26));
  DirEdit.OnChange := @DirEditChange;
  RoundControl(DirEdit, ScaleY(8));
  Browse := TNewButton.Create(WizardForm);
  Browse.Parent := S;
  Browse.Caption := CustomMessage('Change');
  Browse.SetBounds(W - X - ScaleX(80), Y - ScaleY(1), ScaleX(80), ScaleY(28));
  Browse.OnClick := @BrowseClick;
  RoundControl(Browse, ScaleY(8));

  Y := Y + ScaleY(40);
  MenuCheck := TNewCheckBox.Create(WizardForm);
  MenuCheck.Parent := S;
  MenuCheck.SetBounds(X, Y, W - 2 * X, ScaleY(22));
  MenuCheck.Caption := CustomMessage('TaskMenu');
  MenuCheck.Checked := True;
  Y := Y + ScaleY(28);
  DesktopCheck := TNewCheckBox.Create(WizardForm);
  DesktopCheck.Parent := S;
  DesktopCheck.SetBounds(X, Y, W - 2 * X, ScaleY(22));
  DesktopCheck.Caption := CustomMessage('TaskDesktop');
  DesktopCheck.Checked := True;

  FooterText := NewLabel(WizardForm, CustomMessage('Footer'), StripMargin,
    0, 0, 8, Muted, False);
  FooterText.Top := StripTop(FooterText.Height);
  InstallBtn := NewStripButton(CustomMessage('Install'), ScaleX(150), @InstallClick, InstallBtnLabel);

  Y := Y + ScaleY(34);
  StatusText := NewLabel(S, CustomMessage('Installing'), X, Y, 0, 10, Ink, True);
  StatusText.Visible := False;
  Marquee := TNewProgressBar.Create(WizardForm);
  Marquee.Parent := S;
  Marquee.SetBounds(X, Y + ScaleY(26), W - 2 * X, ScaleY(8));
  Marquee.Style := npbstMarquee;
  Marquee.Visible := False;
  ErrorText := NewLabel(S, '', X, Y, W - 2 * X, 9, $3B48E5, False);

  // The scope follows how this Setup runs: elevated (UAC accepted at start)
  // installs for all users, otherwise just for this account. "All users"
  // without elevation re-runs Setup elevated when Install is clicked.
  ScopeAll.Checked := IsAdminInstallMode;
  ScopeMe.Checked := not ScopeAll.Checked;
  PaintScope;
  if ElevationRefused then
    ErrorText.Caption := CustomMessage('NeedAdmin');
end;

// An interactive Setup asks for administrator rights right away: it starts
// itself again with /ALLUSERS, which triggers Inno's own UAC prompt, and the
// elevated copy shows the installer window. This process just waits and
// exits with its result. When UAC is cancelled or refused (exit code 2), or
// the account cannot elevate, this process carries on as a "Just me" setup.
// Silent runs and runs that already name a scope are left alone.
function InitializeSetup: Boolean;
var
  Code: Integer;
begin
  Result := True;
  if WizardSilent or IsAdmin or HasParam('/ALLUSERS') or HasParam('/CURRENTUSER') then
    exit;
  // Even a standard account gets the prompt: an administrator can type their
  // password there. Exit code 2 = UAC cancelled/refused.
  if RunSetupAgain('/ALLUSERS', False, Code) and (Code <> 2) then
    Result := False  // the elevated copy ran (installed, or was closed)
  else
    ElevationRefused := True;
end;

procedure InitializeWizard;
begin
  WizardForm.Caption := CustomMessage('SetupTitle');
  RoundWindow;
  WizardForm.Color := clWhite;
  // Hide the classic wizard chrome: header strip, separators.
  WizardForm.MainPanel.Visible := False;
  WizardForm.Bevel1.Visible := False;
  WizardForm.Bevel.Visible := False;
  WizardForm.InnerNotebook.SetBounds(0, 0, WizardForm.InnerPage.ClientWidth, WizardForm.InnerPage.ClientHeight);
  if not WizardSilent then
    BuildOptionsPage;

  // Progress page in the same style (also shown during /SILENT updates).
  AddHeader(WizardForm.InstallingPage);
  WizardForm.StatusLabel.SetBounds(ScaleX(32), ScaleY(110), WizardForm.InstallingPage.ClientWidth - ScaleX(64), ScaleY(24));
  WizardForm.StatusLabel.Font.Size := 12;
  WizardForm.StatusLabel.Font.Style := [fsBold];
  WizardForm.StatusLabel.Font.Color := Ink;
  WizardForm.ProgressGauge.SetBounds(ScaleX(32), ScaleY(142), WizardForm.InstallingPage.ClientWidth - ScaleX(64), ScaleY(10));
  WizardForm.FilenameLabel.SetBounds(ScaleX(32), ScaleY(160), WizardForm.InstallingPage.ClientWidth - ScaleX(64), ScaleY(20));
  WizardForm.FilenameLabel.Font.Color := Muted;

  // Finished page in the same style.
  WizardForm.WizardBitmapImage2.Visible := False;
  WizardForm.FinishedHeadingLabel.Visible := False;
  WizardForm.FinishedLabel.Visible := False;
  WizardForm.RunList.Visible := False;
  WizardForm.YesRadio.Visible := False;
  WizardForm.NoRadio.Visible := False;
  AddHeader(WizardForm.FinishedPage);
  NewLabel(WizardForm.FinishedPage, CustomMessage('Done'), ScaleX(32), ScaleY(110), 0, 13, Ink, True);
  NewLabel(WizardForm.FinishedPage, CustomMessage('DoneNote'), ScaleX(32), ScaleY(140),
    WizardForm.FinishedPage.ClientWidth - ScaleX(64), 9, Muted, False);
  if not WizardSilent then
  begin
    NewDefaultAppsButton(WizardForm.FinishedPage, ScaleX(32), ScaleY(184), ScaleX(190));
    NewLabel(WizardForm.FinishedPage, CustomMessage('SetDefaultNote'), ScaleX(32), ScaleY(222),
      WizardForm.FinishedPage.ClientWidth - ScaleX(64), 8, Muted, False);
    LaunchBtn := NewStripButton(CustomMessage('Launch'), ScaleX(170), @LaunchClick, LaunchBtnLabel);
    LaunchBtn.Visible := False;
  end;
end;

var
  NextLeft: Integer;
  CancelLeft: Integer;

procedure CurPageChanged(CurPageID: Integer);
begin
  // Silent installs drive the wizard through the Next button, so it must
  // stay visible and enabled; with our own screens it is only moved away.
  if WizardSilent then exit;
  if NextLeft = 0 then NextLeft := WizardForm.NextButton.Left;
  WizardForm.BackButton.Visible := False;
  // Inno disables the title-bar X (and Alt+F4) whenever CancelButton.CanFocus
  // is false, so hiding Cancel made our screens impossible to close. Inno
  // already shows Cancel on this page; keep it shown and merely park it
  // off-screen, the same way the Next button is hidden.
  if CancelLeft = 0 then CancelLeft := WizardForm.CancelButton.Left;
  if CurPageID = wpInstalling then
    WizardForm.CancelButton.Left := CancelLeft
  else if WizardForm.CancelButton.Visible then
    WizardForm.CancelButton.Left := -ScaleX(2000);
  if InstallBtn <> nil then
  begin
    InstallBtn.Visible := (CurPageID = OptionsPage.ID) and not ElevatedDone;
    FooterText.Visible := InstallBtn.Visible;
  end;
  if LaunchBtn <> nil then
    LaunchBtn.Visible := (CurPageID = wpFinished) or ElevatedDone;
  if CurPageID = wpFinished then
  begin
    WizardForm.NextButton.Caption := CustomMessage('Close');
    WizardForm.NextButton.Left := StripMargin;
  end
  else
    WizardForm.NextButton.Left := -ScaleX(2000);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := (PageID = wpLicense) or (PageID = wpPassword) or (PageID = wpInfoBefore) or
    (PageID = wpUserInfo) or (PageID = wpSelectDir) or (PageID = wpSelectComponents) or
    (PageID = wpSelectProgramGroup) or (PageID = wpSelectTasks) or (PageID = wpReady) or
    (PageID = wpInfoAfter);
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  // Closing the window from our own screens needs no "exit setup?" prompt.
  if (OptionsPage <> nil) and ((CurPageID = OptionsPage.ID) or ElevatedDone) then
    Confirm := False;
end;

// ---------------------------------------------------------------- before copying files

// Remove a DaperZip 0.1.0 installed by the previous (NSIS) installer.
procedure RemoveNsisInstall(const Dir: String);
var
  Code: Integer;
begin
  if FileExists(Dir + '\uninstall.exe') then
  begin
    Exec(Dir + '\uninstall.exe', '/S _?=' + Dir, '', SW_HIDE, ewWaitUntilTerminated, Code);
    DelTree(Dir, True, True, True);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  // close a running DaperZip so its files can be replaced
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/IM {#AppExe} /F', '', SW_HIDE, ewWaitUntilTerminated, Code);
  RemoveNsisInstall(ExpandConstant('{localappdata}\{#AppName}'));
  if IsAdminInstallMode then
    RemoveNsisInstall(ExpandConstant('{commonpf64}\{#AppName}'));
end;
