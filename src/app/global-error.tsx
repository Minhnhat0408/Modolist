"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
            backgroundColor: "#fafafa",
            padding: "1rem",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              padding: "2rem",
              backgroundColor: "#ffffff",
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <AlertCircle
              size={48}
              color="#ef4444"
              style={{ margin: "0 auto 1rem" }}
            />
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              Ứng dụng gặp sự cố
            </h1>
            <p
              style={{
                color: "#6b7280",
                marginBottom: "1.5rem",
                fontSize: "0.95rem",
              }}
            >
              {error.message ||
                "Đã có lỗi nghiêm trọng xảy ra. Vui lòng tải lại trang."}
            </p>
            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  fontFamily: "monospace",
                  backgroundColor: "#f3f4f6",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                  marginBottom: "1rem",
                }}
              >
                Mã lỗi: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.25rem",
                backgroundColor: "#111827",
                color: "#ffffff",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <RefreshCw size={16} />
              Thử lại
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
