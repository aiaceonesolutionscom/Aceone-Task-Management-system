"use client";

import { useActionState, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { loginAction, type LoginState } from "@/server/actions/auth";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-red-700 font-medium">
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-neutral-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@aceone.com"
          required
          className="w-full px-3.5 py-2.5 text-sm bg-white border-b-2 border-neutral-200 focus:border-[#e91e63] outline-none transition-colors placeholder:text-neutral-400"
        />
        {state.fieldErrors?.email && (
          <p className="text-red-500 text-xs mt-1">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-neutral-800">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border-b-2 border-neutral-200 focus:border-[#e91e63] outline-none transition-colors placeholder:text-neutral-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p className="text-red-500 text-xs mt-1">{state.fieldErrors.password}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 px-4 rounded-lg text-white text-sm font-bold tracking-wide transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
        style={{
          backgroundImage: "linear-gradient(135deg, #e91e63, #9c27b0)",
        }}
      >
        {pending && <Loader2 className="w-4 h-4 animate-spin" />}
        Sign In
      </button>
    </form>
  );
}