export default function Terms() {
  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "80px",
        maxWidth: "900px",
        margin: "auto",
        lineHeight: "1.6"
      }}
    >
      <h1>Terms of Service</h1>

      <p>
        InboxShaper is a tool designed to help users manage and clean their Gmail inbox using
        simple rule-based filters.
      </p>

      <h2>Use of Service</h2>

      <p>
        By using InboxShaper, you grant permission for the application to access limited Gmail
        data necessary to perform actions requested by you, such as identifying emails by sender
        or subject and moving them to the Trash folder.
      </p>

      <h2>User Control</h2>

      <p>
        InboxShaper only performs actions explicitly triggered by the user. The application does
        not automatically delete or modify emails without user interaction.
      </p>

      <h2>No Email Storage</h2>

      <p>
        InboxShaper does not store, copy, or archive your emails. All operations are performed
        directly through the Gmail API in real time.
      </p>

      <h2>Limitation of Liability</h2>

      <p>
        InboxShaper is provided "as is" without warranties of any kind. Users are responsible for
        reviewing rules before executing actions that modify their inbox.
      </p>

      <h2>Contact</h2>

      <p>
        For questions regarding these terms please contact: support@inboxshaper.com
      </p>
    </main>
  );
}
