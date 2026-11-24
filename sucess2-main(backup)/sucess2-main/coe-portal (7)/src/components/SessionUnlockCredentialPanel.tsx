import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldOff,
  X,
} from 'lucide-react';
import {
  ScheduledExamination,
  SessionUnlockCredential,
  SittingAllocation,
} from '../types/examination';
import { credentialService } from '../services/credentialService';
import { formatIstDisplayFromIso, maskCredentialSecret } from '../utils/credentials';
import { StatusIndicator, SemanticTone } from './StatusIndicator';
import { ConfirmDialog } from './ConfirmDialog';

interface SessionUnlockCredentialPanelProps {
  examination: ScheduledExamination;
  sitting: SittingAllocation;
  credential?: SessionUnlockCredential;
  isLabConnected: boolean;
  sessionStatus?: 'Active' | 'Ready' | 'Completed';
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

function getCredentialStatusTone(
  status?: SessionUnlockCredential['status']
): SemanticTone {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Expired':
      return 'warning';
    case 'Revoked':
    case 'Synchronisation Failed':
      return 'danger';
    case 'Synchronisation Pending':
      return 'info';
    default:
      return 'neutral';
  }
}

export const SessionUnlockCredentialPanel: React.FC<
  SessionUnlockCredentialPanelProps
> = ({
  examination,
  sitting,
  credential,
  isLabConnected,
  sessionStatus,
  onRefresh,
  onNotify,
}) => {
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    'generate' | 'regenerate' | 'revoke' | null
  >(null);
  const [revealOnceSecret, setRevealOnceSecret] = useState<string | null>(null);
  const [revealCredentialId, setRevealCredentialId] = useState<string | null>(null);
  const [revealExpiresAt, setRevealExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveStatus = credential?.status ?? 'Not Generated';
  const isImmutableExam =
    examination.status === 'Cancelled' ||
    examination.status === 'Exam Completed' ||
    sessionStatus === 'Completed';

  const canGenerate =
    !isImmutableExam &&
    (effectiveStatus === 'Not Generated' ||
      effectiveStatus === 'Expired' ||
      effectiveStatus === 'Revoked');

  const canRegenerate =
    !isImmutableExam &&
    effectiveStatus !== 'Not Generated' &&
    (effectiveStatus === 'Active' ||
      effectiveStatus === 'Synchronisation Failed' ||
      effectiveStatus === 'Synchronisation Pending' ||
      effectiveStatus === 'Revoked' ||
      effectiveStatus === 'Expired');

  const canRevoke =
    !isImmutableExam &&
    (effectiveStatus === 'Active' ||
      effectiveStatus === 'Synchronisation Failed' ||
      effectiveStatus === 'Synchronisation Pending');

  const handleExecuteConfirmedAction = async () => {
    if (!pendingAction) return;
    setBusy(true);
    try {
      if (pendingAction === 'generate') {
        const res = await credentialService.generateSessionUnlockCredential(
          examination.id,
          sitting.sittingId
        );
        await onRefresh();
        setRevealOnceSecret(res.revealOnceSecret);
        setRevealCredentialId(res.credential.credentialId);
        setRevealExpiresAt(res.credential.expiresAt || null);
        setCopied(false);
        if (res.credential.status === 'Synchronisation Failed') {
          onNotify(
            'error',
            'Verifier Sync Failed',
            res.credential.syncError ||
              `${sitting.labName} could not confirm unlock verifier synchronisation.`
          );
        } else {
          onNotify(
            'success',
            'Unlock Credential Generated',
            `Session credential ${res.credential.credentialId} synced to ${sitting.labName}.`
          );
        }
      } else if (pendingAction === 'regenerate') {
        const res = await credentialService.regenerateSessionUnlockCredential(
          examination.id,
          sitting.sittingId
        );
        await onRefresh();
        setRevealOnceSecret(res.revealOnceSecret);
        setRevealCredentialId(res.credential.credentialId);
        setRevealExpiresAt(res.credential.expiresAt || null);
        setCopied(false);
        if (res.credential.status === 'Synchronisation Failed') {
          onNotify(
            'error',
            'Regeneration Sync Failed',
            res.credential.syncError ||
              `Replacement credential is NOT active until ${sitting.labName} confirms verifier synchronisation.`
          );
        } else {
          onNotify(
            'success',
            'Unlock Credential Regenerated',
            `Replaced session credential with ${res.credential.credentialId} on ${sitting.labName}.`
          );
        }
      } else if (pendingAction === 'revoke') {
        const updated = await credentialService.revokeSessionUnlockCredential(
          examination.id,
          sitting.sittingId
        );
        await onRefresh();
        onNotify(
          'info',
          'Unlock Credential Revoked',
          `${updated.credentialId} has been revoked for ${sitting.sittingName}.`
        );
      }
      setPendingAction(null);
    } catch (err) {
      onNotify(
        'error',
        'Credential Operation Failed',
        err instanceof Error ? err.message : 'Unable to complete credential action.'
      );
      setPendingAction(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCopySecret = async () => {
    if (!revealOnceSecret) return;
    try {
      await navigator.clipboard.writeText(revealOnceSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify(
        'error',
        'Clipboard Unavailable',
        'Copy the displayed credential manually before closing this dialog.'
      );
    }
  };

  const handleCloseReveal = () => {
    setRevealOnceSecret(null);
    setRevealCredentialId(null);
    setRevealExpiresAt(null);
    setCopied(false);
  };

  return (
    <div className="p-5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#D9E2EF] dark:border-[#334155] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#D9E2EF] dark:border-[#334155] pb-3.5">
        <div className="flex items-start gap-2.5">
          <KeyRound className="w-5 h-5 text-[#2563EB] dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-[16px] font-bold text-[#1F2937] dark:text-slate-100">
              Invigilator Session Unlock Password
            </h3>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
              {examination.examCode} ({examination.subjectCode}) &middot;{' '}
              {sitting.sittingName} &middot; {sitting.examDate} ({sitting.startTime}) &middot;{' '}
              <strong className="text-[#1F2937] dark:text-slate-200">
                {sitting.labName}
              </strong>
            </p>
          </div>
        </div>
        <StatusIndicator
          tone={getCredentialStatusTone(effectiveStatus)}
          label={effectiveStatus}
        />
      </div>

      {/* Sync Failure / Connectivity Alert */}
      {credential?.syncError && (
        <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-[#B42318] dark:text-red-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Lab Server Synchronisation Issue:</strong> {credential.syncError}
          </div>
        </div>
      )}

      {!isLabConnected && !credential?.syncError && (
        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-[#B7791F] dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Lab Server Offline:</strong> {sitting.labName} is currently disconnected. Any newly generated or regenerated verifier will remain in <strong>Synchronisation Failed</strong> until the Lab Server acknowledges sync.
          </div>
        </div>
      )}

      {/* System B: Session Unlock Credential Metadata Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs bg-[#F5F7FB] dark:bg-[#0F172A]/60 border border-[#D9E2EF] dark:border-[#334155] rounded-lg p-3.5">
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Unlock Password</div>
          <div className="font-mono font-bold text-sm text-[#1F2937] dark:text-slate-100 mt-0.5">
            {credential ? credential.maskedPreview || maskCredentialSecret() : '—'}
          </div>
        </div>
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Credential ID / Rev</div>
          <div className="font-mono font-semibold text-[#1F2937] dark:text-slate-200 mt-0.5">
            {credential ? `${credential.credentialId} (Rev ${credential.revision})` : 'Not Issued'}
          </div>
        </div>
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Lab Server Verifier Sync</div>
          <div
            className={`font-semibold mt-0.5 ${
              (credential?.syncStatus === 'Synced' || (credential as any)?.sync_status === 'Synced' || credential?.status === 'Active')
                ? 'text-[#16834A] dark:text-emerald-400'
                : (credential?.syncStatus === 'Sync Failed' || (credential as any)?.sync_status === 'Sync Failed' || credential?.status === 'Synchronisation Failed')
                  ? 'text-[#B42318] dark:text-red-400'
                  : 'text-[#64748B] dark:text-slate-300'
            }`}
          >
            {credential ? (credential.syncStatus || (credential as any)?.sync_status || (credential.status === 'Active' ? 'Synced' : 'Not Synced')) : 'Not Synced'}
          </div>
        </div>
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Generated At</div>
          <div className="font-mono text-[#1F2937] dark:text-slate-200 mt-0.5">
            {credential?.generatedAt || '—'}
          </div>
        </div>
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Last Regenerated</div>
          <div className="font-mono text-[#1F2937] dark:text-slate-200 mt-0.5">
            {credential?.lastRegeneratedAt || '—'}
          </div>
        </div>
        <div>
          <div className="text-[#64748B] dark:text-slate-400">Valid Until (Window +30m)</div>
          <div className="font-mono text-[#1F2937] dark:text-slate-200 mt-0.5">
            {credential?.expiresAt
              ? formatIstDisplayFromIso(credential.expiresAt)
              : '—'}
          </div>
        </div>
      </div>

      {/* System B Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        {canGenerate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingAction('generate')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 rounded-lg cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Generate Password
          </button>
        )}

        {canRegenerate && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingAction('regenerate')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#1F2937] dark:text-slate-100 bg-[#F5F7FB] dark:bg-[#0F172A] border border-[#D9E2EF] dark:border-[#334155] hover:border-[#2563EB] disabled:opacity-40 rounded-lg cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate Password
          </button>
        )}

        {canRevoke && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingAction('revoke')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#B42318] dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-950/60 disabled:opacity-40 rounded-lg cursor-pointer"
          >
            <ShieldOff className="w-3.5 h-3.5" />
            Revoke Password
          </button>
        )}

        {isImmutableExam && (
          <span className="text-xs text-[#64748B] dark:text-slate-400">
            Credential lifecycle locked ({sessionStatus || examination.status}).
          </span>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={pendingAction === 'generate'}
        title="Generate Session Unlock Credential"
        description={`Generate a new session-specific Invigilator Unlock Credential for ${examination.examCode} — ${sitting.sittingName} in ${sitting.labName}?`}
        consequenceNote="A cryptographically random credential will be displayed ONCE after generation and only its salted verifier metadata will be synchronised to the Lab Server for offline invigilator unlock verification."
        confirmLabel="Generate Credential"
        variant="primary"
        loading={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleExecuteConfirmedAction}
      />

      <ConfirmDialog
        open={pendingAction === 'regenerate'}
        title="Regenerate Session Unlock Credential"
        description={`Replace the current unlock credential for ${examination.examCode} — ${sitting.sittingName} in ${sitting.labName}?`}
        consequenceNote="Regenerating immediately invalidates the prior credential revision. The new credential becomes Active only after the Lab Server confirms synchronisation of the replacement salted verifier."
        confirmLabel="Regenerate Credential"
        variant="violet"
        loading={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleExecuteConfirmedAction}
      />

      <ConfirmDialog
        open={pendingAction === 'revoke'}
        title="Revoke Session Unlock Credential"
        description={`Revoke unlock credential ${credential?.credentialId || ''} for ${sitting.sittingName}?`}
        consequenceNote="Once revoked, invigilators in the lab cannot unlock any newly locked student screens using this credential until a new credential is generated and synced."
        confirmLabel="Revoke Credential"
        variant="destructive"
        loading={busy}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleExecuteConfirmedAction}
      />

      {/* Reveal-Once Modal */}
      {revealOnceSecret && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#17243A]/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reveal-unlock-secret-title"
        >
          <div className="bg-white dark:bg-slate-900 border border-[#D9E2EF] dark:border-slate-700 rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#16834A] shrink-0" />
                <h3
                  id="reveal-unlock-secret-title"
                  className="text-lg font-bold text-[#1F2937] dark:text-slate-100"
                >
                  Session Unlock Credential Ready (Shown Once)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseReveal}
                aria-label="Close and mask credential"
                className="text-[#64748B] hover:text-[#1F2937] dark:hover:text-slate-100 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#64748B] dark:text-slate-400 space-y-1">
              <div>
                <strong>Sitting:</strong> {examination.examCode} &middot; {sitting.sittingName} (
                {sitting.labName})
              </div>
              {revealCredentialId && (
                <div>
                  <strong>Credential Reference:</strong>{' '}
                  <span className="font-mono">{revealCredentialId}</span>
                </div>
              )}
              {revealExpiresAt && (
                <div>
                  <strong>Expires At:</strong>{' '}
                  <span className="font-mono">
                    {formatIstDisplayFromIso(revealExpiresAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#F5F7FB] dark:bg-[#0F172A] border-2 border-[#2563EB] flex items-center justify-between gap-3">
              <code className="text-xl sm:text-2xl font-mono font-bold tracking-wider text-[#1F2937] dark:text-white select-all">
                {revealOnceSecret}
              </code>
              <button
                type="button"
                onClick={handleCopySecret}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-[#B7791F] dark:text-amber-300 leading-relaxed">
              <strong>Security Notice:</strong> This credential is shown once only for handoff to the sitting invigilator. Closing this dialog permanently discards the plaintext from memory and masks the value in COE Portal screens.
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCloseReveal}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#242468] hover:bg-[#1B1B52] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8] rounded-lg cursor-pointer"
              >
                I Have Copied &amp; Mask Credential
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
