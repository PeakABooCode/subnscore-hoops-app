import React, { useState, useEffect } from "react";
import {
  Globe,
  Mail,
  Lock,
  User,
  Activity,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

export default function AuthView({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  handleLocalAuth,
  handleDemoLogin,
  showNotification,
  handleForgotPassword,
  handleResetPassword,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [currentAuthView, setCurrentAuthView] = useState(authMode); // login, register, forgotPassword, resetPassword

  useEffect(() => {
    setCurrentAuthView(authMode);
  }, [authMode]);

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 relative overflow-hidden">
        {/* Decorative Header Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900"></div>

        <div className="flex flex-col items-center mb-10">
          <div className="bg-slate-900 p-3 rounded-2xl mb-4 shadow-lg">
            <Activity className="text-amber-400" size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter text-center flex items-center gap-2">
            {currentAuthView === "forgotPassword" ||
            currentAuthView === "resetPassword" ? (
              <button
                type="button"
                onClick={() => setCurrentAuthView("login")}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
            ) : null}
            {currentAuthView === "login"
              ? "Coach Login"
              : currentAuthView === "register"
                ? "Register Coach"
                : currentAuthView === "forgotPassword"
                  ? "Reset Password"
                  : "Set New Password"}
          </h1>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
            SubNScore Dashboard
          </p>
        </div>

        {currentAuthView === "login" || currentAuthView === "register" ? (
          <form onSubmit={handleLocalAuth} className="space-y-5">
            {currentAuthView === "register" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  Full Name
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    required
                    className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                    placeholder="Coach Name"
                    value={authForm.name}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, name: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                  placeholder="coach@team.com"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                Security Key
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {currentAuthView === "login" && (
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => setCurrentAuthView("forgotPassword")}
                    className="text-slate-400 hover:text-blue-600 text-[9px] font-black uppercase tracking-widest transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            {currentAuthView === "register" && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                  Confirm Security Key
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                    placeholder="••••••••"
                    value={authForm.confirmPassword}
                    onChange={(e) =>
                      setAuthForm({
                        ...authForm,
                        confirmPassword: e.target.value,
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] mt-4"
            >
              {currentAuthView === "login"
                ? "Enter Courtside"
                : "Initialize Account"}
            </button>
          </form>
        ) : currentAuthView === "forgotPassword" ? (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                  placeholder="coach@team.com"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] mt-4"
            >
              Send Reset Link
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                New Security Key
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                Confirm New Security Key
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all font-bold text-slate-700"
                  placeholder="••••••••"
                  value={authForm.confirmPassword}
                  onChange={(e) =>
                    setAuthForm({
                      ...authForm,
                      confirmPassword: e.target.value,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] mt-4"
            >
              Reset Password
            </button>
          </form>
        )}

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-100"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-black">
            <span className="bg-white px-4 text-slate-300">Fast Access</span>
          </div>
        </div>

        <button
          onClick={() => {
            // Use the absolute URL to your backend to avoid proxy issues during OAuth redirect
            const apiUrl =
              import.meta.env.VITE_API_URL || "http://localhost:5000";
            window.location.href = `${apiUrl}/api/auth/google`;
          }}
          className="w-full flex items-center justify-center gap-3 border-2 border-slate-100 py-3.5 rounded-xl font-black text-slate-700 hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-[0.98]"
        >
          <Globe size={18} className="text-red-500" /> Google Login
        </button>
        <p className="mt-4 text-center text-sm">
          <button
            onClick={() =>
              setAuthMode(currentAuthView === "login" ? "register" : "login")
            }
            className="text-blue-600 font-black uppercase text-xs tracking-widest hover:text-blue-700 underline underline-offset-4"
          >
            {currentAuthView === "login"
              ? "Need an account? Register Now"
              : "Have an account? Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
