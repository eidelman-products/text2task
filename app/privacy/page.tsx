export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: "800px", margin: "80px auto", lineHeight: "1.7" }}>
      <h1>Privacy Policy</h1>

      <p><b>Effective date:</b> March 2026</p>

      <p>
        InboxShaper is designed with privacy as a core principle. This Privacy Policy explains
        what information InboxShaper accesses, how it is used, and how it is protected.
      </p>

      <h2>1. Information Access</h2>
      <p>
        When you connect your Gmail account, InboxShaper requests access only to the Gmail
        data necessary to provide inbox cleanup and organization features.
      </p>

      <h2>2. Gmail Data Usage</h2>
      <p>
        InboxShaper accesses limited Gmail data such as sender information, subject lines,
        message labels, and message metadata in order to identify sender groups,
        detect promotions categories, show inbox insights, and perform actions requested by the user.
      </p>

      <p>
        InboxShaper only accesses Gmail data required to provide inbox organization features.
      </p>

      <p>
        InboxShaper does not use Gmail data for advertising, marketing, profiling, or any unrelated purposes.
      </p>

      <p>
        Gmail data is processed in real time and is not permanently stored by InboxShaper servers.
      </p>

      <h2>3. No Email Storage</h2>
      <p>
        InboxShaper does not store, copy, or permanently archive your email content.
        Processing happens in real time through the Gmail API.
      </p>

      <h2>4. User Actions</h2>
      <p>
        InboxShaper only performs actions that are explicitly initiated by the user.
        No emails are modified or deleted automatically.
      </p>

      <h2>5. Data Protection</h2>
      <p>
        InboxShaper uses secure authentication and access controls to protect user data.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions please contact: support@inboxshaper.com
      </p>

      <h2>Google API Services Disclosure</h2>
      <p>
        InboxShaper’s use of information received from Google APIs will adhere to the Google
        API Services User Data Policy, including the Limited Use requirements.
      </p>

      <p>
        InboxShaper only accesses Gmail metadata required to provide inbox organization features.
        InboxShaper does not sell or transfer Gmail user data to third parties.
      </p>

      <p>
        All access to Gmail data is used solely to provide functionality requested by the user.
      </p>
    </main>
  );
}