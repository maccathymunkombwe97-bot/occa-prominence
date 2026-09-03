import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Smartphone, 
  HelpCircle, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  User,
  Camera
} from 'lucide-react';
import { UserProfile } from '../types';
import { uploadImageToImgBB } from '../services/imgbbService';
import { TermsPage } from './TermsPage';
import { validatePhone } from '../utils/phone';

interface AuthGateProps {
  onSignInComplete: (profile: UserProfile, token: string) => void;
}

const SECURITY_QUESTIONS = [
  "What is the name of your first school?",
  "What is your mother's maiden name?",
  "What town/city were you born in?",
  "What is the name of your first pet?",
  "What is your favorite book, movie, or band?",
  "What was the make/model of your first car?"
];

// The "manifest" is the enclave's signature visual — a ledger of the exact
// categories Signal clears: Products, services.
const MANIFEST: { tag: string; width: string }[] = [
  { tag: 'Products', width: '72%' },
  { tag: 'Services', width: '46%' },
];

export const AuthGate: React.FC<AuthGateProps> = ({ onSignInComplete }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Inputs
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration extras
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Basic profile — required of every new account (picture + name; bio optional)
  const [regName, setRegName] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regProfilePicUrl, setRegProfilePicUrl] = useState('');
  const [isUploadingRegPic, setIsUploadingRegPic] = useState(false);

  // Forgot Password flow
  const [forgotStep, setForgotStep] = useState<'phone' | 'verify'>('phone');
  const [retrievedQuestion, setRetrievedQuestion] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTerms, setShowTerms] = useState(false);

  const toggleMode = (newMode: 'login' | 'register' | 'forgot') => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setForgotStep('phone');
    setPassword('');
    setNewPassword('');
    setSecurityAnswer('');
    setResetAnswer('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || 'Please enter a valid phone number.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneCheck.e164, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setSuccess('Access verified! Welcome back.');
      setTimeout(() => {
        onSignInComplete(data.profile, data.token);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to login server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRegPic(true);
    setError('');
    try {
      const url = await uploadImageToImgBB(file);
      setRegProfilePicUrl(url);
    } catch (err: any) {
      setError(`Photo upload failed: ${err.message || 'Please try again.'}`);
    } finally {
      setIsUploadingRegPic(false);
      e.target.value = '';
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!regProfilePicUrl) {
      setError('Please upload a profile picture to continue.');
      return;
    }
    if (!regName.trim()) {
      setError('Please enter your name.');
      return;
    }
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || 'Please enter a valid phone number.');
      return;
    }
    if (password.trim().length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    
    const finalQuestion = isCustomQuestion ? customQuestionText.trim() : securityQuestion;
    if (!finalQuestion) {
      setError('Please provide a valid security question.');
      return;
    }
    if (!securityAnswer.trim()) {
      setError('Please provide an answer to your security question.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneCheck.e164,
          password: password.trim(),
          securityQuestion: finalQuestion,
          securityAnswer: securityAnswer.trim(),
          name: regName.trim(),
          bio: regBio.trim(),
          profilePicUrl: regProfilePicUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      setSuccess('Account registered successfully! Loading your setup settings...');
      setTimeout(() => {
        onSignInComplete(data.profile, data.token);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Unable to connect to registration server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordRetrieve = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || 'Please enter a valid phone number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneCheck.e164 }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to retrieve security details.');
      }

      setRetrievedQuestion(data.question);
      setForgotStep('verify');
    } catch (err: any) {
      setError(err.message || 'Phone number not registered.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetAnswer.trim()) {
      setError('Please provide the security answer.');
      return;
    }
    if (newPassword.trim().length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const phoneCheck = validatePhone(phone);
      if (!phoneCheck.valid) {
        setError(phoneCheck.error || 'Please enter a valid phone number.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneCheck.e164,
          answer: resetAnswer.trim(),
          newPassword: newPassword.trim()
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Password update verification failed.');
      }

      setSuccess('Password updated successfully! Welcome.');
      setTimeout(() => {
        onSignInComplete(data.profile, data.token);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showTerms) {
    return <TermsPage onClose={() => setShowTerms(false)} />;
  }

  // Shared field styling — underlined single-line fields read as a ledger
  // form rather than a boxed card; the textarea/select below keep a faint
  // full border since free-form and multi-option fields need a boundary.
  const fieldLabel = "block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2";
  const fieldInput = "w-full bg-transparent border-0 border-b border-neutral-800 pl-7 pr-2 py-3 text-[13.5px] text-white outline-none focus:border-amber-400 transition-colors font-medium placeholder:text-neutral-700";
  const fieldIconPos = "absolute left-0 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none";
  const boxInput = "w-full bg-neutral-950/60 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-amber-400 transition-colors font-medium";

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col lg:flex-row">

      {/* ============ LEFT — hero / manifest panel ============ */}
      <div className="relative overflow-hidden bg-neutral-950 border-b lg:border-b-0 lg:border-r border-neutral-900 px-6 py-8 sm:px-10 sm:py-10 lg:w-[54%] lg:px-14 lg:py-16 flex flex-col justify-between">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 bg-amber-400/[0.06] rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 bg-amber-400/[0.04] rounded-full blur-3xl" />
        {/* ambient scanline sweep */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]">
          <div className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-amber-200 to-transparent animate-scanline" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-10 lg:mb-16">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-4 h-4 stroke-[1.5]" />
            </div>
            <span className="font-mono-brand text-[11px] tracking-[0.2em] text-neutral-400 uppercase">
              OCCA
            </span>
          </div>

          <div className="font-mono-brand text-[10.5px] tracking-[0.25em] text-amber-400/90 uppercase mb-4">
        
          </div>
          <h1 className="font-display font-medium text-[1.65rem] sm:text-3xl lg:text-[2.75rem] leading-[1.15] lg:leading-[1.08] text-neutral-100 max-w-md">
            Welcome to OCCA.
          </h1>
          <p className="mt-5 text-[13px] sm:text-sm text-neutral-500 leading-relaxed max-w-sm">
            The professional market platform for all your products & service...
          </p>
        </div>

        {/* Manifest — desktop only; mobile stays lean so the form loads fast */}
        <div className="relative z-10 mt-10 hidden lg:block">
          <div className="space-y-2.5">
            {MANIFEST.map((row, i) => (
              <div
                key={row.tag}
                className="animate-manifest-in flex items-center gap-3 rounded-lg border border-neutral-900 bg-black/40 px-3.5 py-2.5"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <span className="font-mono-brand text-[10px] text-neutral-600 w-5 shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="font-mono-brand text-[9.5px] tracking-wider text-neutral-400 uppercase shrink-0 w-[78px]">
                  {row.tag}
                </span>
                <span className="h-1.5 rounded-full bg-neutral-800 flex-1" style={{ maxWidth: row.width }} />
                <span className="font-mono-brand text-[9px] tracking-wider text-amber-400/80 uppercase shrink-0">
                  Verified
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-8 lg:mt-16 flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
          </span>
          <span className="font-mono-brand text-[10px] tracking-[0.2em] text-neutral-600 uppercase">
            Enclave status: online
          </span>
        </div>
      </div>

      {/* ============ RIGHT — sign-in panel (no card) ============ */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <div className="font-mono-brand text-[10px] tracking-[0.2em] text-neutral-600 uppercase mb-3">
              products & services Access
            </div>
            <h2 className="font-display font-medium text-2xl sm:text-[1.75rem] text-white">
              {mode === 'register' && 'Create your enclave account'}
              {mode === 'forgot' && 'Reset your access'}
            </h2>
            <p className="mt-2 text-[13px] text-neutral-500">
              {mode === 'login' && 'Enter your credentials to continue.'}
              {mode === 'register' && 'A verified profile is required to post or apply.'}
              {mode === 'forgot' && 'Verify your identity to regain access.'}
            </p>
          </div>

          {/* Feedback notices */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[12.5px] text-red-400 font-medium">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[12.5px] text-emerald-400 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* MODE: LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className={fieldLabel}>Phone Number</label>
                <div className="relative">
                  <Smartphone className={`w-4 h-4 ${fieldIconPos}`} />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+260 977 123 456"
                    className={fieldInput}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Security Password
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleMode('forgot')}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 font-semibold focus:outline-none"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className={`w-4 h-4 ${fieldIconPos}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${fieldInput} pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_30px_-10px_rgba(251,191,36,0.45)] disabled:opacity-50 disabled:shadow-none"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <span className="text-neutral-500 text-[12.5px]">
                  login?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMode('register')}
                  className="text-[12.5px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* MODE: REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="space-y-4 pb-5 border-b border-neutral-900">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <UserCheck className="w-4 h-4" />
                  <span className="font-mono-brand font-bold text-[10.5px] uppercase tracking-wider">Your Profile</span>
                </div>

                {/* Profile Picture */}
                <div className="flex items-center gap-3">
                  {regProfilePicUrl ? (
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border border-neutral-700 shrink-0">
                      <img src={regProfilePicUrl} alt="Profile" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setRegProfilePicUrl('')}
                        className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold transition-opacity"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <label className="w-14 h-14 rounded-full border-2 border-dashed border-neutral-800 hover:border-amber-400 bg-black flex flex-col items-center justify-center text-neutral-400 cursor-pointer shrink-0 transition-colors">
                      {isUploadingRegPic ? (
                        <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-amber-400" />
                          <span className="text-[8px] mt-0.5 text-neutral-400 font-medium">Upload</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleRegProfilePicUpload} className="hidden" disabled={isUploadingRegPic} />
                    </label>
                  )}
                  <div className="text-[10px] text-neutral-500 leading-relaxed">
                    Required for all accounts. Square photo works best.
                  </div>
                </div>

                <div>
                  <label className={fieldLabel}>Your Name</label>
                  <div className="relative">
                    <User className={`w-4 h-4 ${fieldIconPos}`} />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Chilufya Mwenya"
                      className={fieldInput}
                    />
                  </div>
                </div>

                <div>
                  <label className={fieldLabel}>
                    Bio <span className="text-neutral-600 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="A short line about yourself..."
                    className={`${boxInput} resize-none`}
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabel}>Phone Number</label>
                <div className="relative">
                  <Smartphone className={`w-4 h-4 ${fieldIconPos}`} />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+260 977 123 456"
                    className={fieldInput}
                  />
                </div>
                <p className="text-[10px] text-neutral-600 mt-1.5 leading-normal">
                  Include your country code, e.g. +260 97 712 3456. Buyers will reach you on WhatsApp at this number, so make sure it's correct.
                </p>
              </div>

              <div>
                <label className={fieldLabel}>Create Secure Password</label>
                <div className="relative">
                  <Lock className={`w-4 h-4 ${fieldIconPos}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className={`${fieldInput} pr-8`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-neutral-900 pt-5 space-y-4">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <HelpCircle className="w-4 h-4" />
                  <span className="font-mono-brand font-bold text-[10.5px] uppercase tracking-wider">Security Reset Verification</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                      Select a Security Question
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomQuestion(!isCustomQuestion)}
                      className="text-[10px] text-amber-400/90 hover:text-amber-300"
                    >
                      {isCustomQuestion ? 'Select standard question' : 'Write custom question'}
                    </button>
                  </div>

                  {isCustomQuestion ? (
                    <input
                      type="text"
                      required
                      value={customQuestionText}
                      onChange={(e) => setCustomQuestionText(e.target.value)}
                      placeholder="Write your custom question here..."
                      className={boxInput}
                    />
                  ) : (
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className={`${boxInput} cursor-pointer`}
                    >
                      {SECURITY_QUESTIONS.map((q, idx) => (
                        <option key={idx} value={q} className="bg-neutral-900 text-white">
                          {q}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className={fieldLabel}>Your Security Answer</label>
                  <input
                    type="text"
                    required
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Case-insensitive answer (used for recovery)"
                    className={boxInput}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_30px_-10px_rgba(251,191,36,0.45)] disabled:opacity-50 disabled:shadow-none"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Create Account & Verify</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <span className="text-neutral-500 text-[12.5px]">
                  Already have an enclave account?{' '}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMode('login')}
                  className="text-[12.5px] text-amber-400 hover:text-amber-300 font-semibold"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* MODE: FORGOT */}
          {mode === 'forgot' && (
            <div className="space-y-6">
              {forgotStep === 'phone' ? (
                <form onSubmit={handleForgotPasswordRetrieve} className="space-y-6">
                  <div className="px-4 py-3 bg-neutral-950/60 border border-neutral-900 rounded-lg text-neutral-400 leading-relaxed text-[12px]">
                    Provide your registered phone number to load your recovery security question.
                  </div>

                  <div>
                    <label className={fieldLabel}>Your Phone Number</label>
                    <div className="relative">
                      <Smartphone className={`w-4 h-4 ${fieldIconPos}`} />
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. +260977123456"
                        className={fieldInput}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => toggleMode('login')}
                      className="flex-1 py-3 bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold rounded-lg transition-all text-[12.5px] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg uppercase tracking-wider transition-all text-[12.5px] cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Get Question'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleForgotPasswordVerify} className="space-y-6">
                  <div className="px-4 py-3.5 bg-neutral-950/60 border border-neutral-900 rounded-lg space-y-1">
                    <div className="font-mono-brand text-[10px] uppercase font-bold text-amber-400 tracking-wider">Registered Question:</div>
                    <div className="text-white font-semibold text-[13px]">{retrievedQuestion}</div>
                  </div>

                  <div>
                    <label className={fieldLabel}>Your Answer</label>
                    <input
                      type="text"
                      required
                      value={resetAnswer}
                      onChange={(e) => setResetAnswer(e.target.value)}
                      placeholder="Provide the security answer"
                      className={fieldInput}
                    />
                  </div>

                  <div>
                    <label className={fieldLabel}>Choose New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 4 characters"
                      className={fieldInput}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep('phone');
                        setError('');
                      }}
                      className="flex-1 py-3 bg-transparent hover:bg-neutral-900 border border-neutral-800 text-neutral-300 font-semibold rounded-lg transition-all text-[12.5px] cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-lg uppercase tracking-wider transition-all text-[12.5px] cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : 'Reset & Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="text-center pt-6 mt-8 border-t border-neutral-900">
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-[11px] text-neutral-600 hover:text-amber-400 font-medium underline underline-offset-2 transition-colors cursor-pointer"
            >
              Terms &amp; Conditions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
