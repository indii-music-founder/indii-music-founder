/**
 * Shared error helper for Gmail / Outlook mutation endpoints.
 */

export async function assertEmailMutationOk(
    providerLabel: string,
    actionLabel: string,
    messageId: string,
    response: Response
): Promise<void> {
    if (response.ok) {
        return;
    }

    let responseText = '';
    try {
        responseText = (await response.text()).trim();
    } catch {
        responseText = '';
    }

    const detail = responseText ? ` - ${responseText}` : '';
    throw new Error(
        `${providerLabel} ${actionLabel} failed for message ${messageId}: ${response.status}${detail}`
    );
}
