import { useState } from 'react';
import Dialog from './Dialog';

export default function ReleasePolicy({ policy, onSave, onClose }) {
  const [warning, setWarning] = useState(String(policy.warningDays));
  const [overdue, setOverdue] = useState(String(policy.overdueDays));
  const [error, setError] = useState('');
  function submit(event) {
    event.preventDefault();
    const warningDays = Number(warning), overdueDays = Number(overdue);
    if (!Number.isInteger(warningDays) || !Number.isInteger(overdueDays) || warningDays < 1 || overdueDays <= warningDays || overdueDays > 730) {
      setError('Use whole days: the warning must come before the overdue limit (maximum 730 days).'); return;
    }
    onSave({ warningDays, overdueDays });
  }
  return <Dialog title="Your release rhythm" onClose={onClose}><form className="policy-form" onSubmit={submit}><p>Age matters here. Flag plugins early enough to plan a release, then bring overdue releases to the top of the board.</p><div className="policy-fields"><label>Warn after<span><input type="number" min="1" max="729" value={warning} onChange={(event) => setWarning(event.target.value)} required /> days</span></label><label>Overdue after<span><input type="number" min="2" max="730" value={overdue} onChange={(event) => setOverdue(event.target.value)} required /> days</span></label></div>{error && <p role="alert" className="policy-error">{error}</p>}<p className="policy-note">Applies to every plugin. Saved in this browser; your developer can choose the same limits on their machine.</p><div className="detail-links"><button type="submit" className="button button-primary">Apply release policy</button><button type="button" className="button" onClick={onClose}>Cancel</button></div></form></Dialog>;
}
