import { useEffect, useState } from 'react'
import Modal from './Modal'
import RuleError from './RuleError'

/** A small confirmation. onConfirm may throw; the error is shown inside the dialog. */
export default function Confirm({ open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Keep it', tone = 'danger', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (open) {
      setBusy(false)
      setError(null)
    }
  }, [open])
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} data-autofocus>
            {cancelLabel}
          </button>
          <button className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={go} disabled={busy}>
            {busy ? 'One moment' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="text-[15.5px]">{children}</div>
        <RuleError error={error} />
      </div>
    </Modal>
  )
}
