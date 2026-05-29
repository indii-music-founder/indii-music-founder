type BrowserAutomationResult = {
  status?: string;
  result?: string;
  error?: string;
};

const NON_CONFIRMATION_PATTERN = /(credential|login|sign in|manual|not available|missing|failed|error|could not|unable|required|stop)/i;

export function getConfirmedAutomationResult(result: BrowserAutomationResult, orgName: string): string {
  if (result.status !== 'completed') {
    throw new Error(`${orgName} automation did not complete: ${result.error || result.status || 'unknown status'}`);
  }

  const confirmation = (result.result ?? '').trim();
  if (!confirmation || NON_CONFIRMATION_PATTERN.test(confirmation)) {
    throw new Error(`${orgName} automation did not return a confirmed submission number.`);
  }

  return confirmation;
}
