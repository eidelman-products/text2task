export default function Privacy() {
  return (
    <main style={{ maxWidth: "800px", margin: "80px auto", lineHeight: "1.6", padding: "0 16px" }}>
      <h1>Privacy Policy</h1>

      <p>
        InboxShaper is designed with privacy as a core principle.
        We do not store your emails or personal data.
      </p>

      <h2>Information Access</h2>
      <p>
        When you connect your Gmail account, InboxShaper requests permission
        to read basic email metadata such as sender and subject lines in order
        to identify unwanted emails like newsletters or automated messages.
      </p>

      <h2>No Email Storage</h2>
      <p>
        InboxShaper does not store, copy, or archive your emails.
        All processing happens in real-time directly through the Gmail API.
      </p>

      <h2>Actions Performed</h2>
      <p>
        Based on rules selected by the user, InboxShaper may move certain
        emails to the Gmail Trash folder.
      </p>

      <h2>Contact</h2>
      <p>
        For questions please contact: support@inboxshaper.com
      </p>
    </main>
  );
}
