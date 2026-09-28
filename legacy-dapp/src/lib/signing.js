import { keccak256, toHex, recoverMessageAddress } from 'viem'

export function messageDigest(message) {
  return keccak256(toHex(message))
}

export async function recoverSigner(message, signature) {
  return recoverMessageAddress({ message, signature })
}

export async function signWithWallet(signer, message) {
  const account = signer.account?.address ?? (await signer.getAddresses())[0]
  const signature = await signer.signMessage({ account, message })
  return { message, signature, signer: account }
}

export function buildLoginMessage(address, nonce, issuedAt = new Date().toISOString()) {
  return `ChainGuard Wallet wants you to sign in with ${address}\n\nNonce: ${nonce}\nIssued At: ${issuedAt}`
}
