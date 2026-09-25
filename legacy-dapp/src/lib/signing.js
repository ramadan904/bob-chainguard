import { ethers } from 'ethers'

export function messageDigest(message) {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(message))
}

export function recoverSigner(message, signature) {
  return ethers.utils.verifyMessage(message, signature)
}

export async function signWithWallet(signer, message) {
  const signature = await signer.signMessage(message)
  return { message, signature, signer: await signer.getAddress() }
}

export function buildLoginMessage(address, nonce, issuedAt = new Date().toISOString()) {
  return `ChainGuard Wallet wants you to sign in with ${address}\n\nNonce: ${nonce}\nIssued At: ${issuedAt}`
}
