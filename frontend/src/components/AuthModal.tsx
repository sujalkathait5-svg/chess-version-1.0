import React, { useState, useEffect, useRef } from "react";
import { X, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { authService } from "../services/authService";

interface AuthModalProps {
  onClose: () => void;
  onSuccess: (user: any) => void;
  closable?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess, closable = true }) => {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [checkVersion, setCheckVersion] = useState(0);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const usernameChecked = checkVersion > 0;
  const usernameStatus: "checking" | "available" | "taken" | null =
    tab === "register" && username
      ? (usernameChecked ? (usernameAvailable ? "available" : "taken") : "checking")
      : null;

  const checkIdRef = useRef(0);
  useEffect(() => {
    if (tab !== "register" || !username) return;
    checkIdRef.current++;
    const id = checkIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        const available = await authService.checkUsername(username);
        if (id === checkIdRef.current) {
          setUsernameAvailable(available);
          setCheckVersion(v => v + 1);
        }
      } catch {
        if (id === checkIdRef.current) {
          setUsernameAvailable(false);
          setCheckVersion(v => v + 1);
        }
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [username, tab]);

  const reqs = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    num: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (loading) return; // Prevent double submit
    setLoading(true);

    try {
      if (tab === "login") {
        if (!username || !password) {
          throw new Error("Please enter all fields");
        }
        const user = await authService.login(username, password, rememberMe);
        onSuccess(user);
        onClose();
      } else {
        if (!username || !password || !confirmPassword) {
          throw new Error("Please enter all fields");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }
        if (usernameStatus === "taken") {
          throw new Error("Username is already taken");
        }
        if (!reqs.length || !reqs.upper || !reqs.lower || !reqs.num || !reqs.special) {
          throw new Error("Password does not meet all requirements");
        }
        if (username.length > 15) {
          throw new Error("Username cannot exceed 15 characters");
        }
        const user = await authService.register(username, password);
        onSuccess(user);
        onClose();
      }
    } catch (err: any) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError("Something went wrong, please try again");
      } else {
        setError(err.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-panel auth-card">
        <div className="modal-header">
          <div className="flex items-center" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={20} className="text-accent" />
            <h2>{tab === "login" ? "Sign In to Arena" : "Join the Arena"}</h2>
          </div>
          {closable && (
            <button className="close-btn flex-center" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab-btn ${tab === "login" ? "active" : ""}`}
              onClick={() => {
                setTab("login");
                setError(null);
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === "register" ? "active" : ""}`}
              onClick={() => {
                setTab("register");
                setError(null);
              }}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="error-banner flex-center">
              <AlertCircle size={16} className="error-icon" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-body">
              <>
                <div className="input-group">
                  <label htmlFor="auth-username">Username</label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      id="auth-username"
                      type="text"
                      placeholder={tab === "register" ? "Max 15 characters" : "Enter username"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      maxLength={15}
                      required
                    />
                  </div>
                  {tab === "register" && username && (
                    <div style={{ fontSize: "11px", marginTop: "2px", color: usernameStatus === "available" ? "#4ade80" : usernameStatus === "taken" ? "#ef4444" : "var(--text-muted)" }}>
                      {usernameStatus === "checking" && "Checking availability..."}
                      {usernameStatus === "available" && "Available"}
                      {usernameStatus === "taken" && "Already taken"}
                    </div>
                  )}
                </div>
              </>

            <div className="input-group">
              <label htmlFor="auth-password">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: "40px" }}
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {tab === "register" && (
                <div className="password-reqs">
                  <div className={reqs.length ? "met" : ""}>• Min 8 chars</div>
                  <div className={reqs.upper ? "met" : ""}>• 1 uppercase</div>
                  <div className={reqs.lower ? "met" : ""}>• 1 lowercase</div>
                  <div className={reqs.num ? "met" : ""}>• 1 number</div>
                  <div className={reqs.special ? "met" : ""}>• 1 special char</div>
                </div>
              )}
            </div>

            {tab === "register" && (
              <div className="input-group">
                <label htmlFor="auth-confirm-password">Confirm Password</label>
                <div className="input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    className="pwd-toggle-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {tab === "login" && (
              <div className="input-group checkbox-group" style={{ marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Remember me
                </label>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner-icon animate-spin" />
                  <span>Please wait...</span>
                </>
              ) : tab === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .auth-card {
          width: 95%;
          max-width: 400px;
          border-radius: 16px;
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .auth-form {
          padding: 24px;
        }

        @media (max-width: 400px) {
          .auth-form {
            padding: 16px;
          }
          .auth-card {
            width: 100%;
            max-width: 100%;
            border-radius: 0;
            min-height: 100dvh;
            overflow-y: auto;
          }
          .modal-overlay {
            align-items: flex-start;
            padding: 0;
          }
          .form-body {
            gap: 12px;
          }
          .password-reqs {
            grid-template-columns: 1fr !important;
          }
        }

        .auth-tabs {
          display: flex;
          border-bottom: 1px solid var(--glass-border);
          margin-bottom: 20px;
        }

        .auth-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          padding: 10px;
          color: var(--text-muted);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .auth-tab-btn.active {
          color: #0052FF;
          border-bottom-color: #0052FF;
        }

        .error-banner {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 18px;
          gap: 8px;
          justify-content: flex-start !important;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .error-icon {
          flex-shrink: 0;
        }

        .form-body {
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-wrap: break-word;
          word-break: break-word;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-group label {
          font-size: 12.5px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 12px;
          color: var(--text-muted);
        }

        .input-wrapper input {
          width: 100%;
          min-width: 0;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--glass-border);
          padding: 10px 12px 10px 38px;
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 13.5px;
          outline: none;
          transition: border-color 0.2s;
        }

        .input-wrapper input:focus {
          border-color: #0052FF;
        }

        .submit-btn {
          background: #0052FF;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
          transition: all 0.2s ease;
        }

        .submit-btn:hover:not(:disabled) {
          background: #0042cc;
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .pwd-toggle-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .pwd-toggle-btn:hover {
          color: var(--text-primary);
        }

        .password-reqs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .password-reqs .met {
          color: #4ade80;
        }

        .checkbox-group input[type="checkbox"] {
          accent-color: #0052FF;
          width: 14px;
          height: 14px;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
