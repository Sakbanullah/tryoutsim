# Scrubbing helper for `secret-store.js`: Windows Credential Manager access.
#
# Usage (called only by the backend, never by a human):
#   powershell -NoProfile -File CredentialStore.ps1 write  <targetName>   # key on stdin
#   powershell -NoProfile -File CredentialStore.ps1 read   <targetName>   # key on stdout
#   powershell -NoProfile -File CredentialStore.ps1 delete <targetName>   # prints "deleted" | "missing"
#
# The key never enters a command line, an environment variable, a temporary file,
# the console or the history: `write` reads it from stdin, `read` writes it to
# stdout. Both buffers are zeroed after use.

param(
  [Parameter(Mandatory = $true)][ValidateSet('write', 'read', 'delete')][string]$Command,
  [Parameter(Mandatory = $true)][string]$Target
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace TryoutSim {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }

  public static class Cred {
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredWriteW(ref CREDENTIAL cred, uint flags);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredReadW(string target, uint type, uint flags, out IntPtr cred);

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredDeleteW(string target, uint type, uint flags);

    [DllImport("advapi32.dll", SetLastError = true)]
    static extern void CredFree(IntPtr buffer);

    const uint CRED_TYPE_GENERIC = 1;
    const uint CRED_PERSIST_LOCAL_MACHINE = 2;

    public static void Write(string target, string user, string secret) {
      byte[] blob = System.Text.Encoding.Unicode.GetBytes(secret);
      IntPtr blobPtr = Marshal.AllocHGlobal(blob.Length);
      IntPtr targetPtr = Marshal.StringToCoTaskMemUni(target);
      IntPtr userPtr = Marshal.StringToCoTaskMemUni(user);
      try {
        Marshal.Copy(blob, 0, blobPtr, blob.Length);
        Array.Clear(blob, 0, blob.Length);
        CREDENTIAL c = new CREDENTIAL();
        c.Type = CRED_TYPE_GENERIC;
        c.TargetName = targetPtr;
        c.UserName = userPtr;
        c.CredentialBlob = blobPtr;
        c.CredentialBlobSize = (uint)blob.Length;
        c.Persist = CRED_PERSIST_LOCAL_MACHINE;
        if (!CredWriteW(ref c, 0)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      } finally {
        Marshal.FreeHGlobal(blobPtr);
        Marshal.FreeCoTaskMem(targetPtr);
        Marshal.FreeCoTaskMem(userPtr);
      }
    }

    // Returns the secret, or null when the entry does not exist (ERROR_NOT_FOUND = 1168).
    public static string Read(string target) {
      IntPtr p;
      if (!CredReadW(target, CRED_TYPE_GENERIC, 0, out p)) {
        int err = Marshal.GetLastWin32Error();
        if (err == 1168) return null;
        throw new System.ComponentModel.Win32Exception(err);
      }
      try {
        CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
        byte[] blob = new byte[c.CredentialBlobSize];
        Marshal.Copy(c.CredentialBlob, blob, 0, (int)c.CredentialBlobSize);
        string s = System.Text.Encoding.Unicode.GetString(blob);
        Array.Clear(blob, 0, blob.Length);
        return s;
      } finally {
        CredFree(p);
      }
    }

    // True when an entry was deleted, false when there was none.
    public static bool Delete(string target) {
      if (CredDeleteW(target, CRED_TYPE_GENERIC, 0)) return true;
      int err = Marshal.GetLastWin32Error();
      if (err == 1168) return false;
      throw new System.ComponentModel.Win32Exception(err);
    }
  }
}
'@

switch ($Command) {
  'write' {
    $chars = [System.Collections.Generic.List[char]]::new()
    $reader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.UTF8Encoding]::new($false))
    $buffer = [char[]]::new(4096)
    # No slicing here: `$buffer[0..($n-1)]` is an Object[] for a one-character read and `AddRange` refuses it.
    while (($n = $reader.Read($buffer, 0, $buffer.Length)) -gt 0) { for ($i = 0; $i -lt $n; $i++) { $chars.Add($buffer[$i]) } }
    $secret = -join $chars
    try {
      if ([string]::IsNullOrEmpty($secret)) { throw 'Empty secret on stdin.' }
      [TryoutSim.Cred]::Write($Target, 'tryoutsim', $secret)
      Write-Output 'written'
    } finally {
      $chars.Clear()
      $secret = $null
      $reader.Dispose()
    }
  }
  'read' {
    $secret = [TryoutSim.Cred]::Read($Target)
    if ($null -eq $secret) { [Console]::Out.Write(''); exit 0 }
    [Console]::Out.Write($secret)
    $secret = $null
  }
  'delete' {
    if ([TryoutSim.Cred]::Delete($Target)) { Write-Output 'deleted' } else { Write-Output 'missing' }
  }
}
