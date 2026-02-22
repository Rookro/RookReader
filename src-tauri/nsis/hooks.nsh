!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Checking for Visual C++ Redistributable x64..."

  ; Checks if Visual C++ Redistributable x64 is installed
  ClearErrors
  ReadRegDword $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

  ; If the registry key does not exist (error) or Installed is 0
  ${If} ${Errors}
  ${OrIf} $0 == 0
    DetailPrint "Downloading Visual C++ Redistributable..."

    ; Downloads the Visual C++ Redistributable installer
    InitPluginsDir
    NSISdl::download "https://aka.ms/vc14/vc_redist.x64.exe" "$PLUGINSDIR\vcredist_x64.exe"
    Pop $0

    ${If} $0 == "success"
      DetailPrint "Visual C++ Redistributable downloaded successfully"
      DetailPrint "Installing Visual C++ Redistributable..."

      ; Installs the Visual C++ Redistributable silently
      ExecWait '"$PLUGINSDIR\vcredist_x64.exe" /install /quiet /norestart' $1

      ; Abort if the exit code is not 0 (Success) or 3010 (Reboot required)
      ${If} $1 != 0
      ${AndIf} $1 != 3010
        MessageBox MB_ICONSTOP|MB_OK "Failed to install Visual C++ Redistributable (Error Code: $1).$\r$\nSetup will now abort."
        Abort "Installation aborted due to Visual C++ Redistributable installation failure."
      ${EndIf}

      DetailPrint "Visual C++ Redistributable installed successfully"

    ${Else}
      ; Abort if the download fails
      MessageBox MB_ICONSTOP|MB_OK "Failed to download Visual C++ Redistributable (Error: $0).$\r$\nPlease check your internet connection.$\r$\nSetup will now abort."
      Abort "Installation aborted due to Visual C++ Redistributable download failure."
    ${EndIf}

  ${Else}
    DetailPrint "Visual C++ Redistributable is already installed. Skipping."
  ${EndIf}
!macroend
