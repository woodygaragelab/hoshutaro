; HOSHUTARO (保守太郎) Inno Setup Install Script
; This script is used by build_all.py to generate the Windows installer.

[Setup]
AppName=保守太郎 (Hoshutaro)
AppVersion=1.0.0
DefaultDirName={localappdata}\Hoshutaro
DefaultGroupName=保守太郎
UninstallDisplayIcon={app}\hoshutaro.exe
Compression=lzma2
SolidCompression=yes
OutputDir=.\
OutputBaseFilename=hoshutaro-setup-windows
PrivilegesRequired=lowest

[Files]
; Launcher
Source: "..\launcher\dist\hoshutaro.exe"; DestDir: "{app}"; Flags: ignoreversion

; Backend (FastAPI PyInstaller output)
Source: "..\backend\dist\hoshutaro-server.exe"; DestDir: "{app}\core"; Flags: ignoreversion

; Frontend (Vite build output)
Source: "..\dist\*"; DestDir: "{app}\frontend"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\保守太郎"; Filename: "{app}\hoshutaro.exe"
Name: "{group}\Uninstall"; Filename: "{uninstallexe}"
Name: "{autodesktop}\保守太郎"; Filename: "{app}\hoshutaro.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "デスクトップにショートカットを作成する"; GroupDescription: "追加のタスク:"

[Run]
Filename: "{app}\hoshutaro.exe"; Description: "保守太郎を起動する"; Flags: nowait postinstall skipifsilent
