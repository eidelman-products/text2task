type SecondaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export default function SecondaryButton({
  children,
  onClick,
  disabled = false,
}: SecondaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled
          ? "rgba(255,255,255,0.72)"
          : "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        color: disabled ? "#94a3b8" : "#2563eb",
        border: disabled ? "1px solid #e2e8f0" : "1px solid #bfdbfe",
        padding: "14px 22px",
        borderRadius: "16px",
        fontWeight: 800,
        fontSize: "15px",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "none"
          : "0 8px 20px rgba(37, 99, 235, 0.08)",
        transition:
          "all 180ms ease, transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
        transform: "translateY(0)",
        backdropFilter: "blur(8px)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 14px 28px rgba(37, 99, 235, 0.14)";
        e.currentTarget.style.borderColor = "#93c5fd";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 8px 20px rgba(37, 99, 235, 0.08)";
        e.currentTarget.style.borderColor = "#bfdbfe";
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0px) scale(0.985)";
      }}
      onMouseUp={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px) scale(1)";
      }}
    >
      {children}
    </button>
  );
}