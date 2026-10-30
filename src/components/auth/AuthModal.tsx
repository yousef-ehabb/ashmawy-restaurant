import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth, type AuthModalMode } from '@/lib/auth-context';
import logo from '@/assets/ashmawy-logo.png.asset.json';
import {
  LogIn,
  UserPlus,
  ShoppingBag,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  MapPin,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    continueAsGuest,
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
    sendPasswordReset,
    updateProfileData,
    profile,
  } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Complete Profile State
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '');
  const [profileAddress, setProfileAddress] = useState(profile?.defaultAddress || '');

  const resetFormState = () => {
    setError(null);
    setLoading(false);
    setResetSent(false);
  };

  const switchMode = (mode: AuthModalMode) => {
    resetFormState();
    setAuthModalMode(mode);
  };

  // 1. Choice View
  const renderChoiceView = () => (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <img
          src={logo.url}
          alt="شعار عشماوي"
          className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-primary/20 shadow-md"
        />
        <DialogTitle className="mt-4 font-display text-2xl text-primary sm:text-3xl">
          أهلاً بك في عشماوي
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          اختر كيف تفضل متابعة طلبك اليوم:
        </DialogDescription>
      </div>

      <div className="mt-6 grid gap-3">
        {/* Option 1: Sign In */}
        <button
          onClick={() => switchMode('signin')}
          className="group flex items-center justify-between rounded-2xl border-2 border-border bg-card p-4 text-right transition hover:border-primary hover:bg-secondary/40 shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <LogIn className="h-6 w-6" />
            </div>
            <div>
              <p className="font-extrabold text-foreground">تسجيل الدخول</p>
              <p className="text-xs text-muted-foreground">لعملاء عشماوي الحاليين، لطلب أسرع وتتبع فوري</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-[-4px] group-hover:text-primary" />
        </button>

        {/* Option 2: Create Account */}
        <button
          onClick={() => switchMode('register')}
          className="group flex items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-right transition hover:border-primary hover:bg-primary/10 shadow-xs"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <UserPlus className="h-6 w-6" />
            </div>
            <div>
              <p className="font-extrabold text-foreground">إنشاء حساب جديد</p>
              <p className="text-xs text-muted-foreground">احفظ عناوينك وسجل طلباتك واستمتع بتجربة مميزة</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-primary transition group-hover:translate-x-[-4px]" />
        </button>

        {/* Option 3: Continue as Guest */}
        <button
          onClick={continueAsGuest}
          className="group flex items-center justify-between rounded-2xl border border-dashed border-border bg-secondary/30 p-4 text-right transition hover:border-foreground/40 hover:bg-secondary"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground transition group-hover:text-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-foreground">المتابعة كزائر</p>
              <p className="text-xs text-muted-foreground">اطلب الآن مباشرة دون الحاجة لإنشاء حساب</p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-[-4px]" />
        </button>
      </div>

      <div className="mt-4 pt-2 text-center text-xs text-muted-foreground">
        * لن يتم إجبارك أبداً على إنشاء حساب لإتمام طلب وجبتك المفضلة.
      </div>
    </div>
  );

  // 2. Sign In View
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signInEmail.trim() || !signInPassword) {
      setError('يرجى كتابة البريد الإلكتروني وكلمة المرور');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(signInEmail, signInPassword);
    } catch (err: any) {
      let msg = 'تعذر تسجيل الدخول، يرجى التأكد من صحة البيانات.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'تم حظر تسجيل الدخول مؤقتاً بسبب محاولات متكررة. يرجى المحاولة لاحقاً.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, don't show error
        return;
      }
      setError('تعذر تسجيل الدخول عبر Google. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const renderSignInView = () => (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => switchMode('choice')}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> العودة للخيارات
        </button>
      </div>

      <div className="text-center">
        <DialogTitle className="font-display text-2xl text-primary sm:text-3xl">
          تسجيل الدخول
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          أهلاً بعودتك! سجل دخولك لمتابعة طلبك
        </DialogDescription>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card py-3 font-bold text-foreground transition hover:bg-secondary disabled:opacity-60 shadow-xs"
      >
        <GoogleIcon />
        <span>المتابعة باستخدام Google</span>
      </button>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="bg-card px-3 text-xs font-medium text-muted-foreground">أو بالبريد الإلكتروني</span>
      </div>

      <form onSubmit={handleSignIn} className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-bold">البريد الإلكتروني *</label>
          <div className="relative">
            <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              dir="ltr"
              required
              value={signInEmail}
              onChange={(e) => setSignInEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-bold">كلمة المرور *</label>
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="text-xs font-bold text-primary hover:underline"
            >
              نسيت كلمة المرور؟
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              dir="ltr"
              required
              value={signInPassword}
              onChange={(e) => setSignInPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              جاري تسجيل الدخول...
            </>
          ) : (
            'تسجيل الدخول'
          )}
        </button>
      </form>

      <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        ليس لديك حساب بعد؟{' '}
        <button
          onClick={() => switchMode('register')}
          className="font-extrabold text-primary hover:underline"
        >
          إنشاء حساب جديد
        </button>
      </div>
    </div>
  );

  // 3. Register View
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!regName.trim() || regName.trim().length < 2) {
      setError('يرجى كتابة اسمك بالكامل (حرفين على الأقل)');
      return;
    }
    if (!regEmail.trim()) {
      setError('يرجى كتابة البريد الإلكتروني');
      return;
    }
    if (regPassword.length < 6) {
      setError('كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(regName, regEmail, regPassword);
    } catch (err: any) {
      let msg = 'تعذر إنشاء الحساب، يرجى المحاولة مرة أخرى.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'هذا البريد الإلكتروني مسجل بالفعل، يمكنك تسجيل الدخول بدلاً من ذلك.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور ضعيفة للغاية، يرجى اختيار كلمة مرور أقوى.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const renderRegisterView = () => (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => switchMode('choice')}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> العودة للخيارات
        </button>
      </div>

      <div className="text-center">
        <DialogTitle className="font-display text-2xl text-primary sm:text-3xl">
          إنشاء حساب جديد
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          انضم لعائلة عشماوي واطلب وجباتك بسهولة
        </DialogDescription>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign In Option */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card py-3 font-bold text-foreground transition hover:bg-secondary disabled:opacity-60 shadow-xs"
      >
        <GoogleIcon />
        <span>التسجيل السريع باستخدام Google</span>
      </button>

      <div className="relative flex items-center justify-center">
        <div className="w-full border-t border-border" />
        <span className="bg-card px-3 text-xs font-medium text-muted-foreground">أو بالبيانات الشخصية</span>
      </div>

      <form onSubmit={handleRegister} className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold">الاسم بالكامل *</label>
          <div className="relative">
            <UserIcon className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              required
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="اكتب اسمك الثلاثي أو الثنائي"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold">البريد الإلكتروني *</label>
          <div className="relative">
            <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              dir="ltr"
              required
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="mb-1 block text-xs font-bold">كلمة المرور *</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="٦ أحرف فأكثر"
                className="w-full rounded-xl border border-input bg-card py-2 pr-8 pl-2.5 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold">تأكيد كلمة المرور *</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                dir="ltr"
                required
                minLength={6}
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                placeholder="أعد كتابتها"
                className="w-full rounded-xl border border-input bg-card py-2 pr-8 pl-2.5 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              جاري إنشاء الحساب...
            </>
          ) : (
            'إنشاء الحساب والمتابعة'
          )}
        </button>
      </form>

      <div className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
        لديك حساب بالفعل؟{' '}
        <button
          onClick={() => switchMode('signin')}
          className="font-extrabold text-primary hover:underline"
        >
          تسجيل الدخول
        </button>
      </div>
    </div>
  );

  // 4. Forgot Password View
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forgotEmail.trim()) {
      setError('يرجى كتابة البريد الإلكتروني');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(forgotEmail);
      setResetSent(true);
    } catch (err: any) {
      setError('تعذر إرسال رابط الاستعادة، يرجى التأكد من صحة البريد الإلكتروني.');
    } finally {
      setLoading(false);
    }
  };

  const renderForgotView = () => (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => switchMode('signin')}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> العودة لتسجيل الدخول
        </button>
      </div>

      <div className="text-center">
        <DialogTitle className="font-display text-2xl text-primary sm:text-3xl">
          استعادة كلمة المرور
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          اكتب بريدك الإلكتروني المسجل وسنرسل لك رابط إعادة التعيين
        </DialogDescription>
      </div>

      {resetSent ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-2 font-bold text-emerald-600 dark:text-emerald-400">
            تم إرسال رابط استعادة كلمة المرور!
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            تفقد صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam) للبريد: <b>{forgotEmail}</b>
          </p>
          <button
            onClick={() => switchMode('signin')}
            className="mt-4 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground"
          >
            العودة لتسجيل الدخول
          </button>
        </div>
      ) : (
        <form onSubmit={handleForgotPassword} className="space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold">البريد الإلكتروني المسجل *</label>
            <div className="relative">
              <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                dir="ltr"
                required
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-left text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              'إرسال رابط إعادة التعيين'
            )}
          </button>
        </form>
      )}
    </div>
  );

  // 5. Complete Profile View (missing phone or address)
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = profilePhone.replace(/[\s-]/g, '');
    if (!cleanPhone || !/^01[0125]\d{8}$/.test(cleanPhone)) {
      setError('يرجى كتابة رقم موبايل مصري صحيح (مثال: 01012345678)');
      return;
    }

    setLoading(true);
    try {
      await updateProfileData({
        phone: cleanPhone,
        defaultAddress: profileAddress.trim(),
      });
      closeAuthModal();
    } catch (err: any) {
      setError('حدث خطأ في حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const renderCompleteProfileView = () => (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <DialogTitle className="font-display text-2xl text-primary sm:text-3xl">
          بيانات التوصيل والتواصل
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          أكمل رقم هاتفك وعنوانك لتسهيل وصول طلبك إليك بدقة وسرعة
        </DialogDescription>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleCompleteProfile} className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-bold">رقم الموبايل (واتساب / اتصال) *</label>
          <div className="relative">
            <Phone className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="tel"
              inputMode="numeric"
              dir="ltr"
              required
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="01012345678"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-right text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">مطلوب لتأكيد وتتبع طلباتك والتواصل معك</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold">عنوان التوصيل الافتراضي</label>
          <div className="relative">
            <MapPin className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <textarea
              rows={2}
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
              placeholder="اسم المنطقة، الشارع، رقم العمارة والدور (اختياري للاستلام من الفرع)"
              className="w-full rounded-xl border border-input bg-card py-2.5 pr-10 pl-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-extrabold text-primary-foreground shadow-pop transition hover:bg-primary-deep disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              'حفظ ومتابعة الطلب'
            )}
          </button>
          <button
            type="button"
            onClick={closeAuthModal}
            className="rounded-full border border-border bg-card px-5 py-3.5 text-xs font-bold text-muted-foreground hover:bg-secondary"
          >
            تخطي الآن
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <Dialog open={authModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent side="bottom" dir="rtl" className="sm:max-w-md p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader className="sr-only">
          <DialogTitle>بوابة عملاء عشماوي</DialogTitle>
          <DialogDescription>تسجيل الدخول وإنشاء الحساب والمتابعة كزائر</DialogDescription>
        </DialogHeader>

        {authModalMode === 'choice' && renderChoiceView()}
        {authModalMode === 'signin' && renderSignInView()}
        {authModalMode === 'register' && renderRegisterView()}
        {authModalMode === 'forgot' && renderForgotView()}
        {authModalMode === 'complete-profile' && renderCompleteProfileView()}
      </DialogContent>
    </Dialog>
  );
}

