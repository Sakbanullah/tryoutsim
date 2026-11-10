# Minimal Windows Credential Manager access, with no external module.
#
# The password never enters a command line, a temporary file, the console or the
# PowerShell history: it is written straight into the Win32 credential store via
# CredWriteW and read back via CredReadW. Both the plaintext and its UTF-16 copy
# are zeroed after use.
#
# Source this file with the dot operator and keep its result:
#   . (Join-Path $PSScriptRoot 'CredentialStore.ps1')
#
# Failures are explicit. Read returns $null only when the credential is absent
# (ERROR_NOT_FOUND); any other failure throws a TryoutSim.CredStoreException whose
# ErrorCode is one of:
#   CredentialNotFound   - there is no credential with that target name.
#   CredentialStoreFailed - the store refused a read, a write or a delete (Win32 error in
#                           NativeErrorCode). A caller must not report this as
#                           "no credential", because the secret may well exist.
#
# Delete is idempotent: deleting an absent credential is not an error.

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

  public class CredStoreException : Exception {
    public string ErrorCode { get; private set; }
    public int NativeErrorCode { get; private set; }

    public CredStoreException(string errorCode, int nativeErrorCode, string message, Exception inner)
      : base(message, inner) {
      ErrorCode = errorCode;
      NativeErrorCode = nativeErrorCode;
    }
  }

  public class CredOps {
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
    const int ERROR_NOT_FOUND = 1168;

    public void Write(string target, string user, string secret) {
      byte[] blob = System.Text.Encoding.Unicode.GetBytes(secret);
      IntPtr blobPtr = Marshal.AllocHGlobal(blob.Length);
      IntPtr targetPtr = Marshal.StringToCoTaskMemUni(target);
      IntPtr userPtr = Marshal.StringToCoTaskMemUni(user);
      CREDENTIAL c = new CREDENTIAL();
      try {
        Marshal.Copy(blob, 0, blobPtr, blob.Length);
        Array.Clear(blob, 0, blob.Length);
        c.Type = CRED_TYPE_GENERIC;
        c.TargetName = targetPtr;
        c.UserName = userPtr;
        c.CredentialBlob = blobPtr;
        c.CredentialBlobSize = (uint)blob.Length;
        c.Persist = CRED_PERSIST_LOCAL_MACHINE;
        if (!CredWriteW(ref c, 0)) {
          throw Fail("CredentialStoreFailed", "Could not write the credential '" + target + "'");
        }
      } catch (CredStoreException) {
        throw;
      } catch (Exception e) {
        throw new CredStoreException("CredentialStoreFailed", 0, "Could not write the credential '" + target + "'", e);
      } finally {
        Marshal.FreeHGlobal(blobPtr);
        Marshal.FreeCoTaskMem(targetPtr);
        Marshal.FreeCoTaskMem(userPtr);
      }
    }

    public string Read(string target) {
      IntPtr p;
      if (!CredReadW(target, CRED_TYPE_GENERIC, 0, out p)) {
        int error = Marshal.GetLastWin32Error();
        if (error == ERROR_NOT_FOUND) return null;
        throw new CredStoreException(
          "CredentialStoreFailed",
          error,
          "Could not read the credential '" + target + "' (Win32 error " + error + ").",
          null);
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

    public void Delete(string target) {
      if (!CredDeleteW(target, CRED_TYPE_GENERIC, 0)) {
        int error = Marshal.GetLastWin32Error();
        if (error == ERROR_NOT_FOUND) return;
        throw new CredStoreException(
          "CredentialStoreFailed", error, "Could not delete the credential '" + target + "' (Win32 error " + error + ").", null);
      }
    }

    CredStoreException Fail(string code, string message) {
      int error = Marshal.GetLastWin32Error();
      return new CredStoreException(code, error, message + " (Win32 error " + error + ").", null);
    }
  }
}
'@

# The scripts' only door to the store is TryoutSimCredInvoke, so a test replaces one function
# instead of the Win32 layer:
#   TryoutSimCredInvoke -Operation Read -Target 'tryoutsim/tryoutsim_app'
# A store failure is returned as an object with the same Exception/ErrorCode shape a thrown
# failure has, so the call site reads the outcome the same way in production and in tests.
$api = New-Object TryoutSim.CredOps
function TryoutSimCredInvoke {
  param([string]$Operation, [string]$Target, [string]$User = '', [string]$Secret = '')
  try {
    switch ($Operation) {
      'Write' { $api.Write($Target, $User, $Secret); return $null }
      'Read' { return $api.Read($Target) }
      'Delete' { $api.Delete($Target); return $null }
      default { throw "Unknown credential-store operation '$Operation'." }
    }
  } catch [TryoutSim.CredStoreException] {
    return @{ Exception = $_.Exception; ErrorCode = $_.Exception.ErrorCode; NativeErrorCode = $_.Exception.NativeErrorCode }
  }
}
