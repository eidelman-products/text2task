export default function TermsPage() {
  return (
    <main style={{ maxWidth: "800px", margin: "80px auto", lineHeight: "1.7" }}>
      <h1>Terms of Service</h1>

      <p><b>Effective date:</b> March 2026</p>

      <p>
        InboxShaper is a tool designed to help users organize and clean their Gmail inbox
        using simple, user-controlled actions.
      </p>

      <h2>1. Use of Service</h2>
      <p>
        By using InboxShaper, you authorize the application to access limited Gmail data
        necessary to provide features such as inbox analysis, sender grouping, promotions
        detection, and user-requested cleanup actions.
      </p>

      <h2>2. User Control</h2>
      <p>
        InboxShaper only performs actions that are explicitly triggered by the user.
        The application does not automatically delete, modify, or archive emails without
        user interaction.
      </p>

      <h2>3. No Email Storage</h2>
      <p>
        InboxShaper does not store, copy, or permanently archive your emails.
        Operations are performed directly through the Gmail API in real time.
      </p>

      <h2>4. User Responsibility</h2>
      <p>
        Users are responsible for reviewing actions before applying changes to their inbox.
        InboxShaper is a helper tool, and users remain responsible for the final decision
        to delete, archive, or otherwise manage their email.
      </p>

      <h2>5. Limitation of Liability</h2>
      <p>
        InboxShaper is provided &quot;as is&quot; without warranties of any kind.
        To the maximum extent permitted by law, InboxShaper shall not be liable for any
        damages, losses, or consequences resulting from the use of the service.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions regarding these Terms of Service, please contact:
        support@inboxshaper.com
      </p>

      <h2>Google API Services</h2>
      <p>
        InboxShaper’s use of Google APIs complies with the Google API Services User Data Policy.
      </p>

      <p>
        Users may revoke access to their Gmail account at any time through their Google Account
        security settings or through the Disconnect feature inside InboxShaper.
      </p>
    </main>
  );
}