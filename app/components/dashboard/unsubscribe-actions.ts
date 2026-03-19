export type UnsubscribeSender = {
  sender: string;
  unsubscribeAvailable?: boolean;
  unsubscribeTarget?: string;
  unsubscribeMethod?: "url" | "mailto" | null;
};

export function runUnsubscribeFlow(
  item: UnsubscribeSender,
  setError: (value: string) => void,
  setSuccess: (value: string) => void,
  onSuccess?: () => void
) {
  const target = item.unsubscribeTarget;

  if (!item.unsubscribeAvailable || !target) {
    setError("No unsubscribe option is available for this sender.");
    return;
  }

  const isMailto = item.unsubscribeMethod === "mailto";

  const confirmed = window.confirm(
    isMailto
      ? `Unsubscribe from ${item.sender}?\n\nInboxShaper will open your email app using the unsubscribe address provided by the sender.`
      : `Unsubscribe from ${item.sender}?\n\nInboxShaper will open the sender-provided unsubscribe page in a new tab.`
  );

  if (!confirmed) return;

  try {
    const link = document.createElement("a");
    link.href = target;

    if (isMailto) {
      link.target = "_self";
    } else {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess(
      isMailto
        ? `Opened unsubscribe email draft for ${item.sender}. Existing emails from this sender will remain in your inbox until you archive or move them to Trash.`
        : `Opened unsubscribe page for ${item.sender}. Existing emails from this sender will remain in your inbox until you archive or move them to Trash.`
    );

    onSuccess?.();
  } catch {
    setError("Failed to open unsubscribe link.");
  }
}