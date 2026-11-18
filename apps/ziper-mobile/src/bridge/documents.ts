// Document IDs are not authentication; Android load-start also fires on SPA history changes.
export function documentIdentity(data: string): string | null {
  try {
    const message = JSON.parse(data);
    return (message.type === 'getBridgeState' || message.type === 'requestHydrate') &&
      typeof message.documentId === 'string' &&
      /^[A-Za-z0-9]{21}$/.test(message.documentId)
      ? message.documentId
      : null;
  } catch {
    return null;
  }
}
