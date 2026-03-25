import { useState, useRef } from 'react'
import { Smartphone, DollarSign, CheckCircle, XCircle, Clock, AlertCircle, Loader2, ArrowLeft, Wifi } from 'lucide-react'
import './App.css'

const STK_PUSH_URL = 'https://mpesapi.giftedtech.co.ke/api/payNexusTech.php'
const VERIFY_URL = 'https://mpesapi.giftedtech.co.ke/api/verify-transaction.php'
const TILL_NUMBER = '6903935'

type TxStatus = 'idle' | 'sending' | 'polling' | 'success' | 'cancelled' | 'failed_insufficient_funds' | 'timeout' | 'failed'

interface StkResponse {
  success: boolean
  message: string
  CheckoutRequestID: string
  MerchantRequestID: string
  ResponseDescription: string
}

interface VerifyData {
  ResultCode?: number
  Amount?: number
  PhoneNumber?: string
  MpesaReceiptNumber?: string
  TransactionDate?: string
  MerchantRequestID?: string
  CheckoutRequestID?: string
  ResultDesc?: string
  message?: string
}

interface VerifyResponse {
  success: boolean
  status: string
  data: VerifyData
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length >= 9) {
    return '254' + digits.slice(1)
  }
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits
  return digits
}

function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 14) return dateStr
  const y = dateStr.slice(0, 4)
  const mo = dateStr.slice(4, 6)
  const d = dateStr.slice(6, 8)
  const h = dateStr.slice(8, 10)
  const mi = dateStr.slice(10, 12)
  const s = dateStr.slice(12, 14)
  return `${d}/${mo}/${y} ${h}:${mi}:${s}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function App() {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<TxStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txData, setTxData] = useState<VerifyData | null>(null)
  const [checkoutId, setCheckoutId] = useState('')
  const [pollCount, setPollCount] = useState(0)
  const abortRef = useRef(false)

  const reset = () => {
    setStatus('idle')
    setErrorMsg('')
    setTxData(null)
    setCheckoutId('')
    setPollCount(0)
    abortRef.current = false
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    abortRef.current = false

    const formattedPhone = formatPhone(phone)
    if (!/^2547\d{8}$|^2541\d{8}$/.test(formattedPhone)) {
      setErrorMsg('Enter a valid Safaricom number (e.g. 0712345678 or 254712345678)')
      return
    }
    const amt = parseInt(amount, 10)
    if (!amt || amt < 1) {
      setErrorMsg('Amount must be at least KES 1')
      return
    }

    setStatus('sending')

    try {
      const stkRes = await fetch(STK_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ phoneNumber: formattedPhone, amount: amt }),
      })
      const stkData: StkResponse = await stkRes.json()

      if (!stkData.success || !stkData.CheckoutRequestID) {
        setErrorMsg(stkData.message || 'Failed to send STK push. Try again.')
        setStatus('failed')
        return
      }

      setCheckoutId(stkData.CheckoutRequestID)
      setStatus('polling')
      setPollCount(0)

      await pollTransaction(stkData.CheckoutRequestID)
    } catch {
      setErrorMsg('Network error. Check your connection and try again.')
      setStatus('failed')
    }
  }

  const pollTransaction = async (cid: string) => {
    let attempts = 0
    const maxAttempts = 40

    while (attempts < maxAttempts) {
      if (abortRef.current) return

      await sleep(2000)

      if (abortRef.current) return

      attempts++
      setPollCount(attempts)

      try {
        const verifyRes = await fetch(VERIFY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutRequestId: cid }),
        })
        const verifyData: VerifyResponse = await verifyRes.json()

        if (verifyData.status === 'completed' && verifyData.success) {
          setTxData(verifyData.data)
          setStatus('success')
          return
        }

        if (verifyData.status === 'cancelled') {
          setTxData(verifyData.data)
          setStatus('cancelled')
          return
        }

        if (verifyData.status === 'failed_insufficient_funds') {
          setTxData(verifyData.data)
          setStatus('failed_insufficient_funds')
          return
        }

        if (verifyData.status === 'timeout') {
          setTxData(verifyData.data)
          setStatus('timeout')
          return
        }

        if (!verifyData.success && verifyData.status !== 'pending') {
          setTxData(verifyData.data)
          setErrorMsg(verifyData.data?.ResultDesc || 'Transaction failed.')
          setStatus('failed')
          return
        }
      } catch {
        // Continue polling on network errors
      }

      await sleep(1000)
    }

    setErrorMsg('Payment verification timed out. Check your M-Pesa messages.')
    setStatus('failed')
  }

  const handleCancel = () => {
    abortRef.current = true
    setStatus('idle')
    setErrorMsg('')
    setPollCount(0)
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="logo-wrap">
          <div className="logo-circle">
            <span className="logo-m">M</span>
          </div>
          <div>
            <h1 className="brand">Huncky Pay</h1>
            <p className="brand-sub">Powered by M-Pesa</p>
          </div>
        </div>
        <div className="till-badge">
          <Smartphone size={14} />
          Till: <strong>{TILL_NUMBER}</strong>
        </div>
      </div>

      {status === 'idle' || status === 'failed' ? (
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label htmlFor="phone">Phone Number</label>
            <div className="input-wrap">
              <Smartphone size={18} className="input-icon" />
              <input
                id="phone"
                type="tel"
                placeholder="0712 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                autoComplete="tel"
              />
            </div>
            <span className="hint">Safaricom numbers only (07xx or 01xx)</span>
          </div>

          <div className="field">
            <label htmlFor="amount">Amount (KES)</label>
            <div className="input-wrap">
              <DollarSign size={18} className="input-icon" />
              <input
                id="amount"
                type="number"
                placeholder="100"
                value={amount}
                min="1"
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={status === 'sending'}>
            {status === 'sending' ? (
              <><Loader2 size={18} className="spin" /> Sending…</>
            ) : (
              <>Pay Now</>
            )}
          </button>

          <p className="secure-note">
            <Wifi size={12} /> Secure payment via Safaricom M-Pesa
          </p>
        </form>
      ) : status === 'sending' ? (
        <div className="status-panel">
          <div className="spinner-ring">
            <Loader2 size={40} className="spin green" />
          </div>
          <h2>Sending STK Push…</h2>
          <p>Please wait while we initiate your payment request.</p>
        </div>
      ) : status === 'polling' ? (
        <div className="status-panel">
          <div className="spinner-ring">
            <Loader2 size={40} className="spin green" />
          </div>
          <h2>Waiting for Payment…</h2>
          <p>A payment prompt has been sent to your phone.</p>
          <p className="check-sub">Enter your M-Pesa PIN to complete the payment.</p>
          <div className="poll-info">
            <Clock size={14} />
            Checking transaction status… ({pollCount})
          </div>
          <div className="checkout-id">
            Ref: <code>{checkoutId.slice(-16)}</code>
          </div>
          <button className="btn-ghost" onClick={handleCancel}>
            <ArrowLeft size={16} /> Cancel
          </button>
        </div>
      ) : status === 'success' ? (
        <div className="status-panel success">
          <div className="icon-circle success-circle">
            <CheckCircle size={44} />
          </div>
          <h2>Payment Successful!</h2>
          <p>Your M-Pesa payment was received.</p>
          {txData && (
            <div className="receipt">
              <div className="receipt-row">
                <span>Receipt</span>
                <strong>{txData.MpesaReceiptNumber}</strong>
              </div>
              <div className="receipt-row">
                <span>Amount</span>
                <strong>KES {txData.Amount?.toLocaleString()}</strong>
              </div>
              <div className="receipt-row">
                <span>Phone</span>
                <strong>{txData.PhoneNumber}</strong>
              </div>
              {txData.TransactionDate && (
                <div className="receipt-row">
                  <span>Date</span>
                  <strong>{formatDate(txData.TransactionDate)}</strong>
                </div>
              )}
            </div>
          )}
          <button className="btn-primary" onClick={reset}>
            Make Another Payment
          </button>
        </div>
      ) : status === 'cancelled' ? (
        <div className="status-panel warn">
          <div className="icon-circle warn-circle">
            <XCircle size={44} />
          </div>
          <h2>Payment Cancelled</h2>
          <p>You cancelled the M-Pesa payment request.</p>
          <button className="btn-primary" onClick={reset}>
            Try Again
          </button>
        </div>
      ) : status === 'failed_insufficient_funds' ? (
        <div className="status-panel error">
          <div className="icon-circle error-circle">
            <AlertCircle size={44} />
          </div>
          <h2>Insufficient Funds</h2>
          <p>Your M-Pesa balance is too low to complete this payment.</p>
          {txData && (
            <p className="sub-info">Attempted: <strong>KES {txData.Amount?.toLocaleString()}</strong></p>
          )}
          <button className="btn-primary" onClick={reset}>
            Try a Different Amount
          </button>
        </div>
      ) : status === 'timeout' ? (
        <div className="status-panel warn">
          <div className="icon-circle warn-circle">
            <Clock size={44} />
          </div>
          <h2>Request Timed Out</h2>
          <p>Could not reach your phone. Please check your network and try again.</p>
          <button className="btn-primary" onClick={reset}>
            Try Again
          </button>
        </div>
      ) : (
        <div className="status-panel error">
          <div className="icon-circle error-circle">
            <XCircle size={44} />
          </div>
          <h2>Payment Failed</h2>
          <p>{errorMsg || 'An unexpected error occurred. Please try again.'}</p>
          <button className="btn-primary" onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
