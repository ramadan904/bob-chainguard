import { useState } from 'react'
import { buildLoginMessage, recoverSigner, signWithWallet } from '../lib/signing.js'
import { sameAddress } from '../lib/address.js'

export function SignMessage({ wallet }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function sign() {
    setError(null)
    try {
      const message = buildLoginMessage(wallet.account, Math.random().toString(36).slice(2, 10))
      const signed = await signWithWallet(wallet.signer, message)
      setResult({ ...signed, verified: sameAddress(await recoverSigner(message, signed.signature), wallet.account) })
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <section className="card">
      <h2>Sign-in message</h2>
      <button disabled={!wallet.signer} onClick={sign}>Sign</button>
      {error && <p className="error">{error}</p>}
      {result && (
        <>
          <pre>{result.message}</pre>
          <p className="mono small">{result.signature}</p>
          <p className={result.verified ? 'ok' : 'error'}>{result.verified ? 'Signature verified' : 'Signature mismatch'}</p>
        </>
      )}
    </section>
  )
}
