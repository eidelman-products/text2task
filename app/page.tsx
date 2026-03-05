export default function Home() {
  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        padding: "80px",
        textAlign: "center",
        maxWidth: "900px",
        margin: "auto",
      }}
    >
      <h1 style={{ fontSize: "56px", marginBottom: "20px" }}>
        InboxShaper
      </h1>

      <p style={{ fontSize: "22px", color: "#555" }}>
        AI that automatically cleans your Gmail inbox
      </p>

      <button
        style={{
          marginTop: "40px",
          padding: "18px 36px",
          fontSize: "20px",
          borderRadius: "10px",
          border: "none",
          background: "black",
          color: "white",
          cursor: "pointer",
        }}
      >
        Connect Gmail
      </button>

      <div style={{ marginTop: "100px", fontSize: "18px", color: "#444" }}>
        <p>✓ Remove newsletters</p>
        <p>✓ Detect spam</p>
        <p>✓ Clean your inbox automatically</p>
      </div>
    </main>
  );
}
