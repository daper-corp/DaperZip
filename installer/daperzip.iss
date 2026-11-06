; DaperZip installer (Inno Setup 6).
;
; A single custom screen replaces the classic wizard:
;   install scope (all users = default / just me), location, Explorer menu,
;   desktop shortcut, and one big "Install" button; then progress and done.
;
; Build (CI does this):  ISCC /DAppVersion=0.1.1 installer\daperzip.iss
;
; Command-line switches (besides Inno's standard /SILENT, /VERYSILENT, /DIR=…):
;   /ALLUSERS | /CURRENTUSER   install scope (all users needs admin rights)
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
AppSupportURL=https://github.com/daper-corp/DaperZip
AppUpdatesURL=https://github.com/daper-corp/DaperZip/releases
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableWelcomePage=yes
DisableDirPage=yes
DisableReadyPage=yes
DisableFinishedPage=no
; Starts without admin rights; "all users" re-runs elevated (see [Code]).
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=commandline
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
WizardSizePercent=100
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
ko.Footer=MIT 라이선스 · dapercorp.com
en.Footer=MIT License · dapercorp.com
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
ko.NeedAdmin=관리자 권한이 없어 모든 사용자용으로 설치하지 못했습니다. "나만 사용"으로 설치할 수 있습니다.
en.NeedAdmin=Administrator rights were not granted. You can install for "Just me" instead.
ko.Failed=설치하지 못했습니다 (코드 %1).
en.Failed=Installation failed (code %1).
ko.Browse=설치할 폴더를 고르세요.
en.Browse=Choose the installation folder.

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

var
  OptionsPage: TWizardPage;
  ScopeAllCard, ScopeMeCard: TPanel;
  ScopeAll, ScopeMe: TNewRadioButton;
  DirEdit: TNewEdit;
  MenuCheck, DesktopCheck: TNewCheckBox;
  InstallBtn, LaunchBtn: TPanel;
  InstallBtnLabel, LaunchBtnLabel: TLabel;
  DirTouched: Boolean;
  ElevatedDone: Boolean;
  DonePanel: TPanel;
  StatusText, ErrorText: TNewStaticText;
  Marquee: TNewProgressBar;

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

// ---------------------------------------------------------------- scope cards

procedure PaintScope;
begin
  if ScopeAll.Checked then
  begin
    ScopeAllCard.Color := AccentSoft;
    ScopeMeCard.Color := clWhite;
  end else begin
    ScopeAllCard.Color := clWhite;
    ScopeMeCard.Color := AccentSoft;
  end;
  if not DirTouched then
  begin
    if ScopeAll.Checked then DirEdit.Text := AllUsersDir
    else DirEdit.Text := UserDir;
  end;
end;

// The two radios sit on separate cards, so keep them exclusive by hand.
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

function NewScopeCard(Parent: TWinControl; X, Y, W, H: Integer; const Title, Note: String;
  var Radio: TNewRadioButton): TPanel;
var
  N: TNewStaticText;
begin
  Result := TPanel.Create(WizardForm);
  Result.Parent := Parent;
  Result.SetBounds(X, Y, W, H);
  Result.BevelOuter := bvNone;
  Result.BorderStyle := bsSingle;
  Result.ParentBackground := False;
  Result.Color := clWhite;
  Result.Cursor := crHand;
  Result.OnClick := @ScopeClick;
  Radio := TNewRadioButton.Create(WizardForm);
  Radio.Parent := Result;
  Radio.SetBounds(ScaleX(12), ScaleY(8), W - ScaleX(20), ScaleY(20));
  Radio.Caption := Title;
  Radio.Font.Size := 10;
  Radio.Font.Color := Ink;
  Radio.OnClick := @ScopeClick;
  N := NewLabel(Result, Note, ScaleX(30), ScaleY(30), 0, 8, Muted, False);
  N.OnClick := @ScopeClick;
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

// "All users" from a non-admin setup: run this installer again, elevated
// and silent, and wait for it; this window shows progress meanwhile.
function InstallElevated: Boolean;
var
  Params: String;
  Code: Integer;
begin
  Result := False;
  ErrorText.Caption := '';
  InstallBtn.Visible := False;
  StatusText.Visible := True;
  Marquee.Visible := True;
  WizardForm.Refresh;
  Params := '/ALLUSERS /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /LANG=' + ActiveLanguage +
    ' /DIR="' + DirEdit.Text + '" /TASKS="' + TaskList + '"';
  if not ShellExec('runas', ExpandConstant('{srcexe}'), Params, '', SW_SHOWNORMAL, ewWaitUntilTerminated, Code) then
    ErrorText.Caption := CustomMessage('NeedAdmin')
  else if Code <> 0 then
    ErrorText.Caption := FmtMessage(CustomMessage('Failed'), [IntToStr(Code)])
  else
    Result := True;
  StatusText.Visible := False;
  Marquee.Visible := False;
  if Result then
    ShowDone(DirEdit.Text)
  else
    InstallBtn.Visible := True;
end;

procedure InstallClick(Sender: TObject);
begin
  if ScopeAll.Checked and not IsAdminInstallMode then
  begin
    InstallElevated;
    exit;
  end;
  // Just me (or already elevated): normal install in this process.
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
  LaunchBtn := NewPrimaryButton(DonePanel, CustomMessage('Launch'),
    DonePanel.ClientWidth - ScaleX(32) - ScaleX(170), DonePanel.ClientHeight - ScaleY(64), ScaleX(170), ScaleY(42),
    @LaunchClick, Lbl);
  CloseBtn := TNewButton.Create(WizardForm);
  CloseBtn.Parent := DonePanel;
  CloseBtn.Caption := CustomMessage('Close');
  CloseBtn.SetBounds(ScaleX(32), DonePanel.ClientHeight - ScaleY(58), ScaleX(90), ScaleY(30));
  CloseBtn.OnClick := @CloseClick;
end;

// ---------------------------------------------------------------- layout

procedure BuildOptionsPage;
var
  S: TNewNotebookPage;
  W, X, Y, Half: Integer;
  L: TNewStaticText;
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
  ScopeAllCard := NewScopeCard(S, X, Y, Half, ScaleY(54), CustomMessage('ScopeAll'), CustomMessage('ScopeAllNote'), ScopeAll);
  ScopeMeCard := NewScopeCard(S, X + Half + ScaleX(10), Y, Half, ScaleY(54), CustomMessage('ScopeMe'), CustomMessage('ScopeMeNote'), ScopeMe);

  Y := Y + ScaleY(68);
  NewLabel(S, CustomMessage('DirLabel'), X, Y, 0, 8, Muted, True);
  Y := Y + ScaleY(20);
  DirEdit := TNewEdit.Create(WizardForm);
  DirEdit.Parent := S;
  DirEdit.SetBounds(X, Y, W - 2 * X - ScaleX(90), ScaleY(26));
  DirEdit.OnChange := @DirEditChange;
  Browse := TNewButton.Create(WizardForm);
  Browse.Parent := S;
  Browse.Caption := CustomMessage('Change');
  Browse.SetBounds(W - X - ScaleX(80), Y - ScaleY(1), ScaleX(80), ScaleY(28));
  Browse.OnClick := @BrowseClick;

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

  L := NewLabel(S, CustomMessage('Footer'), X, S.ClientHeight - ScaleY(46), 0, 8, Muted, False);
  InstallBtn := NewPrimaryButton(S, CustomMessage('Install'),
    W - X - ScaleX(150), S.ClientHeight - ScaleY(64), ScaleX(150), ScaleY(42), @InstallClick, InstallBtnLabel);

  StatusText := NewLabel(S, CustomMessage('Installing'), X, S.ClientHeight - ScaleY(70), 0, 10, Ink, True);
  StatusText.Visible := False;
  Marquee := TNewProgressBar.Create(WizardForm);
  Marquee.Parent := S;
  Marquee.SetBounds(X, S.ClientHeight - ScaleY(44), W - 2 * X, ScaleY(8));
  Marquee.Style := npbstMarquee;
  Marquee.Visible := False;
  ErrorText := NewLabel(S, '', X, S.ClientHeight - ScaleY(96), W - 2 * X, 9, $3B48E5, False);

  // Default: all users, unless DaperZip is already installed just for this user.
  ScopeAll.Checked := not (RegKeyExists(HKCU, UninstKey) and not RegKeyExists(HKLM, UninstKey));
  ScopeMe.Checked := not ScopeAll.Checked;
  if IsAdminInstallMode then ScopeAll.Checked := True;
  PaintScope;
end;

procedure InitializeWizard;
begin
  WizardForm.Caption := CustomMessage('SetupTitle');
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
    LaunchBtn := NewPrimaryButton(WizardForm.FinishedPage, CustomMessage('Launch'),
      WizardForm.FinishedPage.ClientWidth - ScaleX(32) - ScaleX(170),
      WizardForm.FinishedPage.ClientHeight - ScaleY(64), ScaleX(170), ScaleY(42), @LaunchClick, LaunchBtnLabel);
end;

var
  NextLeft: Integer;

procedure CurPageChanged(CurPageID: Integer);
begin
  // Silent installs drive the wizard through the Next button, so it must
  // stay visible and enabled; with our own screens it is only moved away.
  if WizardSilent then exit;
  if NextLeft = 0 then NextLeft := WizardForm.NextButton.Left;
  WizardForm.BackButton.Visible := False;
  WizardForm.CancelButton.Visible := CurPageID = wpInstalling;
  if CurPageID = wpFinished then
  begin
    WizardForm.NextButton.Caption := CustomMessage('Close');
    WizardForm.NextButton.Left := ScaleX(32);
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
