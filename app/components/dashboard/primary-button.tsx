type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
};

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled
          ? "#94a3b8"
          : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
        color: "white",
        border: "none",
        padding: "14px 22px",
        borderRadius: "16px",
        fontWeight: 800,
        fontSize: "15px",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled
          ? "none"
          : "0 10px 24px rgba(37, 99, 235, 0.25)",
        transition:
          "all 180ms ease, transform 120ms ease, box-shadow 120ms ease",
        transform: "translateY(0)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 16px 32px rgba(37, 99, 235, 0.35)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          "0 10px 24px rgba(37, 99, 235, 0.25)";
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0px) scale(0.98)";
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