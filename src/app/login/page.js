// login/page.js
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { login, signInWithGoogle } from "../firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const canvasRef = useRef(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/canvas");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      router.push("/canvas");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleForgotPassword = () => {
    router.push("/reset-password");
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
        if ((x - meanX) ** 2 + (y - meanY) ** 2 < radius ** 2) {
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
  }, []);

  function onNavigateToSignup() {
    router.push("/signup");
  }

  return (
    <div
      style={{ ...styles.pageStyle, backgroundColor: selectedTheme.inputBg }}>
      <canvas ref={canvasRef} style={styles.canvasStyle} />
      <div style={styles.contentWrapper}>
        <div style={styles.formContainer}>
          <form onSubmit={handleLogin} style={styles.formStyle(selectedTheme)}>
            <h2
              style={{
                ...styles.heading(selectedTheme),
                fontFamily: "Jersey 15, sans-serif!important",
                fontWeight: "400",
              }}>
              Login
            </h2>
            {error && <p style={styles.errorStyle}>{error}</p>}
            <input
              style={styles.inputStyle(selectedTheme)}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <input
              style={styles.inputStyle(selectedTheme)}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <div style={styles.resetPasswordContainer}>
              <button
                type="button"
                style={styles.linkStyle(selectedTheme)}
                onClick={handleForgotPassword}>
                Forgot Password?
              </button>
            </div>
            <button
              type="submit"
              style={{
                ...styles.buttonStyle(selectedTheme),
                fontFamily: "'Jersey 15', sans-serif",
              }}>
              Login
            </button>
            <div
              style={{
                ...styles.linkContainer,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                marginTop: "2vh",
              }}>
              <span
                style={{
                  color: selectedTheme.textColor,
                  fontFamily: "monospace",
                }}>
                Don&apos;t have an account?{"  "}
              </span>
              <button
                style={{
                  ...styles.linkStyle(selectedTheme),
                  marginLeft: "1vh",
                }}
                type="button"
                onClick={onNavigateToSignup}>
                Sign Up
              </button>
            </div>
            <div style={styles.dividerContainer}>
              <div style={styles.divider}></div>
              <span style={styles.dividerText}>OR sign in with</span>
              <div style={styles.divider}></div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
              <button type="button" onClick={handleGoogleSignIn}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="30"
                  height="30"
                  viewBox="0 0 48 48">
                  <path
                    fill="#FFC107"
                    d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                  />
                  <path
                    fill="#FF3D00"
                    d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.801 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                  />
                </svg>
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
    flexDirection: "column",
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
  }),
  buttonStyle: (theme) => ({
    width: "100%",
    padding: "clamp(0.75rem, 1vw, 1rem)",
    backgroundColor: theme.buttonBg,
    color: theme.textColor,
    border: `1px solid ${theme.borderColor}`,
    cursor: "pointer",
    transition: "all 0.3s ease",
    fontSize: "clamp(0.9rem, 1.3vw, 1.3rem)",
    borderRadius: "0",
  }),
  errorStyle: {
    color: "red",
    textAlign: "center",
    marginBottom: "clamp(1rem, 2vw, 2rem)",
    fontSize: "clamp(0.7rem, 1.4vw, 1.1rem)",
  },
  heading: (theme) => ({
    textAlign: "center",
    color: theme.textColor,
    marginBottom: "2rem",
    fontSize: "clamp(2rem, 2vw, 2rem)",
  }),
  dividerContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "1rem 0",
  },
  divider: {
    flex: 1,
    height: "1px",
    backgroundColor: "#92B4F4",
  },
  dividerText: {
    margin: "0 1rem",
    color: "#92B4F4",
    fontFamily: "monospace",
  },
  linkStyle: (theme) => ({
    background: "none",
    border: "none",
    color: theme.borderColor,
    cursor: "pointer",
    fontFamily: "monospace",
    textDecoration: "underline",
  }),
  resetPasswordContainer: {
    marginBottom: "1rem",
    textAlign: "right",
  },
  linkContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: "1rem",
  },
};
