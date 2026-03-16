type SecondaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

export default function SecondaryButton({
  children,
  onClick,
  disabled,
}: SecondaryButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: "#ffffff",
        color: disabled ? "#94a3b8" : "#2563eb",
        border: "1px solid #bfd3ff",
        padding: "14px 22px",
        borderRadius: "16px",
        fontWeight: 800,
        fontSize: "16px",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}