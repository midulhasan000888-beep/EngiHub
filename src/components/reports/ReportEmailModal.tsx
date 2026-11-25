import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiUrl } from '../../engine/apiClient';
import {
  clearGmailAccessToken,
  connectGmailWithPopup,
  subscribeGmailToken,
} from '../../firebase';
import { EmailHistoryRecord } from '../../types';

export interface EmailAttachmentBundle {
  pdfAttachment?: { filename: string; base64: string };
  excelAttachment?: { filename: string; base64: string };
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  reportId?: string;
  reportNumber: string;
  reportTitle: string;
  defaultMessageSummary: string;
  buildAttachments: (opts: { includePdf: boolean; includeExcel: boolean }) => Promise<EmailAttachmentBundle>;
  retryEntry?: EmailHistoryRecord | null;
}

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const ReportEmailModal: React.FC<ModalProps> = ({
  open,
  onClose,
  reportId,
  reportNumber,
  reportTitle,
  defaultMessageSummary,
  buildAttachments,
  retryEntry,
}) => {
  const {
    user,
    profile,
    isAdmin,
    language,
    reportSettings,
    saveEmailHistory,
    updateEmailHistory,
    showToast,
  } = useApp();

  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [serverRelayAvailable, setServerRelayAvailable] = useState(false);
  const [provider, setProvider] = useState<'gmail_oauth' | 'resend'>('gmail_oauth');

  const [toRaw, setToRaw] = useState('');
  const [ccRaw, setCcRaw] = useState('');
  const [bccRaw, setBccRaw] = useState('');
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [includePdf, setIncludePdf] = useState(true);
  const [includeExcel, setIncludeExcel] = useState(false);

  const [step, setStep] = useState<'compose' | 'confirm'>('compose');
  const [authorizingGmail, setAuthorizingGmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribeGmailToken(setGmailToken);
    return unsub;
  }, []);

  useEffect(() => {
    fetch(apiUrl('/api/reports/email-capabilities'))
      .then((r) => r.json())
      .then((d: { serverProviderAvailable?: boolean }) => {
        setServerRelayAvailable(Boolean(d.serverProviderAvailable));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep('compose');
    setErrorMsg('');
    if (retryEntry) {
      setToRaw(retryEntry.to.join(', '));
      setCcRaw((retryEntry.cc || []).join(', '));
      setBccRaw((retryEntry.bcc || []).join(', '));
      setSubject(retryEntry.subject);
      setMessageBody(retryEntry.messageBody || '');
      setIncludePdf(retryEntry.hasPdfAttachment ?? true);
      setIncludeExcel(Boolean(retryEntry.hasExcelAttachment));
      setProvider(retryEntry.provider === 'resend' ? 'resend' : 'gmail_oauth');
    } else {
      setToRaw('');
      setCcRaw('');
      setBccRaw('');
      setSubject(`[${reportNumber}] ${reportTitle}`);
      setMessageBody(
        defaultMessageSummary ||
          `Please find attached the technical engineering report "${reportTitle}" (${reportNumber}), generated via SUTRO SATHI.`
      );
      setIncludePdf(true);
      setIncludeExcel(false);
      setProvider('gmail_oauth');
    }
  }, [open, retryEntry, reportNumber, reportTitle, defaultMessageSummary]);

  if (!open) return null;

  const toList = parseEmailList(toRaw);
  const ccList = parseEmailList(ccRaw);
  const bccList = parseEmailList(bccRaw);
  const allowExcel = isAdmin || reportSettings.allowExcelExport !== false;

  const handleAuthorizeGmail = async () => {
    setAuthorizingGmail(true);
    setErrorMsg('');
    try {
      await connectGmailWithPopup();
      showToast(language === 'bn' ? 'জিমেইল অনুমোদন সম্পন্ন হয়েছে।' : 'Gmail send permission granted for this session.', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gmail authorization cancelled or failed.');
    } finally {
      setAuthorizingGmail(false);
    }
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (toList.length === 0) {
      setErrorMsg('Please enter at least one recipient email in To.');
      return;
    }
    const invalid = [...toList, ...ccList, ...bccList].find((addr) => !isValidEmail(addr));
    if (invalid) {
      setErrorMsg(`Invalid email address: ${invalid}`);
      return;
    }
    if (!subject.trim()) {
      setErrorMsg('Subject cannot be empty.');
      return;
    }
    if (provider === 'gmail_oauth' && !gmailToken) {
      setErrorMsg('Please authorize Gmail access below before sending via Gmail.');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmAndSend = async () => {
    if (!user) return;
    setSending(true);
    setErrorMsg('');
    try {
      const attachments = await buildAttachments({
        includePdf,
        includeExcel: includeExcel && allowExcel,
      });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider === 'gmail_oauth' && gmailToken) {
        headers.Authorization = `Bearer ${gmailToken}`;
      }

      const resp = await fetch(apiUrl('/api/reports/send-email'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: subject.trim(),
          messageText: messageBody,
          provider,
          senderName: profile?.displayName || user.displayName || 'SUTRO SATHI Engineer',
          senderEmail: user.email || '',
          pdfAttachment: attachments.pdfAttachment,
          excelAttachment: attachments.excelAttachment,
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        needsGmailAuth?: boolean;
        provider?: 'gmail_oauth' | 'resend';
        deliveryStatus?: 'submitted' | 'sent' | 'failed';
        providerMessageId?: string;
        statusNote?: string;
        error?: string;
      };

      const sentAtIso = new Date().toISOString();

      if (!resp.ok) {
        if (data.needsGmailAuth) {
          clearGmailAccessToken();
        }
        const errText = data.error || `Email dispatch failed (HTTP ${resp.status})`;
        if (retryEntry) {
          await updateEmailHistory(retryEntry.id, {
            deliveryStatus: 'failed',
            errorDetail: errText,
            statusNote: 'Retry failed',
            sentAtIso,
          });
        } else {
          await saveEmailHistory({
            reportId,
            reportNumber,
            reportTitle,
            to: toList,
            cc: ccList,
            bcc: bccList,
            subject: subject.trim(),
            messageBody,
            hasPdfAttachment: Boolean(attachments.pdfAttachment),
            hasExcelAttachment: Boolean(attachments.excelAttachment),
            provider,
            deliveryStatus: 'failed',
            errorDetail: errText,
            sentAtIso,
          });
        }
        setErrorMsg(errText);
        setStep('compose');
        return;
      }

      const finalStatus = data.deliveryStatus === 'submitted' ? 'submitted' : 'sent';
      if (retryEntry) {
        await updateEmailHistory(retryEntry.id, {
          deliveryStatus: finalStatus,
          providerMessageId: data.providerMessageId || '',
          statusNote: data.statusNote || '',
          errorDetail: '',
          sentAtIso,
        });
      } else {
        await saveEmailHistory({
          reportId,
          reportNumber,
          reportTitle,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: subject.trim(),
          messageBody,
          hasPdfAttachment: Boolean(attachments.pdfAttachment),
          hasExcelAttachment: Boolean(attachments.excelAttachment),
          provider: data.provider || provider,
          providerMessageId: data.providerMessageId || '',
          deliveryStatus: finalStatus,
          statusNote: data.statusNote || '',
          sentAtIso,
        });
      }

      showToast(
        finalStatus === 'sent'
          ? language === 'bn'
            ? 'জিমেইল মাধ্যমে রিপোর্ট পাঠানো হয়েছে।'
            : 'Report email sent via authorized Gmail.'
          : 'Report email submitted to server relay.',
        'success'
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected email sending failure.');
      setStep('compose');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {retryEntry
                ? language === 'bn'
                  ? 'ব্যর্থ ইমেইল পুনরায় পাঠান'
                  : 'Retry Report Email Dispatch'
                : language === 'bn'
                  ? 'ইমেইলে রিপোর্ট পাঠান'
                  : 'Send Engineering Report via Email'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 p-3 flex items-start gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'compose' ? (
            <form onSubmit={handleProceedToConfirm} className="space-y-3.5">
              {/* Provider Selection & Session Gmail Auth */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Dispatch Provider</span>
                  {serverRelayAvailable && (
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value as 'gmail_oauth' | 'resend')}
                      className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
                    >
                      <option value="gmail_oauth">Authorized Gmail ({user?.email})</option>
                      <option value="resend">Server Email Relay</option>
                    </select>
                  )}
                </div>

                {provider === 'gmail_oauth' && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {gmailToken ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Gmail send permission active in this session ({user?.email})</span>
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        Gmail authorization is required to send directly from {user?.email || 'your account'}.
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleAuthorizeGmail}
                      disabled={authorizingGmail}
                      className="rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 text-[11px] font-medium cursor-pointer disabled:opacity-50"
                    >
                      {authorizingGmail
                        ? 'Authorizing...'
                        : gmailToken
                          ? 'Re-authorize Gmail'
                          : 'Authorize Gmail Send'}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-medium mb-1">To (comma-separated for multiple recipients) *</label>
                <input
                  type="text"
                  required
                  value={toRaw}
                  onChange={(e) => setToRaw(e.target.value)}
                  placeholder="client@company.com, lead.engineer@firm.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">CC (optional)</label>
                  <input
                    type="text"
                    value={ccRaw}
                    onChange={(e) => setCcRaw(e.target.value)}
                    placeholder="qa@company.com"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">BCC (optional)</label>
                  <input
                    type="text"
                    value={bccRaw}
                    onChange={(e) => setBccRaw(e.target.value)}
                    placeholder="archive@company.com"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Message Body (English / বাংলা)</label>
                <textarea
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePdf}
                    onChange={(e) => setIncludePdf(e.target.checked)}
                  />
                  <span>Attach Rendered PDF Report</span>
                </label>
                {allowExcel && (
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeExcel}
                      onChange={(e) => setIncludeExcel(e.target.checked)}
                    />
                    <span>Attach Excel Workbook (.xlsx)</span>
                  </label>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 font-medium cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview &amp; Confirm</span>
                </button>
              </div>
            </form>
          ) : (
            /* Mandatory Confirmation Gate with Email Preview */
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 p-4 space-y-2.5">
                <p className="font-bold text-blue-900 dark:text-blue-200">
                  Please confirm before sending email
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Method:</span>
                    <span className="font-semibold">
                      {provider === 'gmail_oauth' ? `Authorized Gmail (${user?.email})` : 'Server Relay'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Attachments:</span>
                    <span className="font-semibold">
                      {[includePdf ? 'Report.pdf' : null, includeExcel && allowExcel ? 'Data.xlsx' : null]
                        .filter(Boolean)
                        .join(', ') || 'None'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block">To:</span>
                    <span className="font-mono-tabular">{toList.join(', ')}</span>
                  </div>
                  {ccList.length > 0 && (
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 block">CC:</span>
                      <span className="font-mono-tabular">{ccList.join(', ')}</span>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block">Subject:</span>
                    <span className="font-semibold">{subject}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 whitespace-pre-wrap text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">
                  {messageBody}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStep('compose')}
                  disabled={sending}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 font-medium cursor-pointer"
                >
                  Back &amp; Edit
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAndSend}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 font-medium cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{sending ? 'Generating Attachments & Sending...' : 'Confirm & Send Email'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const EmailHistoryPanel: React.FC<{
  onRetryEmail: (entry: EmailHistoryRecord) => void;
}> = ({ onRetryEmail }) => {
  const { language, emailHistory, deleteEmailHistory } = useApp();

  if (emailHistory.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
        {language === 'bn'
          ? 'এখনো কোনো রিপোর্ট ইমেইলে পাঠানো হয়নি।'
          : 'No report email dispatches recorded yet.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-2.5 pr-3 font-semibold">Date / Time</th>
              <th className="py-2.5 pr-3 font-semibold">Report</th>
              <th className="py-2.5 pr-3 font-semibold">Recipients</th>
              <th className="py-2.5 pr-3 font-semibold">Provider &amp; ID</th>
              <th className="py-2.5 pr-3 font-semibold">Status</th>
              <th className="py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {emailHistory.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-3 font-mono-tabular whitespace-nowrap text-slate-600 dark:text-slate-300">
                  {item.sentAtIso.slice(0, 16).replace('T', ' ')}
                </td>
                <td className="py-3 pr-3">
                  <p className="font-semibold text-slate-900 dark:text-white">{item.reportTitle}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.subject} {item.hasPdfAttachment ? '· PDF' : ''} {item.hasExcelAttachment ? '· XLSX' : ''}
                  </p>
                </td>
                <td className="py-3 pr-3 text-slate-700 dark:text-slate-300">
                  <p>{item.to.join(', ')}</p>
                  {item.cc && item.cc.length > 0 && (
                    <p className="text-[10px] text-slate-500">CC: {item.cc.join(', ')}</p>
                  )}
                </td>
                <td className="py-3 pr-3 text-[11px] font-mono-tabular text-slate-500">
                  <p>{item.provider}</p>
                  {item.providerMessageId && <p className="truncate max-w-[140px]">ID: {item.providerMessageId}</p>}
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      item.deliveryStatus === 'sent' || item.deliveryStatus === 'delivered'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : item.deliveryStatus === 'submitted'
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    }`}
                  >
                    {item.deliveryStatus === 'failed' ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : item.deliveryStatus === 'submitted' ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    <span className="uppercase">{item.deliveryStatus}</span>
                  </span>
                  {item.errorDetail && (
                    <p className="text-[10px] text-red-600 mt-0.5 max-w-[200px]">{item.errorDetail}</p>
                  )}
                </td>
                <td className="py-3 text-right space-x-2 whitespace-nowrap">
                  {item.deliveryStatus === 'failed' && (
                    <button
                      type="button"
                      onClick={() => onRetryEmail(item)}
                      className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteEmailHistory(item.id)}
                    className="text-slate-400 hover:text-red-600 cursor-pointer"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
