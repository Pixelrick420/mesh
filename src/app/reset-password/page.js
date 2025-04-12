// reset password page
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { resetPassword } from "../firebase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const canvasRef = useRef(null);

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await resetPassword(email);
      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const navigateToLogin = () => {
    router.push("/login");
  };

  const radius = 11;
  const selectedTheme = {
    background: "#16202A",
    inputBg: "#16202A",
    borderColor: "#92B4F4",
    buttonBg: "#669BBC",
    textColor: "#F1F5F9",
  };

  const colors = ["#92B4F4", "#8CD3C5", "#669BBC", "#16202A"];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const gridSize = Math.min(window.innerWidth, window.innerHeight) * 0.04;
    const rows = Math.ceil(window.innerHeight / gridSize);
    const cols = Math.ceil(window.innerWidth / gridSize);

    canvas.width = cols * gridSize;
    canvas.height = rows * gridSize;

    const gaussian = (x, y, meanX, meanY, stdDev) => {
      const dx = (x - meanX) / stdDev;
      const dy = (y - meanY) / stdDev;
      return Math.exp(-1 * (dx * dx + dy * dy));
    };

    const meanX = cols * 0.5;
    const meanY = rows * 0.5;
    const stdDev = Math.max(cols, rows) * 0.6;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let colorChance = gaussian(x, y, meanX, meanY, stdDev);
        if (
          (x - meanX) * (x - meanX) + (y - meanY) * (y - meanY) <
          radius * radius
        ) {
          colorChance = 1;
        }
        let color =
          Math.random() < colorChance
            ? "#16202A"
            : colors[Math.floor(Math.random() * 3)];

        ctx.fillStyle = color;
        ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
      }
    }

    // Handle window resize
    const handleResize = () => {
      if (canvas) {
        const newGridSize =
          Math.min(window.innerWidth, window.innerHeight) * 0.04;
        const newRows = Math.ceil(window.innerHeight / newGridSize);
        const newCols = Math.ceil(window.innerWidth / newGridSize);

        canvas.width = newCols * newGridSize;
        canvas.height = newRows * newGridSize;

        // Redraw canvas
        const newMeanX = newCols * 0.5;
        const newMeanY = newRows * 0.5;
        const newStdDev = Math.max(newCols, newRows) * 0.6;

        for (let y = 0; y < newRows; y++) {
          for (let x = 0; x < newCols; x++) {
            let colorChance = gaussian(x, y, newMeanX, newMeanY, newStdDev);
            if (
              (x - newMeanX) * (x - newMeanX) +
                (y - newMeanY) * (y - newMeanY) <
              radius * radius
            ) {
              colorChance = 1;
            }
            let color =
              Math.random() < colorChance
                ? "#16202A"
                : colors[Math.floor(Math.random() * 3)];

            ctx.fillStyle = color;
            ctx.fillRect(
              x * newGridSize,
              y * newGridSize,
              newGridSize,
              newGridSize
            );
          }
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      style={{ ...styles.pageStyle, backgroundColor: selectedTheme.inputBg }}>
      <canvas ref={canvasRef} style={styles.canvasStyle} />
      <div style={styles.contentWrapper}>
        <div style={styles.formContainer}>
          <form onSubmit={handleReset} style={styles.formStyle(selectedTheme)}>
            <h2
              style={{
                ...styles.heading(selectedTheme),
                fontFamily: "Jersey 15, sans-serif",
              }}>
              Reset Password
            </h2>

            {error && <p style={styles.errorStyle}>{error}</p>}
            {success && (
              <p style={styles.successStyle}>
                Password reset link sent! Redirecting to login...
              </p>
            )}

            {!success && (
              <>
                <input
                  style={styles.inputStyle(selectedTheme)}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                />

                <button
                  type="submit"
                  style={{
                    ...styles.buttonStyle(selectedTheme),
                    fontFamily: "'Jersey 15', sans-serif",
                  }}>
                  Send Reset Link
                </button>
              </>
            )}

            <div style={styles.linkContainer}>
              <span
                style={{
                  color: selectedTheme.textColor,
                  fontFamily: "monospace",
                }}>
                Back to
              </span>
              <button
                onClick={navigateToLogin}
                style={styles.linkStyle(selectedTheme)}
                type="button">
                Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageStyle: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    position: "relative",
    overflow: "hidden",
  },
  canvasStyle: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    zIndex: 0,
  },
  contentWrapper: {
    display: "flex",
    flexDirection: "row",
    width: "100vw",
    height: "100vh",
    zIndex: 1,
  },
  formContainer: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  formStyle: (theme) => ({
    padding: "clamp(2rem, 2vw, 2rem)",
    width: "100%",
    maxWidth: "clamp(300px, 30vw, 500px)",
    background: theme.inputBg,
    position: "relative",
    zIndex: 10,
  }),
  inputStyle: (theme) => ({
    width: "100%",
    padding: "0.5rem",
    marginBottom: "1rem",
    backgroundColor: "#16202A",
    border: `1px solid ${theme.borderColor}`,
    color: theme.textColor,
    fontFamily: "monospace",
    fontSize: "1rem",
    borderRadius: "0",
    outline: "none",
  }),
  buttonStyle: (theme) => ({
    width: "100%",
    padding: "clamp(0.75rem, 1vw, 1rem)",
    backgroundColor: theme.buttonBg,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    cursor: "pointer",
    fontSize: "clamp(0.9rem, 1.3vw, 1.3rem)",
    borderRadius: "0",
    transition: "background-color 0.3s ease",
    "&:hover": {
      backgroundColor: "#5A8CAA",
    },
  }),
  heading: (theme) => ({
    textAlign: "center",
    color: theme.textColor,
    marginBottom: "2rem",
    fontSize: "clamp(2rem, 2vw, 2rem)",
  }),
  errorStyle: {
    color: "red",
    textAlign: "center",
    marginBottom: "clamp(1rem, 2vw, 2rem)",
    fontSize: "clamp(0.8rem, 1.4vw, 1.1rem)",
    fontFamily: "monospace",
  },
  successStyle: {
    color: "#8CD3C5",
    textAlign: "center",
    marginBottom: "clamp(1rem, 2vw, 2rem)",
    fontFamily: "monospace",
    fontSize: "clamp(0.9rem, 1.4vw, 1.2rem)",
  },
  linkContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginTop: "1rem",
    gap: "0.25rem",
  },
  linkStyle: (theme) => ({
    background: "none",
    border: "none",
    color: theme.borderColor,
    cursor: "pointer",
    fontFamily: "monospace",
    textDecoration: "underline",
    fontSize: "1rem",
    padding: "0",
    margin: "0",
  }),
};
