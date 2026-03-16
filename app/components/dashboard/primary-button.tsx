type PrimaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export default function PrimaryButton({
  children,
  onClick,
  disabled,
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
        fontSize: "16px",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : "0 12px 22px rgba(37, 99, 235, 0.22)",
      }}
    >
      {children}
    </button>
  );
}