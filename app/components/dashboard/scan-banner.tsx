type ScanBannerProps = {
  error?: string;
  success?: string;
};

export default function ScanBanner({
  error,
  success,
}: ScanBannerProps) {
  if (!error && !success) return null;

  if (error) {
    return (
      <div
        style={{
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "18px",
          padding: "16px",
          color: "#b91c1c",
          fontWeight: 800,
          marginBottom: "16px",
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#ecfdf5",
        border: "1px solid #86efac",
        borderRadius: "18px",
        padding: "16px",
        color: "#166534",
        fontWeight: 800,
        marginBottom: "16px",
      }}
    >
      {success}
    </div>
  );
}