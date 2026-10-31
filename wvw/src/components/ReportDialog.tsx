import { useState } from 'react';
import { REPORT_REASONS, type ReportReason } from '../shared/constants';
import type { ReportInput } from '../shared/types';
import { call, errorMessage } from '../firebase';
import { isVerified, useStore } from '../store';
import { Modal } from './ui';

/** Report an event / guild / run. Verified members only (anti-spam). */
export function ReportButton({ targetType, targetId }: { targetType: ReportInput['targetType']; targetId: string }) {
  const member = useStore((s) => s.member);
  const toast = useStore((s) => s.toast);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('fake');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isVerified(member)) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await call('report', { targetType, targetId, reason, details } satisfies ReportInput);
      toast('Report sent to the moderators. Thank you!', 'ok');
      setOpen(false);
      setDetails('');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        🚩 Report
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Report this ${targetType}`}>
        <p className="muted mb-3 text-sm">
          Moderators review every report. They see the reason and your note — not who you are, and you never see who
          the commander is.
        </p>
        <label className="label" htmlFor="rep-reason">Reason</label>
        <select id="rep-reason" className="select mb-3" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
          {REPORT_REASONS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="label" htmlFor="rep-details">Details (optional)</label>
        <textarea id="rep-details" className="textarea" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-gold" onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </Modal>
    </>
  );
}
